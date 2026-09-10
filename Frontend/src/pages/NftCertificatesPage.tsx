import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { useAuth } from "../auth/AuthContext";
import { listMyNfts, type NftCertificate } from "../api/bowls";

const STATUS_COPY: Record<NftCertificate["status"], string> = {
  PENDING: "Preparing your certificate…",
  MINTING: "Engraving on-chain…",
  MINTED: "Ready",
  FAILED: "Action required — please contact support",
};

export function NftCertificatesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [nfts, setNfts] = useState<NftCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const list = await listMyNfts();
        if (!cancelled) setNfts(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  if (authLoading) {
    return (
      <div className="sh-container">
        <SiteHeader pageTitle="NFT certificates" />
        <p style={{ color: "#666" }}>Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="sh-container">
        <SiteHeader pageTitle="NFT certificates" />
        <div className="sh-card" style={{ padding: 16 }}>
          <p style={{ margin: 0 }}>
            Please <Link to="/login">sign in</Link> to view your digital certificates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sh-container">
      <SiteHeader
        pageTitle="NFT certificates"
        subtitle="Digital certificates of authenticity for the bowls you own."
      />

      {loading ? (
        <p style={{ color: "#666" }}>Loading…</p>
      ) : error ? (
        <p style={{ color: "crimson" }}>{error}</p>
      ) : nfts.length === 0 ? (
        <div className="sh-card" style={{ padding: 16 }}>
          <p style={{ margin: 0 }}>
            You don't have any certificates yet. <Link to="/bowls">Browse bowls →</Link>
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          {nfts.map((n) => (
            <article key={n.id} className="sh-card" style={{ padding: 14 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 12,
                    overflow: "hidden",
                    flex: "0 0 auto",
                    background: "rgba(13, 150, 136, 0.06)",
                    border: "1px solid rgba(31, 41, 46, 0.08)",
                  }}
                >
                  {n.bowl?.imageUrl ? (
                    <img
                      src={n.bowl.imageUrl}
                      alt={n.bowl.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : null}
                </div>
                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <div style={{ fontWeight: 950, color: "var(--fg)" }}>
                    {n.bowl?.name ?? "NFT certificate"}
                  </div>
                  <div
                    style={{ fontSize: 12, color: "var(--muted-fg)", marginTop: 4 }}
                  >
                    {n.bowl ? `#${n.bowl.serialNumber} of 101` : null} ·{" "}
                    {STATUS_COPY[n.status]}
                  </div>
                  {n.order ? (
                    <div
                      style={{ fontSize: 11, color: "var(--muted-fg)", marginTop: 4 }}
                    >
                      Purchased{" "}
                      {new Date(n.order.createdAt).toLocaleDateString()} · $
                      {Number(n.order.total).toFixed(2)} {n.order.currency}
                    </div>
                  ) : null}
                </div>
                <div style={{ flex: "0 0 auto" }}>
                  {n.suiObjectId ? (
                    <a
                      href={`https://suiscan.xyz/testnet/object/${n.suiObjectId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="sh-btn sh-btnPrimary"
                      style={{ textDecoration: "none" }}
                    >
                      View on Sui Explorer →
                    </a>
                  ) : (
                    <span
                      className="sh-badge"
                      style={{
                        background: "rgba(13, 150, 136, 0.08)",
                        color: "var(--muted-fg)",
                      }}
                    >
                      {STATUS_COPY[n.status]}
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
