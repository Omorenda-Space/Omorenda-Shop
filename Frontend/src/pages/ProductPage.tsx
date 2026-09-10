import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { useCart } from "../cart/useCart";
import { fetchProducts, getFirstAvailableVariant, type StoreProduct } from "../shop/products";

export function ProductPage() {
  const params = useParams();
  const handle = typeof params.handle === "string" ? params.handle : null;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const cart = useCart();

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setError(null);
        if (!handle) throw new Error("Missing product handle");
        const json = await fetchProducts(250);
        const found = (json.products ?? []).find((p) => p.handle === handle) ?? null;
        if (!found) throw new Error("Product not found");
        if (!cancelled) {
          setProduct(found);
          const firstAvailable = getFirstAvailableVariant(found);
          setSelectedVariantId(firstAvailable?.id ?? found.variants?.[0]?.id ?? null);
          setQuantity(1);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  const variants = product?.variants ?? [];
  const selectedVariant =
    (selectedVariantId ? variants.find((v) => v.id === selectedVariantId) : null) ?? variants[0] ?? null;
  const canBuy = !!selectedVariant?.availableForSale;
  const isInCart = selectedVariant?.id ? cart.ids.has(selectedVariant.id) : false;
  const maxQty =
    selectedVariant?.availableForSale === false
      ? 0
      : typeof selectedVariant?.quantityAvailable === "number"
        ? Math.max(0, Math.min(99, Math.trunc(selectedVariant.quantityAvailable)))
        : 99;
  const maxQtyUi = Math.max(1, maxQty);

  useEffect(() => {
    setQuantity((q) => Math.min(maxQtyUi, Math.max(1, q)));
  }, [maxQtyUi]);

  if (loading) {
    return (
      <div className="sh-container">
        <p style={{ color: "#666" }}>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sh-container">
        <p style={{ color: "crimson" }}>{error}</p>
        <p style={{ marginTop: 12 }}>
          <Link to="/" style={{ color: "var(--fg)", fontWeight: 900 }}>
            Back to shop
          </Link>
        </p>
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="sh-container">
      <SiteHeader
        pageTitle="Omorenda Shop"
        left={
          <Link to="/" style={{ color: "var(--fg)", textDecoration: "none", fontWeight: 900 }}>
            ← Back
          </Link>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        <div className="sh-twoCol">
          <div className="sh-productImage" style={{ borderRadius: 16 }}>
            {product.images?.[0]?.url ? <img src={product.images[0].url} alt={product.images[0].altText ?? product.title} /> : null}
          </div>

          <div className="sh-card" style={{ padding: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, color: "var(--fg)", fontWeight: 950, letterSpacing: "-0.01em" }}>{product.title}</h2>
            <p style={{ marginTop: 10, fontSize: 14, color: "var(--muted-fg)", fontWeight: 800 }}>
              ${Number(product.price?.min?.amount ?? 0).toFixed(2)}{" "}
              <span style={{ fontSize: 12, fontWeight: 800 }}>{product.price?.min?.currencyCode ?? "USD"}</span>
            </p>

            <div style={{ marginTop: 10 }}>
              <span className={`sh-badge ${canBuy ? "sh-badgeInStock" : "sh-badgeOut"}`}>{canBuy ? "In stock" : "Sold out"}</span>
            </div>

            <p style={{ marginTop: 10, marginBottom: 0, color: "var(--fg)", fontSize: 13, lineHeight: 1.5, opacity: 0.9 }}>
              {product.description || "No description provided."}
            </p>

            {variants.length > 1 ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "var(--muted-fg)", marginBottom: 8, fontWeight: 900 }}>Variants</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {variants.map((v) => {
                    const active = v.id === selectedVariant?.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id)}
                        className={active ? "sh-btn sh-btnPrimary" : "sh-btn"}
                        style={{
                          padding: "8px 10px",
                          opacity: v.availableForSale ? 1 : 0.55,
                          cursor: v.availableForSale ? "pointer" : "not-allowed",
                        }}
                        title={v.availableForSale ? "Available" : "Sold out"}
                      >
                        {v.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="sh-actionsCompact">
              <button
                type="button"
                onClick={() => {
                  if (!selectedVariant?.id) return;
                  cart.add(
                    {
                      productId: product.id,
                      productHandle: product.handle,
                      title: product.title,
                      imageUrl: product.images?.[0]?.url ?? null,
                      currency: product.price?.min?.currencyCode ?? "USD",
                      unitAmount: Number(product.price?.min?.amount ?? 0),
                      variantGid: selectedVariant.id,
                      variantTitle: selectedVariant.title,
                      availableForSale: selectedVariant.availableForSale,
                      quantityAvailable: typeof selectedVariant?.quantityAvailable === "number" ? selectedVariant.quantityAvailable : null,
                    },
                    quantity,
                  );
                  navigate("/checkout");
                }}
                disabled={!selectedVariant?.id || !canBuy}
                className="sh-btn sh-btnPrimary sh-actionsBuy"
                style={{ cursor: !canBuy ? "not-allowed" : "pointer", opacity: !canBuy ? 0.6 : 1 }}
              >
                Buy Now
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!selectedVariant?.id) return;
                  cart.add(
                    {
                      productId: product.id,
                      productHandle: product.handle,
                      title: product.title,
                      imageUrl: product.images?.[0]?.url ?? null,
                      currency: product.price?.min?.currencyCode ?? "USD",
                      unitAmount: Number(product.price?.min?.amount ?? 0),
                      variantGid: selectedVariant.id,
                      variantTitle: selectedVariant.title,
                      availableForSale: selectedVariant.availableForSale,
                      quantityAvailable: typeof selectedVariant?.quantityAvailable === "number" ? selectedVariant.quantityAvailable : null,
                    },
                    quantity,
                  );
                }}
                disabled={!selectedVariant?.id}
                className="sh-btn"
                style={{ background: isInCart ? "rgba(24, 149, 136, 0.08)" : "#fff" }}
              >
                {isInCart ? "In cart" : "Add to cart"}
              </button>

              <button type="button" onClick={() => navigate("/checkout")} className="sh-btn" disabled={cart.items.length === 0}>
                Go to cart
              </button>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 12, color: "var(--muted-fg)", fontWeight: 900 }}>Quantity</div>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="sh-btn sh-qtyBtn"
                style={{ cursor: quantity <= 1 ? "not-allowed" : "pointer", opacity: quantity <= 1 ? 0.6 : 1 }}
              >
                −
              </button>
              <div style={{ minWidth: 28, textAlign: "center", fontWeight: 950, color: "var(--fg)" }}>{quantity}</div>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(maxQtyUi, q + 1))}
                disabled={quantity >= maxQtyUi}
                className="sh-btn sh-qtyBtn"
                style={{ cursor: quantity >= maxQtyUi ? "not-allowed" : "pointer", opacity: quantity >= maxQtyUi ? 0.6 : 1 }}
              >
                +
              </button>
              {typeof selectedVariant?.quantityAvailable === "number" ? (
                <div style={{ fontSize: 12, color: "var(--muted-fg)", marginLeft: 6, fontWeight: 800 }}>
                  {selectedVariant.quantityAvailable} in stock
                </div>
              ) : null}
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
              Variant GID: <code>{selectedVariant?.id ?? "—"}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

