import type { SavedProduct } from "../types/product";

export function calculateCartTotal(products: SavedProduct[]): number {
  // 1. Go through every product
  // 2. Convert product.price into a number
  // 3. Use 0 when the price is null or invalid
  // 4. Add all values together
  return products.reduce((total, product) => {
    const price = Number(product.price);

    return total + (Number.isFinite(price) ? price : 0);
  }, 0);
}

export function cartTotals(
  products: SavedProduct[],
): { currency: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const product of products) {
    if (product.status !== "ready" || !product.currency || !product.price)
      continue;
    const price = Number(product.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    totals.set(
      product.currency,
      (totals.get(product.currency) ?? 0) + Math.round(price * 100),
    );
  }
  return [...totals].map(([currency, cents]) => ({
    currency,
    total: cents / 100,
  }));
}
