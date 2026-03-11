import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

type Person = {
  id: string;
  name: string;
  isRegular: boolean;
  imageUrl?: string | null;
};

type Cell = { seconds: number | null; note: string | null };
type TableResponse = {
  semester: string;
  columns: Array<{ sessionId: string; dateISO: string }>;
  rows: Array<{
    participantId: string;
    name: string;
    isRegular: boolean;
    bestOverall: number | null;
    avgOverall: number | null;
  }>;
  cells: Record<string, Record<string, Cell>>;
};

type GuestSortMode = "alpha" | "chugs";

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
  const [guestSortMode, setGuestSortMode] = useState<GuestSortMode>("alpha");
  const [chugCountById, setChugCountById] = useState<Record<string, number>>({});
  const [bestTimeById, setBestTimeById] = useState<Record<string, number | null>>({});

  useEffect(() => {
    (async () => {
      const [peopleRes, statsRes] = await Promise.all([
        apiFetch("/api/participants?includeGuests=true"),
        apiFetch("/api/stats/table?semester=all")
      ]);

      const peopleJson: Person[] = await peopleRes.json();
      const statsJson: TableResponse = await statsRes.json();

      setPeople(peopleJson);

      const counts: Record<string, number> = {};
      for (const personId of Object.keys(statsJson.cells ?? {})) {
        const rowCells = statsJson.cells[personId] ?? {};
        let count = 0;

        for (const sessionId of Object.keys(rowCells)) {
          const cell = rowCells[sessionId];
          if (cell?.seconds != null) count += 1;
        }

        counts[personId] = count;
      }

      setChugCountById(counts);

      const bests: Record<string, number | null> = {};
      for (const row of statsJson.rows ?? []) {
        bests[row.participantId] = row.bestOverall;
      }
      setBestTimeById(bests);
    })();
  }, []);

  const regularCards = useMemo(() => {
    return [...people.filter(p => p.isRegular)].sort((a, b) => a.name.localeCompare(b.name, "no"));
  }, [people]);

  const guestCards = useMemo(() => {
    const guests = [...people.filter(p => !p.isRegular)];

    if (guestSortMode === "alpha") {
      guests.sort((a, b) => a.name.localeCompare(b.name, "no"));
      return guests;
    }

    guests.sort((a, b) => {
      const ca = chugCountById[a.id] ?? 0;
      const cb = chugCountById[b.id] ?? 0;
      if (cb !== ca) return cb - ca;
      return a.name.localeCompare(b.name, "no");
    });

    return guests;
  }, [people, guestSortMode, chugCountById]);

  const renderCard = (p: Person) => {
    const chugCount = chugCountById[p.id] ?? 0;
    const bestTime = bestTimeById[p.id];

    return (
      <button
        key={p.id}
        className="grotta__card"
        onClick={() => nav(`/person/${p.id}`)}
        title={`Åpne profil: ${p.name}`}
      >
        <div className="grotta__card-image-frame">
          {p.imageUrl ? (
            <img src={p.imageUrl} alt={p.name} className="grotta__card-image" />
          ) : (
            <div className="grotta__card-initials">{getInitials(p.name)}</div>
          )}
          <div className="grotta__card-overlay">
            <div className="grotta__card-name">{p.name}</div>
            {(chugCount > 0 || bestTime != null) && (
              <div className="grotta__card-stats">
                {chugCount > 0 && <span className="grotta__stat">{chugCount} chugs</span>}
                {bestTime != null && <span className="grotta__stat grotta__stat--best">{bestTime.toFixed(2)}s</span>}
              </div>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="grotta">
      <div className="grotta__hero">
        <h1 className="grotta__title">Grotta</h1>
        <span className="grotta__count-pill">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
          {regularCards.length} medlemmer
        </span>
      </div>
      <p className="grotta__subtitle">Trykk på et kort for å se profil og statistikk.</p>

      <div className="grotta__grid">
        {regularCards.map(p => renderCard(p))}
        {!regularCards.length && (
          <div className="u-text-muted">Ingen grottamedlemmer registrert enda.</div>
        )}
      </div>

      <div className="grotta__toggle-guests">
        <button
          className={`grotta__toggle-btn ${showGuests ? "grotta__toggle-btn--active" : ""}`}
          onClick={() => setShowGuests(!showGuests)}
        >
          {showGuests ? "Skjul gjester" : `Vis gjester (${guestCards.length})`}
        </button>
      </div>

      {showGuests && (
        <div className="grotta__guests-section">
          <div className="grotta__guests-header">
            <h2 className="u-mb-0">Gjester</h2>

            <button
              className="btn grotta__sort-btn"
              onClick={() => setGuestSortMode(prev => (prev === "alpha" ? "chugs" : "alpha"))}
              title={guestSortMode === "alpha" ? "Sorter gjester etter antall chugs" : "Sorter gjester alfabetisk"}
            >
              <span className="grotta__sort-icon">
                {guestSortMode === "alpha" ? "A" : "🏆"}
              </span>
              <span className="grotta__sort-label">
                {guestSortMode === "alpha" ? "Alfabetisk" : "Flest chugs"}
              </span>
              <span className="grotta__sort-arrow">⇅</span>
            </button>
          </div>

          <div className="grotta__grid">
            {guestCards.map(p => renderCard(p))}
            {!guestCards.length && (
              <div className="u-text-muted">Ingen gjester registrert enda.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
