import assert from "node:assert/strict";
import test from "node:test";
import {
  createCartRepository,
  CART_STORAGE_KEY,
} from "../src/storage/cart-repository";
import { createCartQueue, ScrapeRequestError } from "../src/storage/cart-queue";
import { normalizeProductUrl } from "../src/utils/product-url";
import { parsePrice } from "../src/utils/price";
import { cartTotals } from "../src/utils/cart";
import { isPublicAddress } from "./public-web";
import {
  createScrapeService,
  scrapeErrorResponse,
} from "../server/scrape-service";
import type { ScrapedProduct } from "../src/types/product";
import { createApiServer } from "../server/app";
import { createProductFetcher } from "../src/services/product-client";

function memoryStorage() {
  const entries = new Map<string, string>();
  return {
    entries,
    async getItem(key: string) {
      return entries.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      entries.set(key, value);
    },
  };
}
const fixture: ScrapedProduct = {
  url: "https://loja.example/p/1",
  store: "loja.example",
  storeName: "Loja",
  title: "Produto",
  description: null,
  imageUrl: "https://loja.example/p.jpg",
  faviconUrl: null,
  price: "100.00",
  currency: "BRL",
  availability: null,
  priceSource: "json-ld",
  confidence: 0.98,
  priceCandidates: [],
};
async function eventually(check: () => Promise<boolean>) {
  for (let i = 0; i < 200; i++) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail("Condition did not become true");
}

test("normalizes share text/markdown without losing variant or SKU parameters", () => {
  assert.equal(
    normalizeProductUrl("Veja https://loja.example/p?sku=7&utm_source=share"),
    "https://loja.example/p?sku=7",
  );
  assert.equal(
    normalizeProductUrl(
      "[Produto](https://loja.example/p?variant=2&amp;utm_campaign=x)",
    ),
    "https://loja.example/p?variant=2",
  );
  assert.equal(
    normalizeProductUrl("loja.example/p?sku=8"),
    "https://loja.example/p?sku=8",
  );
  for (const url of [
    "",
    "not a link",
    "file:///etc/passwd",
    "https://user:pass@loja.example",
  ])
    assert.throws(() => normalizeProductUrl(url));
});

test("parses single localized amounts and rejects installment/range strings", () => {
  for (const [raw, expected] of [
    ["R$ 1.299,90", "1299.90"],
    ["1.299", "1299.00"],
    ["1299.9", "1299.90"],
    ["1,299.90", "1299.90"],
  ])
    assert.equal(parsePrice(raw), expected);
  for (const value of [
    "12x R$ 25,00",
    "R$ 10 - R$ 20",
    "-5",
    "NaN",
    "",
    "1.2.34",
  ])
    assert.equal(parsePrice(value), null);
});

test("concurrent additions persist immediately, deduplicate, and preserve variants across restart", async () => {
  const storage = memoryStorage();
  const repo = createCartRepository(storage);
  await Promise.all([
    repo.enqueue("https://loja.example/p?sku=1"),
    repo.enqueue("https://loja.example/p?sku=2"),
    repo.enqueue("https://loja.example/p?sku=1&utm_source=x"),
  ]);
  const reopened = createCartRepository(storage);
  const items = await reopened.list();
  assert.equal(items.length, 2);
  assert(items.every((item) => item.status === "pending"));
});

test("migrates existing cart items and never overwrites corrupted storage", async () => {
  const storage = memoryStorage();
  await storage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify([{ ...fixture, id: "old", savedAt: "2026-01-01" }]),
  );
  const repo = createCartRepository(storage);
  assert.equal((await repo.list())[0].status, "ready");
  await storage.setItem(CART_STORAGE_KEY, "broken-json");
  await assert.rejects(repo.enqueue("https://loja.example/new"));
  assert.equal(await storage.getItem(CART_STORAGE_KEY), "broken-json");
});

test("storage write failure does not report a saved link", async () => {
  const repo = createCartRepository({
    async getItem() {
      return null;
    },
    async setItem() {
      throw new Error("disk full");
    },
  });
  await assert.rejects(repo.enqueue(fixture.url), /disk full/);
});

test("temporary errors retry at most three times and retain the saved URL", async () => {
  const repo = createCartRepository(memoryStorage());
  await repo.enqueue(fixture.url);
  let attempts = 0;
  const queue = createCartQueue(
    repo,
    async () => {
      attempts++;
      throw new ScrapeRequestError("offline");
    },
    { retryDelayMs: 1 },
  );
  await queue.start();
  try {
    await eventually(
      async () => (await repo.list())[0].status === "needs_review",
    );
    assert.equal(attempts, 3);
    assert.equal((await repo.list())[0].originalUrl, fixture.url);
  } finally {
    queue.stop();
  }
});

test("a hung scraper cannot block the queue or overwrite a later manual edit", async () => {
  const repo = createCartRepository(memoryStorage());
  const second = await repo.enqueue("https://loja.example/second");
  const first = await repo.enqueue(fixture.url);
  let finish!: (product: ScrapedProduct) => void;
  const queue = createCartQueue(
    repo,
    async (url) => {
      if (url !== fixture.url) return { ...fixture, url };
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    { jobTimeoutMs: 20 },
  );
  await queue.start();
  try {
    await eventually(
      async () =>
        (await repo.list()).find((p) => p.id === second.id)?.status === "ready",
    );
    const failed = (await repo.list()).find((p) => p.id === first.id)!;
    assert.equal(failed.status, "needs_review");
    assert.equal(failed.attempts, 1);
    assert.match(failed.lastError!, /demorou demais/);
    await repo.edit(first.id, { title: "Manual", price: "9", currency: "BRL" });
    finish(fixture);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(
      (await repo.list()).find((p) => p.id === first.id)?.title,
      "Manual",
    );
  } finally {
    queue.stop();
  }
});

test("unreachable API stops verification quickly even if fetch ignores abort", async () => {
  let requests = 0;
  const fetchProduct = createProductFetcher(
    (path) => `http://api.example${path}`,
    {
      healthTimeoutMs: 10,
      fetch: async () => {
        requests++;
        return new Promise(() => {});
      },
    },
  );
  const repo = createCartRepository(memoryStorage());
  await repo.enqueue(fixture.url);
  const queue = createCartQueue(repo, fetchProduct);
  await queue.start();
  try {
    await eventually(
      async () => (await repo.list())[0].status === "needs_review",
    );
    assert.equal(requests, 1);
    assert.equal((await repo.list())[0].originalUrl, fixture.url);
    assert.match((await repo.list())[0].lastError!, /Sem conexão/);
  } finally {
    queue.stop();
  }
});

test("lookup deadline includes a stalled response body and does not retry automatically", async () => {
  const fetchProduct = createProductFetcher(
    (path) => `http://api.example${path}`,
    {
      requestTimeoutMs: 10,
      fetch: async (input) =>
        String(input).endsWith("/health")
          ? Response.json({ status: "ok" })
          : ({
              ok: true,
              text: () => new Promise(() => {}),
            } as unknown as Response),
    },
  );
  await assert.rejects(
    fetchProduct(fixture.url, new AbortController().signal),
    (error: unknown) =>
      error instanceof ScrapeRequestError &&
      !error.retryable &&
      /demorou demais/.test(error.message),
  );
});

test("product client checks API health, validates data, and strips local metadata", async () => {
  const paths: string[] = [];
  const fetchProduct = createProductFetcher(
    (path) => `http://api.example${path}`,
    {
      fetch: async (input) => {
        paths.push(String(input));
        return String(input).endsWith("/health")
          ? Response.json({ status: "ok" })
          : Response.json({ ...fixture, id: "remote", status: "processing" });
      },
    },
  );
  assert.deepEqual(
    await fetchProduct(fixture.url, new AbortController().signal),
    fixture,
  );
  assert.deepEqual(paths, [
    "http://api.example/health",
    "http://api.example/scrape",
  ]);
});

test("failed health checks never submit a product to the wrong server", async () => {
  for (const response of [
    Response.json({ status: "down" }),
    new Response("Not found", { status: 404 }),
  ]) {
    let calls = 0;
    const fetchProduct = createProductFetcher((path) => path, {
      fetch: async () => {
        calls++;
        return response;
      },
    });
    await assert.rejects(
      fetchProduct(fixture.url, new AbortController().signal),
      (error: unknown) =>
        error instanceof ScrapeRequestError && !error.retryable,
    );
    assert.equal(calls, 1);
  }
});

test("blocked stores stop immediately and can be completed manually", async () => {
  const repo = createCartRepository(memoryStorage());
  const item = await repo.enqueue(fixture.url);
  let attempts = 0;
  const queue = createCartQueue(repo, async () => {
    attempts++;
    throw new ScrapeRequestError("blocked", false);
  });
  await queue.start();
  try {
    await eventually(
      async () => (await repo.list())[0].status === "needs_review",
    );
    assert.equal(attempts, 1);
    await repo.edit(item.id, {
      title: "Produto",
      price: "R$ 1.299,90",
      currency: "BRL",
    });
    assert.equal((await repo.list())[0].price, "1299.90");
    assert.equal((await repo.list())[0].status, "ready");
  } finally {
    queue.stop();
  }
});

test("late scrape results cannot resurrect deleted products or overwrite manual edits", async () => {
  for (const operation of ["delete", "edit"]) {
    const repo = createCartRepository(memoryStorage());
    const item = await repo.enqueue(fixture.url);
    let finish!: (product: ScrapedProduct) => void;
    const queue = createCartQueue(
      repo,
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await queue.start();
    try {
      await eventually(async () => Boolean(finish));
      if (operation === "delete") await repo.remove(item.id);
      else
        await repo.edit(item.id, {
          title: "Meu produto",
          price: "90",
          currency: "BRL",
        });
      finish(fixture);
      await new Promise((resolve) => setTimeout(resolve, 20));
      const products = await repo.list();
      if (operation === "delete") assert.equal(products.length, 0);
      else {
        assert.equal(products[0].price, "90.00");
        assert.equal(products[0].title, "Meu produto");
      }
    } finally {
      queue.stop();
    }
  }
});

test("resumes a job interrupted by an app restart", async () => {
  const storage = memoryStorage();
  const repo = createCartRepository(storage);
  const item = await repo.enqueue(fixture.url);
  await repo.update(item.id, { status: "processing", attempts: 1 });
  const reopened = createCartRepository(storage);
  const queue = createCartQueue(reopened, async () => fixture);
  await queue.start();
  try {
    await eventually(async () => (await reopened.list())[0].status === "ready");
  } finally {
    queue.stop();
  }
});

test("background cancellation resumes without spending a retry attempt", async () => {
  const repo = createCartRepository(memoryStorage());
  await repo.enqueue(fixture.url);
  let calls = 0;
  const queue = createCartQueue(repo, async (_url, signal) => {
    calls++;
    if (calls > 1) return fixture;
    return new Promise((_resolve, reject) =>
      signal.addEventListener("abort", () => reject(new Error("interrupted")), {
        once: true,
      }),
    );
  });
  await queue.start();
  await eventually(async () => calls === 1);
  queue.stop();
  await eventually(async () => (await repo.list())[0].status === "pending");
  assert.equal((await repo.list())[0].attempts, 0);
  await queue.start();
  try {
    await eventually(async () => (await repo.list())[0].status === "ready");
    assert.equal((await repo.list())[0].attempts, 1);
  } finally {
    queue.stop();
  }
});

test("partial products need review and totals keep currencies separate", async () => {
  const repo = createCartRepository(memoryStorage());
  const item = await repo.enqueue(fixture.url);
  const queue = createCartQueue(repo, async () => ({
    ...fixture,
    price: null,
  }));
  await queue.start();
  try {
    await eventually(
      async () => (await repo.list())[0].status === "needs_review",
    );
  } finally {
    queue.stop();
  }
  assert.deepEqual(cartTotals(await repo.list()), []);
  await repo.edit(item.id, {
    title: "Produto BR",
    price: "10.20",
    currency: "BRL",
  });
  const second = await repo.enqueue("https://loja.example/2");
  await repo.edit(second.id, {
    title: "Produto US",
    price: "5.10",
    currency: "USD",
  });
  assert.deepEqual(
    cartTotals(await repo.list()).sort((a, b) =>
      a.currency.localeCompare(b.currency),
    ),
    [
      { currency: "BRL", total: 10.2 },
      { currency: "USD", total: 5.1 },
    ],
  );
});

test("private and local IP addresses are not scrape destinations", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "192.168.0.7",
    "169.254.169.254",
    "100.64.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
  ])
    assert.equal(isPublicAddress(address), false);
  assert.equal(isPublicAddress("8.8.8.8"), true);
});

test("API deduplicates in-flight requests and bounds concurrency", async () => {
  let calls = 0;
  const resolvers: ((product: ScrapedProduct) => void)[] = [];
  const service = createScrapeService(async () => {
    calls++;
    return new Promise((resolve) => resolvers.push(resolve));
  });
  const first = service({ url: fixture.url });
  const duplicate = service({ url: fixture.url });
  const second = service({ url: "https://loja.example/p/2" });
  await assert.rejects(service({ url: "https://loja.example/p/3" }), /ocupado/);
  assert.equal(calls, 2);
  resolvers.forEach((resolve) => resolve(fixture));
  await Promise.all([first, duplicate, second]);
  assert.equal(scrapeErrorResponse(new SyntaxError()).status, 400);
});

test("HTTP API returns JSON for success, invalid input, and oversized bodies", async () => {
  const server = createApiServer(createScrapeService(async () => fixture));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const ok = await fetch(`${base}/scrape`, {
      method: "POST",
      body: JSON.stringify({ url: fixture.url }),
    });
    assert.equal(ok.status, 200);
    assert.equal(((await ok.json()) as ScrapedProduct).price, "100.00");
    for (const [body, status] of [
      ["invalid-json", 400],
      [JSON.stringify({ url: "" }), 400],
      ["x".repeat(33000), 413],
    ] as const) {
      const response = await fetch(`${base}/scrape`, { method: "POST", body });
      assert.equal(response.status, status);
      assert.equal(
        ((await response.json()) as { retryable: boolean }).retryable,
        false,
      );
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
