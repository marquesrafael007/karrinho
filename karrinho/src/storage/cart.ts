import AsyncStorage from "@react-native-async-storage/async-storage";

import { createCartRepository } from "./cart-repository";

export const cartRepository = createCartRepository(AsyncStorage);
export const getCartProducts = cartRepository.list;
export const removeCartProduct = cartRepository.remove;
