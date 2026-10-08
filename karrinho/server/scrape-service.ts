import { scrapeWithProvider } from "./scrape-provider";
import { ScrapeError } from "../scripts/scrape-error";
import { normalizeProductUrl } from "../src/utils/product-url";
import type { ScrapedProduct } from "../src/types/product";

/** Bounded browser concurrency and deduplication across overlapping requests. */
export function createScrapeService(scrape = scrapeWithProvider) {
  const jobs = new Map<string, Promise<ScrapedProduct>>();
  return async (body: unknown) => {
    if (
      !body ||
      typeof body !== "object" ||
      !("url" in body) ||
      typeof body.url !== "string"
    ) {
      throw new ScrapeError(
        "Informe um link de produto.",
        "INVALID_URL",
        false,
        400,
      );
    }
    let url: string;
    try {
      url = normalizeProductUrl(body.url);
    } catch (error) {
      throw new ScrapeError(
        (error as Error).message,
        "INVALID_URL",
        false,
        400,
      );
    }
    const existing = jobs.get(url);
    if (existing) return existing;
    if (jobs.size >= 2)
      throw new ScrapeError(
        "O servidor está ocupado. A consulta será tentada novamente.",
        "BUSY",
        true,
        503,
      );
    const job = Promise.resolve().then(() => scrape(url));
    jobs.set(url, job);
    try {
      return await job;
    } finally {
      jobs.delete(url);
    }
  };
}

export const scrapeRequest = createScrapeService();

export function scrapeErrorResponse(error: unknown) {
  if (error instanceof ScrapeError)
    return {
      status: error.status,
      body: {
        error: error.message,
        code: error.code,
        retryable: error.retryable,
      },
    };
  if (error instanceof SyntaxError)
    return {
      status: 400,
      body: {
        error: "Envie um JSON válido com o link do produto.",
        code: "INVALID_JSON",
        retryable: false,
      },
    };
  return {
    status: 503,
    body: {
      error:
        "Não foi possível consultar a loja agora. Seu link continua salvo.",
      code: "UNAVAILABLE",
      retryable: true,
    },
  };
}
