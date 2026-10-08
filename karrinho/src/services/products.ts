import { apiUrl } from "../utils/api-url";
import { createProductFetcher } from "./product-client";

export const fetchProduct = createProductFetcher(apiUrl);
