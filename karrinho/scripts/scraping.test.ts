import assert from "node:assert/strict";
import test from "node:test";
import { extractProductFromHtml } from "./scraping";

type Fixture = {
  name: string;
  url: string;
  body: string;
  title: string;
  price: string;
  image?: string;
  source?: string;
};

const fixtures: Fixture[] = [
  {
    name: "Mercado Livre ignores recommendation prices",
    url: "https://www.mercadolivre.com.br/p/MLB123",
    body: `
      <h1 class="ui-pdp-title">Tênis principal</h1>
      <div class="ui-pdp-price__main-container">
        <meta itemprop="price" content="349.90">
      </div>
      <figure class="ui-pdp-gallery__figure"><img data-zoom="/produto.jpg"></figure>
      <div class="poly-component__price">R$ 29,90</div>`,
    title: "Tênis principal",
    price: "349.90",
    image: "https://www.mercadolivre.com.br/produto.jpg",
    source: "store:mercado-livre",
  },
  {
    name: "Amazon reads the current desktop offer",
    url: "https://www.amazon.com.br/dp/ABC",
    body: `
      <span id="productTitle">Fone principal</span>
      <img id="landingImage" data-old-hires="https://images.example/fone.jpg">
      <div id="corePriceDisplay_desktop_feature_div">
        <span class="a-price"><span class="a-offscreen">R$ 1.299,90</span></span>
      </div>
      <aside><span class="a-price"><span class="a-offscreen">R$ 19,90</span></span></aside>`,
    title: "Fone principal",
    price: "1299.90",
    image: "https://images.example/fone.jpg",
    source: "store:amazon-br",
  },
  {
    name: "Magalu combines its split price text",
    url: "https://www.magazineluiza.com.br/item/p/123",
    body: `
      <h1 data-testid="heading">Lâmpada inteligente</h1>
      <img data-testid="image" alt="Anúncio" src="/ad.jpg">
      <img data-testid="image" alt="Imagem de Lâmpada" src="/lampada.jpg">
      <p data-testid="price-value"><span>R$</span><span>60</span><span>,</span><span>13</span></p>`,
    title: "Lâmpada inteligente",
    price: "60.13",
    image: "https://www.magazineluiza.com.br/lampada.jpg",
    source: "store:magalu",
  },
  {
    name: "Renner prefers Product JSON-LD over buy-together markup",
    url: "https://www.lojasrenner.com.br/p/-/A-123-br.lr",
    body: `
      <h1 class="product_name">Casaco</h1>
      <script type="application/ld+json">{
        "@context":"https://schema.org", "@type":"Product", "name":"Casaco",
        "image":"//img.lojasrenner.com.br/casaco.jpg",
        "offers":{"@type":"Offer","price":"179.90","priceCurrency":"BRL"}
      }</script>
      <section class="ReactCombinedProducts_boxCombinedProducts__x">
        <span data-testid="product-price">R$ 199,90</span>
      </section>`,
    title: "Casaco",
    price: "179.90",
    image: "https://img.lojasrenner.com.br/casaco.jpg",
    source: "json-ld",
  },
  {
    name: "Casas Bahia fallback remains scoped to product test ids",
    url: "https://www.casasbahia.com.br/produto/p/123",
    body: `
      <h1 data-testid="product-title">Geladeira</h1>
      <div data-testid="product-image"><img src="/geladeira.jpg"></div>
      <strong data-testid="product-price">R$ 2.499,00</strong>
      <div class="recommendation-price">R$ 99,00</div>`,
    title: "Geladeira",
    price: "2499.00",
    image: "https://www.casasbahia.com.br/geladeira.jpg",
    source: "store:casas-bahia",
  },
  {
    name: "Shopee reads its embedded product state without DOM classes",
    url: 'https://shopee.com.br/produto-i.1.2?extraParams={"display_model_id":20}',
    body: `
      <script type="text/mfe-initial-data">{
        "initialState":{"item":{"items":{"2":{
          "title":"Capa", "image":"br-image-id", "currency":"BRL",
          "is_unavailable":false,
          "models":[{"modelid":20,"price":3990000}]
        }}}}
      }</script>`,
    title: "Capa",
    price: "39.90",
    image: "https://down-br.img.susercontent.com/file/br-image-id",
    source: "store:shopee-state",
  },
];

for (const fixture of fixtures) {
  test(fixture.name, () => {
    const product = extractProductFromHtml(fixture.body, fixture.url);

    assert.equal(product.title, fixture.title);
    assert.equal(product.price, fixture.price);
    assert.equal(product.currency, "BRL");
    assert.equal(product.imageUrl, fixture.image);
    assert.match(product.priceSource ?? "", new RegExp(fixture.source ?? ""));
  });
}

test("rejects Magalu access-denied pages instead of saving an empty card", () => {
  assert.throws(
    () =>
      extractProductFromHtml(
        "<html><head><title>Magazine Luiza | Não é possível acessar a página</title></head></html>",
        "https://www.magazineluiza.com.br/produto/p/123",
      ),
    /bloqueou a consulta/,
  );
});

test("empty shells remain incomplete so the browser layer can render them", () => {
  const product = extractProductFromHtml(
    "<html><body></body></html>",
    "https://www.casasbahia.com.br/produto/p/123",
  );
  assert.equal(product.title, null);
  assert.equal(product.price, null);
});

test("keeps JSON-LD title and image even when the price is absent", () => {
  const result = extractProductFromHtml(
    '<script type="application/ld+json">{"@type":"Product","name":"Tênis","image":"/tenis.jpg"}</script>',
    "https://loja.example/p/1",
  );
  assert.equal(result.title, "Tênis");
  assert.equal(result.imageUrl, "https://loja.example/tenis.jpg");
  assert.equal(result.price, null);
});

test("selects the main JSON-LD product instead of the first recommendation", () => {
  const result = extractProductFromHtml(
    `<h1>Notebook</h1><script type="application/ld+json">[
    {"@type":"Product","name":"Cabo","url":"/cabo","offers":{"price":20}},
    {"@type":"Product","name":"Notebook","url":"/notebook","offers":{"price":5000,"priceCurrency":"BRL"}}
  ]</script>`,
    "https://loja.example/notebook",
  );
  assert.equal(result.price, "5000.00");
  assert.equal(result.title, "Notebook");
});

test("does not confirm installments, old, hidden, or recommendation prices", () => {
  const result = extractProductFromHtml(
    `<h1>Produto</h1><aside><meta itemprop="price" content="12.00"></aside>
    <div class="recommendations"><meta itemprop="price" content="23.00"></div>
    <del class="price">R$ 400,00</del><span hidden itemprop="price" content="3.00"></span>
    <div class="price">12x de R$ 25,00</div><div class="shipping-price">R$ 10,00</div>`,
    "https://loja.example/p/1",
  );
  assert.equal(result.price, null);
});

test("does not mistake ambiguous offers or aggregate ranges for a selected variation", () => {
  for (const offers of [
    [{ price: 20 }, { price: 50 }],
    { "@type": "AggregateOffer", lowPrice: 20, highPrice: 50 },
  ]) {
    const result = extractProductFromHtml(
      `<script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "Produto", offers })}</script>`,
      "https://loja.example/product",
    );
    assert.equal(result.price, null);
  }
});

test("reads unfamiliar Next.js stores through embedded product data", () => {
  const result = extractProductFromHtml(
    `<h1>Luminária</h1><script id="__NEXT_DATA__" type="application/json">{
    "props":{"pageProps":{"product":{"name":"Luminária","price":{"amount":129.9,"currency":"BRL"},"image":"/lamp.jpg"}}}
  }</script>`,
    "https://loja.example/product",
  );
  assert.equal(result.title, "Luminária");
  assert.equal(result.price, "129.90");
  assert.equal(result.currency, "BRL");
});

test("reads the selected Shopify variant in cents", () => {
  const result = extractProductFromHtml(
    `<script type="application/json">{"product":{
    "title":"Camiseta","handle":"camiseta","currency":"BRL","variants":[{"id":10,"price":9900},{"id":20,"price":12990}]}}
  </script>`,
    "https://loja.example/products/camiseta?variant=20",
  );
  assert.equal(result.price, "129.90");
});

test("rejects challenge pages and unsafe images", () => {
  assert.throws(
    () =>
      extractProductFromHtml(
        "<title>Just a moment...</title>",
        "https://loja.example/p/1",
      ),
    /bloqueou/,
  );
  const result = extractProductFromHtml(
    '<h1>Produto</h1><meta property="og:image" content="javascript:alert(1)">',
    "https://loja.example/p/1",
  );
  assert.equal(result.imageUrl, null);
});
