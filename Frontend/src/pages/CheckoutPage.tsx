import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { useCart } from "../cart/useCart";
import { useAuth } from "../auth/AuthContext";
import { AuthGate } from "../components/AuthGate";
import { API_BASE_URL, ApiError, fetchJson } from "../api/client";

function money(n: number, currency: string) {
  if (!Number.isFinite(n)) return `0.00 ${currency}`;
  return `${n.toFixed(2)} ${currency}`;
}

export function CheckoutPage() {
  const cart = useCart();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = useMemo(() => cart.items[0]?.currency ?? "USD", [cart.items]);

  const subtotal = useMemo(() => {
    return cart.items.reduce((sum, i) => sum + i.unitAmount * i.quantity, 0);
  }, [cart.items]);

  function maxQtyFor(i: { availableForSale: boolean; quantityAvailable: number | null }) {
    if (!i.availableForSale) return 0;
    if (typeof i.quantityAvailable === "number") return Math.max(0, Math.min(99, Math.trunc(i.quantityAvailable)));
    return 99;
  }

  async function checkout() {
    if (!isAuthenticated) {
      setShowAuth(true);
      setPendingCheckout(true);
      return;
    }
    if (cart.items.length === 0) return;

    const invalid = cart.items.find((i) => i.quantity > Math.max(1, maxQtyFor(i)));
    if (invalid) {
      setError("One or more items exceed available stock. Please reduce quantities.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const json = await fetchJson<{ url?: string }>(`${API_BASE_URL}/checkout/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.items.map((i) => ({ variantGid: i.variantGid, quantity: i.quantity })),
          successUrl: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}&email=${encodeURIComponent(user?.email ?? "")}`,
          cancelUrl: `${window.location.origin}/checkout`,
        }),
      });
      if (!json.url) throw new Error("Missing Stripe Checkout url");

      window.location.href = json.url;
    } catch (e) {
      if (e instanceof ApiError && e.code === "SESSION_EXPIRED") {
        setPendingCheckout(true);
        setShowAuth(true);
      }
      setError(e instanceof Error ? e.message : "Checkout failed");
      setLoading(false);
    }
  }

  useEffect(() => {
    if (pendingCheckout && isAuthenticated && !loading) {
      setPendingCheckout(false);
      void checkout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCheckout, isAuthenticated]);

  return (
    <div className="sh-container">
      <SiteHeader
        pageTitle="Checkout"
        left={
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <Link to="/" style={{ color: "var(--fg)", textDecoration: "none", fontWeight: 900 }}>
              ← Continue shopping
            </Link>
            <button
              type="button"
              onClick={() => cart.clear()}
              disabled={cart.items.length === 0}
              className="sh-btn"
              style={{ cursor: cart.items.length === 0 ? "not-allowed" : "pointer" }}
            >
              Clear cart
            </button>
            {isAuthenticated ? (
              <span style={{ fontSize: 12, color: "var(--muted-fg)", fontWeight: 900 }}>
                {user?.email ?? ""}
              </span>
            ) : null}
          </div>
        }
      />

      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}

      {!authLoading && !isAuthenticated && showAuth ? (
        <div style={{ marginBottom: 12 }}>
          <AuthGate title="Sign in to checkout" subtitle="Continue with Google to proceed to payment." />
        </div>
      ) : null}

      {/* When auth is shown, hide the checkout UI below it */}
      {!authLoading && !isAuthenticated && showAuth ? null : cart.items.length === 0 ? (
        <div className="sh-card" style={{ padding: 16 }}>
          <p style={{ margin: 0, color: "var(--muted-fg)", fontWeight: 800 }}>Your cart is empty.</p>
          <p style={{ marginTop: 12 }}>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="sh-btn sh-btnPrimary"
            >
              Browse products
            </button>
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          {cart.items.map((i) => (
            <article
              key={i.variantGid}
              className="sh-card"
              style={{ padding: 14 }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 12,
                    background: "rgba(13, 150, 136, 0.06)",
                    overflow: "hidden",
                    flex: "0 0 auto",
                    border: "1px solid rgba(31, 41, 46, 0.08)",
                  }}
                >
                  {i.imageUrl ? (
                    <img src={i.imageUrl} alt={i.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : null}
                </div>

                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <div style={{ fontWeight: 950, color: "var(--fg)" }}>{i.title}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-fg)", marginTop: 4 }}>
                    {i.variantTitle} · <code>{i.variantGid}</code>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span className={`sh-badge ${i.availableForSale ? "sh-badgeInStock" : "sh-badgeOut"}`}>
                      {i.availableForSale ? "In stock" : "Sold out"}
                    </span>
                  </div>
                </div>

                <div style={{ flex: "0 0 auto", display: "grid", gap: 8, justifyItems: "end" }}>
                  <div style={{ fontWeight: 950, color: "var(--fg)" }}>
                    {money(i.unitAmount * i.quantity, i.currency)}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => cart.setQuantity(i.variantGid, i.quantity - 1)}
                      disabled={i.quantity <= 1}
                      className="sh-btn"
                      style={{
                        width: 34,
                        height: 34,
                        padding: 0,
                        borderRadius: 12,
                        cursor: i.quantity <= 1 ? "not-allowed" : "pointer",
                      }}
                    >
                      −
                    </button>
                    <div style={{ minWidth: 22, textAlign: "center", fontWeight: 900 }}>{i.quantity}</div>
                    <button
                      type="button"
                      onClick={() => cart.setQuantity(i.variantGid, i.quantity + 1)}
                      disabled={i.quantity >= Math.max(1, maxQtyFor(i))}
                      className="sh-btn"
                      style={{
                        width: 34,
                        height: 34,
                        padding: 0,
                        borderRadius: 12,
                        cursor: i.quantity >= Math.max(1, maxQtyFor(i)) ? "not-allowed" : "pointer",
                      }}
                    >
                      +
                    </button>
                  </div>
                  {typeof i.quantityAvailable === "number" ? (
                    <div style={{ fontSize: 12, color: "var(--muted-fg)", fontWeight: 800 }}>{i.quantityAvailable} in stock</div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => cart.remove(i.variantGid)}
                    className="sh-btn"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}

          <div className="sh-card" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ color: "var(--muted-fg)", fontSize: 13, fontWeight: 900 }}>Subtotal (est.)</div>
              <div style={{ fontWeight: 950, color: "var(--fg)" }}>{money(subtotal, currency)}</div>
            </div>
            <button
              type="button"
              onClick={() => void checkout()}
              disabled={loading || cart.items.length === 0}
              className="sh-btn sh-btnPrimary"
              style={{ width: "100%", marginTop: 12, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Redirecting…" : "Checkout"}
            </button>
            <p style={{ marginTop: 10, fontSize: 12, color: "var(--muted-fg)", fontWeight: 700 }}>
              Final totals are calculated by the backend using Shopify pricing.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

