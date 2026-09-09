import { scrapeProduct } from "../../scripts/scraping";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const url =
      typeof body === "object" && body !== null && "url" in body
        ? body.url
        : null;

    if (typeof url !== "string" || !url.trim()) {
      return Response.json({ error: "URL inválida." }, { status: 400 });
    }

    const product = await scrapeProduct(url.trim());
    return Response.json(product);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not scrape product.";

    return Response.json({ error: message }, { status: 500 });
  }
}
