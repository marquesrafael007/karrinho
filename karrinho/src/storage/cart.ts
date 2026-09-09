import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SavedProduct, ScrapedProduct } from "@/types/product";

const CART_STORAGE_KEY = "@karrinho/products";

export async function getCartProducts(): Promise<SavedProduct[]> {
  const storedValue = await AsyncStorage.getItem(CART_STORAGE_KEY);
  if (!storedValue) return [];

  try {
    const products: unknown = JSON.parse(storedValue);
    return Array.isArray(products) ? (products as SavedProduct[]) : [];
  } catch {
    return [];
  }
}

export async function saveCartProduct(
  product: ScrapedProduct,
): Promise<SavedProduct> {
  const products = await getCartProducts();
  const existing = products.find((item) => item.url === product.url);
  const savedProduct: SavedProduct = {
    ...product,
    id:
      existing?.id ??
      `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    savedAt: new Date().toISOString(),
  };
  const nextProducts = existing
    ? products.map((item) =>
        item.id === existing.id ? savedProduct : item,
      )
    : [savedProduct, ...products];

  await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(nextProducts));
  return savedProduct;
}

export async function removeCartProduct(productId: string): Promise<void> {
  const products = await getCartProducts();
  const nextProducts = products.filter((item) => item.id !== productId);
  await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(nextProducts));
}
