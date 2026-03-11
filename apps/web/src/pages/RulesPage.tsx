import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthSession } from "../auth/useAuthSession";
import { apiFetch } from "../lib/api";

type Rule = { code: string; label: string; crosses: number; details?: string | null };

const RULE_COLORS: Record<string, string> = {
  MM: "#10b981", W: "#3b82f6", VW: "#6366f1", P: "#ef4444", T: "#14b8a6",
  DNS: "#f59e0b", DNF: "#f97316", VOMIT: "#ec4899", KPR: "#8b5cf6",
  ABSENCE: "#94a3b8"
};

export function RulesPage() {
  const { isAdmin } = useAuthSession();
  const [rules, setRules] = useState<Rule[]>([]);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [sortBy, setSortBy] = useState<"default" | "alpha-asc" | "alpha-desc" | "crosses-asc" | "crosses-desc">("default");

  const [label, setLabel] = useState("");
  const [crosses, setCrosses] = useState("");
  const [details, setDetails] = useState("");

  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newCrosses, setNewCrosses] = useState("");
  const [newDetails, setNewDetails] = useState("");

  async function load() {
    const res = await apiFetch("/api/rules");
    const data: Rule[] = await res.json();
    setRules(data);
  }

  useEffect(() => { load(); }, []);

  function openEdit(r: Rule) {
    if (!isAdmin) return;

    setEditing(r);
    setLabel(r.label);
    setCrosses(String(r.crosses));
    setDetails(r.details ?? "");
  }

  async function save() {
    if (!editing || !isAdmin) return;
    const c = Number(crosses.replace(",", "."));
    if (!Number.isFinite(c)) {
      alert("Kryss må være et tall");
      return;
    }

    await apiFetch(`/api/rules/${editing.code}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: label.trim(),
        crosses: c,
        details
      })
    });

    setEditing(null);
    load();
  }

  async function createRule() {
    if (!isAdmin) return;
    const code = newCode.trim().toUpperCase();
    if (!code || !newLabel.trim()) { alert("Kode og navn er påkrevd"); return; }
    const c = Number(newCrosses.replace(",", "."));
    if (!Number.isFinite(c)) { alert("Kryss må være et tall"); return; }

    await apiFetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, label: newLabel.trim(), crosses: c, details: newDetails })
    });

    setNewCode(""); setNewLabel(""); setNewCrosses(""); setNewDetails("");
    load();
  }

  const colCount = isAdmin ? 6 : 5;

  const sortedRules = useMemo(() => {
    const copy = [...rules];
    if (sortBy === "alpha-asc") copy.sort((a, b) => a.label.localeCompare(b.label));
    else if (sortBy === "alpha-desc") copy.sort((a, b) => b.label.localeCompare(a.label));
    else if (sortBy === "crosses-desc") copy.sort((a, b) => b.crosses - a.crosses);
    else if (sortBy === "crosses-asc") copy.sort((a, b) => a.crosses - b.crosses);
    return copy;
  }, [rules, sortBy]);

  return (
    <div>
      <h1>Regler</h1>
      <p>Her kan du se regelverket. Ny her? <Link to="/howto" style={{ color: "var(--accent2)", fontWeight: 600, textDecoration: "none" }}>Lær hvordan man chugger →</Link></p>

      <div className="rules__toolbar u-mt-md">
        {isAdmin && (
          <button className={`btn ${editMode ? "" : "btnGhost"}`} onClick={() => setEditMode(v => !v)}>
            {editMode ? "Ferdig" : "Rediger"}
          </button>
        )}
      </div>

      <div className="card u-mt-sm rules__card">
        <div className="tableWrap rules__tableWrap">
          <table className="rules__table">
            <thead>
              <tr>
                <th className="rules__col-code">Kode</th>
                <th className="rules__th-sortable" onClick={() => setSortBy(prev => prev === "alpha-asc" ? "alpha-desc" : prev === "alpha-desc" ? "default" : "alpha-asc")}>
                  Regel {sortBy === "alpha-asc" && <span className="rules__sort-arrow">▲</span>}{sortBy === "alpha-desc" && <span className="rules__sort-arrow">▼</span>}
                </th>
                <th className="rules__col-crosses rules__th-sortable" onClick={() => setSortBy(prev => prev === "crosses-desc" ? "crosses-asc" : prev === "crosses-asc" ? "default" : "crosses-desc")}>
                  Kryss {sortBy === "crosses-desc" && <span className="rules__sort-arrow">▼</span>}{sortBy === "crosses-asc" && <span className="rules__sort-arrow">▲</span>}
                </th>
                <th className="rules__col-details">Detaljer</th>
                {isAdmin && <th className="rules__col-details" />}
                <th className="rules__col-chevron"></th>
              </tr>
            </thead>
            <tbody>
              {sortedRules.map(r => {
                const color = RULE_COLORS[r.code] || "var(--muted)";
                const isOpen = expandedCode === r.code;
                return (
                  <>
                    <tr
                      key={r.code}
                      className={`rules__row ${isOpen ? "rules__row--expanded" : ""}`}
                      onClick={() => setExpandedCode(prev => prev === r.code ? null : r.code)}
                    >
                      <td className="rules__col-code">
                        <span className="badge" style={{ borderColor: color, color }}>{r.code}</span>
                      </td>
                      <td>
                        <b className="rules__label-desktop">{r.label}</b>
                        <b className="rules__label-mobile" style={{ color }}>{r.label}</b>
                      </td>
                      <td className="rules__col-crosses">{r.crosses}</td>
                      <td className="rules__col-details u-text-muted">{r.details ?? ""}</td>
                      {isAdmin && editMode && (
                        <td className="rules__col-details u-text-right">
                          <button className="rules__edit-btn" onClick={(e) => { e.stopPropagation(); openEdit(r); }} title="Rediger">✎</button>
                        </td>
                      )}
                      {isAdmin && !editMode && (
                        <td className="rules__col-details"></td>
                      )}
                      <td className="rules__col-chevron">
                        <span className={`rules__chevron ${isOpen ? "rules__chevron--open" : ""}`}>▸</span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${r.code}-detail`} className="rules__expand-row">
                        <td colSpan={colCount}>
                          <div className="rules__expand-content">
                            <div className="rules__expand-item rules__expand-badge">
                              <span className="badge" style={{ borderColor: color, color }}>{r.code}</span>
                            </div>
                            <div className="rules__expand-item">
                              <span className="u-text-muted">Kryss:</span> <b>{r.crosses}</b>
                            </div>
                            {r.details && (
                              <div className="rules__expand-item">
                                <span className="u-text-muted">Detaljer:</span> {r.details}
                              </div>
                            )}
                            {isAdmin && editMode && (
                              <button className="rules__edit-btn" onClick={() => openEdit(r)} title="Rediger">✎</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {!rules.length && (
                <tr><td colSpan={colCount} className="u-text-muted">Ingen regler</td></tr>
              )}
              {isAdmin && editMode && !showAddForm && (
                <tr className="rules__add-row">
                  <td colSpan={colCount}>
                    <button className="rules__add-btn" onClick={() => setShowAddForm(true)}>+</button>
                  </td>
                </tr>
              )}
              {isAdmin && editMode && showAddForm && (
                <tr className="rules__add-row">
                  <td colSpan={colCount}>
                    <div className="rules__add-form">
                      <h3 className="u-mb-xs">Legg til ny regel</h3>
                      <div className="rules__add-fields">
                        <div>
                          <label className="u-text-muted u-text-sm">Kode</label>
                          <input className="input" placeholder="F.eks. W" value={newCode} onChange={e => setNewCode(e.target.value)} />
                        </div>
                        <div>
                          <label className="u-text-muted u-text-sm">Navn</label>
                          <input className="input" placeholder="Wet" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
                        </div>
                        <div>
                          <label className="u-text-muted u-text-sm">Kryss</label>
                          <input className="input" placeholder="1" value={newCrosses} onChange={e => setNewCrosses(e.target.value)} />
                        </div>
                        <div style={{ flex: 2 }}>
                          <label className="u-text-muted u-text-sm">Detaljer</label>
                          <input className="input" placeholder="Valgfritt" value={newDetails} onChange={e => setNewDetails(e.target.value)} />
                        </div>
                      </div>
                      <div className="rules__add-actions u-mt-sm">
                        <button className="btn" onClick={createRule}>Opprett</button>
                        <button className="btn btnGhost" onClick={() => setShowAddForm(false)}>Avbryt</button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="modalOverlay">
          <div className="card modalCard" style={{ width: 520 }}>
            <h2>Rediger {editing.code}</h2>

            <label>Navn</label>
            <input className="input" value={label} onChange={e => setLabel(e.target.value)} />

            <div className="u-spacer-sm" />
            <label>Kryss</label>
            <input className="input" value={crosses} onChange={e => setCrosses(e.target.value)} />

            <div className="u-spacer-sm" />
            <label>Detaljer</label>
            <textarea className="input" rows={4} value={details} onChange={e => setDetails(e.target.value)} />

            <div className="u-spacer-md" />
            <div className="rules__modal-actions">
              <button className="btn" onClick={() => setEditing(null)}>Avbryt</button>
              <button className="btn" onClick={save}>Lagre</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
