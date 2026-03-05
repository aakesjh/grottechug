import { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import { WheelCanvas } from "../components/WheelCanvas";

// La til imageUrl i typen!
type Participant = { id: string; name: string; isRegular: boolean; imageUrl?: string | null };

// Hjelpefunksjon for å hente initialer hvis bilde mangler
function getInitials(name: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function WheelPage() {
  // Faste (alltid i lista)
  const [regulars, setRegulars] = useState<Participant[]>([]);
  // Gjester som er lagt til "i dag" (vises nederst i lista)
  const [selectedGuests, setSelectedGuests] = useState<Participant[]>([]);

  const [present, setPresent] = useState<Record<string, boolean>>({});

  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string>("");
  const [winnerImage, setWinnerImage] = useState<string | null>(null);

  // --- Add guest UI
  const [guestTabOpen, setGuestTabOpen] = useState(true);
  const [guestQuery, setGuestQuery] = useState("");
  const [guestSuggestions, setGuestSuggestions] = useState<Participant[]>([]);
  const [guestLoading, setGuestLoading] = useState(false);

  // --- States for å fryse hjulet ---
  const [freezeWheel, setFreezeWheel] = useState(false);
  const [wheelNames, setWheelNames] = useState<string[]>([]);

  // Hent KUN faste
  async function loadRegulars() {
    const res = await fetch(`/api/participants?includeGuests=false`);
    const data: Participant[] = await res.json();
    setRegulars(data);

    // Init presence: faste = true, men ikke overskriv gjester som allerede er valgt
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

  // Autocomplete søk mot DB
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

        // Vi viser forslag, men vi vil ikke liste opp alle gjester i UI ellers.
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

  // Kandidater = faste + selectedGuests som er huket av
  const visiblePeople = useMemo(() => [...regulars, ...selectedGuests], [regulars, selectedGuests]);

  const candidateList = useMemo(() => {
    return visiblePeople.filter(p => !!present[p.id]);
  }, [visiblePeople, present]);

  const candidateNames = useMemo(() => candidateList.map(p => p.name), [candidateList]);
  const candidateIds = useMemo(() => candidateList.map(p => p.id), [candidateList]);

  // Oppdater hjulnavnene kun når hjulet IKKE er frosset
  useEffect(() => {
    if (!freezeWheel) {
      setWheelNames(candidateNames);
    }
  }, [candidateNames, freezeWheel]);

  // Enkel av/på for tilstedeværelse
  function togglePresent(p: Participant, checked: boolean) {
    setFreezeWheel(false); // Tin opp hjulet ved manuell interaksjon
    setPresent(prev => ({ ...prev, [p.id]: checked }));
  }

  function fireConfetti() {
    // to "cannons" fra sidene
    const duration = 900;
    const end = Date.now() + duration;

    const shoot = (originX: number) => {
      confetti({
        particleCount: 70,
        startVelocity: 42,
        spread: 62,
        ticks: 200,
        origin: { x: originX, y: 0.55 }
      });
    };

    // burst nå
    shoot(0.05);
    shoot(0.95);

    // liten ekstra burst etter 250ms
    setTimeout(() => {
      shoot(0.08);
      shoot(0.92);
    }, 250);

    // micro-bursts i en kort periode for litt “cascade”
    (function frame() {
      if (Date.now() > end) return;
      confetti({
        particleCount: 6,
        startVelocity: 20,
        spread: 80,
        ticks: 120,
        origin: { x: Math.random() < 0.5 ? 0.1 : 0.9, y: 0.55 }
      });
      requestAnimationFrame(frame);
    })();
  }

  async function spin() {
    if (spinning) return;

    // Fjern gammel vinner og bilde umiddelbart
    setWinner("");
    setWinnerImage(null);

    // Hvis ingen er valgt, stopper vi her (da fungerer klikket kun som en "lukk bilde"-knapp)
    if (!candidateIds.length) return;

    // 1. Lås navnene i en lokal variabel FØR vi spinner.
    const currentNames = [...candidateNames];
    setWheelNames(currentNames);
    setFreezeWheel(true);
    
    setSpinning(true);

    // 2. Hent vinner fra API
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

    // Hent ut bildet til vinneren mens vi først vet hvem det er
    const winnerObj = candidateList.find(p => p.id === winnerId);
    const wImage = winnerObj?.imageUrl || null;

    // 3. Finn indeksen i den FROSNE listen
    const idx = currentNames.findIndex(name => name === winnerName);
    if (idx === -1) {
      setSpinning(false);
      alert("Spin feilet: vinneren finnes ikke i hjulet");
      return;
    }

    // 4. Matte for vinkelen
    const n = currentNames.length;
    const step = (Math.PI * 2) / n;

    // Finn lokal vinkel for midten av vinnerens kakestykke.
    const randomOffset = (Math.random() - 0.5) * (step * 0.7); 
    const targetLocalAngle = (idx * step) + (step / 2) + randomOffset;

    // Utregning som treffer nøyaktig når pekeren står kl. 3 (0 radianer)
    const baseAngle = (Math.PI * 2) - targetLocalAngle;

    // 5. Finn ut hvor mye hjulet skal snurre
    let nextAngle = baseAngle + Math.floor(angle / (Math.PI * 2)) * Math.PI * 2;
    if (nextAngle < angle) {
      nextAngle += Math.PI * 2;
    }

    // Legg til *nøyaktig* antall hele runder (8, 9 eller 10)
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
      setWinnerImage(wImage); // Sett bildet
      
      // Fjern vinneren fra neste spinn
      setPresent(prev => ({ ...prev, [winnerId]: false }));

      fireConfetti();
      setSpinning(false);
    }

    requestAnimationFrame(anim);
  }

  async function addGuestByName(name: string) {
    setFreezeWheel(false); // Tin opp hjulet

    const n = name.trim();
    if (!n) return;

    // Opprett hvis ikke finnes (eller returner eksisterende)
    const res = await fetch("/api/participants/guest-upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n })
    });

    const p: Participant = await res.json();

    // Hvis det var en fast (burde sjelden skje), bare huk den av
    if (p.isRegular) {
      setPresent(prev => ({ ...prev, [p.id]: true }));
      setGuestQuery("");
      setGuestSuggestions([]);
      return;
    }

    // Legg til nederst hvis den ikke allerede er lagt til i dag
    setSelectedGuests(prev => (prev.some(x => x.id === p.id) ? prev : [...prev, p]));

    // Huk den av (default)
    setPresent(prev => ({ ...prev, [p.id]: true }));

    setGuestQuery("");
    setGuestSuggestions([]);
  }

  function removeSelectedGuest(id: string) {
    setFreezeWheel(false); // Tin opp hjulet

    setSelectedGuests(prev => prev.filter(x => x.id !== id));
    setPresent(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  return (
    <div>
      <h1>Hjulet</h1>
      <p>Listen viser kun faste. Gjester må søkes opp og legges til.</p>

      <div className="row" style={{ marginTop: 14 }}>
        <div className="col card" style={{ maxWidth: 460 }}>
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

          {/* Kun faste + gjester lagt til i dag */}
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

        <div className="col card">
          <div style={{ display: "grid", placeItems: "center", gap: 14 }}>
            
            {/* Vinner-banneret øverst */}
            <div style={{ minHeight: 60, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              {winner && !spinning ? (
                <div style={{ fontSize: "2.8rem", fontWeight: 900, color: "var(--accent)" }}>
                  🎉 {winner} 🎉
                </div>
              ) : (
                <div style={{ color: "var(--muted)", fontSize: "1.2rem", fontWeight: 600 }}>
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
                // Vi snurrer på nytt (eller lukker bildet) hvis vi ikke allerede spinner
                if (!spinning && (candidateIds.length > 0 || winner)) spin();
              }}
              style={{
                cursor: spinning ? "default" : "pointer",
                borderRadius: "50%",
                transition: "transform 0.2s ease-in-out",
                transform: (!spinning && (candidateIds.length > 0 || winner)) ? "scale(1.02)" : "scale(1)",
                position: "relative",
                display: "inline-block" // Sørger for at wrapperen smyger seg rundt hjulet
              }}
              title={winner ? "Spinn på ny!" : "Spinn hjulet!"}
            >
              
              {/* Vinner-bildet som legger seg over hele hjulet */}
              {winner && !spinning && (
                <div style={{
                  position: "absolute",
                  inset: 0, // Dekker 100% av mor-diven (altså oppå WheelCanvas)
                  borderRadius: "50%",
                  overflow: "hidden",
                  background: "var(--bg)", 
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 0 0 6px var(--accent)", // Fin accent-ramme rundt vinneren
                  zIndex: 10
                }}>
                  {winnerImage ? (
                    <img 
                      src={winnerImage} 
                      alt={winner} 
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                    />
                  ) : (
                    <div style={{ fontSize: "6rem", fontWeight: 900, color: "var(--muted)" }}>
                      {getInitials(winner)}
                    </div>
                  )}
                </div>
              )}

              {/* Selve hjulet */}
              <WheelCanvas names={wheelNames.length ? wheelNames : ["Ingen"]} angle={angle} winnerName={winner} />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}