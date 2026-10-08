import assert from "node:assert/strict";
import test from "node:test";
import { createFirecrawlScraper } from "../server/firecrawl";
import { resolveScrapeProvider } from "../server/scrape-provider";
import {
  createScrapeService,
  scrapeErrorResponse,
} from "../server/scrape-service";
import { publicTarget } from "./public-web";
import { productIsComplete } from "../src/storage/cart-repository";
import { ScrapeError } from "./scrape-error";

const url = "https://loja.example/p?sku=7";
const key = "test-key-never-expose";
const html = `<html><head><meta property="og:site_name" content="Loja"><script type="application/ld+json">${JSON.stringify(
  {
    "@type": "Product",
    name: "Produto",
    image: "/photo.png",
    url,
    offers: { "@type": "Offer", price: "129.90", priceCurrency: "BRL", url },
  },
)}</script></head><body><h1>Produto</h1></body></html>`;
const json = {
  isProductPage: true,
  title: "Produto IA",
  price: "R$ 99,90",
  currency: "BRL",
  priceType: "total",
  imageUrl: "/image.png",
  storeName: "Loja IA",
};
const validateUrl: typeof publicTarget = async (input) => {
  const parsed = new URL(input);
  assert(
    ["http:", "https:"].includes(parsed.protocol) &&
      parsed.hostname === "loja.example" &&
      !parsed.username &&
      !parsed.password,
  );
  return { url: parsed, addresses: [{ address: "8.8.8.8", family: 4 }] };
};
function scraper(data: unknown) {
  return createFirecrawlScraper({
    apiKey: key,
    validateUrl,
    fetch: async () => Response.json({ success: true, data }),
  });
}

test("Firecrawl provider selection preserves legacy until a server key is configured", () => {
  assert.equal(resolveScrapeProvider({}), "legacy");
  assert.equal(resolveScrapeProvider({ FIRECRAWL_API_KEY: "  " }), "legacy");
  assert.equal(resolveScrapeProvider({ FIRECRAWL_API_KEY: key }), "firecrawl");
  assert.equal(
    resolveScrapeProvider({
      SCRAPING_PROVIDER: "legacy",
      FIRECRAWL_API_KEY: key,
    }),
    "legacy",
  );
  assert.equal(
    resolveScrapeProvider({ SCRAPING_PROVIDER: "firecrawl" }),
    "firecrawl",
  );
  assert.throws(
    () => resolveScrapeProvider({ SCRAPING_PROVIDER: "typo" }),
    /SCRAPING_PROVIDER/,
  );
});

test("Firecrawl sends a bounded v2 request, preserves SKU and never exposes credentials", async () => {
  const scrape = createFirecrawlScraper({
    apiKey: key,
    validateUrl,
    fetch: async (endpoint, init) => {
      assert.equal(endpoint, "https://api.firecrawl.dev/v2/scrape");
      assert.equal(
        new Headers(init?.headers).get("Authorization"),
        `Bearer ${key}`,
      );
      assert.equal(init?.redirect, "error");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.url, url);
      assert.equal(body.maxAge, 0);
      assert.equal(body.storeInCache, false);
      assert.equal(body.skipTlsVerification, false);
      assert.equal(body.timeout, 45000);
      assert.equal(body.formats[0], "rawHtml");
      assert.equal(body.formats[1].type, "json");
      assert(body.formats[1].schema.properties.priceType);
      return Response.json({
        success: true,
        data: { rawHtml: html, json, metadata: { sourceURL: url } },
      });
    },
  });
  const product = await scrape(`${url}&utm_source=test`);
  assert.equal(product.url, url);
  assert.equal(product.price, "129.90");
  assert.equal(product.imageUrl, "https://loja.example/photo.png");
  assert.match(product.priceSource!, /^firecrawl:/);
  assert(productIsComplete(product));
  assert(!JSON.stringify(product).includes(key));
});

test("AI-only product fields are usable but prices require review", async () => {
  const product = await scraper({ json })(url);
  assert.equal(product.title, "Produto IA");
  assert.equal(product.storeName, "Loja IA");
  assert.equal(product.price, "99.90");
  assert.equal(product.currency, "BRL");
  assert.equal(product.priceSource, "firecrawl:json");
  assert.equal(product.confidence, 0.75);
  assert.equal(productIsComplete(product), false);
});

test("Firecrawl never promotes installment, range or missing-currency AI prices", async () => {
  for (const patch of [
    { priceType: "installment" },
    { priceType: "range" },
    { price: "12x R$ 9,90" },
    { currency: "$" },
    { currency: null },
    { price: -10 },
  ])
    assert.equal(
      (await scraper({ json: { ...json, ...patch } })(url)).price,
      null,
    );
});

test("Firecrawl preserves useful partial data and rejects blocked/invalid pages", async () => {
  const product = await scraper({ json: { ...json, price: null } })(url);
  assert.equal(product.title, "Produto IA");
  assert.equal(product.price, null);
  for (const data of [
    {},
    { rawHtml: "<title>Access denied</title>", json },
    { json, metadata: { statusCode: 403 } },
    { rawHtml: "<title>Loja</title>", json: { isProductPage: false } },
  ])
    await assert.rejects(scraper(data)(url));
});

test("Firecrawl rejects private input before external calls and sanitizes image URLs", async () => {
  let called = false;
  const scrape = createFirecrawlScraper({
    apiKey: key,
    fetch: async () => {
      called = true;
      throw new Error();
    },
  });
  await assert.rejects(scrape("http://127.0.0.1/p"));
  assert.equal(called, false);
  const product = await scraper({
    json: {
      ...json,
      imageUrl: "http://127.0.0.1/image",
      faviconUrl: "javascript:alert(1)",
    },
  })(url);
  assert.equal(product.imageUrl, null);
  assert.equal(product.faviconUrl, null);
  await assert.rejects(
    scraper({ json, metadata: { url: "http://127.0.0.1/private" } })(url),
  );
});

test("missing keys and provider errors are actionable and never automatically retried", async () => {
  await assert.rejects(
    createFirecrawlScraper({ apiKey: "" })(url),
    /FIRECRAWL_API_KEY/,
  );
  for (const [status, code] of [
    [401, "FIRECRAWL_AUTH"],
    [403, "FIRECRAWL_AUTH"],
    [402, "FIRECRAWL_CREDITS"],
    [429, "FIRECRAWL_RATE_LIMIT"],
    [500, "FIRECRAWL_UNAVAILABLE"],
  ] as const) {
    const scrape = createFirecrawlScraper({
      apiKey: key,
      validateUrl,
      fetch: async () => new Response(key, { status }),
    });
    await assert.rejects(scrape(url), (error: unknown) => {
      assert(error instanceof ScrapeError);
      assert.equal(error.code, code);
      assert.equal(error.retryable, false);
      assert(!JSON.stringify(scrapeErrorResponse(error)).includes(key));
      return true;
    });
  }
});

test("Firecrawl malformed and oversized responses are rejected without leaking their contents", async () => {
  for (const body of [
    key,
    JSON.stringify({ success: false, error: key }),
    "x".repeat(6_000_001),
  ]) {
    const scrape = createFirecrawlScraper({
      apiKey: key,
      validateUrl,
      fetch: async () => new Response(body),
    });
    await assert.rejects(scrape(url), (error: unknown) => {
      assert(error instanceof ScrapeError && !error.retryable);
      assert(!error.message.includes(key));
      return true;
    });
  }
});

test("a hanging Firecrawl body times out and releases the service concurrency slot", async () => {
  const scrape = createFirecrawlScraper({
    apiKey: key,
    validateUrl,
    timeoutMs: 10,
    fetch: async () => new Response(new ReadableStream({ start() {} })),
  });
  const service = createScrapeService(scrape);
  for (let attempt = 0; attempt < 3; attempt++) {
    await assert.rejects(
      service({ url }),
      (error: unknown) =>
        error instanceof ScrapeError &&
        error.code === "FIRECRAWL_TIMEOUT" &&
        !error.retryable,
    );
  }
});
