export function formatPrice(
  price: string | null,
  currency: string | null,
): string {
  if (!price) return "Preço não encontrado";

  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice) || !currency) return price;

  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
    }).format(numericPrice);
  } catch {
    return `${currency} ${price}`;
  }
}
