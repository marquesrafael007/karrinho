/** A single amount only: never concatenate installment counts or price ranges. */
export function parsePrice(value: unknown): string | null {
  if (typeof value === "number")
    return Number.isFinite(value) && value > 0 && value <= 1_000_000_000
      ? value.toFixed(2)
      : null;
  if (typeof value !== "string") return null;
  let amount = value
    .trim()
    .replace(/^(?:R\$|US\$|BRL|USD|EUR|GBP|[$€£])\s*/i, "")
    .replace(/\s/g, "");
  if (!/^\d+(?:[.,]\d+)*$/.test(amount)) return null;
  const comma = amount.lastIndexOf(",");
  const dot = amount.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    const parts = amount.split(decimal);
    if (
      parts.length !== 2 ||
      parts[1].length > 2 ||
      !new RegExp(`^\\d{1,3}(?:\\${thousands}\\d{3})+$`).test(parts[0])
    )
      return null;
    amount = `${parts[0].split(thousands).join("")}.${parts[1]}`;
  } else if (comma >= 0 || dot >= 0) {
    const separator = comma >= 0 ? "," : ".";
    const parts = amount.split(separator);
    if (parts.length === 2 && parts[1].length <= 2) amount = parts.join(".");
    else if (
      /^\d{1,3}$/.test(parts[0]) &&
      parts.slice(1).every((part) => /^\d{3}$/.test(part))
    )
      amount = parts.join("");
    else return null;
  }
  const price = Number(amount);
  return Number.isFinite(price) && price > 0 && price <= 1_000_000_000
    ? price.toFixed(2)
    : null;
}
