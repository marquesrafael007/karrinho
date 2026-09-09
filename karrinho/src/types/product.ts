export type PriceCandidate = {
  price: string;
  currency: string | null;
  source: string;
  confidence: number;
};

export type ScrapedProduct = {
  url: string;
  store: string;
  storeName: string;
  faviconUrl: string | null;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  price: string | null;
  currency: string | null;
  availability: string | null;
  priceSource: string | null;
  confidence: number;
  priceCandidates: PriceCandidate[];
};

export type SavedProduct = ScrapedProduct & {
  id: string;
  savedAt: string;
};
