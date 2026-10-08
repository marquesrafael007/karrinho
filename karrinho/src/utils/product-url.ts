/** Keep SKU/variant parameters; remove only known marketing parameters. */
export function normalizeProductUrl(input: string): string {
  let value = input.trim().replace(/&amp;/gi, "&");
  const markdown = value.match(/^\[[\s\S]*?\]\((https?:\/\/[^\s]+)\)$/i);
  if (markdown) value = markdown[1];
  else {
    const sharedLinks = value.match(/https?:\/\/[^\s<>]+/gi);
    if (sharedLinks?.length === 1 && !/^https?:\/\//i.test(value))
      value = sharedLinks[0];
  }
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) value = `https://${value}`;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Insira um link válido de produto.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    !url.hostname.includes(".") ||
    /\s/.test(url.hostname)
  ) {
    throw new Error("Use um link público HTTP ou HTTPS, sem usuário ou senha.");
  }
  if (value.length > 8192) throw new Error("O link é muito longo.");
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_.+|gclid|fbclid|matt_tool|matt_word|sid|action)$/i.test(key))
      url.searchParams.delete(key);
  }
  if (!url.hash.startsWith("#/")) url.hash = "";
  url.searchParams.sort();
  return url.toString();
}
