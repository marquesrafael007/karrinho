import type { ScrapedProduct } from "../types/product";
import { ScrapeRequestError } from "../storage/cart-queue";
import { withDeadline } from "../utils/with-deadline";

function isProduct(value: unknown): value is ScrapedProduct {
  if (!value || typeof value !== "object") return false;
  const product = value as ScrapedProduct;
  return (
    typeof product.url === "string" &&
    /^https?:\/\//.test(product.url) &&
    typeof product.store === "string" &&
    typeof product.storeName === "string" &&
    [
      "title",
      "description",
      "imageUrl",
      "faviconUrl",
      "currency",
      "availability",
      "priceSource",
    ].every(
      (key) =>
        product[key as keyof ScrapedProduct] === null ||
        typeof product[key as keyof ScrapedProduct] === "string",
    ) &&
    (product.price === null ||
      (typeof product.price === "string" &&
        /^\d+\.\d{2}$/.test(product.price))) &&
    typeof product.confidence === "number" &&
    Number.isFinite(product.confidence) &&
    Array.isArray(product.priceCandidates)
  );
}

export function createProductFetcher(
  apiUrl: (path: string) => string,
  options: {
    fetch?: typeof fetch;
    healthTimeoutMs?: number;
    requestTimeoutMs?: number;
  } = {},
) {
  const request = options.fetch ?? fetch;
  return async function fetchProduct(
    url: string,
    signal: AbortSignal,
  ): Promise<ScrapedProduct> {
    // Check connectivity separately: a dead API should not consume a full store lookup.
    const connectionError = new ScrapeRequestError(
      "Sem conexão com o servidor. Verifique se a API está ligada e se o endereço está correto. O link continua salvo; use Tentar novamente após reconectar.",
      false,
    );
    try {
      await withDeadline(
        async (requestSignal) => {
          const response = await request(apiUrl("/health"), {
            signal: requestSignal,
          });
          const body = await response.json();
          if (!response.ok || body?.status !== "ok") throw connectionError;
        },
        signal,
        options.healthTimeoutMs ?? 4_000,
        connectionError,
      );
    } catch {
      throw connectionError;
    }

    return withDeadline(
      async (requestSignal) => {
        try {
          const response = await request(apiUrl("/scrape"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
            signal: requestSignal,
          });
          let result: unknown;
          try {
            result = JSON.parse(await response.text());
          } catch {
            throw new ScrapeRequestError(
              "O servidor retornou uma resposta inválida. O link está salvo.",
              false,
            );
          }
          if (!response.ok) {
            const error = result as {
              error?: string;
              retryable?: boolean;
            } | null;
            throw new ScrapeRequestError(
              error?.error ?? "Não foi possível consultar a loja.",
              error?.retryable ??
                (response.status >= 500 || response.status === 429),
            );
          }
          if (!isProduct(result))
            throw new ScrapeRequestError(
              "Os dados recebidos estão incompletos ou inválidos.",
              false,
            );
          // Server responses cannot overwrite local job/id metadata.
          return {
            url: result.url,
            store: result.store,
            storeName: result.storeName,
            title: result.title,
            description: result.description,
            imageUrl: result.imageUrl,
            faviconUrl: result.faviconUrl,
            price: result.price,
            currency: result.currency,
            availability: result.availability,
            priceSource: result.priceSource,
            confidence: result.confidence,
            priceCandidates: result.priceCandidates,
          };
        } catch (error) {
          if (error instanceof ScrapeRequestError) throw error;
          throw connectionError;
        }
      },
      signal,
      options.requestTimeoutMs ?? 70_000,
      new ScrapeRequestError(
        "A consulta demorou demais. O link está salvo; tente novamente ou complete os dados.",
        false,
      ),
    );
  };
}
