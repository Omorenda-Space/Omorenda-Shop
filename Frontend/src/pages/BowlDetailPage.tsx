import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { useAuth } from "../auth/AuthContext";
import { AuthGate } from "../components/AuthGate";
import { GoogleWalletGate } from "../components/GoogleWalletGate";
import { BowlAudioPreview } from "../components/BowlAudioPreview";
import { createBowlCheckoutSession, getBowl, type Bowl } from "../api/bowls";

export function BowlDetailPage() {
  const { serial: serialParam } = useParams<{ serial: string }>();
  const serial = Number(serialParam);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [bowl, setBowl] = useState<Bowl | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [needsGoogle, setNeedsGoogle] = useState(false);
  const [pendingBuy, setPendingBuy] = useState(false);

  useEffect(() => {
    if (!Number.isInteger(serial) || serial < 1 || serial > 101) {
      setError("Invalid serial");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const b = await getBowl(serial);
        if (!cancelled) setBowl(b);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load bowl");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serial]);

  async function buyNow() {
    if (!bowl) return;
    if (!isAuthenticated) {
      setShowAuth(true);
      setPendingBuy(true);
      return;
    }
    if (!user?.hasSuiWallet) {
      setNeedsGoogle(true);
      return;
    }
    setBuying(true);
    setError(null);
    try {
      const res = await createBowlCheckoutSession({
        serial: bowl.serialNumber,
        successUrl: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/bowls/${bowl.serialNumber}`,
      });
      if (!res.url) throw new Error("Missing Stripe Checkout url");
      window.location.href = res.url;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to start checkout";
      if (message.includes("GOOGLE_SIGNIN_REQUIRED")) {
        // A legacy session may not have a wallet yet; the certificate wallet
        // is derived when that account is linked through Google.
        setNeedsGoogle(true);
        setShowAuth(true);
        setBuying(false);
        return;
      }
      if (message.includes("already sold")) {
        try {
          setBowl(await getBowl(serial));
        } catch {
          // keep the stale bowl; the error text below covers it
        }
        setError("This bowl has just been sold to another buyer.");
        setBuying(false);
        return;
      }
      setError(message);
      setBuying(false);
    }
  }

  useEffect(() => {
    if (pendingBuy && isAuthenticated && !buying) {
      setPendingBuy(false);
      void buyNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBuy, isAuthenticated]);

  useEffect(() => {
    if (
      searchParams.get("resumeCheckout") === "1" &&
      !authLoading &&
      !loading &&
      isAuthenticated &&
      user?.hasSuiWallet &&
      bowl &&
      !buying
    ) {
      setSearchParams({}, { replace: true });
      // Resume the user-requested checkout after the Google callback reloads this page.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void buyNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, authLoading, loading, isAuthenticated, user?.hasSuiWallet, bowl, buying]);

  const sold = bowl?.status === "SOLD";

  return (
    <div className="sh-container">
      <SiteHeader
        pageTitle={bowl ? bowl.name : "Singing Bowl"}
        left={
          <Link
            to="/bowls"
            style={{ color: "var(--fg)", textDecoration: "none", fontWeight: 900 }}
          >
            ← All bowls
          </Link>
        }
      />

      {!authLoading && showAuth && !isAuthenticated ? (
        <div style={{ marginBottom: 12 }}>
          <AuthGate
            title="Sign in to continue"
            subtitle="Continue with Google to purchase this bowl and receive its digital certificate."
          />
        </div>
      ) : null}

      {!authLoading && isAuthenticated && needsGoogle ? (
        <div style={{ marginBottom: 12 }}>
          <GoogleWalletGate returnTo={`/bowls/${serial}?resumeCheckout=1`} />
        </div>
      ) : null}

      {loading ? (
        <p style={{ color: "#666" }}>Loading…</p>
      ) : error ? (
        <p style={{ color: "crimson" }}>{error}</p>
      ) : !bowl ? (
        <p>Bowl not found.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 16,
          }}
        >
          <div
            className="sh-card sh-cardPad"
            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {bowl.imageUrl ? (
              <img
                src={bowl.imageUrl}
                alt={bowl.name}
                style={{ width: "100%", height: "auto", borderRadius: 12 }}
              />
            ) : (
              <div style={{ color: "#aaa" }}>No image</div>
            )}
          </div>

          <div className="sh-card sh-cardPad">
            <div className="sh-row">
              <span
                className={`sh-badge ${sold ? "sh-badgeOut" : "sh-badgeInStock"}`}
              >
                {sold ? "Sold" : `#${bowl.serialNumber} of 101`}
              </span>
            </div>
            <h1
              style={{
                fontSize: 22,
                margin: "8px 0 12px",
                color: "var(--fg)",
                fontWeight: 950,
              }}
            >
              {bowl.name}
            </h1>
            {bowl.description ? (
              <p style={{ color: "var(--muted-fg)", marginBottom: 16 }}>
                {bowl.description}
              </p>
            ) : null}

            <BowlAudioPreview audioUrl={bowl.audioUrl} bowlName={bowl.name} />

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              <tbody>
                <Row label="Serial" value={`#${bowl.serialNumber} of 101`} />
                <Row label="Weight" value={`${bowl.weightGrams} g`} />
                <Row label="Height" value={`${bowl.heightMm} mm`} />
                <Row label="Width" value={`${bowl.widthMm} mm`} />
                <Row label="Note" value={bowl.note} />
                <Row label="Frequency" value={`${bowl.frequency} Hz`} />
                <Row
                  label="Price"
                  value={`$${Number(bowl.price).toFixed(2)} ${bowl.currency}`}
                />
              </tbody>
            </table>

            <p
              style={{
                fontSize: 12,
                color: "var(--muted-fg)",
                marginBottom: 12,
                fontWeight: 700,
              }}
            >
              Each purchase comes with a digital certificate of authenticity
              recorded on the Sui network. You don't need a crypto wallet — we
              handle that automatically.
            </p>

            <button
              type="button"
              onClick={() => void buyNow()}
              disabled={sold || buying}
              className="sh-btn sh-btnPrimary"
              style={{
                width: "100%",
                cursor: sold || buying ? "not-allowed" : "pointer",
                opacity: sold || buying ? 0.6 : 1,
              }}
            >
              {sold
                ? "Already sold"
                : buying
                ? "Redirecting to checkout…"
                : "Buy Now"}
            </button>
            {sold && bowl.nftObjectId ? (
              <a
                href={`https://suiscan.xyz/testnet/object/${bowl.nftObjectId}`}
                target="_blank"
                rel="noreferrer"
                className="sh-btn"
                style={{
                  width: "100%",
                  marginTop: 8,
                  textAlign: "center",
                  display: "block",
                  textDecoration: "none",
                }}
              >
                View NFT on Sui Explorer →
              </a>
            ) : null}
            {!isAuthenticated ? (
              <p
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: "var(--muted-fg)",
                  fontWeight: 700,
                }}
              >
                You'll be asked to sign in or create an account before payment.
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => navigate("/bowls")}
              className="sh-btn"
              style={{ width: "100%", marginTop: 8 }}
            >
              Back to all bowls
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td
        style={{
          padding: "8px 0",
          color: "var(--muted-fg)",
          fontWeight: 800,
          borderBottom: "1px solid rgba(31, 41, 46, 0.08)",
        }}
      >
        {label}
      </td>
      <td
        style={{
          padding: "8px 0",
          color: "var(--fg)",
          fontWeight: 900,
          textAlign: "right",
          borderBottom: "1px solid rgba(31, 41, 46, 0.08)",
        }}
      >
        {value}
      </td>
    </tr>
  );
}
