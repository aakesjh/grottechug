import { useEffect, useMemo, useState, useRef } from "react";
import confetti from "canvas-confetti";
import { LoadingCard } from "../components/LoadingCard";
import { WheelCanvas } from "../components/WheelCanvas";
import { useAuthSession } from "../auth/useAuthSession";
import { apiFetch } from "../lib/api";

type Participant = { id: string; name: string; isRegular: boolean; imageUrl?: string | null };

type Point = { dateISO: string; seconds: number; note: string | null };
type WinnerStats = {
  isVirgin: boolean;
  lastTime: number | null;
  avgTime: number | null;
  recordTime: number | null;
  projectedNext: number | null;
};

const TAU = Math.PI * 2;

function normalizeAngle(value: number) {
  const normalized = value % TAU;
  return normalized < 0 ? normalized + TAU : normalized;
}

function getInitials(name: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function WheelPage() {
  const { isAdmin } = useAuthSession();
  const [regulars, setRegulars] = useState<Participant[]>([]);
  const [loadingRegulars, setLoadingRegulars] = useState(true);
  const [selectedGuests, setSelectedGuests] = useState<Participant[]>([]);
  const [present, setPresent] = useState<Record<string, boolean>>({});

  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string>("");
  const [winnerImage, setWinnerImage] = useState<string | null>(null);
  const [winnerStats, setWinnerStats] = useState<WinnerStats | null>(null);

  const [guestQuery, setGuestQuery] = useState("");
  const [guestSuggestions, setGuestSuggestions] = useState<Participant[]>([]);
  const [guestLoading, setGuestLoading] = useState(false);

  const [freezeWheel, setFreezeWheel] = useState(false);
  const [wheelNames, setWheelNames] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [spinHistory, setSpinHistory] = useState<Array<{ name: string; imageUrl: string | null; time: string }>>([]);

  const [windowSize, setWindowSize] = useState({ w: 1000, h: 800 });

  // Referanser for idle-spin animasjonen
  const idleReqRef = useRef<number | undefined>(undefined);
  const angleRef = useRef(angle);

  // Hold angleRef oppdatert
  useEffect(() => {
    angleRef.current = angle;
  }, [angle]);

  // Håndter vindusstørrelse for responsivt hjul
  useEffect(() => {
    if (typeof window !== "undefined") {
      setWindowSize({ w: window.innerWidth, h: window.innerHeight });
      const handleResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // Last inn faste deltakere
  async function loadRegulars() {
    try {
      setLoadingRegulars(true);
      const res = await apiFetch(`/api/participants?includeGuests=false`);
      const data: Participant[] = await res.json();
      setRegulars(data);

      setPresent(prev => {
        const next = { ...prev };
        data.forEach(p => {
          if (next[p.id] === undefined) next[p.id] = true;
        });
        return next;
      });
    } catch (error) {
      console.error("Kunne ikke laste deltakere:", error);
    } finally {
      setLoadingRegulars(false);
    }
  }

  useEffect(() => {
    loadRegulars();
  }, []);

  useEffect(() => {
    // Clear search state when auth changes
    setGuestQuery("");
    setGuestSuggestions([]);
  }, [isAdmin]);

  // --- IDLE SPIN ANIMASJON ---
  useEffect(() => {
    // Stopp sakte-spinnet hvis vi aktivt spinner eller har en vinner på skjermen
    if (spinning || winner) return;

    let lastTime = performance.now();
    const idleSpin = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;
      angleRef.current = normalizeAngle(angleRef.current + (dt * 0.0004)); // Fart på idle-spinnet
      setAngle(angleRef.current);
      idleReqRef.current = requestAnimationFrame(idleSpin);
    };

    idleReqRef.current = requestAnimationFrame(idleSpin);

    return () => {
      if (idleReqRef.current) cancelAnimationFrame(idleReqRef.current);
    };
  }, [spinning, winner]);

  const allRegularsSelected = useMemo(() => {
    if (regulars.length === 0) return false;
    return regulars.every(p => !!present[p.id]);
  }, [regulars, present]);

  function toggleAllRegulars(checked: boolean) {
    setFreezeWheel(false);
    setPresent(prev => {
      const next = { ...prev };
      regulars.forEach(p => {
        next[p.id] = checked;
      });
      return next;
    });
  }

  function fmtSeconds(v: number | null | undefined) {
    return v == null ? "-" : `${v.toFixed(2)}s`;
  }

  // Søk etter gjester
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
        const res = await apiFetch(`/api/participants/search?query=${encodeURIComponent(q)}`);
        const data: Participant[] = await res.json();
        if (!alive) return;
        const visibleSuggestions = data
          .filter((participant) => (isAdmin ? true : !participant.isRegular))
          .filter((participant) => !selectedGuests.some((guest) => guest.id === participant.id))
          .slice(0, 8);
        setGuestSuggestions(visibleSuggestions);
      } catch (error) {
        console.error("Feil ved søk:", error);
      } finally {
        if (alive) {
          setGuestLoading(false);
        }
      }
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [guestQuery, isAdmin, selectedGuests]);

  const visiblePeople = useMemo(() => [...regulars, ...selectedGuests], [regulars, selectedGuests]);
  const candidateList = useMemo(() => visiblePeople.filter(p => !!present[p.id]), [visiblePeople, present]);
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
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 10000 });
  }

  // --- HOVEDFUNKSJON FOR Å SPINNE HJULET ---
  async function spin() {
    if (spinning) return;
    
    // Stopp idle-animasjonen umiddelbart
    if (idleReqRef.current) cancelAnimationFrame(idleReqRef.current);

    setWinner("");
    setWinnerImage(null);
    setWinnerStats(null);
    if (!candidateIds.length) return;

    const currentNames = [...candidateNames];
    setWheelNames(currentNames);
    setFreezeWheel(true);
    setSpinning(true);

    // Jevn deceleration fra start — én sammenhengende animasjon
    const startAngle = normalizeAngle(angleRef.current);
    const v0 = 0.035; // start-fart (rad/ms) — høy nok til å føles rask
    const animStart = performance.now();
    let cancelled = false;

    // Fase 1: Fri deceleration (før API-svar)
    // Bruker v(t) = v0 * (1 - t/T)^k med estimert T
    // Posisjonen: integral av v(t) dt = v0*T/(k+1) * [1 - (1-t/T)^(k+1)]
    const k = 3; // decelerasjonskurve-eksponent
    const estimatedDuration = 10000; // ms, foreløpig estimat
    let phase: "free" | "targeted" = "free";

    // Targeted-fase variabler (settes når API returnerer)
    let targetStartTime = 0;
    let targetStartAngle = 0;
    let targetEndAngle = 0;
    let targetDuration = 0;

    function getFreePosAndSpeed(now: number) {
      const elapsed = now - animStart;
      const t = Math.min(elapsed / estimatedDuration, 0.99); // Begrens til 99% slik at den ikke stopper helt
      const oneMinus = 1 - t;
      const pos = startAngle + (v0 * estimatedDuration / (k + 1)) * (1 - Math.pow(oneMinus, k + 1));
      const speed = v0 * Math.pow(oneMinus, k);
      return { pos, speed, elapsed };
    }

    function animate(now: number) {
      if (cancelled) return;

      if (phase === "free") {
        const { pos } = getFreePosAndSpeed(now);
        setAngle(pos);
        requestAnimationFrame(animate);
      } else {
        // Fase 2: Målrettet deceleration til endAngle
        const elapsed = now - targetStartTime;
        const t = Math.min(1, elapsed / targetDuration);
        // Easing: starter ved nåværende fart, bremser jevnt til 0
        // Bruker kubisk ease-out: pos = startAngle + totalDist * (1 - (1-t)^3)
        // Men vi tilpasser slik at startfarten matcher
        const eased = 1 - Math.pow(1 - t, 3);
        const totalDist = targetEndAngle - targetStartAngle;
        const currentAngle = targetStartAngle + totalDist * eased;
        
        setAngle(currentAngle);

        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          const finalAngle = normalizeAngle(targetEndAngle);
          angleRef.current = finalAngle;
          setAngle(finalAngle);
          cancelled = true;
          onSpinComplete();
        }
      }
    }

    let resolvedWinnerId = "";
    let resolvedWinnerName = "";

    function onSpinComplete() {
      setWinner(resolvedWinnerName);
      const img = candidateList.find(p => p.id === resolvedWinnerId)?.imageUrl || null;
      setWinnerImage(img);
      setPresent(prev => ({ ...prev, [resolvedWinnerId]: false }));
      setSpinHistory(prev => [{ name: resolvedWinnerName, imageUrl: img, time: new Date().toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" }) }, ...prev]);
      fireConfetti();
      setSpinning(false);
    }

    requestAnimationFrame(animate);

    try {
      const res = await apiFetch(`/api/wheel/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantIds: candidateIds })
      });
      const json = await res.json();
      const winnerId: string = json?.winner?.id;
      const winnerName: string = json?.winner?.name ?? "Ukjent";

      if (!winnerId) {
        cancelled = true;
        setSpinning(false);
        return;
      }

      resolvedWinnerId = winnerId;
      resolvedWinnerName = winnerName;

      // Hent vinnerstats mens hjulet spinner
      apiFetch(`/api/person/${winnerId}?semester=all`)
        .then(r => r.json())
        .then(data => {
          const points: Point[] = [...(data?.points || [])];
          points.sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime());

          if (points.length === 0) {
            setWinnerStats({
              isVirgin: true,
              lastTime: null,
              avgTime: null,
              recordTime: null,
              projectedNext: null
            });
            return;
          }

          const lastTime = points[points.length - 1].seconds;
          const avgTime = data?.stats?.avg ?? null;
          const recordTime = data?.stats?.bestClean ?? data?.stats?.best ?? null;

          let projectedNext: number | null = null;

          if (points.length >= 2) {
            const n = points.length;
            const xs = points.map((_, i) => i);
            const ys = points.map(pt => pt.seconds);

            const sumX = xs.reduce((a, b) => a + b, 0);
            const sumY = ys.reduce((a, b) => a + b, 0);
            const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
            const sumXX = xs.reduce((a, x) => a + x * x, 0);

            const denom = n * sumXX - sumX * sumX;
            const m = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
            const b = (sumY - m * sumX) / n;

            projectedNext = Math.max(0, m * n + b);
          }

          setWinnerStats({
            isVirgin: false,
            lastTime,
            avgTime,
            recordTime,
            projectedNext
          });
        })
        .catch(e => console.error(e));

      // Beregn målvinkel for vinneren
      const idx = currentNames.findIndex(name => name === winnerName);
      const n = currentNames.length;
      const step = TAU / n;
      
      // "Near Miss" — pekeren lander nær kanten av segmentet
      const direction = Math.random() > 0.5 ? 1 : -1; 
      const nearMissOffset = (Math.random() * 0.1 + 0.35) * direction; 
      
      const targetLocalAngle = (idx * step) + (step / 2) + (nearMissOffset * step);
      const baseAngle = TAU - targetLocalAngle;

      // Hent nåværende posisjon og fart fra fri-fasen
      const now = performance.now();
      const { pos: currentPos, speed: currentSpeed } = getFreePosAndSpeed(now);

      let nextAngle = baseAngle + Math.floor(currentPos / TAU) * TAU;
      if (nextAngle < currentPos) nextAngle += TAU;
      
      // Legg til nok ekstra rotasjoner basert på nåværende fart
      const minExtraSpins = 5;
      const endAngle = nextAngle + (TAU * (minExtraSpins + Math.floor(Math.random() * 3)));
      const remainingDist = endAngle - currentPos;
      
      // Beregn varighet slik at startfarten matcher nåværende fart
      // For ease-out kubisk: v(0) = 3 * totalDist / duration (derivert av (1-(1-t)^3) ved t=0)
      // Så duration = 3 * totalDist / currentSpeed
      const easePower = 3;
      const duration = Math.max(4000, (easePower * remainingDist) / currentSpeed);

      // Bytt til målrettet fase — sømløs overgang
      targetStartTime = now;
      targetStartAngle = currentPos;
      targetEndAngle = endAngle;
      targetDuration = duration;
      phase = "targeted";

    } catch (error) {
      console.error("Feil ved spin:", error);
      cancelled = true;
      setSpinning(false);
    }
  }

  function addExistingGuest(guest: Participant) {
    setFreezeWheel(false);
    if (guest.isRegular) {
      // Regular is already in the list, just check them in
      setPresent(prev => ({ ...prev, [guest.id]: true }));
    } else {
      setSelectedGuests(prev => (prev.some(x => x.id === guest.id) ? prev : [...prev, guest]));
      setPresent(prev => ({ ...prev, [guest.id]: true }));
    }
    setGuestQuery("");
    setGuestSuggestions([]);
  }

  async function addGuestByName(name: string) {
    const n = name.trim();
    if (!n) return;

    const existingGuest = guestSuggestions.find((guest) => guest.name.toLowerCase() === n.toLowerCase() && !guest.isRegular);
    if (!isAdmin) {
      if (existingGuest) addExistingGuest(existingGuest);
      return;
    }

    setFreezeWheel(false);
    try {
      const res = await apiFetch("/api/participants/guest-upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n })
      });
      const p: Participant = await res.json();
      if (!p.isRegular) addExistingGuest(p);
    } catch (error) {
      console.error("Feil ved tilføring av gjest:", error);
    }
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

  const wheelSize = isExpanded
    ? Math.min(windowSize.w * 0.95, windowSize.h * 0.8, 850)
    : Math.min(windowSize.w - 48, 480);

  const presentCount = regulars.filter(p => !!present[p.id]).length;

  if (loadingRegulars) {
    return (
      <LoadingCard
        title="Laster hjulet..."
        subtitle="Henter faste medlemmer"
        className="wheel-page__loading"
      />
    );
  }

  return (
    <div className="wheel-page">
      {!isExpanded && (
        <div className="wheel-page__hero">
          <h1 className="wheel-page__title">Hjulet</h1>
          <div className="wheel-page__subtitle">
            <span className="wheel-page__candidate-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              {candidateIds.length} kandidater
            </span>
          </div>
        </div>
      )}

      <div className="wheel-page__row">
        <div className="wheel-page__sidebar" style={{ display: isExpanded ? "none" : undefined }}>
          {/* --- Søk / legg til gjest --- */}
          <div className="wheel-page__section card">
            <div className="wheel-page__section-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <h2 className="wheel-page__section-title">Legg til gjest</h2>
            </div>
            <div className="wheel-page__search-row">
              <input
                id="guest-query"
                name="guestQuery"
                className="input"
                value={guestQuery}
                onChange={e => setGuestQuery(e.target.value)}
                placeholder={isAdmin ? "Søk eller skriv nytt navn…" : "Søk etter gjest…"}
              />
              {isAdmin && (
                <button className="btn" onClick={() => addGuestByName(guestQuery)} disabled={!guestQuery.trim()}>
                  Opprett
                </button>
              )}
            </div>

            {guestQuery.trim() && (
              <div className="wheel-page__suggestions">
                {guestLoading && <div className="wheel-page__search-loading">Søker…</div>}
                {guestSuggestions.map(s => (
                  <button key={s.id} className="wheel-page__suggestion-btn" onClick={() => addExistingGuest(s)}>
                    {s.imageUrl ? (
                      <img src={s.imageUrl} alt="" className="wheel-page__suggestion-avatar-img" />
                    ) : (
                      <span className="wheel-page__suggestion-avatar">{getInitials(s.name)}</span>
                    )}
                    <span className="wheel-page__suggestion-name">{s.name}</span>
                    <span className="wheel-page__suggestion-type">{s.isRegular ? "fast" : "gjest"}</span>
                  </button>
                ))}
                {!guestLoading && guestSuggestions.length === 0 && (
                  <div className="wheel-page__search-loading">Ingen treff</div>
                )}
              </div>
            )}
          </div>

          {/* --- Faste deltakere --- */}
          <div className="wheel-page__section card">
            <div className="wheel-page__section-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
              <h2 className="wheel-page__section-title">
                Faste medlemmer
                <span className="wheel-page__member-count">{presentCount}/{regulars.length}</span>
              </h2>
              <label className="wheel-page__select-all">
                <input
                  id="select-all-regulars"
                  name="selectAllRegulars"
                  type="checkbox"
                  checked={allRegularsSelected}
                  onChange={(e) => toggleAllRegulars(e.target.checked)}
                />
                Alle
              </label>
            </div>

            <div className="wheel-page__participant-list">
              {regulars.map(p => (
                <label key={p.id} className={`wheel-page__participant-row ${present[p.id] ? "wheel-page__participant-row--active" : ""}`}>
                  <input
                    name={`present-${p.id}`}
                    type="checkbox"
                    checked={!!present[p.id]}
                    onChange={e => togglePresent(p, e.target.checked)}
                    className="wheel-page__checkbox"
                  />
                  <span className="wheel-page__participant-name">{p.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* --- Gjester i dag --- */}
          {selectedGuests.length > 0 && (
            <div className="wheel-page__section card">
              <div className="wheel-page__section-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                <h2 className="wheel-page__section-title">
                  Gjester i dag
                  <span className="wheel-page__member-count">{selectedGuests.filter(g => !!present[g.id]).length}</span>
                </h2>
              </div>
              <div className="wheel-page__participant-list">
                {selectedGuests.map(p => (
                  <div key={p.id} className={`wheel-page__participant-row ${present[p.id] ? "wheel-page__participant-row--active" : ""}`}>
                    <label className="wheel-page__guest-inner">
                      <input
                        name={`present-guest-${p.id}`}
                        type="checkbox"
                        checked={!!present[p.id]}
                        onChange={e => togglePresent(p, e.target.checked)}
                        className="wheel-page__checkbox"
                      />
                      <span className="wheel-page__participant-name">{p.name}</span>
                      <span className="wheel-page__guest-badge">gjest</span>
                    </label>
                    {isAdmin && <button className="wheel-page__remove-btn" onClick={() => removeSelectedGuest(p.id)} title="Fjern gjest">✕</button>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          className={`wheel-page__canvas-col card wheel-page__canvas-area ${isExpanded ? "wheel-page__canvas-area--expanded" : ""}`}
          style={isExpanded ? undefined : { position: "relative" }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            title={isExpanded ? "Lukk fullskjerm" : "Fullskjerm"}
            className="wheel-page__fullscreen-btn"
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

          <div className="wheel-page__canvas-content">
            {/* Vinner-banner og Stats */}
            <div className="wheel-page__winner-area">
              {winner && !spinning ? (
                <>
                  <div className={`wheel-page__winner-name ${isExpanded ? "wheel-page__winner-name--expanded" : "wheel-page__winner-name--normal"}`}>
                    🎉 {winner} 🎉
                  </div>
                  {winnerStats && (
                    <div className={`wheel-page__winner-stats ${isExpanded ? "wheel-page__winner-stats--expanded" : "wheel-page__winner-stats--normal"}`}>
                      {winnerStats.isVirgin ? (
                        <span>Lykke til med jomfruchuggen! 🍻</span>
                      ) : (
                        <div className="wheel-page__stats-detail">
                          <span>Forrige: <b style={{ color: "var(--accent)" }}>{fmtSeconds(winnerStats.lastTime)}</b></span>
                          <span>Snitt: <b style={{ color: "var(--accent3)" }}>{fmtSeconds(winnerStats.avgTime)}</b></span>
                          <span>Rekord: <b style={{ color: "var(--accent4)" }}>{fmtSeconds(winnerStats.recordTime)}</b></span>
                          <span>Projisert: <b style={{ color: "var(--accent2)" }}>{fmtSeconds(winnerStats.projectedNext)}</b></span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="wheel-page__spacer">
                  {/* Skjult spacer for å holde høyden når hjulet spinner, teksten ligger inni selve canvaset nå */}
                  &nbsp;
                </div>
              )}
            </div>

            <div
              onClick={() => !spinning && spin()}
              className={`wheel-page__wheel-click ${spinning ? "wheel-page__wheel-click--spinning" : "wheel-page__wheel-click--idle"}`}
            >
              {winner && !spinning && (
                <div className="wheel-page__winner-overlay">
                  {winnerImage ? (
                    <img src={winnerImage} className="wheel-page__winner-img" />
                  ) : (
                    <div className="wheel-page__winner-initials" style={{ fontSize: wheelSize * 0.25 }}>
                      {getInitials(winner)}
                    </div>
                  )}
                </div>
              )}
              
              <WheelCanvas 
                size={wheelSize} 
                names={wheelNames.length ? wheelNames : ["Ingen"]} 
                angle={angle} 
                winnerName={winner} 
                isSpinning={spinning}
                imageSrc="/jatha-chug.png" /* Bytt ut med den faktiske bilde-URLen din her */
              />
            </div>

            {/* --- Spin Historikk under hjulet --- */}
            {spinHistory.length > 0 && !isExpanded && (
              <div className="wheel-page__history" style={{ maxWidth: wheelSize }}>
                <div className="wheel-page__history-header">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  <span>Historikk</span>
                </div>
                <div className="wheel-page__history-list">
                  {spinHistory.map((entry, i) => (
                    <div key={i} className={`wheel-page__history-item ${i === 0 ? "wheel-page__history-item--latest" : ""}`}>
                      <span className="wheel-page__history-number">#{spinHistory.length - i}</span>
                      <span className="wheel-page__history-name">{entry.name}</span>
                      <span className="wheel-page__history-time">{entry.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
