import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { StoreHeader } from "../components/StoreHeader";
import { StoreFooter } from "../components/StoreFooter";
import { AuthGate } from "../components/AuthGate";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate("/");
  }, [isLoading, isAuthenticated, navigate]);

  return (
    <div className="om-page">
      <StoreHeader announce="Wild-harvested Himalayan botanicals — shipped worldwide." />
      <main className="om-main">
        <div className="om-shell om-pagehead">
          <h1>Sign in</h1>
          <p>Continue with Google to access your account.</p>
        </div>
        <div className="om-shell om-block" style={{ maxWidth: 460 }}>
          <AuthGate
            title="Welcome to Omorenda"
            subtitle="Sign in or create your account securely with Google."
          />
        </div>
      </main>
      <StoreFooter />
    </div>
  );
}

