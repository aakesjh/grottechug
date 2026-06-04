import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Legend,
} from "recharts";
import { apiFetch } from "../lib/api";
import { LoadingCard } from "../components/LoadingCard";
import { LeaderboardPodium } from "../components/LeaderboardPodium";
import { WrappedStories } from "../components/wrapped/WrappedStories";
import { buildGroupStories } from "../components/wrapped/buildGroupStories";
import { WrappedPosterButton } from "../components/wrapped/WrappedPosterButton";
import { RoundAvatar } from "../components/wrapped/WrappedBits";
import { fmtSeconds, fmtShortDate, type GroupWrapped, type AwardWinner } from "../components/wrapped/types";

const SEMESTERS = [
  { key: "year", label: "Hele året" },
  { key: "2025H", label: "Høst 2025" },
  { key: "2026V", label: "Vår 2026" },
  { key: "all", label: "Tidenes" },
];

const CROSS_COLORS: Record<string, string> = {
  DNS: "#ef4444",
  DNF: "#f97316",
  MM: "#86efac",
  W: "#38bdf8",
  VW: "#1e3a8a",
  P: "#ec4899",
  ABSENCE: "#94a3b8",
  VOMIT: "#84cc16",
  KPR: "#06b6d4",
};

function StatTile({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className={`wrapped-stat ${accent ? "wrapped-stat--accent" : ""}`}>
      <div className="wrapped-stat__value">{value}</div>
      <div className="wrapped-stat__label">{label}</div>
    </div>
  );
}

function AwardCard({
  kicker,
  emoji,
  winner,
  tone,
  onSelect,
}: {
  kicker: string;
  emoji: string;
  winner: AwardWinner;
  tone: "award" | "roast";
  onSelect: (id: string) => void;
}) {
  if (!winner) return null;
  const shared = (winner.winners?.length ?? 0) > 1;
  return (
    <button
      type="button"
      className={`wrapped-award wrapped-award--${tone}`}
      onClick={() => onSelect(winner.participantId)}
    >
      <div className="wrapped-award__kicker">
        {emoji} {kicker}
      </div>
      {shared ? (
        <div className="wrapped-award__avatars">
          {winner.winners!.map((w) => (
            <RoundAvatar key={w.participantId} name={w.name} imageUrl={w.imageUrl} size={56} />
          ))}
        </div>
      ) : (
        <RoundAvatar name={winner.name} imageUrl={winner.imageUrl} size={64} />
      )}
      <div className="wrapped-award__name">{winner.name}</div>
      <div className="wrapped-award__value">{winner.value}</div>
      <div className="wrapped-award__detail">{winner.detail}</div>
    </button>
  );
}

export function WrappedPage() {
  const nav = useNavigate();
  const [semester, setSemester] = useState("year");
  const [includeGuests, setIncludeGuests] = useState(false);
  const [data, setData] = useState<GroupWrapped | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/wrapped?semester=${semester}&includeGuests=${includeGuests}`)
      .then((r) => r.json())
      .then((d: GroupWrapped) => setData(d))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [semester, includeGuests]);

  const stories = useMemo(() => (data ? buildGroupStories(data) : []), [data]);

  const timeSeriesData = useMemo(
    () =>
      data?.charts.timeSeries.map((p) => ({
        date: fmtShortDate(p.dateISO),
        avg: Number(p.avg.toFixed(2)),
        bestClean: p.bestClean,
        wetRate: Number(p.wetRate.toFixed(0)),
      })) ?? [],
    [data],
  );

  if (loading && !data) {
    return (
      <div className="container wrapped">
        <LoadingCard title="Pakker opp året ditt..." subtitle="Henter chugs, kryss og utmerkelser" />
      </div>
    );
  }

  if (!data || data.totals.chugs === 0) {
    return (
      <div className="container wrapped">
        <div className="card u-text-center" style={{ padding: 40 }}>
          Ingen chugs registrert for dette utvalget ennå.
        </div>
      </div>
    );
  }

  const t = data.totals;

  return (
    <div className="container wrapped">
      {/* Hero */}
      <div className="wrapped-hero">
        <div className="wrapped-hero__kicker">{data.semesterLabel}</div>
        <h1 className="wrapped-hero__title">
          Grottechug <span className="wrapped-hero__title-accent">Wrapped</span>
        </h1>
        <p className="wrapped-hero__range">{data.meta.rangeLabel}</p>

        <div className="wrapped-controls">
          <div className="wrapped-seg">
            {SEMESTERS.map((s) => (
              <button
                key={s.key}
                className={`wrapped-seg__btn ${semester === s.key ? "wrapped-seg__btn--active" : ""}`}
                onClick={() => setSemester(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="wrapped-seg">
            <button
              className={`wrapped-seg__btn ${!includeGuests ? "wrapped-seg__btn--active" : ""}`}
              onClick={() => setIncludeGuests(false)}
            >
              Bare faste
            </button>
            <button
              className={`wrapped-seg__btn ${includeGuests ? "wrapped-seg__btn--active" : ""}`}
              onClick={() => setIncludeGuests(true)}
            >
              Med gjester
            </button>
          </div>
        </div>

        <div className="wrapped-hero__actions">
          <button className="btn btnPrimary wrapped-play-btn" onClick={() => setPlaying(true)}>
            ▶ Spill av Wrapped
          </button>
          <WrappedPosterButton kind="year" data={data} />
        </div>
      </div>

      {/* Headline stats */}
      <div className="wrapped-stat-grid">
        <StatTile value={String(t.chugs)} label="chugs totalt" accent />
        <StatTile value={String(t.sessions)} label="samlinger" />
        <StatTile value={String(t.participants)} label="chuggere" />
        <StatTile value={`${t.totalLitres} L`} label="øl drukket" accent />
        <StatTile value={`${t.totalMinutes.toFixed(0)} min`} label="total chuggetid" />
        <StatTile value={t.avg != null ? `${t.avg.toFixed(2)}s` : "–"} label="snitt for året" />
        <StatTile value={`${t.cleanRate}%`} label="tørre chugs" />
        <StatTile value={`${t.wetRate}%`} label="våte chugs" />
        <StatTile value={String(t.totalCrosses)} label="kryss utdelt" />
      </div>

      {/* Records */}
      <div className="wrapped-records">
        {t.fastestClean && (
          <button
            className="wrapped-record wrapped-record--fast"
            onClick={() => nav(`/wrapped/person/${t.fastestClean!.participantId}`)}
          >
            <div className="wrapped-record__label">⚡ Årets raskeste rene chug</div>
            <RoundAvatar name={t.fastestClean.name} imageUrl={t.fastestClean.imageUrl} size={56} ring="#fde047" />
            <div className="wrapped-record__name">{t.fastestClean.name}</div>
            <div className="wrapped-record__time">{fmtSeconds(t.fastestClean.seconds)}</div>
            <div className="wrapped-record__meta">{fmtShortDate(t.fastestClean.dateISO)}</div>
          </button>
        )}
        {t.slowest && (
          <button
            className="wrapped-record wrapped-record--slow"
            onClick={() => nav(`/wrapped/person/${t.slowest!.participantId}`)}
          >
            <div className="wrapped-record__label">🐢 Årets tregeste enkelttid</div>
            <RoundAvatar name={t.slowest.name} imageUrl={t.slowest.imageUrl} size={56} ring="#fb7185" />
            <div className="wrapped-record__name">{t.slowest.name}</div>
            <div className="wrapped-record__time">{fmtSeconds(t.slowest.seconds)}</div>
            <div className="wrapped-record__meta">{fmtShortDate(t.slowest.dateISO)}</div>
          </button>
        )}
      </div>

      {/* Podium */}
      {data.podium.length > 0 && (
        <div className="card wrapped-section">
          <LeaderboardPodium
            title="🏆 Årets pall — reneste tider"
            celebrate
            top3={data.podium.map((p) => ({
              participantId: p.participantId,
              name: p.name,
              imageUrl: p.imageUrl,
              seconds: p.seconds,
            }))}
            onSelect={(pid) => nav(`/wrapped/person/${pid}`)}
          />
        </div>
      )}

      {/* Celebratory awards */}
      <h2 className="wrapped-h2">🏅 Grottechug Awards</h2>
      <div className="wrapped-award-grid">
        <AwardCard kicker="ÅRETS RASKESTE" emoji="⚡" winner={data.awards.raskest} tone="award" onSelect={(id) => nav(`/wrapped/person/${id}`)} />
        <AwardCard kicker="MEST FORBEDRET" emoji="📈" winner={data.awards.mestForbedret} tone="award" onSelect={(id) => nav(`/wrapped/person/${id}`)} />
        <AwardCard kicker="MEST STABIL" emoji="🎯" winner={data.awards.mestStabil} tone="award" onSelect={(id) => nav(`/wrapped/person/${id}`)} />
        <AwardCard kicker="ÅRETS COMEBACK" emoji="🔥" winner={data.awards.comeback} tone="award" onSelect={(id) => nav(`/wrapped/person/${id}`)} />
        <AwardCard kicker="MEST TROFAST" emoji="🗿" winner={data.awards.trofast} tone="award" onSelect={(id) => nav(`/wrapped/person/${id}`)} />
      </div>

      {/* Roasts */}
      <h2 className="wrapped-h2 wrapped-h2--roast">😈 Hall of Shame</h2>
      <div className="wrapped-award-grid">
        <AwardCard kicker="ÅRETS VILLESTE" emoji="💧" winner={data.roasts.villeste} tone="roast" onSelect={(id) => nav(`/wrapped/person/${id}`)} />
        <AwardCard kicker="SYNDAREN" emoji="😈" winner={data.roasts.syndaren} tone="roast" onSelect={(id) => nav(`/wrapped/person/${id}`)} />
        <AwardCard kicker="ÅRETS TREGESTE" emoji="🐢" winner={data.roasts.tregest} tone="roast" onSelect={(id) => nav(`/wrapped/person/${id}`)} />
        <AwardCard kicker="SKUFFET MEST" emoji="📉" winner={data.roasts.skuffet} tone="roast" onSelect={(id) => nav(`/wrapped/person/${id}`)} />
        <AwardCard kicker="BREKKER'N" emoji="🤮" winner={data.roasts.brekker} tone="roast" onSelect={(id) => nav(`/wrapped/person/${id}`)} />
      </div>

      {/* Rivalry */}
      {data.rivalry && (
        <div className="card wrapped-section wrapped-rivalry-card">
          <h2 className="wrapped-h2" style={{ marginTop: 0 }}>⚔️ Årets rivalisering</h2>
          <div className="wrapped-rivalry">
            <button className="wrapped-rivalry__side" onClick={() => nav(`/wrapped/person/${data.rivalry!.a.participantId}`)}>
              <RoundAvatar name={data.rivalry.a.name} imageUrl={data.rivalry.a.imageUrl} size={88} ring="#22d3ee" />
              <div className="wrapped-rivalry__wins">{data.rivalry.a.wins}</div>
              <div className="wrapped-rivalry__wins-label">seire</div>
              <div className="wrapped-rivalry__name">{data.rivalry.a.name}</div>
            </button>
            <div className="wrapped-rivalry__vs">VS</div>
            <button className="wrapped-rivalry__side" onClick={() => nav(`/wrapped/person/${data.rivalry!.b.participantId}`)}>
              <RoundAvatar name={data.rivalry.b.name} imageUrl={data.rivalry.b.imageUrl} size={88} ring="#c084fc" />
              <div className="wrapped-rivalry__wins">{data.rivalry.b.wins}</div>
              <div className="wrapped-rivalry__wins-label">seire</div>
              <div className="wrapped-rivalry__name">{data.rivalry.b.name}</div>
            </button>
          </div>
          <div className="wrapped-rivalry__meta">
            {data.rivalry.a.wins}–{data.rivalry.b.wins} i innbyrdes seire over {data.rivalry.shared} felles chugs
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="wrapped-chart-grid">
        <div className="card wrapped-chart">
          <h2 className="wrapped-chart__title">Tidsutvikling gjennom året</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="wAvg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c5cff" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#7c5cff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="wBest" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="date" stroke="var(--text)" tick={{ fontSize: 11 }} minTickGap={16} />
              <YAxis stroke="var(--text)" tick={{ fontSize: 11 }} width={42} tickFormatter={(v) => `${v}s`} />
              <Tooltip wrapperClassName="session__recharts-tooltip" formatter={(v: any, n: any) => [`${Number(v).toFixed(2)}s`, n === "avg" ? "Snitt" : "Beste rene"]} />
              <Legend formatter={(v) => (v === "avg" ? "Snitt" : "Beste rene")} />
              <Area type="monotone" dataKey="avg" stroke="#7c5cff" strokeWidth={2} fill="url(#wAvg)" />
              <Area type="monotone" dataKey="bestClean" stroke="#22d3ee" strokeWidth={2} fill="url(#wBest)" connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card wrapped-chart">
          <h2 className="wrapped-chart__title">Kryss-fordeling</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.charts.crossBreakdown} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="code" stroke="var(--text)" tick={{ fontSize: 11 }} />
              <YAxis stroke="var(--text)" tick={{ fontSize: 11 }} width={36} allowDecimals={false} />
              <Tooltip wrapperClassName="session__recharts-tooltip" formatter={(v: any, _n: any, p: any) => [`${v} stk`, p?.payload?.label ?? "Kryss"]} />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {data.charts.crossBreakdown.map((c) => (
                  <Cell key={c.code} fill={CROSS_COLORS[c.code] ?? "#a8a29e"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Month by month */}
      {data.monthly.length > 1 && (
        <div className="card wrapped-chart">
          <h2 className="wrapped-chart__title">Måned for måned</h2>
          <div className="wrapped-chart__legend">
            <span><i className="wrapped-dot" style={{ background: "#7c5cff" }} /> Chugs</span>
            <span><i className="wrapped-dot" style={{ background: "#22d3ee" }} /> Snitt-tid</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data.monthly} margin={{ top: 10, right: 6, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="label" stroke="var(--text)" tick={{ fontSize: 11 }} interval={0} />
              <YAxis yAxisId="c" stroke="var(--text)" tick={{ fontSize: 11 }} width={34} allowDecimals={false} />
              <YAxis yAxisId="s" orientation="right" stroke="var(--text)" tick={{ fontSize: 11 }} width={40} tickFormatter={(v) => `${v}s`} />
              <Tooltip
                wrapperClassName="session__recharts-tooltip"
                formatter={(v: any, n: any) => (n === "chugs" ? [`${v}`, "Chugs"] : [`${Number(v).toFixed(2)}s`, "Snitt"])}
              />
              <Bar yAxisId="c" dataKey="chugs" radius={[8, 8, 0, 0]} fill="#7c5cff" maxBarSize={64} />
              <Line yAxisId="s" type="monotone" dataKey="avg" stroke="#22d3ee" strokeWidth={3} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Everyone */}
      <h2 className="wrapped-h2">🎁 Hele kullet — trykk for personlig Wrapped</h2>
      <div className="wrapped-people-grid">
        {data.participants.map((p) => (
          <button
            key={p.id}
            className={`wrapped-person-chip ${p.isRegular ? "" : "wrapped-person-chip--guest"}`}
            onClick={() => nav(`/wrapped/person/${p.id}`)}
          >
            <RoundAvatar name={p.name} imageUrl={p.imageUrl} size={52} />
            <div className="wrapped-person-chip__name">{p.name}</div>
            {p.titleLabel && (
              <div className="wrapped-person-chip__title">{p.titleEmoji} {p.titleLabel}</div>
            )}
            <div className="wrapped-person-chip__meta">
              {p.n} chugs{p.bestClean != null ? ` · ${fmtSeconds(p.bestClean)}` : ""}
            </div>
          </button>
        ))}
      </div>

      {playing && (
        <WrappedStories cards={stories} playSong onClose={() => setPlaying(false)} />
      )}
    </div>
  );
}
