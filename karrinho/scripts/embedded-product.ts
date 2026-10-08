import type { CheerioAPI } from "cheerio";
import { parsePrice } from "../src/utils/price";

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** Read known product state shapes, never execute scripts or search arbitrary price keys. */
export function extractEmbeddedProduct($: CheerioAPI, url: URL) {
  const possible: ObjectValue[] = [];
  function visit(value: unknown, depth = 0) {
    if (depth > 12 || !object(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (
        /recommend|related|suggest|carousel|cross.?sell|items|results/i.test(
          key,
        )
      )
        continue;
      if (
        ["product", "productData", "selectedProduct"].includes(key) &&
        object(child)
      )
        possible.push(child);
      if (object(child)) visit(child, depth + 1);
    }
  }
  $('script[type="application/json"], script#__NEXT_DATA__')
    .slice(0, 30)
    .each((_, node) => {
      try {
        const data: unknown = JSON.parse($(node).text());
        visit(data);
        if (
          object(data) &&
          ("productName" in data ||
            (Array.isArray(data.variants) && data.title))
        )
          possible.push(data);
      } catch {
        /* Invalid state does not affect other layers. */
      }
    });
  const heading = $("h1").first().text().trim().toLowerCase();
  const matching = possible.filter((product) => {
    const name = text(product.name ?? product.title ?? product.productName);
    if (!name) return false;
    const productUrl = text(product.url);
    let matchesUrl = false;
    try {
      matchesUrl = Boolean(
        productUrl && new URL(productUrl, url).pathname === url.pathname,
      );
    } catch {
      /* A malformed optional canonical URL does not discard other metadata. */
    }
    return !heading || heading === name.toLowerCase() || matchesUrl;
  });
  if (matching.length !== 1) return null;
  const product = matching[0];
  const variants = Array.isArray(product.variants)
    ? product.variants.filter(object)
    : [];
  const variantId =
    url.searchParams.get("variant") ?? url.searchParams.get("sku");
  const variant =
    variants.find((item) => String(item.id ?? item.sku) === variantId) ??
    (variants.length === 1 ? variants[0] : null);
  // Shopify serializes variant price as integer cents. Other generic objects use decimal amounts.
  const shopify = Boolean(
    product.handle &&
    variants.length &&
    variants.every((item) => "price" in item && "id" in item),
  );
  const offer = object(product.offers) ? product.offers : null;
  const raw =
    variant?.price ??
    (variants.length ? null : (offer?.price ?? product.price));
  const rawPrice = object(raw) ? (raw.value ?? raw.amount) : raw;
  const price = parsePrice(
    shopify && typeof rawPrice === "number" ? rawPrice / 100 : rawPrice,
  );
  const image =
    product.image ??
    product.featured_image ??
    (Array.isArray(product.images) ? product.images[0] : null);
  return {
    title: text(product.name ?? product.title ?? product.productName),
    description: text(product.description),
    image: object(image) ? (image.url ?? image.src) : image,
    price,
    currency: text(
      offer?.priceCurrency ??
        product.currency ??
        (object(raw) ? raw.currency : null),
    ),
    availability: variant?.available === false ? "OutOfStock" : null,
  };
}
