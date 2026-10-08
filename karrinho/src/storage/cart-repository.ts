import type { SavedProduct, ScrapedProduct } from "../types/product";
import { normalizeProductUrl } from "../utils/product-url";
import { parsePrice } from "../utils/price";

export const CART_STORAGE_KEY = "@karrinho/products";
type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
};
type Listener = (products: SavedProduct[]) => void;

export function productIsComplete(product: ScrapedProduct): boolean {
  return Boolean(
    product.title?.trim() &&
    product.imageUrl &&
    parsePrice(product.price) &&
    product.currency &&
    /^[A-Z]{3}$/.test(product.currency) &&
    product.confidence >= 0.9,
  );
}

export function createCartRepository(storage: Storage) {
  let writes: Promise<unknown> = Promise.resolve();
  const listeners = new Set<Listener>();
  async function read(): Promise<SavedProduct[]> {
    const raw = await storage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (
      !Array.isArray(data) ||
      data.some(
        (item) =>
          !item || typeof item.id !== "string" || typeof item.url !== "string",
      )
    ) {
      throw new Error(
        "Não foi possível ler o carrinho salvo. Seus dados não foram substituídos.",
      );
    }
    return data.map((item: SavedProduct) => ({
      ...item,
      originalUrl: item.originalUrl ?? item.url,
      status:
        item.status ?? (productIsComplete(item) ? "ready" : "needs_review"),
      attempts: item.attempts ?? 0,
      revision: item.revision ?? 0,
      nextRetryAt: item.nextRetryAt ?? null,
      lastError: item.lastError ?? null,
      updatedAt: item.updatedAt ?? item.savedAt,
      lastCheckedAt: item.lastCheckedAt ?? null,
    }));
  }
  function mutate<T>(
    change: (products: SavedProduct[]) => {
      products: SavedProduct[];
      result: T;
    },
  ): Promise<T> {
    const operation = writes.then(async () => {
      const next = change(await read());
      await storage.setItem(CART_STORAGE_KEY, JSON.stringify(next.products));
      listeners.forEach((listener) => listener(next.products));
      return next.result;
    });
    writes = operation.catch(() => undefined);
    return operation;
  }
  const repository = {
    async list() {
      await writes;
      return read();
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    enqueue(input: string) {
      const url = normalizeProductUrl(input);
      return mutate((products) => {
        const existing = products.find(
          (item) =>
            normalizeProductUrl(item.originalUrl) === url ||
            normalizeProductUrl(item.url) === url,
        );
        if (existing) return { products, result: existing };
        const parsed = new URL(url);
        const now = new Date().toISOString();
        const product: SavedProduct = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
          savedAt: now,
          originalUrl: url,
          url,
          store: parsed.hostname.replace(/^www\./, ""),
          storeName: parsed.hostname.replace(/^www\./, ""),
          title: null,
          description: null,
          imageUrl: null,
          faviconUrl: null,
          price: null,
          currency: null,
          availability: null,
          priceSource: null,
          confidence: 0,
          priceCandidates: [],
          status: "pending",
          attempts: 0,
          revision: 0,
          nextRetryAt: null,
          lastError: null,
          updatedAt: now,
          lastCheckedAt: null,
        };
        return { products: [product, ...products], result: product };
      });
    },
    update(
      id: string,
      patch: Partial<SavedProduct>,
      expectedRevision?: number,
    ) {
      return mutate<SavedProduct | null>((products) => {
        const current = products.find((item) => item.id === id);
        if (
          !current ||
          (expectedRevision !== undefined &&
            current.revision !== expectedRevision)
        )
          return { products, result: null };
        const updated = {
          ...current,
          ...patch,
          id: current.id,
          savedAt: current.savedAt,
          updatedAt: new Date().toISOString(),
        };
        return {
          products: products.map((item) => (item.id === id ? updated : item)),
          result: updated,
        };
      });
    },
    retry(id: string) {
      return mutate((products) => ({
        products: products.map((item) =>
          item.id === id
            ? {
                ...item,
                status: "pending" as const,
                attempts: 0,
                revision: item.revision + 1,
                nextRetryAt: null,
                lastError: null,
              }
            : item,
        ),
        result: undefined,
      }));
    },
    recover() {
      return mutate((products) => ({
        products: products.map((item) =>
          item.status === "processing"
            ? {
                ...item,
                status: "pending" as const,
                attempts: Math.max(0, item.attempts - 1),
                revision: item.revision + 1,
                nextRetryAt: null,
              }
            : item,
        ),
        result: undefined,
      }));
    },
    edit(
      id: string,
      values: { title: string; price: string; currency: string },
    ) {
      const title = values.title.trim();
      const price = parsePrice(values.price);
      const currency = values.currency.trim().toUpperCase();
      if (!title || !price || !/^[A-Z]{3}$/.test(currency))
        throw new Error("Informe nome, preço válido e moeda (ex.: BRL).");
      return mutate((products) => ({
        products: products.map((item) =>
          item.id === id
            ? {
                ...item,
                title,
                price,
                currency,
                priceSource: "manual",
                confidence: 1,
                status: "ready" as const,
                revision: item.revision + 1,
                nextRetryAt: null,
                lastError: null,
                updatedAt: new Date().toISOString(),
              }
            : item,
        ),
        result: undefined,
      }));
    },
    remove(id: string) {
      return mutate((products) => ({
        products: products.filter((item) => item.id !== id),
        result: undefined,
      }));
    },
  };
  return repository;
}
export type CartRepository = ReturnType<typeof createCartRepository>;
