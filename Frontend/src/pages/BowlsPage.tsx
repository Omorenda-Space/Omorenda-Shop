import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { listBowls, type Bowl } from "../api/bowls";

export function BowlsPage() {
  const [bowls, setBowls] = useState<Bowl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const list = await listBowls();
        if (!cancelled) setBowls(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load bowls");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="sh-container">
      <SiteHeader
        pageTitle="Singing Bowls"
        subtitle="101 hand-hammered bowls. Each purchase comes with a digital certificate of authenticity."
      />

      {loading ? (
        <p style={{ color: "#666" }}>Loading bowls…</p>
      ) : error ? (
        <p style={{ color: "crimson" }}>{error}</p>
      ) : bowls.length === 0 ? (
        <div className="sh-card" style={{ padding: 16 }}>
          <p style={{ margin: 0, color: "var(--muted-fg)", fontWeight: 800 }}>
            No bowls listed yet.
          </p>
        </div>
      ) : (
        <div className="sh-gridProducts">
          {bowls.map((b) => {
            const sold = b.status === "SOLD";
            return (
              <article key={b.id} className="sh-card sh-cardPad">
                <div className="sh-productImage" style={{ position: "relative" }}>
                  {b.imageUrl ? (
                    <img src={b.imageUrl} alt={b.name} />
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
                  {sold ? (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(31, 41, 46, 0.55)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                        fontSize: 18,
                        letterSpacing: 1,
                      }}
                    >
                      SOLD
                    </div>
                  ) : null}
                </div>

                <h2
                  style={{
                    fontSize: 14,
                    margin: "12px 0 6px",
                    color: "var(--fg)",
                    fontWeight: 900,
                  }}
                >
                  {b.name}
                </h2>
                <div className="sh-row">
                  <span
                    className={`sh-badge ${sold ? "sh-badgeOut" : "sh-badgeInStock"}`}
                  >
                    {sold ? "Sold" : `#${b.serialNumber} of 101`}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--muted-fg)",
                    fontWeight: 800,
                    marginTop: 4,
                  }}
                >
                  {b.note} · {b.frequency} Hz
                </div>
                <div className="sh-row" style={{ alignItems: "baseline" }}>
                  <strong style={{ fontSize: 14, color: "var(--fg)" }}>
                    ${Number(b.price).toFixed(2)}
                  </strong>
                  <span
                    style={{ fontSize: 12, color: "var(--muted-fg)", fontWeight: 800 }}
                  >
                    {b.currency}
                  </span>
                </div>

                <div className="sh-actionsCompact">
                  <button
                    type="button"
                    onClick={() => navigate(`/bowls/${b.serialNumber}`)}
                    className="sh-btn sh-btnPrimary sh-actionsBuy"
                  >
                    {sold ? "View certificate" : "View"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
