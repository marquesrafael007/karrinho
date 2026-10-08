import { publicTarget } from "./public-web";
import { ScrapeError } from "./scrape-error";

const BROWSER_TIMEOUT_MS = 35_000;

export type RenderedPage = {
  html: string;
  url: string;
};

function loadPlaywright(): typeof import("playwright") {
  // Playwright is a Node-only runtime dependency. Hiding this require from
  // Metro prevents it from trying to bundle Playwright's browser internals.
  const runtimeRequire = Function(
    "moduleName",
    "const load = globalThis.$$require_external || " +
      "process.getBuiltinModule('module').createRequire(process.cwd() + '/package.json'); " +
      "return load(moduleName);",
  ) as (moduleName: string) => typeof import("playwright");

  return runtimeRequire("playwright");
}

export async function renderProductPage(
  productUrl: string,
): Promise<RenderedPage> {
  await publicTarget(productUrl);
  const { chromium } = loadPlaywright();
  // Prefer the locally installed, up-to-date Chrome. Some commerce CDNs reject
  // the older Chromium build bundled with Playwright. CI can still fall back to
  // the bundled browser when Chrome is unavailable.
  const browser = await chromium
    .launch({ channel: "chrome", headless: true, timeout: 8000 })
    .catch(() => chromium.launch({ headless: true, timeout: 8000 }));

  const deadline = setTimeout(() => {
    void browser.close().catch(() => undefined);
  }, BROWSER_TIMEOUT_MS);

  try {
    const context = await browser.newContext({
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      viewport: { width: 1365, height: 900 },
      serviceWorkers: "block",
      acceptDownloads: false,
    });
    const page = await context.newPage();

    await context.route("**/*", async (route) => {
      if (["font", "media", "image"].includes(route.request().resourceType())) {
        await route.abort();
        return;
      }

      try {
        await publicTarget(route.request().url());
        await route.continue();
      } catch {
        await route.abort().catch(() => undefined);
      }
    });

    await context.routeWebSocket("**/*", (socket) => socket.close());

    const response = await page.goto(productUrl, {
      waitUntil: "domcontentloaded",
      timeout: BROWSER_TIMEOUT_MS,
    });
    if (response && [401, 403, 404, 410, 429].includes(response.status())) {
      throw new ScrapeError(
        "A loja não permitiu consultar este produto. Abra o link ou complete os dados manualmente.",
        `HTTP_${response.status()}`,
        response.status() === 429,
        response.status() === 429 ? 503 : 422,
      );
    }
    if (response && response.status() >= 500) {
      throw new ScrapeError(
        "A loja está temporariamente indisponível.",
        "STORE_UNAVAILABLE",
        true,
        503,
      );
    }

    await page
      .waitForFunction(
        () => {
          // A heading often renders before the offer. Wait for pricing data itself.
          const price = document.querySelector(
            '[itemprop="price"], meta[property="product:price:amount"], [data-testid="price-value"], [data-testid="product-price"], #corePriceDisplay_desktop_feature_div .a-price',
          );
          return (
            Boolean(
              price?.getAttribute("content") || price?.textContent?.match(/\d/),
            ) ||
            [
              ...document.querySelectorAll(
                'script[type="application/ld+json"], script[type="text/mfe-initial-data"]',
              ),
            ].some((script) =>
              /"price"\s*:\s*"?\d/.test(script.textContent ?? ""),
            )
          );
        },
        undefined,
        { timeout: 8000 },
      )
      .catch(() => undefined);

    // Lazy product content is often initialized only after entering the viewport.
    await page.evaluate(() =>
      window.scrollTo(0, Math.min(700, document.body.scrollHeight)),
    );
    await page.waitForTimeout(750);
    await page.evaluate(() => window.scrollTo(0, 0));

    await publicTarget(page.url());
    const html = await page.content();
    if (Buffer.byteLength(html) > 5_000_000)
      throw new ScrapeError(
        "A página excede o tamanho permitido.",
        "PAGE_TOO_LARGE",
        false,
      );
    return {
      html,
      url: page.url(),
    };
  } finally {
    clearTimeout(deadline);
    await browser.close();
  }
}
