import { useEffect, useState } from "react";
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

  const [label, setLabel] = useState("");
  const [crosses, setCrosses] = useState("");
  const [details, setDetails] = useState("");

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

  return (
    <div>
      <h1>Regler</h1>
      <p>Her kan du se regelverket.</p>

      <div className="card u-mt-md rules__card">
        <div className="tableWrap rules__tableWrap">
          <table className="rules__table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Regel</th>
                <th className="rules__col-crosses">Kryss</th>
                <th className="rules__col-details">Detaljer</th>
                {isAdmin && <th className="rules__col-details" />}
                <th className="rules__col-chevron"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map(r => {
                const color = RULE_COLORS[r.code] || "var(--muted)";
                const isOpen = expandedCode === r.code;
                return (
                  <>
                    <tr
                      key={r.code}
                      className={`rules__row ${isOpen ? "rules__row--expanded" : ""}`}
                      onClick={() => setExpandedCode(prev => prev === r.code ? null : r.code)}
                    >
                      <td>
                        <span className="badge" style={{ borderColor: color, color }}>{r.code}</span>
                      </td>
                      <td><b>{r.label}</b></td>
                      <td className="rules__col-crosses">{r.crosses}</td>
                      <td className="rules__col-details u-text-muted">{r.details ?? ""}</td>
                      {isAdmin && (
                        <td className="rules__col-details u-text-right">
                          <button className="btn btn--sm" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>Rediger</button>
                        </td>
                      )}
                      <td className="rules__col-chevron">
                        <span className={`rules__chevron ${isOpen ? "rules__chevron--open" : ""}`}>▸</span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${r.code}-detail`} className="rules__expand-row">
                        <td colSpan={isAdmin ? 6 : 5}>
                          <div className="rules__expand-content">
                            <div className="rules__expand-item">
                              <span className="u-text-muted">Kryss:</span> <b>{r.crosses}</b>
                            </div>
                            {r.details && (
                              <div className="rules__expand-item">
                                <span className="u-text-muted">Detaljer:</span> {r.details}
                              </div>
                            )}
                            {isAdmin && (
                              <button className="btn btn--sm u-mt-xs" onClick={() => openEdit(r)}>Rediger</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {!rules.length && (
                <tr><td colSpan={isAdmin ? 6 : 5} className="u-text-muted">Ingen regler</td></tr>
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
