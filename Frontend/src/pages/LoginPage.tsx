import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { AuthGate } from "../components/AuthGate";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate("/");
  }, [isLoading, isAuthenticated, navigate]);

  return (
    <div className="sh-container">
      <SiteHeader pageTitle="Sign in" subtitle="Continue with Google to access your account." />

      <AuthGate
        title="Welcome to Omorenda"
        subtitle="Sign in or create your account securely with Google."
      />
    </div>
  );
}

