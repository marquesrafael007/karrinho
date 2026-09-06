import * as cheerio from "cheerio";

type ScrapedProduct = {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  price: string | null;
  currency: string | null;
};

export async function scrapeProduct(
  productUrl: string
): Promise<ScrapedProduct> {
  // 1. Parse and validate the supplied URL
  const url = new URL(productUrl);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }

  // 2. Download the webpage
  const response = await fetch(url, {
    headers: {
      Accept: "text/html",
      "User-Agent": "Karrinho/1.0 (personal product tracker)",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(
      `The store returned ${response.status} ${response.statusText}`
    );
  }

  const contentType = response.headers.get("content-type");

  if (!contentType?.includes("text/html")) {
    throw new Error(`Expected HTML, but received ${contentType}`);
  }

  // 3. Convert the response into an HTML string
  const html = await response.text();

  // 4. Load the HTML into Cheerio
  const $ = cheerio.load(html);

  // 5. Extract common product metadata
  const title =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").text().trim() ||
    null;

  const description =
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    null;

  const imageUrl =
    $('meta[property="og:image"]').attr("content")?.trim() || null;

  const price =
    $('meta[property="product:price:amount"]').attr("content")?.trim() ||
    $('[itemprop="price"]').first().attr("content")?.trim() ||
    $('[itemprop="price"]').first().text().trim() ||
    null;

  const currency =
    $('meta[property="product:price:currency"]').attr("content")?.trim() ||
    $('[itemprop="priceCurrency"]').first().attr("content")?.trim() ||
    null;

  return {
    url: url.toString(),
    title,
    description,
    imageUrl,
    price,
    currency,
  };
}

// Read the product URL from the terminal
const productUrl = process.argv[2];

if (!productUrl) {
  console.error(
    'Usage: node scripts/scraping.ts "https://store.com/product"'
  );
  process.exitCode = 1;
} else {
  scrapeProduct(productUrl)
    .then((product) => {
      console.log(JSON.stringify(product, null, 2));
    })
    .catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Unknown scraping error";

      console.error("Scraping failed:", message);
      process.exitCode = 1;
    });
}