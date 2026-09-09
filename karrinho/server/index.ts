import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { scrapeProduct } from "../scripts/scraping";

const DEFAULT_PORT = 3001;
const MAX_BODY_BYTES = 32_000;
const parsedPort = Number(process.env.PORT ?? DEFAULT_PORT);
const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;

function setCorsHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  setCorsHeaders(response);
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;

    if (size > MAX_BODY_BYTES) {
      throw new Error("Request body is too large.");
    }

    chunks.push(buffer);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  return body ? JSON.parse(body) : null;
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    setCorsHeaders(response);
    response.writeHead(204);
    response.end();
    return;
  }

  const requestUrl = new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? `localhost:${port}`}`,
  );

  if (request.method === "GET" && requestUrl.pathname === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method !== "POST" || requestUrl.pathname !== "/scrape") {
    sendJson(response, 404, { error: "Route not found." });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const productUrl =
      typeof body === "object" &&
      body !== null &&
      "url" in body &&
      typeof body.url === "string"
        ? body.url.trim()
        : "";

    if (!productUrl) {
      sendJson(response, 400, { error: "URL inválida." });
      return;
    }

    sendJson(response, 200, await scrapeProduct(productUrl));
  } catch (error) {
    const message =
      error instanceof SyntaxError
        ? "O corpo da requisição não contém JSON válido."
        : error instanceof Error
          ? error.message
          : "Não foi possível buscar o produto.";

    sendJson(response, 500, { error: message });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Karrinho API listening on http://0.0.0.0:${port}`);
});
