export type ValueSelector = {
  selector: string;
  attribute?: string;
};

export type PriceSelector = ValueSelector & {
  currency?: string;
};

export type StoreAdapter = {
  id: string;
  hostnames: string[];
  storeName: string;
  titles: ValueSelector[];
  images: ValueSelector[];
  prices: PriceSelector[];
};

// Keep these selectors scoped to the main product area. Broad selectors such as
// `[class*=price]` frequently capture recommendations, installments, or old prices.
export const STORE_ADAPTERS: StoreAdapter[] = [
  {
    id: "mercado-livre",
    hostnames: ["mercadolivre.com.br", "mercadolibre.com"],
    storeName: "Mercado Livre",
    titles: [{ selector: "h1.ui-pdp-title" }],
    images: [
      { selector: ".ui-pdp-gallery__figure img", attribute: "data-zoom" },
      { selector: ".ui-pdp-gallery__figure img", attribute: "src" },
    ],
    prices: [
      {
        selector: '.ui-pdp-price__main-container meta[itemprop="price"]',
        attribute: "content",
        currency: "BRL",
      },
      {
        selector: ".ui-pdp-price__main-container .andes-money-amount",
        currency: "BRL",
      },
    ],
  },
  {
    id: "amazon-br",
    hostnames: ["amazon.com.br"],
    storeName: "Amazon",
    titles: [{ selector: "#productTitle" }],
    images: [
      { selector: "#landingImage", attribute: "data-old-hires" },
      { selector: "#landingImage", attribute: "src" },
    ],
    prices: [
      {
        selector:
          "#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen",
        currency: "BRL",
      },
      {
        selector: "#apex_desktop .a-price:not(.a-text-price) .a-offscreen",
        currency: "BRL",
      },
      { selector: "#priceblock_dealprice", currency: "BRL" },
      { selector: "#priceblock_ourprice", currency: "BRL" },
      { selector: "#price_inside_buybox", currency: "BRL" },
    ],
  },
  {
    id: "magalu",
    hostnames: ["magazineluiza.com.br"],
    storeName: "Magazine Luiza",
    titles: [{ selector: 'h1[data-testid="heading"]' }],
    images: [
      {
        selector: 'img[data-testid="image"][alt^="Imagem de"]',
        attribute: "src",
      },
    ],
    prices: [
      { selector: '[data-testid="price-value"]', currency: "BRL" },
    ],
  },
  {
    id: "renner",
    hostnames: ["lojasrenner.com.br"],
    storeName: "Lojas Renner",
    titles: [{ selector: "h1.product_name" }],
    images: [],
    // Renner's visible `product-price` attribute also appears on its
    // "compre junto" products. Its verified Product JSON-LD is safer.
    prices: [],
  },
  {
    id: "casas-bahia",
    hostnames: ["casasbahia.com.br"],
    storeName: "Casas Bahia",
    titles: [
      { selector: '[data-testid="product-title"]' },
      { selector: "h1" },
    ],
    images: [
      { selector: '[data-testid="product-image"] img', attribute: "src" },
    ],
    prices: [
      { selector: '[data-testid="product-price"]', currency: "BRL" },
      { selector: '[data-testid="price-value"]', currency: "BRL" },
    ],
  },
  {
    id: "shopee-br",
    hostnames: ["shopee.com.br"],
    storeName: "Shopee",
    titles: [
      { selector: '[data-testid="product-title"]' },
      { selector: "main h1" },
    ],
    images: [
      { selector: 'meta[property="og:image"]', attribute: "content" },
    ],
    prices: [
      { selector: '[data-testid="product-price"]', currency: "BRL" },
    ],
  },
];

export function findStoreAdapter(hostname: string): StoreAdapter | null {
  const normalized = hostname.toLowerCase().replace(/^www\./, "");

  return (
    STORE_ADAPTERS.find((adapter) =>
      adapter.hostnames.some(
        (host) => normalized === host || normalized.endsWith(`.${host}`),
      ),
    ) ?? null
  );
}
