import * as cheerio from "cheerio";
import type { PriceCandidate, ScrapedProduct } from "../src/types/product";
import { renderProductPage } from "./browser";
import { findStoreAdapter, type ValueSelector } from "./store-adapters";
import { parsePrice } from "../src/utils/price";
import { normalizeProductUrl } from "../src/utils/product-url";
import { fetchPublicHtml } from "./public-web";
import { ScrapeError } from "./scrape-error";
import { extractEmbeddedProduct } from "./embedded-product";

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
  return parsePrice(value);
}

function normalizeCurrency(value: unknown): string | null {
  const currency = asText(value);
  if (!currency) return null;

  const knownCurrencies: Record<string, string> = {
    R$: "BRL",
    BRL: "BRL",
    US$: "USD",
    $: "USD",
    USD: "USD",
    "€": "EUR",
    EUR: "EUR",
    "£": "GBP",
    GBP: "GBP",
  };

  const result =
    knownCurrencies[currency.toUpperCase()] ?? currency.toUpperCase();
  return /^[A-Z]{3}$/.test(result) ? result : null;
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
    const resolved = new URL(imageText, pageUrl);
    return ["http:", "https:"].includes(resolved.protocol)
      ? resolved.toString()
      : null;
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
      type.split(/[/#]/).pop()?.toLowerCase() === expectedType.toLowerCase(),
  );
}

function findProducts(value: unknown, products: JsonObject[], depth = 0): void {
  if (depth > 20 || products.length > 100) return;
  if (Array.isArray(value)) {
    value.forEach((item) => findProducts(item, products, depth + 1));
    return;
  }

  if (!isObject(value)) return;

  if (hasType(value, "Product")) products.push(value);

  // Stores sometimes nest Product under custom state keys instead of @graph.
  // Walking every value makes the structured-data layer tolerate both shapes.
  if (hasType(value, "ItemList")) return;
  Object.entries(value).forEach(([key, child]) => {
    if (!/recommend|related|suggest|itemListElement/i.test(key))
      findProducts(child, products, depth + 1);
  });
}

function excludedPriceElement(
  $: cheerio.CheerioAPI,
  element: Parameters<cheerio.CheerioAPI>[0],
): boolean {
  const node = $(element);
  if (node.closest('del, s, aside, [hidden], [aria-hidden="true"]').length)
    return true;
  const hints = node
    .parents()
    .addBack()
    .map((_, parent) =>
      [
        $(parent).attr("id"),
        $(parent).attr("class"),
        $(parent).attr("data-testid"),
        $(parent).attr("style"),
      ].join(" "),
    )
    .get()
    .join(" ");
  return /recommend|related|suggest|carousel|cross.?sell|combined|installment|parcel|old.?price|list.?price|compare.?price|display\s*:\s*none|visibility\s*:\s*hidden/i.test(
    hints,
  );
}

function readSelectorValue(
  $: cheerio.CheerioAPI,
  selector: ValueSelector,
): string | null {
  const element = $(selector.selector)
    .filter((_, node) => !excludedPriceElement($, node))
    .first();
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
    if (
      candidates.some(
        (candidate) =>
          candidate.source === `${sourcePrefix}store:${adapter.id}`,
      )
    )
      break;
  }

  return {
    storeName: adapter.storeName,
    title: firstSelectorValue($, adapter.titles),
    imageUrl: absoluteUrl(firstSelectorValue($, adapter.images), pageUrl),
  };
}

function extractShopeeState(
  $: cheerio.CheerioAPI,
  pageUrl: URL,
  candidates: PriceCandidate[],
  sourcePrefix: string,
) {
  if (findStoreAdapter(pageUrl.hostname)?.id !== "shopee-br") {
    return null;
  }

  const content = $('script[type="text/mfe-initial-data"]')
    .first()
    .text()
    .trim();
  if (!content) return null;

  try {
    const state = JSON.parse(content) as JsonObject;
    const initialState = firstObject(state.initialState);
    const itemState = firstObject(initialState?.item);
    const items = firstObject(itemState?.items);
    const item = items ? Object.values(items).find(isObject) : null;
    if (!item) return null;

    let selectedModelId: number | null = null;
    const extraParams = pageUrl.searchParams.get("extraParams");
    if (extraParams) {
      try {
        const parsed = JSON.parse(extraParams) as JsonObject;
        const id = Number(parsed.display_model_id);
        if (Number.isFinite(id)) selectedModelId = id;
      } catch {
        // A malformed optional variation parameter should not discard the item.
      }
    }

    const models = Array.isArray(item.models)
      ? item.models.filter(isObject)
      : [];
    const selectedModel =
      models.find(
        (model) => Number(model.modelid ?? model.model_id) === selectedModelId,
      ) ?? null;
    const rawPrice =
      selectedModel?.price ??
      (models.length <= 1 ||
      new Set(models.map((model) => model.price)).size === 1
        ? item.price
        : null) ??
      (item.price_min === item.price_max ? item.price_min : null);

    // Shopee represents BRL prices in units of 1/100000 in its page state.
    const scaledPrice =
      rawPrice !== null &&
      rawPrice !== undefined &&
      Number.isFinite(Number(rawPrice))
        ? Number(rawPrice) / 100_000
        : null;
    addCandidate(
      candidates,
      scaledPrice,
      item.currency ?? "BRL",
      `${sourcePrefix}store:shopee-state`,
      1,
    );

    const imageId =
      asText(item.image) ??
      (Array.isArray(item.images) ? asText(item.images[0]) : null);

    return {
      title: asText(item.title ?? item.name),
      description: asText(item.description),
      imageUrl: imageId
        ? `https://down-br.img.susercontent.com/file/${imageId}`
        : null,
      availability: item.is_unavailable === true ? "OutOfStock" : "InStock",
    };
  } catch {
    return null;
  }
}

function firstObject(value: unknown): JsonObject | null {
  if (Array.isArray(value)) return value.find(isObject) ?? null;
  return isObject(value) ? value : null;
}

function readOffer(product: JsonObject, pageUrl: URL): JsonObject | null {
  const offers = Array.isArray(product.offers)
    ? product.offers.filter(isObject)
    : [product.offers].filter(isObject);
  const exact = offers.find((offer) => {
    const location = absoluteUrl(offer.url, pageUrl);
    return (
      location &&
      normalizeProductUrl(location) === normalizeProductUrl(pageUrl.toString())
    );
  });
  const amounts = new Set(
    offers.map(
      (offer) => `${normalizePrice(offer.price)}:${offer.priceCurrency}`,
    ),
  );
  if (!exact && offers.length > 1 && amounts.size > 1) return null;
  const offer = exact ?? offers[0];
  if (!offer) return null;

  // AggregateOffer sometimes contains an inner list of real offers.
  return offer.offers ? readOffer({ offers: offer.offers }, pageUrl) : offer;
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

  const heading = $("h1").first().text().trim().toLowerCase();
  const score = (product: JsonObject) => {
    const location = absoluteUrl(product.url ?? product["@id"], pageUrl);
    return (
      (location && new URL(location).pathname === pageUrl.pathname ? 10 : 0) +
      (heading && asText(product.name)?.toLowerCase() === heading ? 5 : 0)
    );
  };
  const unique = [...new Set(products)];
  unique.sort((a, b) => score(b) - score(a));
  // Ambiguous structured products may be a listing/recommendation section.
  const selected =
    unique.length === 1 ||
    (unique.length > 1 && score(unique[0]) > score(unique[1]))
      ? unique[0]
      : null;
  if (selected) {
    const product = selected;
    const offer = readOffer(product, pageUrl);
    const priceSpecification = firstObject(offer?.priceSpecification);
    const price =
      offer?.price ??
      (offer?.lowPrice === offer?.highPrice ? offer?.lowPrice : null) ??
      priceSpecification?.price;
    const currency = offer?.priceCurrency ?? priceSpecification?.priceCurrency;

    addCandidate(candidates, price, currency, `${sourcePrefix}json-ld`, 0.98);

    return {
      title: asText(product.name),
      description: asText(product.description),
      imageUrl: absoluteUrl(product.image, pageUrl),
      availability: asText(offer?.availability),
    };
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
      price:
        'meta[property="product:price:amount"], meta[name="product:price:amount"]',
      currency:
        'meta[property="product:price:currency"], meta[name="product:price:currency"]',
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
    const priceElements = $(selector.price).filter(
      (_, node) => !excludedPriceElement($, node),
    );
    if (
      selector.source === "microdata" &&
      new Set(
        priceElements
          .map((_, node) =>
            normalizePrice($(node).attr("content") ?? $(node).text()),
          )
          .get(),
      ).size > 1
    )
      return;
    const priceElement = priceElements.first();
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
  const pricePattern =
    /(R\$|US\$|\$|€|£)\s*([0-9]+(?:[.\s][0-9]{3})*(?:,[0-9]{2})|[0-9]+(?:[.,][0-9]{2})?)/i;

  $(selectors)
    .slice(0, 80)
    .each((_, element) => {
      const node = $(element);
      if (excludedPriceElement($, element)) return;
      const text =
        node.attr("content") ?? node.attr("aria-label") ?? node.text();
      const normalizedText = text.replace(/\s+/g, " ").trim();
      if (
        /\b\d+\s*x\b|parcela|frete|shipping|a partir|\bfrom\b/i.test(
          normalizedText,
        ) ||
        (normalizedText.match(/R\$|US\$|[$€£]/g)?.length ?? 0) > 1
      )
        return;
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
      const looksCurrent = /(sale|current|final|best|agora|por|pix)/.test(
        hints,
      );
      const looksOld = /(old|original|list|regular|compare|was|de:)/.test(
        hints,
      );
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
    throw new ScrapeError(
      "A loja bloqueou a consulta automática. Abra o link ou complete os dados manualmente.",
      "STORE_BLOCKED",
      false,
    );
  }

  const normalizedTitle = $("title").text().replace(/\s+/g, " ").trim();
  const normalizedBody = $("body").text().replace(/\s+/g, " ").trim();
  const storeBlockedPage =
    /access denied|just a moment|verify you are human|captcha|robot check|sign in|login|verifique.*humano/i.test(
      normalizedTitle,
    ) ||
    /não é possível acessar a página/i.test(normalizedTitle) ||
    /alguns detalhes do erro:\s*reference id:/i.test(normalizedBody);

  if (storeBlockedPage) {
    throw new ScrapeError(
      "A loja bloqueou a consulta automática. Abra o link ou complete os dados manualmente.",
      "STORE_BLOCKED",
      false,
    );
  }

  const candidates: PriceCandidate[] = [];
  const structuredProduct = extractJsonLd($, url, candidates, sourcePrefix);
  const storeInfo = extractStoreInfo($, url);
  const storeProduct = extractStoreAdapter($, url, candidates, sourcePrefix);
  const shopeeProduct = extractShopeeState($, url, candidates, sourcePrefix);
  const embedded = extractEmbeddedProduct($, url);
  if (embedded)
    addCandidate(
      candidates,
      embedded.price,
      embedded.currency ?? inferCurrency(url),
      `${sourcePrefix}embedded-product`,
      0.95,
    );

  extractMetaCandidates($, candidates, sourcePrefix);
  extractVisiblePriceCandidates($, candidates, url, sourcePrefix);
  candidates.sort((a, b) => b.confidence - a.confidence);

  // Heuristic text is useful evidence, but never a confirmed cart price.
  const bestPrice =
    candidates.find((candidate) => candidate.confidence >= 0.9) ?? null;
  const title =
    shopeeProduct?.title ??
    storeProduct?.title ??
    structuredProduct?.title ??
    embedded?.title ??
    $('meta[property="og:title"]').attr("content")?.trim() ??
    asText($("h1").first().text()) ??
    asText($("title").text()) ??
    null;
  const description =
    shopeeProduct?.description ??
    structuredProduct?.description ??
    embedded?.description ??
    $('meta[property="og:description"]').attr("content")?.trim() ??
    $('meta[name="description"]').attr("content")?.trim() ??
    null;
  const imageUrl =
    shopeeProduct?.imageUrl ??
    storeProduct?.imageUrl ??
    structuredProduct?.imageUrl ??
    absoluteUrl(embedded?.image, url) ??
    absoluteUrl($('meta[property="og:image"]').attr("content"), url);

  return {
    url: url.toString(),
    store: storeInfo.hostname,
    storeName: storeProduct?.storeName ?? storeInfo.storeName,
    faviconUrl: storeInfo.faviconUrl ?? new URL("/favicon.ico", url).toString(),
    title,
    description,
    imageUrl,
    price: bestPrice?.price ?? null,
    currency: bestPrice?.currency ?? (bestPrice ? inferCurrency(url) : null),
    availability:
      shopeeProduct?.availability ?? structuredProduct?.availability ?? null,
    priceSource: bestPrice?.source ?? null,
    confidence: bestPrice?.confidence ?? 0,
    priceCandidates: candidates,
  };
}

function isCompleteProduct(product: ScrapedProduct): boolean {
  return Boolean(
    product.title &&
    product.imageUrl &&
    product.price &&
    product.currency &&
    product.confidence >= 0.9,
  );
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
    availability: renderedProduct.availability ?? staticProduct.availability,
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
  const url = new URL(normalizeProductUrl(productUrl));

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }

  if (url.username || url.password) {
    throw new Error("URLs containing credentials are not supported.");
  }

  let staticProduct: ScrapedProduct | null = null;
  let staticError: unknown = null;

  try {
    const response = await fetchPublicHtml(
      url.toString(),
      AbortSignal.timeout(STATIC_TIMEOUT_MS),
    );
    staticProduct = extractProductFromHtml(response.html, response.url);
  } catch (error) {
    if (error instanceof ScrapeError && !error.retryable) throw error;
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
    if (browserError instanceof ScrapeError) throw browserError;
    if (staticError instanceof ScrapeError) throw staticError;
    throw new ScrapeError(
      "A loja não respondeu a tempo. O link continua salvo para tentar novamente.",
      "STORE_UNAVAILABLE",
      true,
      503,
    );
  }
}
