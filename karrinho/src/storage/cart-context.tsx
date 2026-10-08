import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";
import type { SavedProduct } from "../types/product";
import { cartRepository } from "./cart";
import { createCartQueue } from "./cart-queue";
import { fetchProduct } from "../services/products";

const CartContext = createContext<{
  products: SavedProduct[];
  loading: boolean;
  error: string | null;
}>({ products: [], loading: true, error: null });

export function CartProvider({ children }: PropsWithChildren) {
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const reportError = () => {
      if (active)
        setError(
          "Não foi possível acessar o armazenamento do carrinho. Tente abrir o app novamente.",
        );
    };
    const queue = createCartQueue(cartRepository, fetchProduct, {
      onError: reportError,
    });
    const unsubscribe = cartRepository.subscribe((items) => {
      if (active) {
        setProducts(items);
        setError(null);
      }
    });
    void cartRepository
      .list()
      .then((items) => {
        if (active) {
          setProducts(items);
          setLoading(false);
        }
        if (active && AppState.currentState !== "background")
          return queue.start();
      })
      .catch(() => {
        reportError();
        setLoading(false);
      });
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void queue.start().catch(reportError);
      else queue.stop();
    });
    return () => {
      active = false;
      unsubscribe();
      listener.remove();
      queue.stop();
    };
  }, []);
  return (
    <CartContext.Provider value={{ products, loading, error }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
