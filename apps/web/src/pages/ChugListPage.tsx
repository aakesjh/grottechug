// ChugListPage.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthSession } from "../auth/useAuthSession";
import { apiFetch } from "../lib/api";
import { LoadingCard } from "../components/LoadingCard";

type Semester = "2026V" | "2025H" | "all";

type Row = {
  participantId: string;
  name: string;
  isRegular: boolean;
  bestOverall: number | null;
  avgOverall: number | null;
};

type SessionCol = { sessionId: string; dateISO: string; note?: string | null };
type Cell = { seconds: number | null; note: string | null; violations?: string };

type TableResponse = {
  semester: string;
  columns: SessionCol[];
  rows: Row[];
  cells: Record<string, Record<string, Cell>>;
};

type ViolationEntry = {
  id: string;
  participantId: string;
  sessionId: string;
  ruleCode: string;
  crosses: number;
};

const PERF_CODES = ["MM", "W", "VW", "P", "T", "DNS", "DNF", "VOMIT", "KPR"] as const;
const WETNESS_CODES = new Set<string>(["MM", "W", "VW"]);


function fmtDDMMYYYY(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}
function fmtDDMMYYYYFromYYYYMMDD(yyyyMmDd: string) {
  const [y, m, d] = yyyyMmDd.split("-");
  if (!y || !m || !d) return yyyyMmDd;
  return `${d}/${m}/${y}`;
}

const RULE_COLORS: Record<string, string> = {
  MM: "#10b981", W: "#3b82f6", VW: "#6366f1", P: "#ef4444", T: "#14b8a6",
  DNS: "#f59e0b", DNF: "#f97316", VOMIT: "#ec4899", KPR: "#8b5cf6",
  ABSENCE: "#94a3b8"
};

function inferSemesterFromYYYYMMDD(yyyyMmDd: string): "2026V" | "2025H" {
  const [yStr, mStr] = yyyyMmDd.split("-");
  const y = Number(yStr);
  const m = Number(mStr);

  if (!Number.isFinite(y) || !Number.isFinite(m)) return "2026V";

  const isSpring = m >= 1 && m <= 6;

  if (y === 2026) return isSpring ? "2026V" : "2025H"; 
  if (y === 2025) return isSpring ? "2025H" : "2025H";
  return isSpring ? "2026V" : "2025H";
}

function parseSeconds(s: string) {
  const v = Number(String(s).trim().replace(",", "."));
  return Number.isFinite(v) ? v : NaN;
}

function cellKey(participantId: string, sessionId: string) {
  return `${participantId}|${sessionId}`;
}

export function ChugListPage() {
  const nav = useNavigate();
  const { isAdmin } = useAuthSession();
  const [semester, setSemester] = useState<Semester>("2026V");
  const [data, setData] = useState<TableResponse | null>(null);
  
  const [allViolations, setAllViolations] = useState<ViolationEntry[]>([]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editSessionId, setEditSessionId] = useState<string | null>(null);

  const [draftSeconds, setDraftSeconds] = useState<Record<string, string>>({});
  const [draftNote, setDraftNote] = useState<Record<string, string>>({});
  const [draftViolations, setDraftViolations] = useState<Record<string, string[]>>({});

  const [newDayOpen, setNewDayOpen] = useState(false);
  const [newDayDate, setNewDayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [textDate, setTextDate] = useState(() => fmtDDMMYYYYFromYYYYMMDD(new Date().toISOString().slice(0, 10)));
  const [newDaySemester, setNewDaySemester] = useState<"2026V" | "2025H">("2026V");

  useEffect(() => {
    setNewDaySemester(inferSemesterFromYYYYMMDD(newDayDate));
  }, [newDayDate]);

  function toISOFromDateInput(yyyyMmDd: string) {
    return new Date(`${yyyyMmDd}T12:00:00.000Z`).toISOString();
  }

  const [dirtyCells, setDirtyCells] = useState<Set<string>>(new Set());
  const [dirtySessionNote, setDirtySessionNote] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [sessionNote, setSessionNote] = useState("");

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    setData(null);
    
    const [resT, resV, resS] = await Promise.all([
      apiFetch(`/api/stats/table?semester=${semester}`),
      apiFetch(`/api/violations?semester=${semester}`),
      apiFetch(`/api/sessions?semester=${semester}`)
    ]);
    
    const json: TableResponse = await resT.json();
    const violationsJson: ViolationEntry[] = await resV.json();
    const sessionsJson: Array<{id: string, note: string | null}> = await resS.json();
    
    // Fletter inn 'note' fra sessions inn i kolonnene
    json.columns = json.columns.map(col => {
      const foundSession = sessionsJson.find(s => s.id === col.sessionId);
      return {
        ...col,
        note: foundSession?.note ?? null
      };
    });

    setData(json);
    setAllViolations(violationsJson);

    setEditSessionId(prev => (prev && json.columns.some(c => c.sessionId === prev) ? prev : null));
  }, [semester]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isAdmin) return;

    setNewDayOpen(false);
    setEditSessionId(null);
    setDirtyCells(new Set());
    setDirtySessionNote(false);
  }, [isAdmin]);

  function toggleExpand(id: string) {
    setExpandedIds(prev => prev.has(id) ? new Set() : new Set([id]));
  }


  const editSession = useMemo(() => {
    if (!data || !editSessionId) return null;
    return data.columns.find(c => c.sessionId === editSessionId) ?? null;
  }, [data, editSessionId]);

  const projectedTimes = useMemo(() => {
    if (!data) return {} as Record<string, number | null>;
    const result: Record<string, number | null> = {};
    for (const r of data.rows) {
      const pts: number[] = [];
      for (const col of data.columns) {
        const cell = data.cells?.[r.participantId]?.[col.sessionId];
        if (cell?.seconds != null) pts.push(cell.seconds);
      }
      if (pts.length < 2) { result[r.participantId] = null; continue; }
      const n = pts.length;
      const xs = pts.map((_, i) => i);
      const sumX = xs.reduce((a, b) => a + b, 0);
      const sumY = pts.reduce((a, b) => a + b, 0);
      const sumXY = xs.reduce((a, x, i) => a + x * pts[i], 0);
      const sumXX = xs.reduce((a, x) => a + x * x, 0);
      const denom = n * sumXX - sumX * sumX;
      const m = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
      const b = (sumY - m * sumX) / n;
      result[r.participantId] = Math.max(0, m * n + b);
    }
    return result;
  }, [data]);

  const sessionStats = useMemo(() => {
    if (!data) return {} as Record<string, { count: number; best: number | null; bestName: string | null; avg: number | null }>;
    const result: Record<string, { count: number; best: number | null; bestName: string | null; avg: number | null }> = {};
    for (const col of data.columns) {
      let count = 0;
      let best: number | null = null;
      let bestName: string | null = null;
      let total = 0;
      for (const r of data.rows) {
        const cell = data.cells?.[r.participantId]?.[col.sessionId];
        if (cell?.seconds != null) {
          count++;
          total += cell.seconds;
          if (best === null || cell.seconds < best) {
            best = cell.seconds;
            bestName = r.name;
          }
        }
      }
      result[col.sessionId] = { count, best, bestName, avg: count > 0 ? total / count : null };
    }
    return result;
  }, [data]);

  async function openEditor(sessionId: string) {
    if (!data || !isAdmin) return;

    setDirtyCells(new Set());
    setDirtySessionNote(false);
    setEditSessionId(sessionId);

    const nextSec: Record<string, string> = {};
    const nextNote: Record<string, string> = {};

    for (const r of data.rows) {
      const cell = data.cells?.[r.participantId]?.[sessionId];
      nextSec[r.participantId] = cell?.seconds == null ? "" : cell.seconds.toFixed(2);
      nextNote[r.participantId] = cell?.note ?? "";
    }
    setDraftSeconds(nextSec);
    setDraftNote(nextNote);

    const sRes = await apiFetch(`/api/sessions?semester=${semester}`);
    const sessions = await sRes.json() as Array<{ id: string; note?: string|null }>;
    const found = sessions.find(s => s.id === sessionId);
    setSessionNote(found?.note ?? "");

    const sessionViolations = allViolations.filter(v => v.sessionId === sessionId);
    const nextViolations: Record<string, string[]> = {};
    for (const r of data.rows) {
      nextViolations[r.participantId] = sessionViolations
        .filter(v => v.participantId === r.participantId)
        .map(v => v.ruleCode);
    }
    setDraftViolations(nextViolations);

    const first = data.rows.find(x => x.isRegular) ?? data.rows[0];
    if (first) setTimeout(() => inputRefs.current[first.participantId]?.focus(), 0);
  }

  function markDirty(pid: string, sid: string) {
    const k = cellKey(pid, sid);
    setDirtyCells(prev => {
      const next = new Set(prev);
      next.add(k);
      return next;
    });
  }

  function focusByIndex(idx: number) {
    if (!data) return;
    const r = data.rows[idx];
    if (!r) return;
    setTimeout(() => inputRefs.current[r.participantId]?.focus(), 0);
  }

  async function saveAll() {
    if (!data || !editSessionId || !isAdmin || isSaving) return;

    setIsSaving(true);

    try {
      const sid = editSessionId;
      const dirty = Array.from(dirtyCells);

      for (const k of dirty) {
        const [participantId, sessionId] = k.split("|");
        if (sessionId !== sid) continue;

        const secStr = (draftSeconds[participantId] ?? "").trim();
        const violations = draftViolations[participantId] ?? [];
        const seconds = secStr ? parseSeconds(secStr) : null;
        const hasValidTime = seconds !== null && Number.isFinite(seconds) && seconds > 0;

        if (!hasValidTime && violations.length === 0 && !draftNote[participantId]?.trim()) continue;
        if (secStr && !hasValidTime) continue;

        const note = (draftNote[participantId] ?? "").trim();

        await apiFetch("/api/attempts/upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participantId,
            sessionId: sid,
            seconds: hasValidTime ? seconds : null,
            note: note ? note : null,
            violations
          })
        });
      }

      if (dirtySessionNote) {
        await apiFetch(`/api/sessions/${sid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: sessionNote.trim() ? sessionNote.trim() : null })
        });
      }

      await load();

      setDirtyCells(new Set());
      setDirtySessionNote(false);
      setEditSessionId(null);
    } catch (e) {
      alert(`Kunne ikke lagre endringer.\n\n${String(e)}`);
    } finally {
      setIsSaving(false);
    }
  }

  const dirtyCount = dirtyCells.size + (dirtySessionNote ? 1 : 0);

  async function createNewDay() {
    if (!isAdmin) return;

    try {
      const dateISO = toISOFromDateInput(newDayDate);

      const res = await apiFetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateISO, semester: newDaySemester })
      });

      if (!res.ok) {
        const txt = await res.text(); 
        alert(`Kunne ikke opprette ny dag (${res.status}).\n\n${txt}`);
        return;
      }

      const created = await res.json(); 
      setNewDayOpen(false);

      setSemester(newDaySemester);

      setTimeout(async () => {
        await load();
        if (created?.id) {
          await openEditor(created.id);
        } else if (data?.columns?.length) {
          await openEditor(data.columns[data.columns.length - 1].sessionId);
        }
      }, 0);

    } catch (e) {
      alert(`Kunne ikke opprette ny dag (nettverksfeil).\n\n${String(e)}`);
    }
  }

  async function deleteSession(sessionId: string, dateISO: string) {
    if (!isAdmin) return;

    const confirmMessage = `Er du helt sikker på at du vil SLETTE hele listen for ${fmtDDMMYYYY(dateISO)}?\n\nAlle tider og anmerkninger for denne dagen vil bli slettet for alltid. Dette kan ikke angres!`;
    
    if (window.confirm(confirmMessage)) {
      try {
        const res = await apiFetch(`/api/sessions/${sessionId}`, {
          method: "DELETE"
        });

        if (!res.ok) {
          const txt = await res.text();
          alert(`Feil ved sletting: ${txt}`);
          return;
        }

        setEditSessionId(null);
        setDirtyCells(new Set());
        setDirtySessionNote(false);
        await load();

      } catch {
        alert("Nettverksfeil ved sletting.");
      }
    }
  }

  const sessionCount = data?.columns.length ?? 0;

  return (
    <div className="chuglist">
      {/* Hero header */}
      <div className="chuglist__hero">
        <h1 className="chuglist__title">Chuggelista</h1>
        <div className="chuglist__pills">
          <span className="chuglist__pill chuglist__pill--cyan">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            {sessionCount} økter
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="chuglist__toolbar">
        <div className="chuglist__toolbar-left">
          <div className="tabs">
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
          {isAdmin && <button className="btn" onClick={() => setNewDayOpen(true)}>+ Ny dag</button>}
        </div>

        <div className="chuglist__toolbar-right">
          {editSession ? (
            <>
              <span className="chuglist__pill chuglist__pill--warn">✏️ {fmtDDMMYYYY(editSession.dateISO)}</span>
              <span className="chuglist__pill">{dirtyCount} ulagret</span>
              <button className="btn btnPrimary" onClick={saveAll} disabled={dirtyCount === 0 || isSaving}>
                {isSaving ? "Lagrer..." : "Lagre"}
              </button>
              <button
                className="btn"
                onClick={() => {
                  setEditSessionId(null);
                  setDirtyCells(new Set());
                  setDirtySessionNote(false);
                }}
              >
                Lukk
              </button>
            </>
          ) : (
            isAdmin && <span className="chuglist__hint">Klikk ✏️ på en økt for å redigere</span>
          )}
        </div>
      </div>

      {isAdmin && newDayOpen && (
        <div className="modalOverlay">
          <div className="card modalCard">
            <h2>Legg til ny dag</h2>

            <label>Dato (dd/mm/yyyy)</label>
            <input
              className="input"
              type="text"
              placeholder="dd/mm/yyyy"
              value={textDate}
              onChange={e => {
                const val = e.target.value;
                setTextDate(val); 
                
                if (val.length === 10 && val.includes("/")) {
                  const [d, m, y] = val.split("/");
                  if (d && m && y && y.length === 4) {
                    setNewDayDate(`${y}-${m}-${d}`);
                  }
                }
              }}
            />

            <div className="chuglist__modal-semester-hint">
              Semester settes automatisk: <b style={{ color: "var(--text)" }}>{newDaySemester}</b>
            </div>

            <div className="u-spacer-sm" />

            <div className="u-spacer-sm" />
            <div className="u-flex u-flex-end" style={{ gap: 10 }}>
              <button className="btn" onClick={() => setNewDayOpen(false)}>Avbryt</button>
              <button className="btn" onClick={createNewDay}>Opprett</button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && editSession && data && (
        <div className="card chuglist__editor-card">
          <div className="chuglist__editor-header">
            <h2>Spreadsheet – {fmtDDMMYYYY(editSession.dateISO)}</h2>
            <button 
              className="btn chuglist__delete-btn" 
              onClick={() => deleteSession(editSession.sessionId, editSession.dateISO)}
            >
              Slett hele dagen
            </button>
          </div>

          <label>Dagsnotat</label>
          <input
            className="input"
            value={sessionNote}
            placeholder="F.eks. 'Kald øl, Tobias rant, to mm-chugs…'"
            onChange={e => {
              setSessionNote(e.target.value);
              setDirtySessionNote(true);
            }}
          />

          <div className="hr" />

          <div style={{ display: "grid", gap: 10 }}>
            {data.rows.map((r, idx) => {
              const activeViolations = draftViolations[r.participantId] ?? [];
              const isDirty = dirtyCells.has(cellKey(r.participantId, editSession.sessionId));
              return (
                <div key={r.participantId} className="chuglist__editor-row">
                  <button
                    className="name-link chuglist__name-btn"
                    onClick={() => nav(`/person/${r.participantId}`)}
                  >
                    {r.name}{r.isRegular ? "" : " (gjest)"}
                  </button>

                  <input
                    ref={el => { inputRefs.current[r.participantId] = el; }}
                    className={`input cellInput ${isDirty ? "cellDirty" : ""}`}
                    placeholder={projectedTimes[r.participantId] != null ? projectedTimes[r.participantId]!.toFixed(2) : "12.34"}
                    value={draftSeconds[r.participantId] ?? ""}
                    onChange={e => {
                      setDraftSeconds(prev => ({ ...prev, [r.participantId]: e.target.value }));
                      markDirty(r.participantId, editSession.sessionId);
                    }}
                    onKeyDown={e => {
                      if (e.key === "Escape") {
                        setEditSessionId(null);
                        setDirtyCells(new Set());
                        setDirtySessionNote(false);
                        return;
                      }
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (e.shiftKey) focusByIndex(idx - 1);
                        else focusByIndex(idx + 1);
                      } else if (e.key === "ArrowDown") {
                        e.preventDefault();
                        focusByIndex(idx + 1);
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        focusByIndex(idx - 1);
                      }
                    }}
                  />

                  {PERF_CODES.map(code => {
                    const active = activeViolations.includes(code);
                    return (
                      <button
                        key={code}
                        className={`btn chuglist__perf-btn ${active ? "chuglist__perf-btn--active" : "chuglist__perf-btn--inactive"}`}
                        onClick={() => {
                          setDraftViolations(prev => {
                            const cur = prev[r.participantId] ?? [];
                            const next = cur.includes(code)
                              ? cur.filter(c => c !== code)
                              : WETNESS_CODES.has(code)
                                // Allow only one wetness mark at a time (MM/W/VW).
                                ? [...cur.filter(c => !WETNESS_CODES.has(c)), code]
                                : [...cur, code];
                            return { ...prev, [r.participantId]: next };
                          });
                          markDirty(r.participantId, editSession.sessionId);
                        }}
                      >
                        {code}
                      </button>
                    );
                  })}

                  <span className="chuglist__separator">|</span>

                  {(() => {
                    const active = activeViolations.includes("ABSENCE");
                    return (
                      <button
                        className={`btn chuglist__perf-btn ${active ? "chuglist__absence-btn--active" : "chuglist__absence-btn--inactive"}`}
                        onClick={() => {
                          setDraftViolations(prev => {
                            const cur = prev[r.participantId] ?? [];
                            const next = cur.includes("ABSENCE")
                              ? cur.filter(c => c !== "ABSENCE")
                              : [...cur, "ABSENCE"];
                            return { ...prev, [r.participantId]: next };
                          });
                          markDirty(r.participantId, editSession.sessionId);
                        }}
                      >
                        ABSENCE
                      </button>
                    );
                  })()}

                  <input
                    className="input chuglist__note-input"
                    placeholder="notat (valgfritt)"
                    value={draftNote[r.participantId] ?? ""}
                    onChange={e => {
                      setDraftNote(prev => ({ ...prev, [r.participantId]: e.target.value }));
                      markDirty(r.participantId, editSession.sessionId);
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (e.shiftKey) focusByIndex(idx - 1);
                        else focusByIndex(idx + 1);
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div className="chuglist__editor-hint">
            Enter = ned, Shift+Enter = opp, piltaster flytter, Esc lukker. Trykk <b>Lagre</b> når du er ferdig.
          </div>
        </div>
      )}

      {/* Session accordion view */}
      <div className="card chuglist__table-card">
        {!data ? (
          <LoadingCard
            card={false}
            compact
            className="chuglist__inline-loading"
            title="Laster..."
            subtitle="Henter chuggeliste"
          />
        ) : (
          <div className="chuglist__sessions">
            {[...data.columns].reverse().map((col) => {
              const expanded = expandedIds.has(col.sessionId);
              const stats = sessionStats[col.sessionId];
              const hasDayNote = col.note && col.note.trim() !== "";

              // Get participants with times for this session, sorted by time
              const participants = data.rows
                .map(r => {
                  const cell = data.cells?.[r.participantId]?.[col.sessionId];
                  if (!cell || cell.seconds == null) return null;
                  const cellViolations = allViolations.filter(
                    v => v.participantId === r.participantId && v.sessionId === col.sessionId
                  );
                  return { ...r, cell, cellViolations };
                })
                .filter(Boolean)
                .sort((a, b) => a!.cell.seconds! - b!.cell.seconds!) as Array<Row & { cell: Cell; cellViolations: ViolationEntry[] }>;

              const guestParticipants = participants.filter(p => !p.isRegular);
              const regularParticipants = participants.filter(p => p.isRegular);

              return (
                <div
                  key={col.sessionId}
                  className={`chuglist__scard ${expanded ? "chuglist__scard--open" : ""}`}
                >
                  {/* Session header */}
                  <div
                    className="chuglist__scard-header"
                    onClick={() => toggleExpand(col.sessionId)}
                  >
                    <div className="chuglist__scard-date-row">
                      <button
                        className="chuglist__scard-date"
                        onClick={(e) => { e.stopPropagation(); nav(`/session/${col.sessionId}`); }}
                        title="Se dagsrapport"
                      >
                        {fmtDDMMYYYY(col.dateISO)}
                      </button>
                      {hasDayNote && (
                        <span className="chuglist__scard-daynote" title={col.note!} onClick={(e) => { e.stopPropagation(); nav(`/session/${col.sessionId}`); }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        </span>
                      )}
                      {isAdmin && (
                        <button
                          className="btn chuglist__scard-edit-btn"
                          onClick={(e) => { e.stopPropagation(); openEditor(col.sessionId); }}
                          title="Rediger denne dagen"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                        </button>
                      )}
                    </div>

                    <div className="chuglist__scard-stats">
                      <span className="chuglist__scard-stat" title="Deltakere">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                        {stats?.count ?? 0}
                      </span>
                      {stats?.best != null && (
                        <span className="chuglist__scard-stat chuglist__scard-stat--best" title="Beste tid">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          {stats.best.toFixed(2)}s
                        </span>
                      )}
                      {stats?.avg != null && (
                        <span className="chuglist__scard-stat chuglist__scard-stat--avg" title="Gjennomsnitt">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                          {stats.avg.toFixed(2)}s
                        </span>
                      )}
                    </div>

                    <span className={`chuglist__scard-chevron ${expanded ? "chuglist__scard-chevron--open" : ""}`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                  </div>

                  {/* Expanded: participant list */}
                  {expanded && (
                    <div className="chuglist__scard-body">
                      {hasDayNote && (
                        <div className="chuglist__scard-note">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                          <span>{col.note}</span>
                        </div>
                      )}

                      <div className="chuglist__scard-list">
                        {regularParticipants.length === 0 && guestParticipants.length === 0 && (
                          <div className="chuglist__prow-empty">Ingen registrerte tider</div>
                        )}
                        {regularParticipants.map((p, idx) => {
                          const note = p.cell.note ?? null;
                          return (
                            <div key={p.participantId} className="chuglist__scard-row">
                              <span className="chuglist__scard-row-rank">{idx + 1}</span>
                              <button
                                className="name-link chuglist__scard-row-name"
                                onClick={() => nav(`/person/${p.participantId}`)}
                              >
                                {p.name}
                              </button>
                              <span className="chuglist__scard-row-tags">
                                {p.cellViolations.map((v, i) => (
                                  <span key={i} className="chuglist__tag" style={{ borderColor: RULE_COLORS[v.ruleCode], color: RULE_COLORS[v.ruleCode] }}>{v.ruleCode}</span>
                                ))}
                                {note && (
                                  <span className="chuglist__tag chuglist__tag--note" title={note}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                  </span>
                                )}
                              </span>
                              <span className="chuglist__scard-row-time">{p.cell.seconds!.toFixed(2)}s</span>
                            </div>
                          );
                        })}
                        {guestParticipants.length > 0 && (
                          <>
                            <div className="chuglist__scard-guest-label">Gjester</div>
                            {guestParticipants.map((p, idx) => {
                              const note = p.cell.note ?? null;
                              return (
                                <div key={p.participantId} className="chuglist__scard-row chuglist__scard-row--guest">
                                  <span className="chuglist__scard-row-rank">{idx + 1}</span>
                                  <button
                                    className="name-link chuglist__scard-row-name"
                                    onClick={() => nav(`/person/${p.participantId}`)}
                                  >
                                    {p.name}
                                  </button>
                                  <span className="chuglist__scard-row-tags">
                                    {p.cellViolations.map((v, i) => (
                                      <span key={i} className="chuglist__tag" style={{ borderColor: RULE_COLORS[v.ruleCode], color: RULE_COLORS[v.ruleCode] }}>{v.ruleCode}</span>
                                    ))}
                                    {note && (
                                      <span className="chuglist__tag chuglist__tag--note" title={note}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                      </span>
                                    )}
                                  </span>
                                  <span className="chuglist__scard-row-time">{p.cell.seconds!.toFixed(2)}s</span>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
