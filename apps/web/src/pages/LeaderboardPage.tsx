import { useEffect, useMemo, useState } from "react";
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
  // Tar kun topp 3, men vi mapper [1, 0, 2] for å vise 2.plass til venstre, 1. i midten, 3. til høyre
  const top3 = rows.slice(0, 3);

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>{title}</h2>

      {!top3.length ? (
        <div style={{ color: "var(--muted)" }}>
          Ingen data (sjekk at API returnerer rader, og at faste har <code>isRegular=true</code>).
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          {[1, 0, 2].map(pos => {
            const r = top3[pos];
            const rank = pos === 0 ? 1 : pos === 1 ? 2 : 3;
            const label = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
            const height = pos === 0 ? 170 : pos === 1 ? 140 : 120;

            const hasBgImage = showAvatar && r?.imageUrl;
            const bgStyle = hasBgImage
              ? { 
                  backgroundImage: `url(${r.imageUrl})`, 
                  backgroundSize: "cover", 
                  backgroundPosition: "center" 
                }
              : { 
                  background: "rgba(0,0,0,0.18)" 
                };

            // Farger for rammene (Gull, Sølv, Bronse)
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
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: r ? "pointer" : "default",
                  textAlign: "center",
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center" // Sentrerer alt innhold i knappen
                }}
              >
                {/* Medalje over podiumet */}
                <div style={{ fontSize: "1.6rem", marginBottom: 6, lineHeight: 1 }}>{label}</div>

                {/* Selve podium-blokken (bildet/fargen) */}
                <div
                  style={{
                    height,
                    width: "100%", // Fyller knappens bredde
                    borderRadius: 18,
                    // Ramme og glød basert på rangering
                    border: r ? `3px solid ${theme.border}` : "2px dashed rgba(255,255,255,0.14)",
                    boxShadow: r ? `0 4px 15px ${theme.glow}` : "none",
                    ...bgStyle,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  {/* Vis kun Avatar inne i boksen hvis det ikke er bakgrunnsbilde */}
                  {r && showAvatar && !hasBgImage && <Avatar name={r.name} size={height * 0.4} />}
                  {!r && <div style={{ color: "var(--muted)" }}>—</div>}
                </div>

                {/* NYTT: Tekstinfo UNDER podium-blokken */}
                {r ? (
                  <div style={{ 
                    marginTop: 8, 
                    width: "100%", 
                    textAlign: "center",
                    color: "var(--text)", // Standard tekstfarge
                    display: "flex",
                    flexDirection: "column",
                    gap: 2
                  }}>
                    <div style={{ 
                      fontWeight: 700, // Litt mindre ekstremt enn 900 når det står på lys bakgrunn
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      width: "100%", 
                      fontSize: "0.85rem",
                    }}>
                      {r.name}
                    </div>
                    <div style={{ 
                      fontSize: "0.8rem", 
                      fontWeight: 500,
                      color: "var(--text)" 
                    }}>
                      {r.bestClean.toFixed(2)}s
                    </div>
                  </div>
                ) : (
                  // Tom plassholder for tekst så høyden forblir lik
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

// -- LeaderboardPage forblir uendret --
export function LeaderboardPage() {
  const nav = useNavigate();
  const [semester, setSemester] = useState<Semester>("2026V");
  const [data, setData] = useState<Resp | null>(null);
  const [showGuests, setShowGuests] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      // Merk: I et ekte prosjekt må du håndtere proxy/absolutt URL for fetch
      const res = await fetch(`/api/leaderboard?semester=${semester}`);
      const json: Resp = await res.json();
      setData(json);
    })();
  }, [semester]);

  const rows = data?.rows ?? [];

  const { topRegular, topAll } = useMemo(() => {
    const regularRows = rows.filter(r => r.isRegular);
    return {
      topRegular: regularRows,
      topAll: rows
    };
  }, [rows]);

  const tableRows = showGuests ? topAll : topRegular;

  return (
    <div>
      <h1>Toppliste</h1>
      <p>Rangert etter beste tid uten anmerkning.</p>

      <div className="tabs" style={{ marginTop: 10 }}>
        <button className={`tab ${semester === "2025H" ? "tabActive" : ""}`} onClick={() => setSemester("2025H")}>
          2025 Høst
        </button>
        <button className={`tab ${semester === "2026V" ? "tabActive" : ""}`} onClick={() => setSemester("2026V")}>
          2026 Vår
        </button>
        <button className={`tab ${semester === "all" ? "tabActive" : ""}`} onClick={() => setSemester("all")}>
          Total
        </button>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <div className="col" style={{ display: "grid", gap: 14, marginBottom: 20 }}>
          <Podium title="Podium (kun faste)" rows={topRegular} showAvatar />
          <Podium title="Best uansett (fast + gjest)" rows={topAll} showAvatar={false} />
        </div>

        <div className="col card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <h2 style={{ margin: 0 }}>Hele listen</h2>
            
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "var(--text)" }}>
              <input 
                type="checkbox" 
                checked={showGuests} 
                onChange={(e) => setShowGuests(e.target.checked)} 
              />
              Vis gjester
            </label>
          </div>

          <div className="tableWrap" style={{ marginTop: 14 }}>
            <table style={{ width: "100%", minWidth: 0, textAlign: "left", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th style={{ padding: 8, width: "50px", textAlign: "center" }}>#</th>
                  <th style={{ padding: 8 }}>Navn</th>
                  <th style={{ padding: 8, width: "80px" }}>Tid</th>
                  <th style={{ padding: 8, width: "100px" }}>Dato</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => {
                  const rank = i + 1;
                  
                  return (
                    <tr key={`${r.participantId}-${r.dateISO}-${i}`}>
                      <td style={{ padding: 8, fontWeight: 900, textAlign: "center", verticalAlign: "middle" }}>
                        {rank === 1 ? <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>🥇</span> :
                         rank === 2 ? <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>🥈</span> :
                         rank === 3 ? <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>🥉</span> :
                         <span>{rank}</span>}
                      </td>
                      <td style={{ padding: 8, whiteSpace: "normal" }}>
                        <button 
                          className="btn" 
                          style={{ 
                            padding: "6px 10px", 
                            margin: 0,
                            maxWidth: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "inline-block",
                            verticalAlign: "middle"
                          }} 
                          onClick={() => nav(`/person/${r.participantId}`)}
                        >
                          {r.name}
                        </button>
                      </td>
                      <td style={{ padding: 8, fontWeight: 500 }}>{r.bestClean.toFixed(2)}s</td>
                      <td style={{ padding: 8, color: "var(--muted)" }}>{fmtDDMMYYYY(r.dateISO)}</td>
                    </tr>
                  );
                })}
                {!tableRows.length && (
                  <tr>
                    <td colSpan={4} style={{ color: "var(--muted)", textAlign: "center", padding: 20 }}>
                      Ingen data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}