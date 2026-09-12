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
  // Prefer the locally installed, up-to-date Chrome. Some commerce CDNs reject
  // the older Chromium build bundled with Playwright. CI can still fall back to
  // the bundled browser when Chrome is unavailable.
  const browser = await chromium
    .launch({ channel: "chrome", headless: true })
    .catch(() => chromium.launch({ headless: true }));

  try {
    const context = await browser.newContext({
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
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
