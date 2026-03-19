import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useAuthSession } from "../auth/useAuthSession";
import { apiFetch } from "../lib/api";
import { LoadingCard } from "../components/LoadingCard";

type Rule = {
  code: string;
  label: string;
  crosses: number;
  details?: string | null;
};

type SummaryItem = {
  icon: "time" | "place" | "move" | "order";
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
    icon: "time",
    label: "Tid",
    value: "Fredag 15:15",
    note: "Med mindre annet avtales.",
  },
  {
    icon: "place",
    label: "Sted",
    value: "Geogrotta",
    href: "https://link.mazemap.com/TrTpAZMq",
    note: "Med mindre annet avtales.",
  },
  {
    icon: "move",
    label: "Flytting",
    value: "2/3 flertall",
    note: "Kreves for å flytte bort fra fredag.",
  },
  {
    icon: "order",
    label: "Rekkefølge",
    value: "Hjulet",
    note: "Helst Tobias A. sin PC.",
  },
];

function SummarySymbol({ icon }: { icon: SummaryItem["icon"] }) {
  if (icon === "time") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 8v4l2.8 1.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === "place") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 20s-5-4.6-5-8.6A5 5 0 0 1 17 11.4C17 15.4 12 20 12 20Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="11" r="1.9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (icon === "move") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M5 8h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 5l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 16H9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 13l-3 3 3 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 7h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 12h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 17h7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" />
      <circle cx="15" cy="17" r="1.5" fill="currentColor" />
      <circle cx="20" cy="7" r="1.5" fill="currentColor" />
    </svg>
  );
}

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
    label: "DNS",
    crosses: 3,
    details: "Did-Not-Start. Å være på Geogrotta uten å delta på chugging.",
  },
  {
    code: "DNF",
    label: "Tobias-chug",
    crosses: 2,
    details: "Å ikke fullføre chuggen innen 25 sekunder.",
  },
  {
    code: "MM",
    label: "MM-chug",
    crosses: 0.5,
    details:
      "Mildly-Moist-chug regnes som gult kort. To mm-chugs på rad gir ett helt kryss.",
  },
  {
    code: "W",
    label: "W-chug",
    crosses: 1,
    details: "Wet-chug. Å søle øl under chugging.",
  },
  {
    code: "VW",
    label: "VW-chug",
    crosses: 2,
    details:
      "Very-Wet-chug. Å søle en betydelig mengde øl under chugging eller å ha litt øl igjen i glasset.",
  },
  {
    code: "P",
    label: "P-chug",
    crosses: 1,
    details: "Pause-chug. Å måtte ta pause under chugging.",
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
    details: "Klage-På-Regel. Å klage på regler under chug.",
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
  const [creating, setCreating] = useState(false);
  const [loadingSystemRules, setLoadingSystemRules] = useState(false);
  const [systemRulesError, setSystemRulesError] = useState<string | null>(null);
  const [systemRulesVersion, setSystemRulesVersion] = useState(0);

  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [crosses, setCrosses] = useState("");
  const [details, setDetails] = useState("");

  useEffect(() => {
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
  }, [systemRulesVersion]);

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

  const crossRules = sortedSystemRules;

  function openEdit(rule: Rule) {
    if (!isAdmin) return;

    setCreating(false);
    setEditing(rule);
    setCode(rule.code);
    setLabel(rule.label);
    setCrosses(String(rule.crosses));
    setDetails(rule.details ?? "");
  }

  function openCreate() {
    if (!isAdmin) return;

    setEditing(null);
    setCreating(true);
    setCode("");
    setLabel("");
    setCrosses("");
    setDetails("");
  }

  function closeModal() {
    setEditing(null);
    setCreating(false);
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

  async function createRule() {
    if (!isAdmin) return;

    const normalizedCode = code.trim().toUpperCase();
    const nextLabel = label.trim();
    const nextCrosses = Number(crosses.replace(",", "."));

    if (!normalizedCode || !nextLabel || !Number.isFinite(nextCrosses)) {
      alert("Kode, navn og gyldig kryss må fylles ut");
      return;
    }

    const res = await apiFetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: normalizedCode,
        label: nextLabel,
        crosses: nextCrosses,
        details,
      }),
    });

    if (!res.ok) {
      const message = await res.text();
      alert(message || "Kunne ikke opprette regel");
      return;
    }

    closeModal();
    setSystemRulesVersion((value) => value + 1);
  }

  async function deleteRule(rule: Rule) {
    if (!isAdmin) return;

    const confirmed = window.confirm(
      `Slette regel ${rule.code} (${rule.label})? Dette kan ikke angres.`,
    );
    if (!confirmed) return;

    const res = await apiFetch(`/api/rules/${rule.code}`, { method: "DELETE" });
    if (!res.ok) {
      const message = await res.text();
      alert(message || "Kunne ikke slette regel");
      return;
    }

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
            <span className="rules__heroLinkLabel">Hvordan chugge?</span>
            <span className="rules__heroLinkHint">Se guide</span>
          </Link>
        </div>

        <div className="rules__summaryGrid">
          {SUMMARY_ITEMS.map((item) => (
            <article key={item.label} className="rules__summaryCard">
              <div className="rules__summaryHead">
                <span className="rules__summaryIcon" aria-hidden="true">
                  <SummarySymbol icon={item.icon} />
                </span>
                <span className="rules__summaryLabel">{item.label}</span>
              </div>
              {item.href ? (
                <a
                  className={`rules__summaryValue rules__summaryValueLink ${item.icon === "place" ? "rules__summaryValueLink--place" : ""}`}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className={item.icon === "place" ? "rules__summaryPlaceText" : undefined}>{item.value}</span>
                  {item.icon === "place" && (
                    <img
                      className="rules__summaryPlaceLogo"
                      src="/mazemap-logo.png"
                      alt="MazeMap"
                    />
                  )}
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
          {isAdmin && (
            <div className="rules__crossAdminActions">
              <button type="button" className="btn" onClick={openCreate}>
                Opprett regel
              </button>
            </div>
          )}
        </div>

        <div className="rules__crossList" role="list">
          {loadingSystemRules && (
            <article className="rules__crossRow" role="listitem">
              <div className="rules__crossBody">
                <LoadingCard
                  card={false}
                  compact
                  className="rules__inline-loading"
                  title="Laster regler..."
                  subtitle="Henter kryssregler"
                  skeletonPattern={["md", "sm"]}
                />
              </div>
            </article>
          )}

          {!loadingSystemRules && systemRulesError && (
            <article className="rules__crossRow" role="listitem">
              <div className="rules__crossBody">
                <p className="rules__crossText">{systemRulesError}</p>
              </div>
            </article>
          )}

          {!loadingSystemRules &&
            !systemRulesError &&
            !crossRules.length && (
              <article className="rules__crossRow" role="listitem">
                <div className="rules__crossBody">
                  <p className="rules__crossText">Ingen regler funnet.</p>
                </div>
              </article>
            )}

          {!loadingSystemRules &&
            !systemRulesError &&
            crossRules.map((rule) => {
            const color = RULE_COLORS[rule.code] ?? "var(--muted)";
            const rowStyle = { "--rule-color": color } as CSSProperties;
            return (
              <article
                key={rule.code}
                className="rules__crossRow"
                style={rowStyle}
                role="listitem"
              >
                <div className="rules__crossCode">
                  <span className="badge" style={{ borderColor: color, color }}>
                    {rule.code}
                  </span>
                </div>

                <div className="rules__crossBody">
                  <h3 className="rules__crossTitle">{rule.label}</h3>
                  <p className="rules__crossText">{rule.details ?? "-"}</p>
                </div>

                <div className="rules__crossCount">
                  <span className="rules__crossValue" style={{ color }}>
                    {formatCrosses(rule.crosses)}
                  </span>
                  <span className="rules__crossUnit">kryss</span>
                  {isAdmin && (
                    <div className="rules__crossActions">
                      <button
                        type="button"
                        className="rules__crossEditBtn"
                        onClick={() => openEdit(rule)}
                      >
                        Rediger
                      </button>
                      <button
                        type="button"
                        className="rules__crossDeleteBtn"
                        onClick={() => deleteRule(rule)}
                      >
                        Slett
                      </button>
                    </div>
                  )}
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

      {(editing || creating) && (
        <div className="modalOverlay">
          <div className="card modalCard" style={{ width: 520 }}>
            <h2>{creating ? "Opprett regel" : `Rediger ${editing?.code}`}</h2>

            <label>Kode</label>
            <input
              className="input"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              disabled={!creating}
            />

            <div className="u-spacer-sm" />

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
              <button className="btn btnGhost" onClick={closeModal}>
                Avbryt
              </button>
              <button className="btn" onClick={creating ? createRule : save}>
                {creating ? "Opprett" : "Lagre"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
