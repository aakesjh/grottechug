import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { LoadingCard } from "../components/LoadingCard";
import { apiFetch } from "../lib/api";

type Semester = "2026V" | "2025H" | "all";

type Row = {
  participantId: string;
  name: string;
  isRegular: boolean;
  imageUrl?: string | null;
  bestClean: number;
  dateISO: string;
  sessionId?: string;
};

type Resp = { semester: string; rows: Row[] };

function fmtDDMMYYYY(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

const MEDAL = ["🥇", "🥈", "🥉"] as const;
const PODIUM_COLORS = [
  { bg: "linear-gradient(180deg, rgba(255,215,0,0.18), rgba(255,215,0,0.06))", border: "#FFD700", glow: "0 0 20px rgba(255,215,0,0.2)" },
  { bg: "linear-gradient(180deg, rgba(192,192,192,0.14), rgba(192,192,192,0.04))", border: "#C0C0C0", glow: "0 0 16px rgba(192,192,192,0.15)" },
  { bg: "linear-gradient(180deg, rgba(205,127,50,0.14), rgba(205,127,50,0.04))", border: "#CD7F32", glow: "0 0 16px rgba(205,127,50,0.15)" },
];
const STAND_HEIGHTS = [100, 72, 52];

function MedalStand({ rows }: { rows: Row[] }) {
  const nav = useNavigate();
  const top3 = rows.slice(0, 3);
  // Display order: 2nd, 1st, 3rd
  const order = [1, 0, 2];

  return (
    <div className="podium">
      {order.map(pos => {
        const r = top3[pos];
        const colors = PODIUM_COLORS[pos];
        const standH = STAND_HEIGHTS[pos];

        if (!r) {
          return (
            <div key={pos} className="podium__slot">
              <div className="podium__medal">{MEDAL[pos]}</div>
              <div className="podium__avatar-wrap podium__avatar-wrap--empty">—</div>
              <div className="podium__stand podium__stand--empty" style={{ height: standH }} />
            </div>
          );
        }

        return (
          <button
            key={pos}
            className="podium__slot podium__slot--clickable"
            onClick={() => nav(`/person/${r.participantId}`)}
          >
            <div className="podium__medal">{MEDAL[pos]}</div>
            <div
              className="podium__avatar-wrap"
              style={{ borderColor: colors.border, boxShadow: colors.glow }}
            >
              {r.imageUrl
                ? <img src={r.imageUrl} alt={r.name} className="podium__avatar-img" />
                : <Avatar name={r.name} size={56} />
              }
            </div>
            <div className="podium__details">
              <div className="podium__name">{r.name}</div>
              <div className="podium__time">{r.bestClean.toFixed(2)}s</div>
            </div>
            <div
              className="podium__stand"
              style={{ height: standH, background: colors.bg, borderColor: colors.border }}
            >
              <span className="podium__stand-rank">{pos + 1}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function LeaderboardPage() {
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSemester = (() => {
    const value = searchParams.get("semester");
    return value === "2025H" || value === "2026V" || value === "all" ? value : "2026V";
  })();
  const [semester, setSemester] = useState<Semester>(initialSemester);
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGuests, setShowGuests] = useState<boolean>(searchParams.get("includeGuests") === "1");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const next = new URLSearchParams();
    next.set("semester", semester);
    if (showGuests) next.set("includeGuests", "1");
    setSearchParams(next, { replace: true });
  }, [semester, setSearchParams, showGuests]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setData(null);
        setError(null);
        const res = await apiFetch(`/api/leaderboard?semester=${semester}`);
        if (!res.ok) throw new Error("Kunne ikke hente topplisten");
        const json: Resp = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("Kunne ikke hente topplisten akkurat nå.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [semester]);

  const rows = data?.rows ?? [];
  const topRegular = useMemo(() => rows.filter(r => r.isRegular), [rows]);
  const baseRows = showGuests ? rows : topRegular;
  const tableRows = useMemo(() => {
    if (!search.trim()) return baseRows;
    const q = search.toLowerCase();
    return baseRows.filter(r => r.name.toLowerCase().includes(q));
  }, [baseRows, search]);

  const slowest = useMemo(() => tableRows.length ? Math.max(...tableRows.map(r => r.bestClean)) : 1, [tableRows]);
  const fastest = useMemo(() => tableRows.length ? Math.min(...tableRows.map(r => r.bestClean)) : 0, [tableRows]);

  const getRankClass = (i: number) => {
    if (i === 0) return "leaderboard__row--gold";
    if (i === 1) return "leaderboard__row--silver";
    if (i === 2) return "leaderboard__row--bronze";
    return "";
  };

  const getBarPct = (time: number) => {
    if (slowest === fastest) return 100;
    return 100 - ((time - fastest) / (slowest - fastest)) * 80;
  };

  if (!data && !error) {
    return (
      <LoadingCard
        title="Laster toppliste..."
        subtitle="Henter tider og rangering"
        className="leaderboard__loading"
      />
    );
  }

  if (error) {
    return (
      <div className="card leaderboard__loading" role="alert">
        {error}
      </div>
    );
  }

  return (
    <div className="leaderboard">
      <h1>Toppliste</h1>
      <p>Rangert etter beste tid uten anmerkning.</p>

      <div className="tabs u-mt-sm">
        {["2025H", "2026V", "all"].map((s) => (
          <button 
            key={s}
            className={`tab ${semester === s ? "tabActive" : ""}`} 
            onClick={() => setSemester(s as Semester)}
          >
            {s === "all" ? "Total" : s === "2025H" ? "2025 Høst" : "2026 Vår"}
          </button>
        ))}
        <button
          className={`tab ${showGuests ? "tabActive" : ""}`}
          onClick={() => setShowGuests(g => !g)}
        >
          Vis gjester
        </button>
      </div>

      {/* Podium */}
      <div className="card u-mt-sm">
        <MedalStand rows={showGuests ? rows : topRegular} />
      </div>

      {/* Table */}
      <div className="card u-mt-sm">
        <div className="leaderboard__list-header">
          <h2 style={{ margin: 0 }}>Hele listen</h2>
        </div>

        <div className="leaderboard__search-wrap">
          <input
            id="leaderboard-search"
            name="leaderboardSearch"
            type="text"
            className="leaderboard__search"
            placeholder="Søk etter navn..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="leaderboard__search-clear" onClick={() => setSearch("")}>✕</button>
          )}
        </div>

        <div className="tableWrap" style={{ border: "none", overflow: "visible" }}>
          <table className="leaderboard__table">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th>#</th>
                <th>Navn</th>
                <th>Tid</th>
                <th>Dato</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, i) => {
                const globalIdx = baseRows.indexOf(r);
                return (
                  <tr
                    key={`${r.participantId}-${i}`}
                    className={`leaderboard__row ${getRankClass(globalIdx)}`}
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <td className="leaderboard__rank">
                      {globalIdx === 0 ? "🥇" : globalIdx === 1 ? "🥈" : globalIdx === 2 ? "🥉" : globalIdx + 1}
                    </td>
                    <td className="leaderboard__name-cell">
                      <button 
                        className="leaderboard__name-btn" 
                        onClick={() => nav(`/person/${r.participantId}`)}
                      >
                        {r.name}
                      </button>
                      {!r.isRegular && <span className="leaderboard__guest-badge">gjest</span>}
                    </td>
                    <td className="leaderboard__time-cell">
                      <div className="leaderboard__time-bar-bg">
                        <div
                          className="leaderboard__time-bar"
                          style={{ width: `${getBarPct(r.bestClean)}%` }}
                        />
                      </div>
                      <span className="leaderboard__time-value">{r.bestClean.toFixed(2)}s</span>
                    </td>
                    <td style={{ padding: "8px" }}>
                      <button
                        className="leaderboard__date-btn"
                        onClick={() => nav(`/session/${r.sessionId}`)}
                        title="Se dagsrapport for denne kvelden"
                      >
                        {fmtDDMMYYYY(r.dateISO)}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {tableRows.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", padding: 20, color: "var(--muted)" }}>
                  {search ? "Ingen treff" : "Ingen data"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
