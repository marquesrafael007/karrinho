import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import { scrapeRequest, scrapeErrorResponse } from "./scrape-service";
import { ScrapeError } from "../scripts/scrape-error";

const MAX_BODY_BYTES = 32_000;

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
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("error", reject);
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        chunks.length = 0;
        reject(
          new ScrapeError(
            "Requisição muito grande.",
            "BODY_TOO_LARGE",
            false,
            413,
          ),
        );
      } else chunks.push(chunk);
    });
    request.on("end", () => {
      if (size > MAX_BODY_BYTES) return;
      try {
        const body = Buffer.concat(chunks).toString("utf8");
        resolve(body ? JSON.parse(body) : null);
      } catch (error) {
        reject(error);
      }
    });
  });
}

export function createApiServer(handler = scrapeRequest) {
  return createServer(async (request, response) => {
    if (request.method === "OPTIONS") {
      setCorsHeaders(response);
      response.writeHead(204);
      response.end();
      return;
    }

    let requestUrl: URL;
    try {
      requestUrl = new URL(request.url ?? "/", "http://localhost");
    } catch {
      sendJson(response, 400, { error: "Endereço inválido." });
      return;
    }

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
      sendJson(response, 200, await handler(body));
    } catch (error) {
      const result = scrapeErrorResponse(error);
      sendJson(response, result.status, result.body);
    }
  });
}
