// import { useEffect, useMemo, useState } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listOrders, type Order } from "../api/orders";
import { SiteHeader } from "../components/SiteHeader";
import { useAuth } from "../auth/AuthContext";
import { AuthGate } from "../components/AuthGate";

type ProductsResponse = {
  products: Array<{
    id: string;
    title: string;
    images: Array<{ url: string; altText: string | null }>;
    variants: Array<{
      id: string;
      title: string;
      price?: { amount: string; currencyCode: string };
    }>;
  }>;
};

function formatMoney(amount: string, currency: string): string {
  const num = Number(amount);
  if (Number.isFinite(num)) return `${num.toFixed(2)} ${currency}`;
  return `${amount} ${currency}`;
}

export function OrdersPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [variantMeta, setVariantMeta] = useState<Record<string, { imageUrl: string | null; productTitle: string | null }>>(
    {},
  );

  async function fetchProducts(limit = 250): Promise<ProductsResponse> {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001/api";
    const res = await fetch(`${API_BASE_URL}/products?limit=${limit}`);
    if (!res.ok) throw new Error(`Failed to load products (${res.status})`);
    return (await res.json()) as ProductsResponse;
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listOrders();
      setOrders(data);

      try {
        const products = await fetchProducts(250);
        const meta: Record<string, { imageUrl: string | null; productTitle: string | null }> = {};
        for (const p of products.products ?? []) {
          const imageUrl = p.images?.[0]?.url ?? null;
          for (const v of p.variants ?? []) {
            meta[v.id] = { imageUrl, productTitle: p.title ?? null };
          }
        }
        setVariantMeta(meta);
      } catch {
        // Product images are optional metadata; order history should still render.
        setVariantMeta({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      void load();
    } else {
      setOrders([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  return (
    <div className="sh-container">
      <SiteHeader
        pageTitle="Your orders"
        left={
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <Link to="/" style={{ color: "var(--fg)", textDecoration: "none", fontWeight: 900 }}>
              ← Back to shop
            </Link>
            {isAuthenticated ? (
              <span style={{ fontSize: 12, color: "var(--muted-fg)", fontWeight: 900 }}>{user?.email}</span>
            ) : null}
          </div>
        }
      />

      {!authLoading && !isAuthenticated ? (
        <div style={{ marginBottom: 12 }}>
          <AuthGate title="Sign in to view orders" subtitle="Continue with Google to see your order history." />
        </div>
      ) : null}

      {loading ? <p style={{ color: "#666" }}>Loading…</p> : null}
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}

      {!loading && !error && orders.length === 0 ? (
        <p style={{ color: "var(--muted-fg)", fontWeight: 800 }}>No orders found.</p>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        {orders.map((o) => (
          <article key={o.id} className="sh-card" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 240 }}>
                <div style={{ fontSize: 12, color: "var(--muted-fg)", fontWeight: 900 }}>Order</div>
                <div style={{ fontWeight: 950, color: "var(--fg)" }}>
                  <code>{o.id}</code>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted-fg)" }}>
                  {new Date(o.createdAt).toLocaleString()}
                </div>
              </div>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontSize: 12, color: "var(--muted-fg)", fontWeight: 900 }}>Status</div>
                <div style={{ fontWeight: 950, color: "var(--fg)" }}>{o.status}</div>
              </div>
              <div style={{ minWidth: 180, textAlign: "right" }}>
                <div style={{ fontSize: 12, color: "var(--muted-fg)", fontWeight: 900 }}>Total</div>
                <div style={{ fontWeight: 950, color: "var(--fg)" }}>{formatMoney(o.total, o.currency)}</div>
              </div>
            </div>

            <div style={{ marginTop: 10, borderTop: "1px solid rgba(31, 41, 46, 0.08)", paddingTop: 10 }}>
              <div style={{ fontSize: 12, color: "var(--muted-fg)", marginBottom: 6 }}>
                Stripe session: <code>{o.stripeSessionId}</code>
              </div>
              {o.shopifyOrderId ? (
                <div style={{ fontSize: 12, color: "var(--muted-fg)", marginBottom: 6 }}>
                  Shopify order: <code>{o.shopifyOrderId}</code>
                </div>
              ) : null}
              <div style={{ display: "grid", gap: 10 }}>
                {o.items.map((it) => (
                  <div
                    key={it.id}
                    style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, color: "var(--fg)" }}
                  >
                    <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0, flex: "1 1 auto" }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 12,
                          background: "rgba(13, 150, 136, 0.06)",
                          border: "1px solid rgba(31, 41, 46, 0.08)",
                          overflow: "hidden",
                          flex: "0 0 auto",
                        }}
                      >
                        {variantMeta[it.shopifyVariantGid]?.imageUrl ? (
                          <img
                            src={variantMeta[it.shopifyVariantGid]?.imageUrl ?? ""}
                            alt={variantMeta[it.shopifyVariantGid]?.productTitle ?? it.title ?? "Product image"}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : null}
                      </div>

                      <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                        <div style={{ fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {it.title ?? variantMeta[it.shopifyVariantGid]?.productTitle ?? it.shopifyVariantGid}
                        </div>
                        <div style={{ color: "var(--muted-fg)", fontSize: 12 }}>
                          Qty {it.quantity} · Unit {formatMoney(it.unitPrice, o.currency)} · Variant <code>{it.shopifyVariantGid}</code>
                        </div>
                      </div>
                    </div>

                    <div style={{ flex: "0 0 auto", textAlign: "right" }}>
                      <div style={{ fontWeight: 950 }}>{formatMoney(it.lineTotal, o.currency)}</div>
                      <div style={{ fontSize: 12, color: "var(--muted-fg)" }}>
                        {formatMoney(it.unitPrice, o.currency)} × {it.quantity}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

