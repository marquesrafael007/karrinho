# Karrinho

React Native / Expo app for saving product links from different stores.

## Run locally

```bash
npm install
npm run setup:browser
npm run dev
```

The Node API listens on port 3001. Expo runs the app. A phone needs access to the
API through the computer's LAN IP, or a deployed HTTPS URL. Leave
`EXPO_PUBLIC_API_URL` empty locally: Expo Go discovers the Metro host on port 3001,
and the browser uses same-origin Expo API routes. Keep phone and computer on the
same LAN. Only set an override for a deployed API or an intentional custom server.
A hardcoded LAN address becomes stale when the computer's IP changes. After
changing `.env.local`, fully reload web/Expo Go (restart Expo if needed).

For an installed APK, set `EXPO_PUBLIC_API_URL` in the EAS build profile to the
actual server URL and rebuild. The current preview profile still uses a LAN
address. The APK does not include the Node server or Playwright browser.

## Design

The React Native interface uses compact headings, rounded surfaces, product
photos and a muted green accent. Reacticx Animated Input Bar, Segmented Control
and Pressable source components power input feedback, cart filters and buttons.
Their Expo 57 and accessibility adaptations are documented in
`THIRD_PARTY_NOTICES.md`; review those before replacing components upstream.

Palette, typography and spacing tokens live in `src/constants/theme.ts`.
The app follows the device's light/dark preference, with a session-only header
toggle. Navigation stays outside the scrolling content. Controls have 48-point
minimum touch areas; filters support keyboard arrows as well as taps. Motion
follows live OS preferences, and larger native text switches cards and editor
fields to stacked layouts. Contrast ratios have automated tests. VoiceOver,
TalkBack and native Dynamic Type should also be checked on a physical device.

## Saving links

- Valid links are persisted on the device **before** a scraping request starts.
  Shared text, Markdown links and missing HTTPS prefixes are normalized; SKU and
  variant parameters are preserved.
- A single queue processes saved links while the app is active. It continues
  across screen changes and resumes pending/interrupted work when the app opens.
  It does not run a background service while the app is closed.
- A 4-second health check catches unreachable/misconfigured APIs before scraping.
  Connection failures and lookup timeouts stop with a visible error and manual
  Retry, rather than repeating long requests. Links remain saved and editable.
- Retryable server/store errors retry up to three attempts with backoff.
  Blocked/login pages stop automatic attempts and remain available for review.
- A lookup has a 70-second client deadline and a 75-second queue watchdog, even
  when the underlying request ignores cancellation. A stuck job cannot hold the
  remaining queue indefinitely.
- Home highlights the saved product for 15 seconds, then keeps it in the recent list.
  More links can be submitted while product data is loading.
- Cart groups products by store, shows status, and offers Open store, Edit,
  Retry (for incomplete items), and Remove. Editing a price marks it as manual.
- Totals include only confirmed items and are separated by currency. Missing
  prices and uncertain estimates are not treated as confirmed prices.

Storage uses AsyncStorage under `@karrinho/products`, including the durable
queue metadata. Existing carts are migrated on read. Writes are serialized;
late network responses cannot restore deleted products or overwrite manual edits.
A damaged storage record is reported without silently replacing it.

This is device-local persistence, **not cloud backup or multi-device sync**.
Uninstalling the app or clearing its data can remove the cart. No server database
or 24-hour background price monitoring is introduced by this change.

## Firecrawl (optional, server-side)

The app can now use Firecrawl v2 for rendered HTML plus structured product extraction.
Both the Node API and Expo web API share the provider. No Firecrawl key belongs in
React Native, `EXPO_PUBLIC_*`, `app.json` or an EAS client build profile.

1. Create an account and get an API key from [Firecrawl](https://www.firecrawl.dev/).
2. In the app folder's ignored `.env.local`, add:

   ```dotenv
   SCRAPING_PROVIDER=auto
   FIRECRAWL_API_KEY=your-real-key
   ```

3. Restart `npm run dev` and reload the app. On Coolify, set these as **server
   environment variables** and restart the API instead. Keep the API private or
   protect it with authentication before enabling paid scraping on a public host.

`auto` uses Firecrawl when a nonempty key is configured, otherwise the existing
scraper. `firecrawl` explicitly requires a key; `legacy` explicitly selects
Cheerio/Playwright. Firecrawl failures do not silently fall back to a second slow
lookup or trigger automatic paid retries. Missing keys, authorization, exhausted
credits and rate limits produce actionable errors while preserving saved links.

The adapter sends only the product URL and extraction settings, requests fresh
data (`maxAge: 0`), disables cache storage, and has a 55-second total deadline.
Firecrawl receives the URL/content; requests can use account credits. There is no
guarantee that every store, login wall, CAPTCHA or variant-dependent price works.
Our keyless smoke test was refused by Firecrawl from this network; a keyed live
test is still required. Automated tests use mocked responses, not account credits.

Prices parsed from product-specific HTML retain the existing validation. AI-only
prices are displayed with `firecrawl:json` provenance but remain **a conferir**
and excluded from confirmed totals until reviewed with Editar → Salvar dados.
Missing data is never guessed. See [Firecrawl JSON extraction](https://docs.firecrawl.dev/features/llm-extract).

## Legacy extraction layers

The Node server first downloads bounded public HTML and reads:

1. Main-product JSON-LD and scoped store adapters.
2. Recognized embedded product state (Shopee, Next.js-style product objects and
   Shopify variants).
3. Product metadata and microdata.

When data remains incomplete, Playwright renders the page and runs those same
extractors again. Ambiguous product/offer ranges and broad visible-price guesses
are not promoted to confirmed prices. Existing adapters cover Mercado Livre,
Amazon BR, Magazine Luiza, Renner, Casas Bahia and Shopee, with HTML fixture tests.
Store markup and access rules can change; fixture coverage does not guarantee
live access.

CAPTCHAs, authentication walls, unavailable listings and prices dependent on a
selected variation/location may require manual completion or an authorized store
API. The saved URL remains accessible in these cases.

Both `POST /scrape` routes (Node and Expo web) use the same service. Requests are
validated, overlapping identical lookups share one job, and at most two jobs run
per server process. Responses are JSON with `error`, `code`, and `retryable` on
failure. Static requests validate redirect targets and pin the resolved public IP;
browser requests reject local/private targets. Apply network egress restrictions
and access control when exposing the API on a public host.

## Verification

```bash
npm test
npx tsc --noEmit
npx expo export --platform android
npx expo export --platform web
```

Tests cover durable saving, concurrent additions, duplicates and variants,
migration, failures, retry limits, interrupted work, stale responses, HTTP error
responses, currency totals, and extraction fixtures. Live stores are not contacted
by the regression suite.
