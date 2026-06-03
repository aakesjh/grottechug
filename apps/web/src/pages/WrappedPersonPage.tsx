import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from "recharts";
import { apiFetch } from "../lib/api";
import { LoadingCard } from "../components/LoadingCard";
import { WrappedStories } from "../components/wrapped/WrappedStories";
import { buildPersonStories } from "../components/wrapped/buildPersonStories";
import { WrappedPosterButton } from "../components/wrapped/WrappedPosterButton";
import { RoundAvatar } from "../components/wrapped/WrappedBits";
import { BadgeMedal } from "../components/BadgeMedal";
import { fmtSeconds, fmtShortDate, type PersonWrapped, type ProfileBadge } from "../components/wrapped/types";

function StatTile({ value, label, accent, sub }: { value: string; label: string; accent?: boolean; sub?: string }) {
  return (
    <div className={`wrapped-stat ${accent ? "wrapped-stat--accent" : ""}`}>
      <div className="wrapped-stat__value">{value}</div>
      <div className="wrapped-stat__label">{label}</div>
      {sub && <div className="wrapped-stat__sub">{sub}</div>}
    </div>
  );
}

export function WrappedPersonPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState<PersonWrapped | null>(null);
  const [badges, setBadges] = useState<ProfileBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    Promise.all([
      apiFetch(`/api/wrapped/person/${id}?semester=year`).then(async (r) => (r.ok ? ((await r.json()) as PersonWrapped) : null)),
      apiFetch(`/api/person/${id}?semester=all`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([w, profile]) => {
        if (!w) {
          setNotFound(true);
          return;
        }
        setData(w);
        setBadges(Array.isArray(profile?.badges) ? profile.badges : []);
      })
      .catch((e) => {
        console.error(e);
        setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const stories = useMemo(() => (data ? buildPersonStories(data) : []), [data]);

  const seriesData = useMemo(
    () =>
      data?.timeSeries.map((p) => ({
        date: fmtShortDate(p.dateISO),
        seconds: Number(p.seconds.toFixed(2)),
        clean: p.clean,
        wet: p.wet,
      })) ?? [],
    [data],
  );

  if (loading && !data) {
    return (
      <div className="container wrapped">
        <LoadingCard title="Pakker opp året ditt..." subtitle="Henter dine chugs og rekorder" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="container wrapped">
        <div className="card u-text-center" style={{ padding: 40 }}>
          Fant ingen chugs for denne personen i år.
          <div style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => nav("/wrapped")}>
              ← Til årets Wrapped
            </button>
          </div>
        </div>
      </div>
    );
  }

  const s = data.stats;
  const r = data.rankings;
  const isRegular = data.participant.isRegular;
  const earnedBadges = badges.filter((b) => b.earned).length;

  return (
    <div className="container wrapped">
      {/* Hero */}
      <div className="wrapped-hero wrapped-hero--person">
        <RoundAvatar name={data.participant.name} imageUrl={data.participant.imageUrl} size={104} ring="rgba(255,255,255,0.85)" />
        <div className="wrapped-hero__kicker">{data.semesterLabel} · Wrapped</div>
        <h1 className="wrapped-hero__title">{data.participant.name}</h1>
        <div className="wrapped-hero__personality">
          {data.title.emoji} {data.title.label}
        </div>
        <p className="wrapped-hero__range">{data.title.blurb}</p>
        <div className="wrapped-hero__aura">Aura: <strong>{data.aura.word}</strong> · {data.aura.hint}</div>

        <div className="wrapped-hero__actions">
          <button className="btn btnPrimary wrapped-play-btn" onClick={() => setPlaying(true)}>
            ▶ Spill av din Wrapped
          </button>
          <WrappedPosterButton kind="person" data={data} />
          <button className="btn" onClick={() => nav(`/person/${data.participant.id}`)}>
            Full profil
          </button>
        </div>
      </div>

      {/* Awards won */}
      {data.awardsWon.length > 0 && (
        <div className="wrapped-awards-won">
          {data.awardsWon.map((a) => (
            <span key={a.key} className={`wrapped-awards-won__pill wrapped-awards-won__pill--${a.kind}`}>
              {a.emoji} {a.label}
            </span>
          ))}
        </div>
      )}

      {/* Season classification */}
      <div className="card wrapped-verdict-card">
        <div className="wrapped-verdict-card__kicker">Sesongen din klassifisert som</div>
        <div className="wrapped-verdict-card__label">«{data.classification.label}»</div>
        <div className="wrapped-verdict">
          {data.classification.lines.map((line, i) => (
            <div key={i} className="wrapped-verdict__line">{line}</div>
          ))}
        </div>
      </div>

      {/* Headline stats */}
      <div className="wrapped-stat-grid">
        <StatTile value={String(s.chugs)} label="chugs i år" accent />
        <StatTile value={`${s.attendance}/${s.totalSessions}`} label="oppmøter" />
        <StatTile value={s.bestClean != null ? fmtSeconds(s.bestClean) : "–"} label="beste tid" accent />
        <StatTile
          value={r.bestCleanRank != null ? `#${r.bestCleanRank}` : "–"}
          label={isRegular ? `av ${r.totalRanked} faste` : `av ${r.totalRanked} i kullet`}
          sub={
            isRegular && r.bestCleanRankAll != null && r.bestCleanRankAll !== r.bestCleanRank
              ? `#${r.bestCleanRankAll} av ${r.totalRankedAll} med gjester`
              : undefined
          }
        />
        <StatTile value={`${s.avg.toFixed(2)}s`} label="snittet ditt" />
        <StatTile
          value={
            data.comparison.avgDelta != null
              ? `${data.comparison.avgDelta <= 0 ? "−" : "+"}${Math.abs(data.comparison.avgDelta).toFixed(2)}s`
              : "–"
          }
          label="vs gruppa"
        />
        <StatTile value={`${s.totalLitres} L`} label="øl drukket" />
        <StatTile value={`${s.totalMinutes.toFixed(1)} min`} label="chuggetid" />
        <StatTile value={r.percentile != null ? `${r.percentile.toFixed(0)}%` : "–"} label="raskere enn" accent />
        <StatTile value={s.improvement > 0 ? `−${s.improvement.toFixed(2)}s` : "–"} label="forbedring" />
        <StatTile value={`±${s.stddev.toFixed(2)}s`} label="stabilitet" />
        {isRegular && <StatTile value={String(s.crossesTotal)} label="kryss" />}
      </div>

      {/* Highlights row */}
      <div className="wrapped-records">
        {data.fastestDay && (
          <div className="wrapped-record wrapped-record--fast">
            <div className="wrapped-record__label">⚡ Raskeste dag</div>
            <div className="wrapped-record__time">{fmtSeconds(data.fastestDay.seconds)}</div>
            <div className="wrapped-record__meta">{fmtShortDate(data.fastestDay.dateISO)}</div>
          </div>
        )}
        {data.slowestDay && (
          <div className="wrapped-record wrapped-record--slow">
            <div className="wrapped-record__label">🐢 Tregeste dag</div>
            <div className="wrapped-record__time">{fmtSeconds(data.slowestDay.seconds)}</div>
            <div className="wrapped-record__meta">{fmtShortDate(data.slowestDay.dateISO)}</div>
          </div>
        )}
        {data.rival && (
          <button
            className="wrapped-record wrapped-record--neutral"
            onClick={() => nav(`/wrapped/person/${data.rival!.participantId}`)}
          >
            <div className="wrapped-record__label">⚔️ Største rival</div>
            <div className="wrapped-record__name">{data.rival.name}</div>
            <div className="wrapped-record__time">{data.rival.youWon}–{data.rival.theyWon}</div>
            <div className="wrapped-record__meta">seire (deg–{data.rival.name.split(" ")[0]}) · {data.rival.meetings} felles chugs</div>
          </button>
        )}
        {Object.keys(data.perSemester).length > 1 && (
          <div className="wrapped-record wrapped-record--neutral">
            <div className="wrapped-record__label">📅 Per semester</div>
            <div className="wrapped-record__semesters">
              {Object.entries(data.perSemester).map(([sem, v]) => (
                <div key={sem} className="wrapped-record__sem-row">
                  <span>{sem}</span>
                  <span>{v.n} chugs · {fmtSeconds(v.bestClean)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Time series */}
      {seriesData.length > 0 && (
        <div className="card wrapped-chart">
          <h2 className="wrapped-chart__title">Tidene dine gjennom året</h2>
          {isRegular && (
            <div className="wrapped-chart__legend">
              <span><i className="wrapped-dot wrapped-dot--clean" /> Ren</span>
              <span><i className="wrapped-dot wrapped-dot--wet" /> Våt</span>
            </div>
          )}
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={seriesData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="date" stroke="var(--text)" tick={{ fontSize: 11 }} minTickGap={12} />
              <YAxis stroke="var(--text)" tick={{ fontSize: 11 }} width={42} tickFormatter={(v) => `${v}s`} />
              <Tooltip wrapperClassName="session__recharts-tooltip" formatter={(v: any) => [`${Number(v).toFixed(2)}s`, "Tid"]} />
              {s.bestClean != null && (
                <ReferenceLine y={s.bestClean} stroke="#fde047" strokeDasharray="6 6" label={{ value: `PB ${s.bestClean.toFixed(2)}s`, position: "insideTopRight", fill: "#fde047", fontSize: 11 }} />
              )}
              <Bar dataKey="seconds" radius={[6, 6, 0, 0]}>
                {seriesData.map((p, i) => (
                  <Cell key={i} fill={isRegular && p.wet ? "#38bdf8" : "#34d399"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Month by month */}
      {data.monthly.length > 1 && (
        <div className="card wrapped-section">
          <h2 className="wrapped-h2" style={{ marginTop: 0 }}>📅 Måned for måned</h2>
          <div className="wrapped-month-row">
            {data.monthly.map((m) => (
              <div key={m.key} className="wrapped-month">
                <div className="wrapped-month__label">{m.label}</div>
                <div className="wrapped-month__best">{m.bestClean != null ? fmtSeconds(m.bestClean) : "–"}</div>
                <div className="wrapped-month__meta">{m.chugs} chugs · ⌀ {m.avg.toFixed(2)}s</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rap sheet — regulars only (kryss telles ikke for gjester) */}
      {isRegular && data.crossBreakdown.length > 0 && (
        <div className="card wrapped-section">
          <h2 className="wrapped-h2" style={{ marginTop: 0 }}>❌ Synderegisteret</h2>
          <div className="wrapped-crosslist">
            {data.crossBreakdown.map((c) => (
              <div key={c.code} className="wrapped-crosslist__row">
                <span className={`badge session__rule-code session__rule-code--${c.code.toLowerCase()}`}>{c.code}</span>
                <span className="wrapped-crosslist__label">{c.label}</span>
                <span className="wrapped-crosslist__count">{c.count}×</span>
              </div>
            ))}
          </div>
          {r.crossRank != null && <div className="wrapped-crosslist__rank">#{r.crossRank} mest kryss i kullet</div>}
        </div>
      )}

      {/* Badges — the real profile badges */}
      {badges.length > 0 && (
        <div className="card wrapped-section">
          <h2 className="wrapped-h2" style={{ marginTop: 0 }}>🏅 Merker ({earnedBadges} av {badges.length})</h2>
          <div className="person__badges-grid">
            {badges.map((b) => (
              <div
                key={b.id}
                className={`person__badge ${b.earned ? "person__badge--earned" : "person__badge--locked"}`}
                data-category={b.category}
                data-tooltip={b.description}
              >
                <BadgeMedal badgeId={b.id} category={b.category} icon={b.icon} />
                <div className="person__badge-title">{b.title}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="wrapped-back">
        <button className="btn" onClick={() => nav("/wrapped")}>← Til årets Wrapped</button>
      </div>

      {playing && <WrappedStories cards={stories} playSong onClose={() => setPlaying(false)} />}
    </div>
  );
}
