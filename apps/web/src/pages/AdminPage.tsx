import { Navigate, useLocation } from "react-router-dom";
import { useAuthSession } from "../auth/useAuthSession";

export function AdminPage() {
  const location = useLocation();
  const { isAdmin, isAuthenticated, isPending, user } = useAuthSession();
  const nextPath = `${location.pathname}${location.search}${location.hash}`;

  if (isPending) {
    return (
      <div style={{ padding: "40px 0" }}>
        <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
          <h1>Admin</h1>
          <p>Sjekker tilgang…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/login?next=${encodeURIComponent(nextPath)}`} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div style={{ display: "grid", gap: 18, padding: "24px 0 48px" }}>
      <section className="card">
        <h1>Admin</h1>
        <p>
          Midlertidig adminside for {user?.name}. Denne siden er bare tilgjengelig for innloggede admins.
        </p>
      </section>

      <section className="row" style={{ flexWrap: "wrap" }}>
        <div className="card col" style={{ minWidth: 260 }}>
          <h2>Dataverktøy</h2>
          <p>Plassholder for import, synk og vedlikehold av chug-data.</p>
        </div>

        <div className="card col" style={{ minWidth: 260 }}>
          <h2>Moderering</h2>
          <p>Plassholder for adminhandlinger knyttet til deltakere, regler og sesjoner.</p>
        </div>

        <div className="card col" style={{ minWidth: 260 }}>
          <h2>System</h2>
          <p>Plassholder for interne verktøy, status og fremtidige admininnstillinger.</p>
        </div>
      </section>
    </div>
  );
}
