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

export async function renderProductPage(productUrl: string): Promise<RenderedPage> {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/136.0.0.0 Safari/537.36",
      viewport: { width: 1365, height: 900 },
    });
    const page = await context.newPage();

    await page.route("**/*", async (route) => {
      if (route.request().resourceType() === "font") {
        await route.abort();
        return;
      }

      await route.continue();
    });

    await page.goto(productUrl, {
      waitUntil: "domcontentloaded",
      timeout: BROWSER_TIMEOUT_MS,
    });

    await page
      .waitForLoadState("networkidle", { timeout: 8_000 })
      .catch(() => undefined);

    // Lazy product content is often initialized only after entering the viewport.
    await page.evaluate(() => window.scrollTo(0, Math.min(700, document.body.scrollHeight)));
    await page.waitForTimeout(750);
    await page.evaluate(() => window.scrollTo(0, 0));

    return {
      html: await page.content(),
      url: page.url(),
    };
  } finally {
    await browser.close();
  }
}
