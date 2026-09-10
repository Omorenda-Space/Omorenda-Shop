import { useState } from "react";
import { startGoogleZkLogin } from "../api/zklogin";

export function GoogleWalletGate({ returnTo }: { returnTo: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connectGoogle() {
    setLoading(true);
    setError(null);
    try {
      await startGoogleZkLogin(returnTo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google connection failed");
      setLoading(false);
    }
  }

  return (
    <div className="sh-card" style={{ padding: 16 }}>
      <h2 style={{ margin: 0, fontSize: 16, color: "var(--fg)", fontWeight: 900 }}>
        Connect Google for your certificate
      </h2>
      <p style={{ marginTop: 8, marginBottom: 0, color: "var(--muted-fg)", fontSize: 13 }}>
        You are already logged in. Connect Google once so we can create the Sui wallet that receives your bowl's digital certificate.
      </p>
      {error ? <p style={{ marginBottom: 0, color: "crimson", fontSize: 13 }}>{error}</p> : null}
      <button
        type="button"
        onClick={() => void connectGoogle()}
        disabled={loading}
        className="sh-btn sh-btnPrimary"
        style={{
          width: "100%",
          marginTop: 12,
          opacity: loading ? 0.6 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615Z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A9 9 0 0 0 9 18Z"
          />
          <path
            fill="#FBBC05"
            d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A9 9 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332Z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9 0A9 9 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58Z"
          />
        </svg>
        {loading ? "Redirecting to Google…" : "Continue with Google"}
      </button>
      <p style={{ margin: "8px 0 0", color: "var(--muted-fg)", fontSize: 11, textAlign: "center" }}>
        After connecting, you will return here and checkout will continue.
      </p>
    </div>
  );
}
