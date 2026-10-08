import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { ScrapeError } from "./scrape-error";

export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0)) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224 ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  // Global unicast only; also exclude mapped IPv4, NAT64, transition and documentation ranges.
  return (
    isIP(address) === 6 &&
    /^[23]/i.test(address) &&
    !/^(2001:|2002:|3fff:)/i.test(address)
  );
}

export async function publicTarget(value: string) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port))
  ) {
    throw new ScrapeError(
      "Use um link público HTTP ou HTTPS.",
      "INVALID_URL",
      false,
      400,
    );
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await lookup(hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some((item) => !isPublicAddress(item.address))
  ) {
    throw new ScrapeError(
      "O endereço precisa ser de uma loja pública na internet.",
      "PRIVATE_ADDRESS",
      false,
      400,
    );
  }
  return { url, addresses };
}

/** Pin the validated DNS address, validate every redirect and bound the response. */
export async function fetchPublicHtml(
  value: string,
  signal: AbortSignal,
): Promise<{ html: string; url: string }> {
  let current = value;
  for (let redirects = 0; redirects < 6; redirects++) {
    signal.throwIfAborted();
    const { url, addresses } = await publicTarget(current);
    signal.throwIfAborted();
    const result = await new Promise<{ redirect?: string; html?: string }>(
      (resolve, reject) => {
        const address = addresses[0];
        const request = (
          url.protocol === "https:" ? httpsRequest : httpRequest
        )(
          url,
          {
            signal,
            family: address.family,
            lookup: (_host, _options, callback) =>
              callback(null, address.address, address.family),
            headers: {
              Accept: "text/html,application/xhtml+xml",
              "Accept-Encoding": "identity",
              "User-Agent": "Karrinho/1.0 (personal product tracker)",
            },
          },
          (response) => {
            const status = response.statusCode ?? 500;
            if (status >= 300 && status < 400 && response.headers.location) {
              response.resume();
              try {
                resolve({
                  redirect: new URL(response.headers.location, url).toString(),
                });
              } catch {
                reject(
                  new ScrapeError(
                    "A loja retornou um redirecionamento inválido.",
                    "INVALID_REDIRECT",
                    false,
                  ),
                );
              }
              return;
            }
            if (status >= 400) {
              response.resume();
              reject(
                new ScrapeError(
                  status === 403 || status === 401
                    ? "A loja exige acesso autorizado. O link foi salvo; complete os dados manualmente."
                    : status === 404 || status === 410
                      ? "A página do produto não está disponível."
                      : `A loja retornou erro ${status}. Tente novamente mais tarde.`,
                  `HTTP_${status}`,
                  status === 429 || status >= 500,
                  status === 429 || status >= 500 ? 503 : 422,
                ),
              );
              return;
            }
            if (
              !/text\/html|application\/xhtml\+xml/i.test(
                response.headers["content-type"] ?? "",
              )
            ) {
              response.resume();
              reject(
                new ScrapeError(
                  "O link não retornou uma página de produto.",
                  "NOT_HTML",
                  false,
                ),
              );
              return;
            }
            const chunks: Buffer[] = [];
            let size = 0;
            response.on("data", (chunk: Buffer) => {
              size += chunk.length;
              if (size > 5_000_000) {
                response.destroy(
                  new ScrapeError(
                    "A página excede o tamanho permitido.",
                    "PAGE_TOO_LARGE",
                    false,
                  ),
                );
                return;
              }
              chunks.push(chunk);
            });
            response.on("error", reject);
            response.on("end", () =>
              resolve({ html: Buffer.concat(chunks).toString("utf8") }),
            );
          },
        );
        request.on("error", reject);
        request.end();
      },
    );
    if (!result.redirect) return { html: result.html ?? "", url: current };
    current = result.redirect;
  }
  throw new ScrapeError(
    "O link redireciona muitas vezes. Use o endereço final do produto.",
    "REDIRECT_LOOP",
    false,
  );
}
