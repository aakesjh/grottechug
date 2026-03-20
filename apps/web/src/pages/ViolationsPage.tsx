import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthSession } from "../auth/useAuthSession";
import { apiFetch } from "../lib/api";
import { LoadingCard } from "../components/LoadingCard";

type Semester = "2026V" | "2025H" | "all";

type DetailRow = {
  participantId: string;
  name: string;
  isRegular: boolean;
  total: number;
  byRule: Record<string, number>;
};

type DetailResp = {
  semester: string;
  rows: DetailRow[];
};

type ViolationEntry = {
  id: string;
  participantId: string;
  participantName: string;
  isRegular: boolean;
  sessionId: string;
  dateISO: string;
  ruleCode: string;
  crosses: number;
  reason?: string | null;
};

type TableCell = {
  seconds: number | null;
  note: string | null;
};

type TableRow = {
  participantId: string;
  name: string;
  isRegular: boolean;
};

type TableResp = {
  columns: Array<{ sessionId: string; dateISO: string }>;
  rows: TableRow[];
  cells: Record<string, Record<string, TableCell>>;
};

type AwardCard = {
  id: string;
  title: string;
  winner: string;
  value: string;
  detail: string;
};

const EXCLUDED_LOWEST_PERCENT_NAMES = new Set(["ake"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const RULE_ORDER = ["DNS", "DNF", "MM", "W", "VW", "P", "ABSENCE", "VOMIT", "KPR"];
const RULE_LABELS: Record<string, string> = {
  DNS: "DNS", DNF: "DNF", MM: "MM", W: "W", VW: "VW",
  P: "P", ABSENCE: "Fravær", VOMIT: "Oppkast", KPR: "KPR"
};
const RULE_CROSSES: Record<string, number> = {
  DNS: 3, DNF: 2, MM: 0.5, W: 1, VW: 2, P: 1, ABSENCE: 2, VOMIT: 4, KPR: 1
};
const RULE_COLORS: Record<string, string> = {
  MM: "#10b981", W: "#3b82f6", VW: "#6366f1", P: "#ef4444", T: "#14b8a6",
  DNS: "#f59e0b", DNF: "#f97316", VOMIT: "#ec4899", KPR: "#8b5cf6",
  ABSENCE: "#94a3b8"
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function normalizeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function ViolationsPage() {
  const nav = useNavigate();
  const { isAdmin } = useAuthSession();
  const [semester, setSemester] = useState<Semester>("all");
  const [detail, setDetail] = useState<DetailResp | null>(null);
  const [tableData, setTableData] = useState<TableResp | null>(null);
  const [violations, setViolations] = useState<ViolationEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<Set<string>>(new Set());
  const [showGuests, setShowGuests] = useState(false);

  const loadDetail = useCallback(async () => {
    setDetail(null);
    try {
      const res = await apiFetch(`/api/crosses/detail?semester=${semester}`);
      const json: unknown = await res.json();

      if (isObject(json) && Array.isArray(json.rows)) {
        setDetail({
          semester: typeof json.semester === "string" ? json.semester : semester,
          rows: json.rows as DetailRow[],
        });
        return;
      }
    } catch {
      // Keep UI stable on failed/malformed responses.
    }

    setDetail({ semester, rows: [] });
  }, [semester]);

  const loadViolations = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/violations?semester=${semester}`);
      const json: unknown = await res.json();
      setViolations(Array.isArray(json) ? (json as ViolationEntry[]) : []);
    } catch {
      setViolations([]);
    }
  }, [semester]);

  const loadTableData = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/stats/table?semester=${semester}`);
      const json: unknown = await res.json();

      if (isObject(json) && Array.isArray(json.columns) && isObject(json.cells)) {
        setTableData({
          columns: json.columns as TableResp["columns"],
          rows: Array.isArray(json.rows) ? (json.rows as TableRow[]) : [],
          cells: json.cells as TableResp["cells"],
        });
        return;
      }
    } catch {
      // Keep UI stable on failed/malformed responses.
    }

    setTableData({ columns: [], rows: [], cells: {} });
  }, [semester]);

  function handleSemesterChange(next: Semester) {
    setExpandedId(null);
    setMobileExpanded(new Set());
    setSemester(next);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDetail();
      void loadViolations();
      void loadTableData();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadDetail, loadViolations, loadTableData]);

  async function deleteViolation(id: string) {
    if (!isAdmin) return;

    await apiFetch(`/api/violations/${id}`, { method: "DELETE" });
    loadViolations();
    loadDetail();
  }

  const detailRows = Array.isArray(detail?.rows) ? detail.rows : [];

  const visibleRows = showGuests
    ? detailRows
    : detailRows.filter(r => r.isRegular);

  const awards = useMemo<AwardCard[]>(() => {
    if (!visibleRows.length || !tableData) return [];

    const absenceSessionsByParticipant = new Map<string, Set<string>>();
    for (const violation of violations) {
      if (violation.ruleCode !== "ABSENCE") continue;
      const existing = absenceSessionsByParticipant.get(violation.participantId) ?? new Set<string>();
      existing.add(violation.sessionId);
      absenceSessionsByParticipant.set(violation.participantId, existing);
    }

    const rowsWithStats = visibleRows
      .map((row) => {
        const pCells = tableData.cells[row.participantId] ?? {};
        const chugSessionIds = new Set(
          Object.entries(pCells)
            .filter(([, cell]) => cell.seconds != null)
            .map(([sessionId]) => sessionId)
        );
        const absenceSessionIds = absenceSessionsByParticipant.get(row.participantId) ?? new Set<string>();
        const denominatorSessionIds = new Set([...chugSessionIds, ...absenceSessionIds]);
        const denominatorSessions = denominatorSessionIds.size;
        const violationCount = Object.values(row.byRule).reduce((sum, count) => sum + count, 0);
        const flooredCrossTotal = Math.floor(row.total);

        return {
          participantId: row.participantId,
          name: row.name,
          violationCount,
          crossTotal: row.total,
          flooredCrossTotal,
          denominatorSessions,
          weightedPerSession: denominatorSessions > 0 ? row.total / denominatorSessions : null,
          weightedPercent: denominatorSessions > 0 ? (flooredCrossTotal / denominatorSessions) * 100 : null,
        };
      })
      .filter((r) => r.denominatorSessions > 0);

    if (!rowsWithStats.length) return [];

    const mostViolations = rowsWithStats.reduce((best, current) => {
      return current.violationCount > best.violationCount ? current : best;
    });

    const mostCrosses = rowsWithStats.reduce((best, current) => {
      return current.crossTotal > best.crossTotal ? current : best;
    });

    const highestAvg = rowsWithStats.reduce((best, current) => {
      if (current.weightedPerSession == null) return best;
      if (best.weightedPerSession == null) return current;
      return current.weightedPerSession > best.weightedPerSession ? current : best;
    });

    const eligibleLowestPercent = rowsWithStats.filter(
      (row) => !EXCLUDED_LOWEST_PERCENT_NAMES.has(normalizeName(row.name))
    );

    const lowestPercentPool = eligibleLowestPercent.length ? eligibleLowestPercent : rowsWithStats;

    const lowestPercent = lowestPercentPool.reduce((best, current) => {
      if (current.weightedPercent == null) return best;
      if (best.weightedPercent == null) return current;
      return current.weightedPercent < best.weightedPercent ? current : best;
    });

    const totalWeightedViolations = rowsWithStats.reduce((sum, r) => sum + r.crossTotal, 0);

    return [
      {
        id: "most-violations",
        title: "Flest brudd",
        winner: mostViolations.name,
        value: `${mostViolations.violationCount}`,
        detail: `Brudd i perioden`,
      },
      {
        id: "most-crosses",
        title: "Flest kryss",
        winner: mostCrosses.name,
        value: `${Math.floor(mostCrosses.crossTotal)}`,
        detail: `Vektet sum`,
      },
      {
        id: "highest-average",
        title: "Høyest snitt",
        winner: highestAvg.name,
        value: `${(highestAvg.weightedPerSession ?? 0).toFixed(2)}`,
        detail: `${Math.floor(highestAvg.crossTotal)}/${highestAvg.denominatorSessions} sesjoner`,
      },
      {
        id: "lowest-percent",
        title: "Lavest %",
        winner: lowestPercent.name,
        value: `${(lowestPercent.weightedPercent ?? 0).toFixed(1)}%`,
        detail: `${lowestPercent.flooredCrossTotal}/${lowestPercent.denominatorSessions} sesjoner`,
      },
      {
        id: "total-violations",
        title: "Totalt",
        winner: "Alle",
        value: `${Math.floor(totalWeightedViolations)}`,
        detail: `Alle kryss`,
      },
    ];
  }, [visibleRows, tableData, violations]);

  const usedRules = new Set(visibleRows.flatMap(r => Object.keys(r.byRule)));
  const ruleCols = RULE_ORDER.filter(r => usedRules.has(r));


  return (
    <div>
      <h1>Kryssliste</h1>

      <div className="sheetBar">
        <div className="tabs">
          <button
            className={`tab ${semester === "2025H" ? "tabActive" : ""}`}
            onClick={() => handleSemesterChange("2025H")}
          >
            2025 Høst
          </button>
          <button
            className={`tab ${semester === "2026V" ? "tabActive" : ""}`}
            onClick={() => handleSemesterChange("2026V")}
          >
            2026 Vår
          </button>
          <button
            className={`tab ${semester === "all" ? "tabActive" : ""}`}
            onClick={() => handleSemesterChange("all")}
          >
            Total
          </button>
        </div>
        <div className="violations__controls">
          <button className={`btn ${showGuests ? "" : "btnGhost"}`} onClick={() => setShowGuests(v => !v)}>
            {showGuests ? "Skjul gjester" : "Vis gjester"}
          </button>
        </div>
      </div>

      {!!awards.length && (
        <div className="violations__awards-wrap u-mt-md u-mb-sm">
          <div className="violations__awards-grid">
            {awards.map((award) => (
              <article key={award.id} className="card violations__award-card">
                <div className="violations__award-title">{award.title}</div>
                <div className="violations__award-value">{award.value}</div>
                <div className="violations__award-winner">{award.winner}</div>
                <div className="violations__award-detail">{award.detail}</div>
              </article>
            ))}
          </div>
        </div>
      )}

      <div className="card u-mt-md violations__card">
        {!detail ? (
          <LoadingCard
            card={false}
            compact
            className="violations__inline-loading"
            title="Laster..."
            subtitle="Henter kryssoversikt"
          />
        ) : (
          <div className="tableWrap violations__tableWrap">
            <table className="violations__table">
              <thead>
                <tr>
                  <th className="violations__col-rank">#</th>
                  <th className="sticky">Deltaker</th>
                  <th className="violations__col-summary">Oversikt</th>
                  <th>Total</th>
                  {ruleCols.map(code => (
                    <th key={code} className="violations__col-rule" title={`${RULE_CROSSES[code]}× per ${RULE_LABELS[code] ?? code}`}>
                      <div>{RULE_LABELS[code] ?? code}</div>
                      <div className="violations__rule-subheader">×{RULE_CROSSES[code]}</div>
                    </th>
                  ))}
                  <th className="violations__col-chevron"></th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r, i) => {
                  const isMobileExpanded = mobileExpanded.has(r.participantId);
                  const isExpanded = expandedId === r.participantId;
                  const rowViolations = isExpanded
                    ? violations.filter(v => v.participantId === r.participantId)
                    : [];
                  return (
                    <Fragment key={r.participantId}>
                      <tr
                        style={{ cursor: "pointer" }}
                        className={`${expandedId === r.participantId ? "separatorRow" : ""} ${isMobileExpanded ? "violations__row-expanded" : ""}`}
                        onClick={() => {
                          setExpandedId(prev => prev === r.participantId ? null : r.participantId);
                          setMobileExpanded(prev => {
                            const next = new Set(prev);
                            if (next.has(r.participantId)) next.delete(r.participantId);
                            else next.add(r.participantId);
                            return next;
                          });
                        }}
                      >
                        <td className="violations__col-rank">{i + 1}</td>
                        <td className="sticky">
                          <span className="violations__name-cell">
                            <button className="name-link" onClick={(e) => { e.stopPropagation(); nav(`/person/${r.participantId}`); }}>
                              {r.name}
                            </button>
                            {!r.isRegular && <span className="badge violations__badge-inline">gjest</span>}
                          </span>
                        </td>
                        <td className="violations__col-summary">
                          <span className="violations__summary-pills">
                            {ruleCols.filter(code => r.byRule[code]).map(code => (
                              <span key={code} className="violations__summary-pill" style={{ borderColor: RULE_COLORS[code], color: RULE_COLORS[code] }}>
                                {RULE_LABELS[code] ?? code} <b>{r.byRule[code]}</b>
                              </span>
                            ))}
                          </span>
                        </td>
                        <td><b>{Math.floor(r.total)}</b></td> 
                        {ruleCols.map(code => (
                          <td key={code} className="violations__col-rule">
                            {r.byRule[code]
                              ? <b style={{ color: RULE_COLORS[code] }}>{r.byRule[code]}</b>
                              : <span className="u-text-muted">–</span>}
                          </td>
                        ))}
                        <td className="violations__col-chevron">
                          <span className={`violations__chevron ${isMobileExpanded ? "violations__chevron--open" : ""}`}>▸</span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${r.participantId}-violations`} className="violations__inline-detail-row">
                          <td colSpan={4 + ruleCols.length + 1} style={{ padding: 0 }}>
                            <div className="violations__inline-detail">
                              <table className="violations__detail-table">
                                <thead>
                                  <tr>
                                    <th>Dato</th>
                                    <th>Kode</th>
                                    <th>Kryss</th>
                                    <th>Notat</th>
                                    {isAdmin && <th></th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {rowViolations.length === 0 ? (
                                    <tr><td colSpan={isAdmin ? 5 : 4} className="u-text-muted">Ingen kryss</td></tr>
                                  ) : rowViolations.map(v => (
                                    <tr key={v.id}>
                                      <td>
                                        <button
                                          className="btn violations__date-btn"
                                          onClick={(e) => { e.stopPropagation(); nav(`/session/${v.sessionId}`); }}
                                          title="Se dagsrapport og statistikk"
                                        >
                                          {fmtDate(v.dateISO)}
                                        </button>
                                      </td>
                                      <td><span className="badge" style={{ borderColor: RULE_COLORS[v.ruleCode], color: RULE_COLORS[v.ruleCode] }}>{v.ruleCode}</span></td>
                                      <td>{v.crosses}</td>
                                      <td className="u-text-muted">{v.reason ?? "–"}</td>
                                      {isAdmin && (
                                        <td>
                                          <button
                                            className="btn btnDanger"
                                            style={{ padding: "4px 10px", fontSize: 12, color: "#ef4444", borderColor: "rgba(239,68,68,0.35)" }}
                                            onClick={e => { e.stopPropagation(); deleteViolation(v.id); }}
                                          >
                                            Slett
                                          </button>
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {!visibleRows.length && (
                  <tr>
                    <td colSpan={4 + ruleCols.length + 1} className="u-text-muted">
                      Ingen kryss registrert ennå
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
