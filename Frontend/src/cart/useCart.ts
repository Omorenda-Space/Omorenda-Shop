import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartItem } from "./types";
import { clearCartStorage, readCart, writeCart } from "./storage";

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function maxAllowedForItem(item: Pick<CartItem, "availableForSale" | "quantityAvailable">): number {
  if (!item.availableForSale) return 0;
  if (typeof item.quantityAvailable === "number") {
    return Math.max(0, Math.min(99, Math.trunc(item.quantityAvailable)));
  }
  // Shopify returns null when inventory is not tracked/unknown → cap to 99
  return 99;
}

type CartContextValue = {
  items: CartItem[];
  count: number;
  ids: Set<string>;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  remove: (variantGid: string) => void;
  toggle: (item: Omit<CartItem, "quantity">) => void;
  setQuantity: (variantGid: string, quantity: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => readCart());

  useEffect(() => {
    writeCart(items);
  }, [items]);

  const count = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  const ids = useMemo(() => new Set(items.map((i) => i.variantGid)), [items]);

  const add = useCallback((item: Omit<CartItem, "quantity">, quantity = 1) => {
    setItems((prev) => {
      const max = maxAllowedForItem(item);
      const qty = clampInt(quantity, 1, Math.max(1, max));
      const idx = prev.findIndex((p) => p.variantGid === item.variantGid);
      if (idx >= 0) {
        const next = [...prev];
        const existing = next[idx];
        const existingMax = maxAllowedForItem(existing);
        next[idx] = {
          ...existing,
          quantity: clampInt(existing.quantity + qty, 1, Math.max(1, existingMax)),
        };
        return next;
      }
      return [...prev, { ...item, quantity: qty }];
    });
  }, []);

  const remove = useCallback((variantGid: string) => {
    setItems((prev) => prev.filter((p) => p.variantGid !== variantGid));
  }, []);

  const setQuantity = useCallback((variantGid: string, quantity: number) => {
    setItems((prev) =>
      prev.map((p) =>
        p.variantGid === variantGid
          ? { ...p, quantity: clampInt(quantity, 1, Math.max(1, maxAllowedForItem(p))) }
          : p,
      ),
    );
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    clearCartStorage();
  }, []);

  const toggle = useCallback((item: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.variantGid === item.variantGid);
      if (idx >= 0) {
        return prev.filter((p) => p.variantGid !== item.variantGid);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({ items, count, ids, add, remove, toggle, setQuantity, clear }),
    [items, count, ids, add, remove, toggle, setQuantity, clear],
  );

  return createElement(CartContext.Provider, { value }, children);
}

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("useCart must be used within CartProvider");
  return cart;
}

