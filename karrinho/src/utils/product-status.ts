import type { SavedProduct } from "../types/product";

export function productStatus(product: SavedProduct): string {
  switch (product.status) {
    case "pending":
      return product.lastError
        ? "Salvo · aguardando nova tentativa"
        : "Salvo · na fila";
    case "processing":
      return "Salvo · buscando dados";
    case "needs_review":
      return "Salvo · confira os dados";
    case "ready":
      return product.priceSource === "manual"
        ? "Dados informados por você"
        : "Dados encontrados";
  }
}
