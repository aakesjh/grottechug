import { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import { WheelCanvas } from "../components/WheelCanvas";

type Participant = { id: string; name: string; isRegular: boolean; imageUrl?: string | null };

// Typer for å hente ut stats fra API-et
type Point = { dateISO: string; seconds: number; note: string | null };
type WinnerStats = {
  isVirgin: boolean;
  lastTime: number | null;
  avgTime: number | null;
  projectedNext: number | null;
};

// Hjelpefunksjon for å hente initialer hvis bilde mangler
function getInitials(name: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function WheelPage() {
  const [regulars, setRegulars] = useState<Participant[]>([]);
  const [selectedGuests, setSelectedGuests] = useState<Participant[]>([]);
  const [present, setPresent] = useState<Record<string, boolean>>({});

  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string>("");
  const [winnerImage, setWinnerImage] = useState<string | null>(null);
  const [winnerStats, setWinnerStats] = useState<WinnerStats | null>(null);

  const [guestTabOpen, setGuestTabOpen] = useState(true);
  const [guestQuery, setGuestQuery] = useState("");
  const [guestSuggestions, setGuestSuggestions] = useState<Participant[]>([]);
  const [guestLoading, setGuestLoading] = useState(false);

  const [freezeWheel, setFreezeWheel] = useState(false);
  const [wheelNames, setWheelNames] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  const [windowSize, setWindowSize] = useState({ w: 1000, h: 800 });
  useEffect(() => {
    if (typeof window !== "undefined") {
      setWindowSize({ w: window.innerWidth, h: window.innerHeight });
      const handleResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  async function loadRegulars() {
    const res = await fetch(`/api/participants?includeGuests=false`);
    const data: Participant[] = await res.json();
    setRegulars(data);

    setPresent(prev => {
      const next = { ...prev };
      data.forEach(p => {
        if (next[p.id] === undefined) next[p.id] = true;
      });
      return next;
    });
  }

  useEffect(() => {
    loadRegulars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = guestQuery.trim();
    if (!q) {
      setGuestSuggestions([]);
      return;
    }

    let alive = true;
    setGuestLoading(true);

    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/participants/search?query=${encodeURIComponent(q)}`);
        const data: Participant[] = await res.json();
        if (!alive) return;
        setGuestSuggestions(data.slice(0, 8));
      } finally {
        if (!alive) return;
        setGuestLoading(false);
      }
    }, 200);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [guestQuery]);

  const visiblePeople = useMemo(() => [...regulars, ...selectedGuests], [regulars, selectedGuests]);

  const candidateList = useMemo(() => {
    return visiblePeople.filter(p => !!present[p.id]);
  }, [visiblePeople, present]);

  const candidateNames = useMemo(() => candidateList.map(p => p.name), [candidateList]);
  const candidateIds = useMemo(() => candidateList.map(p => p.id), [candidateList]);

  useEffect(() => {
    if (!freezeWheel) {
      setWheelNames(candidateNames);
    }
  }, [candidateNames, freezeWheel]);

  function togglePresent(p: Participant, checked: boolean) {
    setFreezeWheel(false);
    setPresent(prev => ({ ...prev, [p.id]: checked }));
  }

  function fireConfetti() {
    const duration = 900;
    const end = Date.now() + duration;

    const shoot = (originX: number) => {
      confetti({
        particleCount: 70,
        startVelocity: 42,
        spread: 62,
        ticks: 200,
        origin: { x: originX, y: 0.55 },
        zIndex: 10000 
      });
    };

    shoot(0.05);
    shoot(0.95);

    setTimeout(() => {
      shoot(0.08);
      shoot(0.92);
    }, 250);

    (function frame() {
      if (Date.now() > end) return;
      confetti({
        particleCount: 6,
        startVelocity: 20,
        spread: 80,
        ticks: 120,
        origin: { x: Math.random() < 0.5 ? 0.1 : 0.9, y: 0.55 },
        zIndex: 10000
      });
      requestAnimationFrame(frame);
    })();
  }

  async function spin() {
    if (spinning) return;
    setWinner("");
    setWinnerImage(null);
    setWinnerStats(null);
    if (!candidateIds.length) return;

    const currentNames = [...candidateNames];
    setWheelNames(currentNames);
    setFreezeWheel(true);
    setSpinning(true);

    const res = await fetch(`/api/wheel/spin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantIds: candidateIds })
    });
    const json = await res.json();

    const winnerId: string | undefined = json?.winner?.id;
    const winnerName: string = json?.winner?.name ?? "Ukjent";
    
    if (!winnerId) {
      setSpinning(false);
      alert("Spin feilet: mangler winnerId");
      return;
    }

    const winnerObj = candidateList.find(p => p.id === winnerId);
    const wImage = winnerObj?.imageUrl || null;

    // --- HENT STATISTIKK FOR VINNEREN MENS HJULET SPINNER ---
    fetch(`/api/person/${winnerId}?semester=all`)
      .then(r => r.json())
      .then(data => {
        const points: Point[] = data?.points || [];
        // Sorter i tilfelle de ikke kommer i rekkefølge
        points.sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime());

        if (points.length === 0) {
          setWinnerStats({ isVirgin: true, lastTime: null, avgTime: null, projectedNext: null });
        } else {
          const lastTime = points[points.length - 1].seconds;
          const avgTime = data?.stats?.avg || null;
          let projectedNext = null;

          // Regn ut projisert tid (samme lineære regresjon som på profil-siden)
          if (points.length >= 2) {
            const n = points.length;
            const sumX = points.map((_, i) => i).reduce((a, b) => a + b, 0);
            const sumY = points.reduce((a, pt) => a + pt.seconds, 0);
            const sumXY = points.map((pt, i) => i * pt.seconds).reduce((a, b) => a + b, 0);
            const sumXX = points.map((_, i) => i * i).reduce((a, b) => a + b, 0);
            const denom = n * sumXX - sumX * sumX;
            const m = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
            const b = (sumY - m * sumX) / n;
            
            projectedNext = Math.max(0, m * n + b);
          }

          setWinnerStats({ isVirgin: false, lastTime, avgTime, projectedNext });
        }
      })
      .catch(e => console.error("Klarte ikke hente vinnerstats", e));

    const idx = currentNames.findIndex(name => name === winnerName);
    if (idx === -1) {
      setSpinning(false);
      alert("Spin feilet: vinneren finnes ikke i hjulet");
      return;
    }

    const n = currentNames.length;
    const step = (Math.PI * 2) / n;
    const randomOffset = (Math.random() - 0.5) * (step * 0.7); 
    const targetLocalAngle = (idx * step) + (step / 2) + randomOffset;
    const baseAngle = (Math.PI * 2) - targetLocalAngle;

    let nextAngle = baseAngle + Math.floor(angle / (Math.PI * 2)) * Math.PI * 2;
    if (nextAngle < angle) {
      nextAngle += Math.PI * 2;
    }

    const fullTurns = Math.floor(8 + Math.random() * 3);
    const extraSpins = fullTurns * Math.PI * 2;
    
    const endAngle = nextAngle + extraSpins;
    const startAngle = angle;
    const duration = 4600 + Math.random() * 800;
    const t0 = performance.now();
    const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);

    function anim(now: number) {
      const t = Math.min(1, (now - t0) / duration);
      const eased = easeOutQuint(t);
      const wobble = t > 0.85 ? Math.sin((t - 0.85) * 45) * (1 - t) * 0.18 : 0;
      
      setAngle(startAngle + (endAngle - startAngle) * eased + wobble);

      if (t < 1) {
        requestAnimationFrame(anim);
        return;
      }

      setAngle(endAngle % (Math.PI * 2)); 
      setWinner(winnerName);
      setWinnerImage(wImage);
      setPresent(prev => ({ ...prev, [winnerId]: false }));

      fireConfetti();
      setSpinning(false);
    }

    requestAnimationFrame(anim);
  }

  async function addGuestByName(name: string) {
    setFreezeWheel(false);
    const n = name.trim();
    if (!n) return;

    const res = await fetch("/api/participants/guest-upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n })
    });

    const p: Participant = await res.json();

    if (p.isRegular) {
      setPresent(prev => ({ ...prev, [p.id]: true }));
      setGuestQuery("");
      setGuestSuggestions([]);
      return;
    }

    setSelectedGuests(prev => (prev.some(x => x.id === p.id) ? prev : [...prev, p]));
    setPresent(prev => ({ ...prev, [p.id]: true }));
    setGuestQuery("");
    setGuestSuggestions([]);
  }

  function removeSelectedGuest(id: string) {
    setFreezeWheel(false);
    setSelectedGuests(prev => prev.filter(x => x.id !== id));
    setPresent(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  const maxExpandedSize = Math.min(windowSize.w * 0.9, windowSize.h * 0.75, 850);
  const wheelSize = isExpanded ? maxExpandedSize : 360;

  const isClickable = !spinning && (candidateIds.length > 0 || winner);
  const finalScale = isClickable ? 1.02 : 1; 

  return (
    <div>
      <h1 style={{ display: isExpanded ? "none" : "block" }}>Hjulet</h1>
      <p style={{ display: isExpanded ? "none" : "block" }}>Listen viser kun grottamedlemmer. Gjester må søkes opp og legges til.</p>

      <div className="row" style={{ marginTop: 14 }}>
        
        {/* Venstre kolonne skjules når hjulet er i fullskjerm */}
        <div className="col card" style={{ maxWidth: 460, display: isExpanded ? "none" : "block" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0 }}>Deltakere</h2>
            <button className="btn" onClick={() => setGuestTabOpen(v => !v)}>
              {guestTabOpen ? "Skjul gjest-tab" : "Legg til gjest"}
            </button>
          </div>

          {guestTabOpen && (
            <>
              <div className="hr" />
              <h2 style={{ fontSize: 14, marginTop: 0 }}>Legg til gjest</h2>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  className="input"
                  value={guestQuery}
                  onChange={e => setGuestQuery(e.target.value)}
                  placeholder="Søk eller skriv nytt navn…"
                />
                <button className="btn" onClick={() => addGuestByName(guestQuery)} disabled={!guestQuery.trim()}>
                  Legg til
                </button>
              </div>

              {guestQuery.trim() && (
                <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                  {guestLoading && <div style={{ color: "var(--muted)", fontSize: 13 }}>Søker…</div>}
                  {!guestLoading &&
                    guestSuggestions.map(s => (
                      <button
                        key={s.id}
                        className="btn"
                        style={{ textAlign: "left", padding: "8px 10px" }}
                        onClick={() => addGuestByName(s.name)}
                      >
                        {s.name} <span style={{ opacity: 0.7 }}>{s.isRegular ? "(fast)" : "(gjest)"}</span>
                      </button>
                    ))}
                </div>
              )}
            </>
          )}

          <div className="hr" />

          {/* Kun grottamedlemmer + gjester lagt til i dag */}
          <div style={{ display: "grid", gap: 8 }}>
            {regulars.map(p => (
              <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={!!present[p.id]}
                  onChange={e => togglePresent(p, e.target.checked)}
                />
                <span style={{ flex: 1 }}>{p.name}</span>
                <span className="badge">fast</span>
              </label>
            ))}

            {selectedGuests.length > 0 && (
              <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 13, fontWeight: 700 }}>
                Gjester lagt til i dag
              </div>
            )}

            {selectedGuests.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={!!present[p.id]}
                    onChange={e => togglePresent(p, e.target.checked)}
                  />
                  <span style={{ flex: 1 }}>{p.name}</span>
                  <span className="badge">gjest</span>
                </label>
                <button className="btn" onClick={() => removeSelectedGuest(p.id)} title="Fjern fra dagens hjul">
                  Fjern
                </button>
              </div>
            ))}
          </div>

          <div className="hr" />
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            Kandidater i hjulet: <b style={{ color: "var(--text)" }}>{candidateIds.length}</b>
          </div>
        </div>

        {/* Høyre kolonne (Selve Hjulet) */}
        <div 
          className="col card"
          style={{
            position: isExpanded ? "fixed" : "relative",
            inset: isExpanded ? 0 : "auto",
            zIndex: isExpanded ? 9999 : 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: isExpanded ? "100vw" : "auto",
            height: isExpanded ? "100vh" : "auto",
            borderRadius: isExpanded ? 0 : undefined,
            background: isExpanded ? "var(--bg, #111)" : "var(--card-bg)",
            margin: 0
          }}
        >
          {/* Fullscreen knapp */}
          <button
            onClick={(e) => {
              e.stopPropagation(); 
              setIsExpanded(!isExpanded);
            }}
            title={isExpanded ? "Lukk fullskjerm" : "Fullskjerm"}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              padding: 8,
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 8,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              color: "var(--text)",
              zIndex: 20,
              transition: "background 0.2s"
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
          >
            {isExpanded ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            )}
          </button>

          <div style={{ display: "grid", placeItems: "center", gap: isExpanded ? 24 : 14 }}>
            
            {/* Vinner-banneret øverst + Statistikk */}
            <div style={{ 
              minHeight: isExpanded ? 110 : 80, // Økt høyde for å gi plass til stats
              display: "flex", 
              flexDirection: "column",
              alignItems: "center", 
              justifyContent: "center", 
              textAlign: "center" 
            }}>
              {winner && !spinning ? (
                <>
                  <div style={{ 
                    fontSize: isExpanded ? "3.5rem" : "2.4rem", 
                    fontWeight: 900, 
                    color: "var(--accent)", 
                    textShadow: "0px 4px 15px rgba(0,0,0,0.5)",
                    lineHeight: 1.1
                  }}>
                    🎉 {winner} 🎉
                  </div>
                  
                  {/* Vis statistikk-pillen når API-et har svart */}
                  {winnerStats && (
                    <div style={{ 
                      marginTop: 8, 
                      fontSize: isExpanded ? "1.1rem" : "0.95rem", 
                      color: "var(--text)", 
                      fontWeight: 600, 
                      background: "rgba(0,0,0,0.3)", 
                      padding: "6px 16px", 
                      borderRadius: 30,
                      border: "1px solid rgba(255,255,255,0.08)"
                    }}>
                      {winnerStats.isVirgin ? (
                        <span>Lykke til med jomfruchuggen! 🍻</span>
                      ) : (
                        <div style={{ display: "flex", gap: isExpanded ? 20 : 12, flexWrap: "wrap", justifyContent: "center" }}>
                          <span>Forrige: <span style={{ color: "var(--accent)" }}>{winnerStats.lastTime?.toFixed(2)}s</span></span>
                          <span>Snitt: <span style={{ color: "var(--accent)" }}>{winnerStats.avgTime?.toFixed(2)}s</span></span>
                          {winnerStats.projectedNext != null && (
                            <span>Projisert: <span style={{ color: "var(--accent2)" }}>{winnerStats.projectedNext.toFixed(2)}s</span></span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: "var(--muted)", fontSize: isExpanded ? "1.5rem" : "1.2rem", fontWeight: 600 }}>
                  {spinning 
                    ? "Spinner..." 
                    : candidateIds.length > 0 
                      ? "Trykk på hjulet for å spinne!" 
                      : "Legg til deltakere for å spinne"}
                </div>
              )}
            </div>

            {/* Klikkbart hjul med overlay for bilde */}
            <div 
              onClick={() => {
                if (!spinning && (candidateIds.length > 0 || winner)) spin();
              }}
              style={{
                cursor: spinning ? "default" : "pointer",
                borderRadius: "50%",
                transition: "transform 0.2s ease-in-out",
                transform: `scale(${finalScale})`, 
                position: "relative",
                display: "inline-block", 
              }}
              title={winner ? "Spinn på ny!" : "Spinn hjulet!"}
            >
              
              {/* Vinner-bildet som legger seg over hele hjulet */}
              {winner && !spinning && (
                <div style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  overflow: "hidden",
                  background: "var(--bg)", 
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 0 0 6px var(--accent)", 
                  zIndex: 10
                }}>
                  {winnerImage ? (
                    <img 
                      src={winnerImage} 
                      alt={winner} 
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                    />
                  ) : (
                    <div style={{ fontSize: `${wheelSize * 0.25}px`, fontWeight: 900, color: "var(--muted)" }}>
                      {getInitials(winner)}
                    </div>
                  )}
                </div>
              )}

              {/* Selve hjulet */}
              <WheelCanvas size={wheelSize} names={wheelNames.length ? wheelNames : ["Ingen"]} angle={angle} winnerName={winner} />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}