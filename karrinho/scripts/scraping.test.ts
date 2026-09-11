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
    name: "Shopee fallback uses stable product attributes",
    url: "https://shopee.com.br/produto-i.1.2",
    body: `
      <main><h1 data-testid="product-title">Capa</h1></main>
      <meta property="og:image" content="https://cf.shopee.com.br/capa.jpg">
      <div data-testid="product-price">R$ 39,90</div>`,
    title: "Capa",
    price: "39.90",
    image: "https://cf.shopee.com.br/capa.jpg",
    source: "store:shopee-br",
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
