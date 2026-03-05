import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type Person = {
  id: string;
  name: string;
  isRegular: boolean;
  imageUrl?: string | null;
};

// Hjelpefunksjon for å hente initialer (f.eks "Ola Nordmann" -> "ON")
function getInitials(name: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function GrottaPage() {
  const nav = useNavigate();
  const [people, setPeople] = useState<Person[]>([]);
  const [showGuests, setShowGuests] = useState(false);

  useEffect(() => {
    (async () => {
      // Henter NÅ også inn gjester fra backend!
      const res = await fetch("/api/participants?includeGuests=true");
      const json: Person[] = await res.json();
      setPeople(json);
    })();
  }, []);

  const cards = useMemo(() => people.filter(p => p.isRegular), [people]);
  const guestCards = useMemo(() => people.filter(p => !p.isRegular), [people]);

  // En liten hjelpefunksjon for å unngå å skrive samme kort-kode to ganger
  const renderCard = (p: Person) => (
    <button
      key={p.id}
      className="card cardCard"
      onClick={() => nav(`/person/${p.id}`)}
      style={{
        cursor: "pointer",
        padding: 12,
        textAlign: "left",
        border: "1px solid var(--border)",
        background: "rgba(0,0,0,0.16)",
        display: "flex",
        flexDirection: "column"
      }}
      title={`Åpne profil: ${p.name}`}
    >
      {/* Navn over bildet, sentrert i midten */}
      <div
        style={{
          fontWeight: 900,
          marginBottom: 10,
          fontSize: 20,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          color: "var(--text)",
          textAlign: "center"
        }}
      >
        {p.name}
      </div>

      {/* Bilde eller initialer */}
      <div
        style={{
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.05)",
          aspectRatio: "3 / 4",
          display: "grid",
          placeItems: "center",
          width: "100%"
        }}
      >
        {p.imageUrl ? (
          <img
            src={p.imageUrl}
            alt={p.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ 
            color: "var(--muted)", 
            fontWeight: 900, 
            fontSize: "3.5rem",
            opacity: 0.5
          }}>
            {getInitials(p.name)}
          </div>
        )}
      </div>
    </button>
  );

  return (
    <div style={{ paddingBottom: 60 }}>
      <h1>Grotta</h1>
      <p>Faste medlemmer. Trykk på et kort for profil.</p>

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
          gap: 14
        }}
      >
        {cards.map(renderCard)}

        {!cards.length && (
          <div style={{ color: "var(--muted)" }}>
            Ingen faste enda.
          </div>
        )}
      </div>

      <div style={{ marginTop: 40, textAlign: "center" }}>
        <button 
          className="btn" 
          onClick={() => setShowGuests(!showGuests)}
          style={{ padding: "10px 20px", fontSize: "1rem" }}
        >
          {showGuests ? "Skjul gjester" : "Vis gjester"}
        </button>
      </div>

      {showGuests && (
        <div style={{ marginTop: 30 }}>
          <h2 style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>Gjester</h2>
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
              gap: 14
            }}
          >
            {guestCards.map(renderCard)}
            
            {!guestCards.length && (
              <div style={{ color: "var(--muted)" }}>
                Ingen gjester registrert enda.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}