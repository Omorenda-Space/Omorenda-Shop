import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { PastPurchases } from "../components/PastPurchases";
import { useCart } from "../cart/useCart";
import { useAuth } from "../auth/AuthContext";
import { fetchProducts, getFirstAvailableVariant, type StoreProduct } from "../shop/products";

const PRODUCTS_PER_PAGE = 15;

export function ShopPage() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const pageParam = Number(searchParams.get("page") ?? "1");
  const pageIdx = Number.isFinite(pageParam) ? Math.max(0, Math.trunc(pageParam) - 1) : 0;

  const [pageCursors, setPageCursors] = useState<Array<string | undefined>>(() => {
    try {
      const raw = sessionStorage.getItem("shop_page_cursors_v1");
      const parsed = raw ? (JSON.parse(raw) as Array<string | undefined>) : null;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // ignore
    }
    return [undefined];
  });
  const [hasNextPage, setHasNextPage] = useState(false);
  const [endCursor, setEndCursor] = useState<string | null>(null);

  const navigate = useNavigate();
  const cart = useCart();
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    try {
      sessionStorage.setItem("shop_page_cursors_v1", JSON.stringify(pageCursors));
    } catch {
      // ignore
    }
  }, [pageCursors]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setError(null);

        if (pageIdx > 0 && !pageCursors[pageIdx]) {
          let cursors = [...pageCursors];
          let cursor: string | undefined = cursors[0];
          let lastEndCursor: string | null = null;
          for (let i = 0; i < pageIdx; i++) {
            const json = await fetchProducts(PRODUCTS_PER_PAGE, cursor);
            lastEndCursor = json.endCursor ?? null;
            cursor = lastEndCursor ?? undefined;
            if (!cursors[i + 1]) cursors[i + 1] = cursor;
          }
          if (!cancelled) setPageCursors(cursors);
        }

        const cursor = pageCursors[pageIdx];
        const json = await fetchProducts(PRODUCTS_PER_PAGE, cursor);
        if (!cancelled) {
          setProducts(json.products ?? []);
          setHasNextPage(!!json.hasNextPage);
          setEndCursor(json.endCursor ?? null);
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
  }, [pageIdx, pageCursors]);

  const canPrev = pageIdx > 0;
  const canNext = products.length === PRODUCTS_PER_PAGE && !!hasNextPage && !!endCursor;

  function goToPage(nextIdx: number) {
    const page = nextIdx + 1;
    if (page <= 1) setSearchParams({});
    else setSearchParams({ page: String(page) });
  }

  return (
    <div className="sh-container">
      <SiteHeader pageTitle="Omorenda Shop" subtitle="Products loaded from Shopify via your backend." />

      {isAuthenticated && user?.email ? <PastPurchases email={user.email} /> : null}

      {loading ? (
        <p style={{ color: "#666" }}>Loading products…</p>
      ) : error ? (
        <p style={{ color: "crimson" }}>{error}</p>
      ) : (
        <>
          <div className="sh-gridProducts">
            {products.map((p) => {
              const purchasable = p.availableForSale ? getFirstAvailableVariant(p) : null;
              const soldOut = !p.availableForSale || !purchasable;
              const variantId = purchasable?.id ?? null;
              const inCart = variantId ? cart.ids.has(variantId) : false;
              return (
                <article key={p.id} className="sh-card sh-cardPad">
                  <div className="sh-productImage">
                    {p.images?.[0]?.url ? (
                      <img src={p.images[0].url} alt={p.images[0].altText ?? p.title} />
                    ) : (
                      <div
                        style={{
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#aaa",
                          fontSize: 12,
                        }}
                      >
                        No image
                      </div>
                    )}
                  </div>

                  <h2 style={{ fontSize: 14, margin: "12px 0 6px", color: "var(--fg)", fontWeight: 900 }}>{p.title}</h2>
                  <div className="sh-row">
                    <span className={`sh-badge ${soldOut ? "sh-badgeOut" : "sh-badgeInStock"}`}>
                      {soldOut ? "Sold out" : "In stock"}
                    </span>
                  </div>
                  <div className="sh-row" style={{ alignItems: "baseline" }}>
                    <strong style={{ fontSize: 14, color: "var(--fg)" }}>${Number(p.price?.min?.amount ?? 0).toFixed(2)}</strong>
                    <span style={{ fontSize: 12, color: "var(--muted-fg)", fontWeight: 800 }}>
                      {p.price?.min?.currencyCode ?? "USD"}
                    </span>
                  </div>

                  <div className="sh-actionsCompact">
                    <button type="button" onClick={() => navigate(`/products/${encodeURIComponent(p.handle)}`)} className="sh-btn">
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!purchasable?.id) return;
                        cart.toggle({
                          productId: p.id,
                          productHandle: p.handle,
                          title: p.title,
                          imageUrl: p.images?.[0]?.url ?? null,
                          currency: p.price?.min?.currencyCode ?? "USD",
                          unitAmount: Number(p.price?.min?.amount ?? 0),
                          variantGid: purchasable.id,
                          variantTitle: purchasable.title,
                          availableForSale: purchasable.availableForSale,
                          quantityAvailable: typeof purchasable.quantityAvailable === "number" ? purchasable.quantityAvailable : null,
                        });
                      }}
                      disabled={soldOut || !variantId}
                      className="sh-btn"
                      style={{ background: inCart ? "rgba(24, 149, 136, 0.08)" : "#fff" }}
                    >
                      {inCart ? "Remove" : "Add to cart"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!purchasable?.id) return;
                        cart.add(
                          {
                            productId: p.id,
                            productHandle: p.handle,
                            title: p.title,
                            imageUrl: p.images?.[0]?.url ?? null,
                            currency: p.price?.min?.currencyCode ?? "USD",
                            unitAmount: Number(p.price?.min?.amount ?? 0),
                            variantGid: purchasable.id,
                            variantTitle: purchasable.title,
                            availableForSale: purchasable.availableForSale,
                            quantityAvailable: typeof purchasable.quantityAvailable === "number" ? purchasable.quantityAvailable : null,
                          },
                          1,
                        );
                        navigate("/checkout");
                      }}
                      disabled={soldOut}
                      className="sh-btn sh-btnPrimary sh-actionsBuy"
                    >
                      Buy Now
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {canPrev || canNext ? (
            <div className="sh-pagination">
              {canPrev ? (
                <button type="button" className="sh-btn" onClick={() => goToPage(Math.max(0, pageIdx - 1))}>
                  ← Prev
                </button>
              ) : (
                <span />
              )}
              {canNext ? (
                <button
                  type="button"
                  className="sh-btn"
                  onClick={() => {
                    if (!endCursor) return;
                    setPageCursors((arr) => {
                      const next = [...arr];
                      if (!next[pageIdx + 1]) next[pageIdx + 1] = endCursor;
                      return next;
                    });
                    goToPage(pageIdx + 1);
                  }}
                >
                  Next →
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

