import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthSession } from "../auth/useAuthSession";
import { apiFetch } from "../lib/api";

type Rule = {
  code: string;
  label: string;
  crosses: number;
  details?: string | null;
};

type SummaryItem = {
  label: string;
  value: string;
  note?: string;
  href?: string;
};

type RuleSection = {
  title: string;
  items: string[];
};

type FravaerOption = {
  title: string;
  items: string[];
};

const RULE_COLORS: Record<string, string> = {
  MM: "#10b981",
  W: "#3b82f6",
  VW: "#6366f1",
  P: "#ef4444",
  DNS: "#f59e0b",
  DNF: "#f97316",
  VOMIT: "#ec4899",
  KPR: "#8b5cf6",
  ABSENCE: "#94a3b8",
};

const SUMMARY_ITEMS: SummaryItem[] = [
  {
    label: "Tid",
    value: "Fredag 15:15",
    note: "Med mindre annet avtales.",
  },
  {
    label: "Sted",
    value: "Geogrotta",
    href: "https://link.mazemap.com/TrTpAZMq",
  },
  {
    label: "Flytting",
    value: "2/3 flertall",
    note: "Kreves for å flytte bort fra fredag.",
  },
  {
    label: "Rekkefølge",
    value: "Hjulet",
    note: "Helst Tobias A. sin PC.",
  },
];

const RULE_SECTIONS: RuleSection[] = [
  {
    title: "Tid og sted",
    items: [
      "Grottechug skal skje på Geogrotta fredager kl. 15:15, med mindre annet avtales.",
      "Flytting av tidspunkt er tillatt.",
      "Flytting av sted kan tillates ved spesielle anledninger slik som vors eller lignende.",
    ],
  },
  {
    title: "Enhet",
    items: [
      "Anbefalt enhet er øl.",
      "Cider eller seltzer er tillatt som alternativ.",
      "Kun alkoholfri øl er tillatt som alkoholfri enhet.",
      "Peder er unntatt fra regelen om enhet, men oppfordres til kullsyreholdig enhet.",
    ],
  },
  {
    title: "Forsøk",
    items: [
      "På Grotta kan man gjøre så mange forsøk man vil.",
      "Beste forsøk gjelder.",
      "Ved spesielt ønske eller behov kan ønsket plassering eller modifikasjon i rekkefølgen tillates. Eksempelvis hvis en deltaker må gå tidlig.",
    ],
  },
  {
    title: "Annet",
    items: [
      "Gjester er lov og velkomne så lenge de følger reglene.",
      "Erfaringsoverføring av Grottechug skal gjennomføres for 3. klasse geomatikk på vårsemesteret.",
      "Alle deltakere må bruke glass av samme type, for eksempel like plastglass på 0,5 L eller like ølglass.",
      "Pant fra chug doneres til felleskapet",
    ],
  },
];

const FRAVAER_OPTIONS: FravaerOption[] = [
  {
    title: "Videochug",
    items: [
      "Video av chug deles i grottas snap- eller messengergruppe, eller sendes til en admin.",
    ],
  },
  {
    title: "Remotechug",
    items: [
      "Deltakeren ringer en av grottas medlemmer på video under grottechug og chugge live mens tidtaking foregår.",
    ],
  },
];

const FRAVAER_REGLER = [
  "Ved fravær kan video- eller remotechug godkjennes som erstatning for chugging på Grotta.",
  "Forsøket må skje samme dag som Grottechuggen.",
  "Kun ett (1) forsøk er tillatt.",
  "Regelen om like glass kan sees bort fra ved video- eller remotechug, men det oppfordres til å bruke et lignende.",
  "Bordet skal være tydelig synlig slik at tidtaking er mulig.",
];

const OFFICIAL_CROSS_RULES: Rule[] = [
  {
    code: "DNS",
    label: "DNS-chug",
    crosses: 3,
    details: "Å være på Geogrotta uten å delta på chugging.",
  },
  {
    code: "DNF",
    label: "Tobias-chug",
    crosses: 2,
    details: "Å ikke fullføre chuggen innen 25 sekunder.",
  },
  {
    code: "MM",
    label: "mm-chug",
    crosses: 0.5,
    details:
      "Mildly moist regnes som gult kort. To mm-chugs på rad gir ett helt kryss.",
  },
  {
    code: "W",
    label: "w-chug",
    crosses: 1,
    details: "Å søle øl under chugging.",
  },
  {
    code: "VW",
    label: "vw-chug",
    crosses: 2,
    details:
      "Å søle en betydelig mengde øl under chugging eller å ha litt øl igjen i glasset.",
  },
  {
    code: "P",
    label: "p-chug",
    crosses: 1,
    details: "Å måtte ta pause under chugging.",
  },
  {
    code: "ABSENCE",
    label: "Fravær",
    crosses: 2,
    details: "Fravær fra Grotta uten godkjent video/remotechug.",
  },
  {
    code: "VOMIT",
    label: "Oppkast",
    crosses: 4,
    details: "Dersom man ikke klarer å fullføre etter å ha kasta opp.",
  },
  {
    code: "KPR",
    label: "KPR",
    crosses: 1,
    details: "Å klage på regler under chug.",
  },
];

const CROSS_NOTES = [
  "Tobias-chug gjelder for 25/26. Hvis Tobias Andresen fullfører under 10 sek, går regelen tilbake til DNF-chug.",
  "Ved oppkast stoppes klokka til chugginga gjenopptas. Dersom man trekker seg, får man kryss.",
];

const OFFICIAL_RULE_ORDER = new Map(
  OFFICIAL_CROSS_RULES.map((rule, index) => [rule.code, index]),
);

function formatCrosses(value: number) {
  return Number.isInteger(value) ? String(value) : String(value);
}

export function RulesPage() {
  const { isAdmin } = useAuthSession();
  const [systemRules, setSystemRules] = useState<Rule[]>([]);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [loadingSystemRules, setLoadingSystemRules] = useState(false);
  const [systemRulesError, setSystemRulesError] = useState<string | null>(null);
  const [systemRulesVersion, setSystemRulesVersion] = useState(0);

  const [label, setLabel] = useState("");
  const [crosses, setCrosses] = useState("");
  const [details, setDetails] = useState("");

  useEffect(() => {
    if (!isAdmin) {
      setSystemRules([]);
      setLoadingSystemRules(false);
      setSystemRulesError(null);
      return;
    }

    let cancelled = false;

    async function loadSystemRules() {
      setLoadingSystemRules(true);
      setSystemRulesError(null);

      try {
        const res = await apiFetch("/api/rules");
        if (!res.ok) throw new Error("Kunne ikke hente systemregler");
        const data: Rule[] = await res.json();
        if (!cancelled) setSystemRules(data);
      } catch (error) {
        if (!cancelled) {
          setSystemRulesError(
            error instanceof Error
              ? error.message
              : "Kunne ikke hente systemregler",
          );
        }
      } finally {
        if (!cancelled) setLoadingSystemRules(false);
      }
    }

    void loadSystemRules();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, systemRulesVersion]);

  const sortedSystemRules = useMemo(() => {
    const copy = [...systemRules];
    copy.sort((a, b) => {
      const rankA = OFFICIAL_RULE_ORDER.get(a.code) ?? Number.MAX_SAFE_INTEGER;
      const rankB = OFFICIAL_RULE_ORDER.get(b.code) ?? Number.MAX_SAFE_INTEGER;
      if (rankA !== rankB) return rankA - rankB;
      return a.code.localeCompare(b.code);
    });
    return copy;
  }, [systemRules]);

  function openEdit(rule: Rule) {
    if (!isAdmin) return;

    setEditing(rule);
    setLabel(rule.label);
    setCrosses(String(rule.crosses));
    setDetails(rule.details ?? "");
  }

  async function save() {
    if (!editing || !isAdmin) return;

    const nextCrosses = Number(crosses.replace(",", "."));
    if (!Number.isFinite(nextCrosses)) {
      alert("Kryss må være et tall");
      return;
    }

    await apiFetch(`/api/rules/${editing.code}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: label.trim(),
        crosses: nextCrosses,
        details,
      }),
    });

    setEditing(null);
    setSystemRulesVersion((value) => value + 1);
  }

  return (
    <div className="rulesPage">
      <section className="card rules__hero">
        <div className="rules__heroTop">
          <div className="rules__heroTitleBlock">
            <span className="rules__eyebrow">Grottechug 25/26</span>
            <h1>Regler</h1>
          </div>

          <Link to="/howto" className="rules__heroLink">
            Hvordan chugge? Se vår guide
          </Link>
        </div>

        <div className="rules__summaryGrid">
          {SUMMARY_ITEMS.map((item) => (
            <article key={item.label} className="rules__summaryCard">
              <span className="rules__summaryLabel">{item.label}</span>
              {item.href ? (
                <a
                  className="rules__summaryValue rules__summaryValueLink"
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.value}
                </a>
              ) : (
                <div className="rules__summaryValue">{item.value}</div>
              )}
              {item.note && <p className="rules__summaryNote">{item.note}</p>}
            </article>
          ))}
        </div>
      </section>

      <section className="card rules__crossSection">
        <div className="rules__sectionHeader">
          <h2>Kryssoversikt</h2>
          <p className="rules__sectionNote">
            Kryss kan brukes til kryssfest, vors, sponsing av enheter eller
            annet grotta blir enige om.
          </p>
        </div>

        <div className="rules__crossList" role="list">
          {OFFICIAL_CROSS_RULES.map((rule) => {
            const color = RULE_COLORS[rule.code] ?? "var(--muted)";
            return (
              <article
                key={rule.code}
                className="rules__crossRow"
                role="listitem"
              >
                <div className="rules__crossCode">
                  <span className="badge" style={{ borderColor: color, color }}>
                    {rule.code}
                  </span>
                </div>

                <div className="rules__crossBody">
                  <h3 className="rules__crossTitle">{rule.label}</h3>
                  <p className="rules__crossText">{rule.details}</p>
                </div>

                <div className="rules__crossCount">
                  <span className="rules__crossValue" style={{ color }}>
                    {formatCrosses(rule.crosses)}
                  </span>
                  <span className="rules__crossUnit">kryss</span>
                </div>
              </article>
            );
          })}
        </div>

        <div className="rules__crossNotes">
          {CROSS_NOTES.map((note) => (
            <p key={note} className="rules__crossNote">
              {note}
            </p>
          ))}
        </div>
      </section>

      <section className="rules__sectionGrid">
        {RULE_SECTIONS.map((section) => (
          <article key={section.title} className="card rules__ruleCard">
            <h2>{section.title}</h2>

            <ul className="rules__bulletList">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="card rules__absenceCard">
        <div className="rules__sectionHeader">
          <h2>Fravær, video og remote</h2>
        </div>

        <ul className="rules__bulletList rules__bulletList--compact">
          {FRAVAER_REGLER.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <div className="rules__absenceGrid">
          {FRAVAER_OPTIONS.map((option) => (
            <article key={option.title} className="rules__absenceOption">
              <h3>{option.title}</h3>
              <ul className="rules__bulletList">
                {option.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {isAdmin && (
        <details className="card rules__adminCard">
          <summary className="rules__adminSummary">
            <span>Admin: systemregler</span>
            <span className="rules__adminHint">Teknisk oversikt fra API</span>
          </summary>

          <div className="rules__adminContent">
            <p className="rules__adminIntro">
              Dette er regeldataene i <code>/api/rules</code>. Siden over er
              fortsatt frontendstyrt.
            </p>

            <div className="tableWrap rules__adminTableWrap">
              <table className="rules__adminTable">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Navn</th>
                    <th>Kryss</th>
                    <th>Detaljer</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {loadingSystemRules && (
                    <tr>
                      <td colSpan={5} className="u-text-muted">
                        Laster systemregler…
                      </td>
                    </tr>
                  )}

                  {!loadingSystemRules && systemRulesError && (
                    <tr>
                      <td colSpan={5} className="u-text-muted">
                        {systemRulesError}
                      </td>
                    </tr>
                  )}

                  {!loadingSystemRules &&
                    !systemRulesError &&
                    sortedSystemRules.map((rule) => (
                      <tr key={rule.code}>
                        <td>
                          <span
                            className="badge"
                            style={{
                              borderColor:
                                RULE_COLORS[rule.code] ?? "var(--muted)",
                              color: RULE_COLORS[rule.code] ?? "var(--muted)",
                            }}
                          >
                            {rule.code}
                          </span>
                        </td>
                        <td>{rule.label}</td>
                        <td>{formatCrosses(rule.crosses)}</td>
                        <td className="rules__adminDetails">
                          {rule.details ?? "–"}
                        </td>
                        <td className="u-text-right">
                          <button
                            className="rules__editBtn"
                            onClick={() => openEdit(rule)}
                          >
                            Rediger
                          </button>
                        </td>
                      </tr>
                    ))}

                  {!loadingSystemRules &&
                    !systemRulesError &&
                    !sortedSystemRules.length && (
                      <tr>
                        <td colSpan={5} className="u-text-muted">
                          Ingen systemregler
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      )}

      {editing && (
        <div className="modalOverlay">
          <div className="card modalCard" style={{ width: 520 }}>
            <h2>Rediger {editing.code}</h2>

            <label>Navn</label>
            <input
              className="input"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />

            <div className="u-spacer-sm" />
            <label>Kryss</label>
            <input
              className="input"
              value={crosses}
              onChange={(event) => setCrosses(event.target.value)}
            />

            <div className="u-spacer-sm" />
            <label>Detaljer</label>
            <textarea
              className="input"
              rows={4}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
            />

            <div className="u-spacer-md" />
            <div className="rules__modalActions">
              <button className="btn btnGhost" onClick={() => setEditing(null)}>
                Avbryt
              </button>
              <button className="btn" onClick={save}>
                Lagre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
