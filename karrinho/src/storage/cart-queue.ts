import type { ScrapedProduct } from "../types/product";
import { productIsComplete, type CartRepository } from "./cart-repository";
import { withDeadline } from "../utils/with-deadline";

export class ScrapeRequestError extends Error {
  constructor(
    message: string,
    public retryable = true,
  ) {
    super(message);
  }
}

/** One job at a time, independent of the screen that submitted it. */
export function createCartQueue(
  repository: CartRepository,
  scrape: (url: string, signal: AbortSignal) => Promise<ScrapedProduct>,
  options: {
    retryDelayMs?: number;
    jobTimeoutMs?: number;
    onError?: (error: unknown) => void;
  } = {},
) {
  let running = false;
  let wakeRequested = false;
  let generation = 0;
  let enabled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let unsubscribe: (() => void) | undefined;
  async function drain() {
    if (!enabled) return;
    if (running) {
      wakeRequested = true;
      return;
    }
    running = true;
    wakeRequested = false;
    clearTimeout(timer);
    try {
      while (enabled) {
        const pending = (await repository.list()).filter(
          (item) => item.status === "pending",
        );
        const product = pending.find(
          (item) => !item.nextRetryAt || item.nextRetryAt <= Date.now(),
        );
        if (!product) {
          const times = pending.map((item) => item.nextRetryAt ?? Date.now());
          if (times.length)
            timer = setTimeout(
              () => void drain(),
              Math.max(50, Math.min(...times) - Date.now()),
            );
          break;
        }
        const revision = product.revision + 1;
        const claimed = await repository.update(
          product.id,
          {
            status: "processing",
            revision,
            attempts: product.attempts + 1,
            nextRetryAt: null,
          },
          product.revision,
        );
        if (!claimed) continue;
        controller = new AbortController();
        try {
          const result = await withDeadline(
            (signal) => scrape(product.originalUrl, signal),
            controller.signal,
            options.jobTimeoutMs ?? 75_000,
            new ScrapeRequestError(
              "A consulta demorou demais. O link está salvo; tente novamente ou complete os dados.",
              false,
            ),
          );
          await repository.update(
            product.id,
            {
              ...result,
              status: productIsComplete(result) ? "ready" : "needs_review",
              lastError: productIsComplete(result)
                ? null
                : "Link salvo. Confira ou complete os dados que a loja não informou.",
              lastCheckedAt: new Date().toISOString(),
              nextRetryAt: null,
            },
            revision,
          );
        } catch (error) {
          const interrupted = controller.signal.aborted;
          const retryable =
            !(error instanceof ScrapeRequestError) || error.retryable;
          const retry = retryable && claimed.attempts < 3;
          await repository.update(
            product.id,
            {
              status: interrupted || retry ? "pending" : "needs_review",
              attempts: interrupted ? product.attempts : claimed.attempts,
              lastError:
                error instanceof Error
                  ? error.message
                  : "Não foi possível consultar a loja. O link continua salvo.",
              nextRetryAt:
                retry && !interrupted
                  ? Date.now() +
                    (options.retryDelayMs ?? 5000) * 2 ** (claimed.attempts - 1)
                  : null,
            },
            revision,
          );
        } finally {
          controller = undefined;
        }
      }
    } catch (error) {
      options.onError?.(error);
    } finally {
      running = false;
      if (enabled && wakeRequested) {
        wakeRequested = false;
        void drain();
      }
    }
  }
  return {
    async start() {
      if (enabled) return;
      enabled = true;
      const currentGeneration = ++generation;
      try {
        await repository.recover();
      } catch (error) {
        if (currentGeneration === generation) enabled = false;
        throw error;
      }
      if (!enabled || currentGeneration !== generation) return;
      unsubscribe = repository.subscribe(() => void drain());
      void drain();
    },
    stop() {
      enabled = false;
      generation++;
      unsubscribe?.();
      unsubscribe = undefined;
      clearTimeout(timer);
      controller?.abort();
    },
  };
}
