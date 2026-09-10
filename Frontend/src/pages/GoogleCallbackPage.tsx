import { useEffect, useState } from "react";
import { completeGoogleZkLogin, readPending } from "../api/zklogin";
import { SiteHeader } from "../components/SiteHeader";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done" };

function parseHashIdToken(): string | null {
  const hash = window.location.hash || "";
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(trimmed);
  const token = params.get("id_token");
  return token && token.length > 0 ? token : null;
}

export function GoogleCallbackPage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const idToken = parseHashIdToken();
    if (!idToken) {
      setState({
        kind: "error",
        message: "Google sign-in did not return an id_token.",
      });
      return;
    }

    (async () => {
      try {
        const pending = readPending();
        await completeGoogleZkLogin(idToken);
        setState({ kind: "done" });
        // Hard navigation so the AuthContext re-initializes with the
        // freshly stored user.
        const returnTo = pending?.returnTo || "/";
        window.location.replace(returnTo);
      } catch (e) {
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : "Google sign-in failed",
        });
      }
    })();
  }, []);

  return (
    <div className="sh-container">
      <SiteHeader pageTitle="Signing you in…" />
      {state.kind === "loading" ? (
        <p style={{ color: "var(--muted-fg)" }}>Completing sign-in with Google…</p>
      ) : state.kind === "done" ? (
        <p style={{ color: "var(--fg)", fontWeight: 900 }}>Signed in. Redirecting…</p>
      ) : (
        <div>
          <p style={{ color: "crimson" }}>{state.message}</p>
          <p>
            <a href="/login" style={{ color: "var(--fg)", fontWeight: 900 }}>
              Try again
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
