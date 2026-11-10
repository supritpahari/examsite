/* Shopping cart — stored in localStorage so it persists across page visits.
 * Items are formula sheet topics with grade context.
 */

export interface CartItem {
  topicId: string;
  topicName: string;
  gradeId: string;
  gradeName: string;
  amount: number; // in INR (whole rupees)
}

const CART_KEY = "examsite_cart";

function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CartItem[];
  } catch {
    return [];
  }
}

function saveCart(cart: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    /* ignore */
  }
}

export function addToCart(item: CartItem) {
  const cart = getCart();
  const existing = cart.find((c) => c.topicId === item.topicId && c.gradeId === item.gradeId);
  if (existing) {
    // Already in cart — no duplicates
    return cart;
  }
  const newCart = [...cart, item];
  saveCart(newCart);
  return newCart;
}

export function removeFromCart(topicId: string, gradeId: string) {
  const cart = getCart();
  const newCart = cart.filter((c) => !(c.topicId === topicId && c.gradeId === gradeId));
  saveCart(newCart);
  return newCart;
}

export function getCartItems(): CartItem[] {
  return getCart();
}

export function clearCart() {
  if (typeof window === "undefined") return [];
  try {
    window.localStorage.removeItem(CART_KEY);
  } catch {
    /* ignore */
  }
  return [];
}

export function getCartTotal(): number {
  return getCart().reduce((sum, item) => sum + item.amount, 0);
}

export function getCartCount(): number {
  return getCart().length;
}
