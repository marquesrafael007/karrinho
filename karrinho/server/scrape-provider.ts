import { scrapeProduct } from "../scripts/scraping";
import { ScrapeError } from "../scripts/scrape-error";
import { createFirecrawlScraper } from "./firecrawl";

export function resolveScrapeProvider(env: {
  SCRAPING_PROVIDER?: string;
  FIRECRAWL_API_KEY?: string;
}) {
  const provider = env.SCRAPING_PROVIDER?.trim().toLowerCase() || "auto";
  if (provider === "auto")
    return env.FIRECRAWL_API_KEY?.trim() ? "firecrawl" : "legacy";
  if (provider === "firecrawl" || provider === "legacy") return provider;
  throw new ScrapeError(
    "SCRAPING_PROVIDER deve ser auto, firecrawl ou legacy.",
    "INVALID_PROVIDER",
    false,
    503,
  );
}

// Read server environment at request time. No key is ever serialized into app data.
export async function scrapeWithProvider(url: string) {
  if (
    resolveScrapeProvider({
      SCRAPING_PROVIDER: process.env.SCRAPING_PROVIDER,
      FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
    }) === "legacy"
  )
    return scrapeProduct(url);
  return createFirecrawlScraper({
    apiKey: process.env.FIRECRAWL_API_KEY ?? "",
  })(url);
}
