import * as cheerio from "cheerio";
import type { PriceCandidate, ScrapedProduct } from "../src/types/product";
import { renderProductPage } from "./browser";
import { findStoreAdapter, type ValueSelector } from "./store-adapters";

type JsonObject = Record<string, unknown>;
const STATIC_TIMEOUT_MS = 12_000;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  return null;
}

function normalizePrice(value: unknown): string | null {
  const raw = asText(value);
  if (!raw) return null;

  let numeric = raw.replace(/\s/g, "").replace(/[^0-9,.-]/g, "");
  if (!numeric) return null;

  const comma = numeric.lastIndexOf(",");
  const dot = numeric.lastIndexOf(".");

  if (comma > -1 && dot > -1) {
    numeric =
      comma > dot
        ? numeric.replace(/\./g, "").replace(",", ".")
        : numeric.replace(/,/g, "");
  } else if (comma > -1) {
    numeric = numeric.replace(",", ".");
  }

  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : null;
}

function normalizeCurrency(value: unknown): string | null {
  const currency = asText(value);
  if (!currency) return null;

  const knownCurrencies: Record<string, string> = {
    "R$": "BRL",
    BRL: "BRL",
    "US$": "USD",
    "$": "USD",
    USD: "USD",
    "€": "EUR",
    EUR: "EUR",
    "£": "GBP",
    GBP: "GBP",
  };

  return knownCurrencies[currency.toUpperCase()] ?? currency.toUpperCase();
}

function inferCurrency(pageUrl: URL): string | null {
  if (pageUrl.hostname.endsWith(".br")) return "BRL";
  return null;
}

function absoluteUrl(value: unknown, pageUrl: URL): string | null {
  let image = value;

  if (Array.isArray(image)) image = image[0];
  if (isObject(image)) image = image.url ?? image.contentUrl;

  const imageText = asText(image);
  if (!imageText) return null;

  try {
    return new URL(imageText, pageUrl).toString();
  } catch {
    return null;
  }
}

function hasType(object: JsonObject, expectedType: string): boolean {
  const types = Array.isArray(object["@type"])
    ? object["@type"]
    : [object["@type"]];

  return types.some(
    (type) =>
      typeof type === "string" &&
      type.toLowerCase() === expectedType.toLowerCase(),
  );
}

function findProducts(value: unknown, products: JsonObject[]): void {
  if (Array.isArray(value)) {
    value.forEach((item) => findProducts(item, products));
    return;
  }

  if (!isObject(value)) return;

  if (hasType(value, "Product")) products.push(value);

  // Stores sometimes nest Product under custom state keys instead of @graph.
  // Walking every value makes the structured-data layer tolerate both shapes.
  Object.values(value).forEach((child) => findProducts(child, products));
}

function readSelectorValue(
  $: cheerio.CheerioAPI,
  selector: ValueSelector,
): string | null {
  const element = $(selector.selector).first();
  return asText(
    selector.attribute ? element.attr(selector.attribute) : element.text(),
  );
}

function firstSelectorValue(
  $: cheerio.CheerioAPI,
  selectors: ValueSelector[],
): string | null {
  for (const selector of selectors) {
    const value = readSelectorValue($, selector);
    if (value) return value;
  }

  return null;
}

function extractStoreAdapter(
  $: cheerio.CheerioAPI,
  pageUrl: URL,
  candidates: PriceCandidate[],
  sourcePrefix: string,
) {
  const adapter = findStoreAdapter(pageUrl.hostname);
  if (!adapter) return null;

  for (const priceSelector of adapter.prices) {
    const value = readSelectorValue($, priceSelector);
    if (!value) continue;

    addCandidate(
      candidates,
      value,
      priceSelector.currency ?? inferCurrency(pageUrl),
      `${sourcePrefix}store:${adapter.id}`,
      1,
    );
    break;
  }

  return {
    storeName: adapter.storeName,
    title: firstSelectorValue($, adapter.titles),
    imageUrl: absoluteUrl(firstSelectorValue($, adapter.images), pageUrl),
  };
}

function firstObject(value: unknown): JsonObject | null {
  if (Array.isArray(value)) return value.find(isObject) ?? null;
  return isObject(value) ? value : null;
}

function readOffer(product: JsonObject): JsonObject | null {
  const offer = firstObject(product.offers);
  if (!offer) return null;

  // AggregateOffer sometimes contains an inner list of real offers.
  return firstObject(offer.offers) ?? offer;
}

function addCandidate(
  candidates: PriceCandidate[],
  rawPrice: unknown,
  rawCurrency: unknown,
  source: string,
  confidence: number,
): void {
  const price = normalizePrice(rawPrice);
  if (!price) return;

  const currency = normalizeCurrency(rawCurrency);
  const duplicate = candidates.some(
    (candidate) =>
      candidate.price === price &&
      candidate.currency === currency &&
      candidate.source === source,
  );

  if (!duplicate) candidates.push({ price, currency, source, confidence });
}

function extractJsonLd(
  $: cheerio.CheerioAPI,
  pageUrl: URL,
  candidates: PriceCandidate[],
  sourcePrefix: string,
) {
  const products: JsonObject[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const content = $(element).text().trim();
    if (!content) return;

    try {
      findProducts(JSON.parse(content), products);
    } catch {
      // Invalid JSON-LD should not stop the other strategies.
    }
  });

  for (const product of products) {
    const offer = readOffer(product);
    if (!offer) continue;

    const priceSpecification = firstObject(offer.priceSpecification);
    const price =
      offer.price ??
      offer.lowPrice ??
      priceSpecification?.price;
    const currency =
      offer.priceCurrency ?? priceSpecification?.priceCurrency;

    addCandidate(candidates, price, currency, `${sourcePrefix}json-ld`, 0.98);

    if (normalizePrice(price)) {
      return {
        title: asText(product.name),
        description: asText(product.description),
        imageUrl: absoluteUrl(product.image, pageUrl),
        availability: asText(offer.availability),
      };
    }
  }

  return null;
}

function extractMetaCandidates(
  $: cheerio.CheerioAPI,
  candidates: PriceCandidate[],
  sourcePrefix: string,
): void {
  const selectors = [
    {
      price: 'meta[property="product:price:amount"]',
      currency: 'meta[property="product:price:currency"]',
      source: "product-meta",
      confidence: 0.94,
    },
    {
      price: 'meta[property="og:price:amount"]',
      currency: 'meta[property="og:price:currency"]',
      source: "open-graph",
      confidence: 0.92,
    },
    {
      price: '[itemprop="price"]',
      currency: '[itemprop="priceCurrency"]',
      source: "microdata",
      confidence: 0.9,
    },
  ];

  selectors.forEach((selector) => {
    const priceElement = $(selector.price).first();
    const currencyElement = $(selector.currency).first();

    addCandidate(
      candidates,
      priceElement.attr("content") ?? priceElement.text(),
      currencyElement.attr("content") ?? currencyElement.text(),
      `${sourcePrefix}${selector.source}`,
      selector.confidence,
    );
  });

  const twitterLabel = $('meta[name="twitter:label1"]')
    .attr("content")
    ?.toLowerCase();

  if (twitterLabel?.includes("preço") || twitterLabel?.includes("price")) {
    addCandidate(
      candidates,
      $('meta[name="twitter:data1"]').attr("content"),
      null,
      `${sourcePrefix}twitter-card`,
      0.75,
    );
  }
}

function extractVisiblePriceCandidates(
  $: cheerio.CheerioAPI,
  candidates: PriceCandidate[],
  pageUrl: URL,
  sourcePrefix: string,
): void {
  const selectors = [
    '[itemprop="price"]',
    '[data-testid*="price" i]',
    '[data-test*="price" i]',
    '[class*="price" i]',
    '[id*="price" i]',
    '[aria-label*="preço" i]',
    '[aria-label*="price" i]',
  ].join(",");
  const seen = new Set<string>();
  const pricePattern = /(R\$|US\$|\$|€|£)\s*([0-9]+(?:[.\s][0-9]{3})*(?:,[0-9]{2})|[0-9]+(?:[.,][0-9]{2})?)/i;

  $(selectors)
    .slice(0, 80)
    .each((_, element) => {
      const node = $(element);
      const text = node.attr("content") ?? node.attr("aria-label") ?? node.text();
      const normalizedText = text.replace(/\s+/g, " ").trim();
      const match = normalizedText.match(pricePattern);
      if (!match) return;

      const identity = `${match[1]}:${match[2]}`;
      if (seen.has(identity)) return;
      seen.add(identity);

      const hints = [
        node.attr("class"),
        node.attr("id"),
        node.attr("data-testid"),
        normalizedText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const looksCurrent = /(sale|current|final|best|agora|por|pix)/.test(hints);
      const looksOld = /(old|original|list|regular|compare|was|de:)/.test(hints);
      const confidence = looksOld ? 0.5 : looksCurrent ? 0.72 : 0.62;

      addCandidate(
        candidates,
        match[2],
        match[1] || inferCurrency(pageUrl),
        `${sourcePrefix}visible-price`,
        confidence,
      );
    });
}

function extractStoreInfo($: cheerio.CheerioAPI, pageUrl: URL) {
  const hostname = pageUrl.hostname.replace(/^www\./, "");
  const fallbackName = hostname
    .split(".")[0]
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  const storeName =
    $('meta[property="og:site_name"]').attr("content")?.trim() ||
    $('meta[name="application-name"]').attr("content")?.trim() ||
    fallbackName;

  const faviconSelectors = [
    'link[rel="apple-touch-icon"]',
    'link[rel="apple-touch-icon-precomposed"]',
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
  ];

  let faviconUrl: string | null = null;

  for (const selector of faviconSelectors) {
    faviconUrl = absoluteUrl($(selector).first().attr("href"), pageUrl);
    if (faviconUrl) break;
  }

  return { hostname, storeName, faviconUrl };
}

export function extractProductFromHtml(
  html: string,
  productUrl: string,
  sourcePrefix = "",
): ScrapedProduct {
  const url = new URL(productUrl);

  const $ = cheerio.load(html);

  const suspiciousTrafficPage =
    $("html")
      .attr("data-assets-prefix")
      ?.includes("suspicious-traffic-frontend") ||
    html.includes("/gz/account-verification");

  if (suspiciousTrafficPage) {
    throw new Error(
      "Mercado Livre blocked automated access to this page. This store requires its official API with authentication.",
    );
  }

  const candidates: PriceCandidate[] = [];
  const structuredProduct = extractJsonLd($, url, candidates, sourcePrefix);
  const storeInfo = extractStoreInfo($, url);
  const storeProduct = extractStoreAdapter($, url, candidates, sourcePrefix);

  extractMetaCandidates($, candidates, sourcePrefix);
  extractVisiblePriceCandidates($, candidates, url, sourcePrefix);
  candidates.sort((a, b) => b.confidence - a.confidence);

  const bestPrice = candidates[0] ?? null;
  const title =
    storeProduct?.title ??
    structuredProduct?.title ??
    $('meta[property="og:title"]').attr("content")?.trim() ??
    $("title").text().trim() ??
    null;
  const description =
    structuredProduct?.description ??
    $('meta[property="og:description"]').attr("content")?.trim() ??
    $('meta[name="description"]').attr("content")?.trim() ??
    null;
  const imageUrl =
    storeProduct?.imageUrl ??
    structuredProduct?.imageUrl ??
    absoluteUrl($('meta[property="og:image"]').attr("content"), url);

  return {
    url: url.toString(),
    store: storeInfo.hostname,
    storeName: storeProduct?.storeName ?? storeInfo.storeName,
    faviconUrl: storeInfo.faviconUrl,
    title,
    description,
    imageUrl,
    price: bestPrice?.price ?? null,
    currency: bestPrice?.currency ?? (bestPrice ? inferCurrency(url) : null),
    availability: structuredProduct?.availability ?? null,
    priceSource: bestPrice?.source ?? null,
    confidence: bestPrice?.confidence ?? 0,
    priceCandidates: candidates,
  };
}

function isCompleteProduct(product: ScrapedProduct): boolean {
  return Boolean(product.title && product.imageUrl && product.price);
}

function mergeProducts(
  staticProduct: ScrapedProduct | null,
  renderedProduct: ScrapedProduct,
): ScrapedProduct {
  if (!staticProduct) return renderedProduct;

  const renderedHasBetterPrice =
    renderedProduct.price !== null &&
    (staticProduct.price === null ||
      renderedProduct.confidence > staticProduct.confidence);
  const priceProduct = renderedHasBetterPrice ? renderedProduct : staticProduct;
  const priceCandidates = [
    ...staticProduct.priceCandidates,
    ...renderedProduct.priceCandidates,
  ].filter(
    (candidate, index, all) =>
      all.findIndex(
        (item) =>
          item.price === candidate.price &&
          item.currency === candidate.currency &&
          item.source === candidate.source,
      ) === index,
  );

  return {
    ...staticProduct,
    url: renderedProduct.url,
    store: renderedProduct.store || staticProduct.store,
    storeName: renderedProduct.storeName || staticProduct.storeName,
    faviconUrl: renderedProduct.faviconUrl ?? staticProduct.faviconUrl,
    title: renderedProduct.title ?? staticProduct.title,
    description: renderedProduct.description ?? staticProduct.description,
    imageUrl: renderedProduct.imageUrl ?? staticProduct.imageUrl,
    availability:
      renderedProduct.availability ?? staticProduct.availability,
    price: priceProduct.price,
    currency: priceProduct.currency,
    priceSource: priceProduct.priceSource,
    confidence: priceProduct.confidence,
    priceCandidates: priceCandidates.sort(
      (a, b) => b.confidence - a.confidence,
    ),
  };
}

export async function scrapeProduct(
  productUrl: string,
): Promise<ScrapedProduct> {
  const url = new URL(productUrl);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }

  if (url.username || url.password) {
    throw new Error("URLs containing credentials are not supported.");
  }

  let staticProduct: ScrapedProduct | null = null;
  let staticError: unknown = null;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Karrinho/1.0 (personal product tracker)",
      },
      signal: AbortSignal.timeout(STATIC_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(
        `The store returned ${response.status} ${response.statusText}`,
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("text/html")) {
      throw new Error(`Expected HTML, but received ${contentType}`);
    }

    staticProduct = extractProductFromHtml(
      await response.text(),
      response.url || url.toString(),
    );
  } catch (error) {
    staticError = error;
  }

  if (staticProduct && isCompleteProduct(staticProduct)) {
    return staticProduct;
  }

  try {
    const renderedPage = await renderProductPage(url.toString());
    const renderedProduct = extractProductFromHtml(
      renderedPage.html,
      renderedPage.url,
      "browser:",
    );
    return mergeProducts(staticProduct, renderedProduct);
  } catch (browserError) {
    if (staticProduct) return staticProduct;

    const staticMessage =
      staticError instanceof Error ? staticError.message : "static request failed";
    const browserMessage =
      browserError instanceof Error
        ? browserError.message
        : "browser rendering failed";

    throw new Error(
      `The store could not be read. Static layer: ${staticMessage}. Browser layer: ${browserMessage}`,
    );
  }
}
