/** Run after `expo export --platform web --output-dir <dir>`; uses an isolated browser and mocked store responses. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { chromium } from "playwright";

async function main() {
  const root = resolve(process.argv[2] ?? "dist");
  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    const file =
      path === "/"
        ? `${root}/server/index.html`
        : path === "/cart"
          ? `${root}/server/cart.html`
          : resolve(root, `client/.${path}`);
    if (!file.startsWith(`${root}/`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const contents = await readFile(file);
      const types: Record<string, string> = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".wasm": "application/wasm",
        ".ttf": "font/ttf",
        ".png": "image/png",
      };
      response
        .writeHead(200, {
          "Content-Type": types[extname(file)] ?? "application/octet-stream",
        })
        .end(contents);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
      console.error(error.message);
    });
    async function checkLayout(name: string) {
      const viewport = page.viewportSize()!;
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `${name}: horizontal overflow`,
      );
      const navigation = await page
        .getByRole("tab", { name: "Carrinho", exact: true })
        .boundingBox();
      assert(
        navigation &&
          navigation.width >= 48 &&
          navigation.height >= 48 &&
          navigation.x >= 0 &&
          navigation.x + navigation.width <= viewport.width &&
          navigation.y >= 0 &&
          navigation.y + navigation.height <= viewport.height,
        `${name}: navigation outside viewport`,
      );
      await page.screenshot({
        path: `/private/tmp/karrinho-reacticx-${name}.png`,
        fullPage: true,
      });
    }
    // An image fixture exercises loaded product photos without calling a live store.
    await page.route("https://loja.example/image.png", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><path d="M75 166v-27a75 75 0 0 1 150 0v27" fill="none" stroke="#39413d" stroke-width="25" stroke-linecap="round"/><rect x="49" y="147" width="54" height="95" rx="24" fill="#535e57"/><rect x="197" y="147" width="54" height="95" rx="24" fill="#535e57"/><rect x="84" y="159" width="19" height="73" rx="9" fill="#28312c"/><rect x="197" y="159" width="19" height="73" rx="9" fill="#28312c"/></svg>',
      }),
    );
    let apiOffline = false;
    await page.route("**/health", (route) =>
      apiOffline
        ? route.abort("failed")
        : route.fulfill({
            contentType: "application/json",
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ status: "ok" }),
          }),
    );
    await page.route("**/scrape", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "POST",
          },
        });
        return;
      }
      const { url } = route.request().postDataJSON() as { url: string };
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const headers = {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      };
      if (url.includes("/blocked")) {
        await route.fulfill({
          status: 422,
          headers,
          body: JSON.stringify({
            error: "A loja bloqueou a consulta automática.",
            code: "STORE_BLOCKED",
            retryable: false,
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify({
            url,
            store: "loja.example",
            storeName: "Loja de teste",
            title: "Produto de teste",
            description: null,
            imageUrl: "https://loja.example/image.png",
            faviconUrl: null,
            price: "100.00",
            currency: "BRL",
            availability: null,
            confidence: 0.98,
            priceSource: "json-ld",
            priceCandidates: [],
          }),
        });
      }
    });
    await page.goto(`http://127.0.0.1:${address.port}`);
    await page.getByRole("textbox", { name: "Link do produto" }).waitFor();
    await page
      .getByRole("tab", { name: "Início", exact: true, selected: true })
      .waitFor();
    await page.evaluate(() => document.fonts.ready);
    await checkLayout("home-mobile");
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.getByRole("button", { name: "Usar tema claro" }).waitFor();
    await checkLayout("home-system-dark");
    await page.emulateMedia({
      colorScheme: "light",
      reducedMotion: "no-preference",
    });
    await page.getByRole("button", { name: "Usar tema escuro" }).waitFor();
    await page.getByRole("tab", { name: "Carrinho", exact: true }).click();
    await page
      .getByRole("tab", { name: "Carrinho", exact: true, selected: true })
      .waitFor();
    await page
      .getByRole("button", { name: /Adicionar primeiro produto/ })
      .waitFor();
    await checkLayout("cart-empty");
    await page.getByRole("tab", { name: "Início", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Link do produto" })
      .fill("https://loja.example/p/1");
    await page
      .getByRole("button", { name: "Adicionar produto", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Ver produto salvo no carrinho" })
      .waitFor();
    await checkLayout("home-saved");
    assert.equal(
      await page.getByRole("textbox", { name: "Link do produto" }).inputValue(),
      "",
    );
    await page
      .getByRole("textbox", { name: "Link do produto" })
      .fill("https://loja.example/blocked");
    await page
      .getByRole("button", { name: "Adicionar produto", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Ver produto salvo no carrinho" })
      .click();
    await page
      .getByTestId(/^product-/)
      .getByText("Produto de teste", { exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Tentar novamente", exact: true })
      .waitFor()
      .catch(async (error) => {
        console.log(await page.locator("body").innerText());
        await page.screenshot({
          path: "/private/tmp/karrinho-reacticx-failure.png",
          fullPage: true,
        });
        throw error;
      });
    await checkLayout("cart-review");
    assert.equal(
      await page.getByRole("button", { name: "Editar", exact: true }).count(),
      2,
    );
    await page.reload();
    await page
      .getByRole("button", { name: "Tentar novamente", exact: true })
      .waitFor();
    const pendingCard = page
      .getByTestId(/^product-/)
      .filter({ has: page.getByText("Produto salvo", { exact: true }) });
    await pendingCard
      .getByRole("button", { name: "Editar", exact: true })
      .click();
    await page.getByRole("textbox", { name: "Nome do produto" }).waitFor();
    await page.screenshot({
      path: "/private/tmp/karrinho-reacticx-editor.png",
      fullPage: true,
    });
    await page
      .getByRole("textbox", { name: "Nome do produto" })
      .fill("Produto revisado");
    await page.getByRole("textbox", { name: "Preço total" }).fill("25,50");
    await page
      .getByRole("button", { name: "Salvar dados", exact: true })
      .click();
    await page
      .getByTestId(/^product-/)
      .getByText("Produto revisado", { exact: true })
      .waitFor();
    assert.match(await page.locator("body").innerText(), /125,50/);
    await page.getByRole("tab", { name: "Todos", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await page
      .getByRole("tab", { name: "A conferir", exact: true, selected: true })
      .waitFor();
    await page.getByText("Tudo conferido.", { exact: true }).waitFor();
    await page.keyboard.press("ArrowLeft");
    await page
      .getByRole("tab", { name: "Todos", exact: true, selected: true })
      .waitFor();
    await page
      .getByTestId(/^product-/)
      .getByText("Produto revisado", { exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Usar tema escuro" }).click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    await checkLayout("cart-dark");
    await page.getByRole("button", { name: "Usar tema claro" }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await checkLayout("cart-desktop");
    await page.getByRole("tab", { name: "Início", exact: true }).click();
    await page.getByRole("textbox", { name: "Link do produto" }).waitFor();
    await checkLayout("home-desktop");
    await page.setViewportSize({ width: 840, height: 1000 });
    await checkLayout("home-tablet");
    assert(
      (await page.getByRole("heading").first().boundingBox())!.height <= 160,
      "Tablet heading should remain two lines",
    );
    await page.setViewportSize({ width: 320, height: 740 });
    await checkLayout("home-narrow");
    assert(
      (await page.getByRole("heading").first().boundingBox())!.height <= 100,
      "Narrow heading should remain two lines",
    );
    await page.getByRole("tab", { name: "Carrinho", exact: true }).click();
    await page
      .getByTestId(/^product-/)
      .getByText("Produto revisado", { exact: true })
      .waitFor();
    await checkLayout("cart-narrow");
    await page
      .getByRole("button", { name: "Editar", exact: true })
      .first()
      .click();
    await page.getByRole("textbox", { name: "Nome do produto" }).waitFor();
    await page.screenshot({
      path: "/private/tmp/karrinho-reacticx-editor-narrow.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await page.screenshot({
      path: "/private/tmp/karrinho-cart-verified.png",
      fullPage: true,
    });
    // 200% web text-size check; native Dynamic Type still needs device verification.
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.evaluate(() => {
      document
        .querySelectorAll<HTMLElement>("div[dir], input")
        .forEach((element) => {
          if (
            element.tagName === "INPUT" ||
            (element.childNodes.length > 0 &&
              [...element.childNodes].every(
                (node) => node.nodeType === Node.TEXT_NODE,
              ))
          ) {
            const fontSize = parseFloat(getComputedStyle(element).fontSize);
            if (fontSize > 0) {
              element.style.fontSize = fontSize * 2 + "px";
              element.style.lineHeight = "1.35";
            }
          }
        });
    });
    await checkLayout("cart-large-text");
    await page.reload();
    await page
      .getByRole("button", { name: "Editar", exact: true })
      .first()
      .waitFor();
    await page.emulateMedia({ reducedMotion: "reduce" });
    const themeButton = page.getByRole("button", { name: "Usar tema escuro" });
    const themeBox = await themeButton.boundingBox();
    assert(themeBox);
    await page.mouse.move(
      themeBox.x + themeBox.width / 2,
      themeBox.y + themeBox.height / 2,
    );
    await page.mouse.down();
    await page.waitForFunction(() => {
      const element = document.querySelector('[aria-label="Usar tema escuro"]');
      const transform = element && getComputedStyle(element).transform;
      return transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)";
    });
    await page.mouse.up();
    await page.getByRole("button", { name: "Usar tema claro" }).waitFor();
    await checkLayout("cart-reduced-motion");
    // Offline API must stop the spinner, preserve the link, and allow recovery.
    apiOffline = true;
    await page.getByRole("tab", { name: "Início", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Link do produto" })
      .fill("https://loja.example/offline");
    await page
      .getByRole("button", { name: "Adicionar produto", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Ver produto salvo no carrinho" })
      .click();
    const offlineCard = page
      .getByTestId(/^product-/)
      .filter({ hasText: "Sem conexão com o servidor" });
    await offlineCard
      .getByRole("button", { name: "Tentar novamente", exact: true })
      .waitFor();
    const offlineId = await offlineCard.getAttribute("data-testid");
    assert(offlineId);
    assert.equal(await page.getByTestId(/^product-/).count(), 3);
    apiOffline = false;
    await offlineCard
      .getByRole("button", { name: "Tentar novamente", exact: true })
      .click();
    await page
      .getByTestId(offlineId)
      .getByText("Dados encontrados", { exact: true })
      .waitFor();
    // Home shows only four recent items, in two rows, before the composer.
    await page.getByRole("tab", { name: "Início", exact: true }).click();
    for (const suffix of ["fourth", "fifth"]) {
      await page
        .getByRole("textbox", { name: "Link do produto" })
        .fill(`https://loja.example/${suffix}`);
      await page
        .getByRole("button", { name: "Adicionar produto", exact: true })
        .click();
      await page.waitForFunction(
        () =>
          (
            document.querySelector(
              '[aria-label="Link do produto"]',
            ) as HTMLInputElement
          )?.value === "",
      );
    }
    await page.waitForFunction(() => {
      const grid = document.querySelector('[data-testid="recent-grid"]');
      return grid && !/buscando dados|na fila/.test(grid.textContent ?? "");
    });
    for (const width of [390, 320, 840]) {
      await page.setViewportSize({ width, height: 1000 });
      await page
        .getByRole("heading", { name: "Recentes", exact: true })
        .scrollIntoViewIfNeeded();
      const visibleGrid = page.locator('[data-testid="recent-grid"]:visible');
      const cells = await visibleGrid.getByTestId("recent-cell").all();
      assert.equal(cells.length, 4);
      const boxes = await Promise.all(cells.map((cell) => cell.boundingBox()));
      const [a, b, c, d] = boxes;
      assert(a && b && c && d);
      assert(
        Math.abs(a.y - b.y) < 2 && Math.abs(c.y - d.y) < 2,
        "Two cards per row",
      );
      assert(
        b.x >= a.x + a.width && d.x >= c.x + c.width,
        "Grid columns must not overlap",
      );
      assert(c.y >= a.y + a.height, "Second row must follow first row");
      const grid = await visibleGrid.boundingBox();
      const composer = await page
        .locator('[data-testid="home-composer"]:visible')
        .boundingBox();
      assert(
        grid && composer && composer.y >= grid.y + grid.height,
        "Input must be below Recent",
      );
      await checkLayout(`home-grid-${width}`);
      await page
        .locator('[data-testid="home-composer"]:visible')
        .scrollIntoViewIfNeeded();
      const inputBox = await page
        .getByRole("textbox", { name: "Link do produto" })
        .boundingBox();
      const navBox = await page
        .getByRole("tab", { name: "Início", exact: true })
        .boundingBox();
      assert(
        inputBox && navBox && inputBox.y + inputBox.height <= navBox.y,
        "Input must scroll clear of bottom navigation",
      );
      await checkLayout(`home-grid-input-${width}`);
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: save queue, offline API recovery, blocked-store review, persistence, editing, totals, review filter, system/manual themes, and responsive layouts at 320, 390, 840 and 1440px.",
    );
  } finally {
    await browser?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
