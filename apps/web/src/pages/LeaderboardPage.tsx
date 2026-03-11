import { useLayoutEffect, useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "../components/Avatar";

type Semester = "2026V" | "2025H" | "all";

type Row = {
  participantId: string;
  name: string;
  isRegular: boolean;
  imageUrl?: string | null;
  bestClean: number;
  dateISO: string;
};

type Resp = { semester: string; rows: Row[] };

function fmtDDMMYYYY(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function Podium({
  title,
  rows,
  showAvatar
}: {
  title: string;
  rows: Row[];
  showAvatar: boolean;
}) {
  const nav = useNavigate();
  const top3 = rows.slice(0, 3);

  return (
    <div className="card podium__card">
      <h2 style={{ marginTop: 0 }}>{title}</h2>

      {!top3.length ? (
        <div className="u-text-muted" style={{ flex: 1 }}>
          Ingen data funnet.
        </div>
      ) : (
        <div className="podium" style={{ flex: 1, paddingBottom: 10 }}>
          {[1, 0, 2].map(pos => {
            const r = top3[pos];
            const rank = pos === 0 ? 1 : pos === 1 ? 2 : 3;
            const label = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
            const height = pos === 0 ? 170 : pos === 1 ? 140 : 120;

            const hasBgImage = showAvatar && r?.imageUrl;
            const bgStyle = hasBgImage
              ? { backgroundImage: `url(${r.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
              : { background: "rgba(0,0,0,0.18)" };

            const frameColors = {
              1: { border: "#FFD700", glow: "rgba(255, 215, 0, 0.3)" },
              2: { border: "#C0C0C0", glow: "rgba(192, 192, 192, 0.3)" },
              3: { border: "#CD7F32", glow: "rgba(205, 127, 50, 0.3)" }
            };
            const theme = frameColors[rank as keyof typeof frameColors];

            return (
              <button
                key={pos}
                onClick={() => r && nav(`/person/${r.participantId}`)}
                disabled={!r}
                className={`podium__button ${r ? "podium__button--clickable" : ""}`}
              >
                <div className="podium__emoji">{label}</div>
                <div
                  className={`podium__frame ${!r ? "podium__frame--empty" : ""}`}
                  style={{
                    height,
                    ...(r ? { border: `3px solid ${theme.border}`, boxShadow: `0 4px 15px ${theme.glow}` } : {}),
                    ...bgStyle,
                  }}
                >
                  {r && showAvatar && !hasBgImage && <Avatar name={r.name} size={height * 0.4} />}
                  {!r && <div className="u-text-muted">—</div>}
                </div>
                {r ? (
                  <div className="podium__info">
                    <div className="podium__name">{r.name}</div>
                    <div className="podium__time">{r.bestClean.toFixed(2)}s</div>
                  </div>
                ) : (
                  <div style={{ marginTop: 8, fontSize: "0.85rem", color: "transparent" }}>&nbsp;</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LeaderboardPage() {
  const nav = useNavigate();
  const [semester, setSemester] = useState<Semester>("2026V");
  const [data, setData] = useState<Resp | null>(null);
  const [showGuests, setShowGuests] = useState<boolean>(false);
  
  const rightColRef = useRef<HTMLDivElement>(null);
  const [lockedHeight, setLockedHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/leaderboard?semester=${semester}`);
      const json: Resp = await res.json();
      setData(json);
    })();
  }, [semester]);

  const rows = data?.rows ?? [];
  const topRegular = useMemo(() => rows.filter(r => r.isRegular), [rows]);
  const tableRows = showGuests ? rows : topRegular;

  // Låser høyden basert på 2026V én gang
  useLayoutEffect(() => {
    if (semester === "2026V" && !showGuests && rightColRef.current && topRegular.length > 0) {
      const height = rightColRef.current.getBoundingClientRect().height;
      if (height > 100) {
        setLockedHeight(height);
      }
    }
  }, [data, semester, showGuests, topRegular]);

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
      </div>

      <div className="row u-mt-sm" style={{ alignItems: "stretch" }}>
        
        {/* Venstre kolonne - Podium */}
        <div 
          className="col u-flex" 
          style={{ 
            flexDirection: "column", 
            gap: 14, 
            minHeight: lockedHeight,
            height: lockedHeight
          }}
        >
          <Podium title="Podium (kun grottamedlemmer)" rows={topRegular} showAvatar />
          <Podium title="Best uansett" rows={rows} showAvatar />
        </div>

        {/* Høyre kolonne - Listen */}
        <div 
          className="col card u-flex" 
          ref={rightColRef}
          style={{ flexDirection: "column", minHeight: lockedHeight }}
        >
          <div className="leaderboard__list-header">
            <h2 style={{ margin: 0 }}>Hele listen</h2>
            <label className="leaderboard__guest-toggle">
              <input type="checkbox" checked={showGuests} onChange={(e) => setShowGuests(e.target.checked)} />
              Vis gjester
            </label>
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
                {tableRows.map((r: any, i) => (
                  <tr key={`${r.participantId}-${i}`} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="leaderboard__rank">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </td>
                    <td style={{ padding: "8px" }}>
                      <button 
                        className="btn leaderboard__name-btn" 
                        onClick={() => nav(`/person/${r.participantId}`)}
                      >
                        {r.name}
                      </button>
                    </td>
                    <td className="leaderboard__time">{r.bestClean.toFixed(2)}s</td>
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}