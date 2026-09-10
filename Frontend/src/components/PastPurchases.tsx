import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listOrders, type Order } from "../api/orders";
import { useCart } from "../cart/useCart";

function firstLineItem(order: Order) {
  return order.items?.[0] ?? null;
}

export function PastPurchases({ email }: { email: string }) {
  const cart = useCart();
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);

  const enabled = useMemo(() => email.includes("@"), [email]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!enabled) {
        setOrders([]);
        return;
      }
      setLoading(true);
      try {
        const data = await listOrders();
        if (!cancelled) setOrders(data);
      } catch {
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [email, enabled]);

  if (!enabled) return null;
  if (loading) {
    return <p style={{ color: "#666", marginTop: 0 }}>Loading previous purchases…</p>;
  }
  if (orders.length === 0) return null;

  const items = orders
    .map((o) => ({ order: o, item: firstLineItem(o) }))
    .filter((x): x is { order: Order; item: NonNullable<ReturnType<typeof firstLineItem>> } => !!x.item)
    .slice(0, 6);

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <h2 style={{ margin: 0, fontSize: 14, color: "var(--fg)", fontWeight: 950 }}>Previous purchases</h2>
        <Link
          to={`/orders?email=${encodeURIComponent(email)}`}
          style={{ fontSize: 12, color: "var(--fg)", fontWeight: 900 }}
        >
          View all
        </Link>
      </div>

      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {items.map(({ order, item }) => {
          const variantGid = item.shopifyVariantGid;
          const inCart = cart.ids.has(variantGid);
          return (
            <article key={`${order.id}-${item.id}`} className="sh-card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 950, fontSize: 13, color: "var(--fg)" }}>
                {item.title ?? "Purchased item"}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted-fg)", fontWeight: 700 }}>
                Qty {item.quantity} · <code>{variantGid}</code>
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() =>
                    cart.add({
                      productId: "unknown",
                      productHandle: "",
                      title: item.title ?? "Purchased item",
                      imageUrl: null,
                      currency: order.currency,
                      unitAmount: Number(item.unitPrice),
                      variantGid,
                      variantTitle: item.title ?? "Variant",
                      availableForSale: true,
                      quantityAvailable: null,
                    }, 1)
                  }
                  className="sh-btn sh-btnPrimary"
                >
                  Reorder
                </button>
                <button
                  type="button"
                  onClick={() =>
                    cart.toggle({
                      productId: "unknown",
                      productHandle: "",
                      title: item.title ?? "Purchased item",
                      imageUrl: null,
                      currency: order.currency,
                      unitAmount: Number(item.unitPrice),
                      variantGid,
                      variantTitle: item.title ?? "Variant",
                      availableForSale: true,
                      quantityAvailable: null,
                    })
                  }
                  className="sh-btn"
                  style={{ background: inCart ? "rgba(24, 149, 136, 0.08)" : "#fff" }}
                >
                  {inCart ? "Remove" : "Add to cart"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

