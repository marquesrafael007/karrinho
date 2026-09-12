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