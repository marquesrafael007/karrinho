import {
  scrapeRequest,
  scrapeErrorResponse,
} from "../../server/scrape-service";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const product = await scrapeRequest(body);
    return Response.json(product);
  } catch (error) {
    const result = scrapeErrorResponse(error);
    return Response.json(result.body, { status: result.status });
  }
}
