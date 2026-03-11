import { useEffect, useState } from "react";

type Rule = { code: string; label: string; crosses: number; details?: string | null };

export function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [editing, setEditing] = useState<Rule | null>(null);

  const [label, setLabel] = useState("");
  const [crosses, setCrosses] = useState("");
  const [details, setDetails] = useState("");

  async function load() {
    const res = await fetch("/api/rules");
    const data: Rule[] = await res.json();
    setRules(data);
  }

  useEffect(() => { load(); }, []);

  function openEdit(r: Rule) {
    setEditing(r);
    setLabel(r.label);
    setCrosses(String(r.crosses));
    setDetails(r.details ?? "");
  }

  async function save() {
    if (!editing) return;
    const c = Number(crosses.replace(",", "."));
    if (!Number.isFinite(c)) {
      alert("Kryss må være et tall");
      return;
    }

    await fetch(`/api/rules/${editing.code}`, {
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
      <p>Her kan du redigere label, kryss og detaljer direkte i databasen.</p>

      <div className="card u-mt-md">
        <div className="tableWrap">
          <table style={{ minWidth: 800 }}>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Regel</th>
                <th>Kryss</th>
                <th>Detaljer</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.code}>
                  <td><span className="badge">{r.code}</span></td>
                  <td><b>{r.label}</b></td>
                  <td>{r.crosses}</td>
                  <td className="u-text-muted">{r.details ?? ""}</td>
                  <td className="u-text-right">
                    <button className="btn" onClick={() => openEdit(r)}>Rediger</button>
                  </td>
                </tr>
              ))}
              {!rules.length && (
                <tr><td colSpan={5} className="u-text-muted">Ingen regler</td></tr>
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