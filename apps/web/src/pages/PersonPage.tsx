import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer
} from "recharts";
import { apiFetch } from "../lib/api";
import { BadgeMedal } from "../components/BadgeMedal";
import { LoadingCard } from "../components/LoadingCard";

type Semester = "2026V" | "2025H" | "all";

// NYTT: Inkludert sessionId i typen
type Point = { sessionId: string; dateISO: string; seconds: number; note: string | null };
type Badge = { id: string; title: string; description: string; icon: string; category: string; earned: boolean };
type ProfileRanking = {
  bestCleanRank: number | null;
  violationCount: number;
  violationRank: number | null;
};

const EMPTY_PROFILE_RANKING: ProfileRanking = {
  bestCleanRank: null,
  violationCount: 0,
  violationRank: null,
};
type BottomStat = {
  label: string;
  value: string;
  tone?: "better" | "worse" | "accent";
};
type Resp = {
  participant: { id: string; name: string; isRegular: boolean; imageUrl?: string | null };
  semester: string;
  points: Point[];
  stats: { attempts: number; best: number | null; avg: number | null; bestClean: number | null };
  profileRanking?: ProfileRanking;
  badges: Badge[];
};

function fmtDDMMYYYY(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function ruleCodeClass(code: string) {
  return `person__note-code--${code.trim().toLowerCase()}`;
}

function countViolationsFromPoints(points: Point[]) {
  return points.reduce((total, point) => {
    if (!point.note) return total;

    const count = point.note
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean).length;

    return total + count;
  }, 0);
}

const PERSON_PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981",
  "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899",
];

function personColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PERSON_PALETTE[Math.abs(hash) % PERSON_PALETTE.length];
}

function personInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

const SEMESTER_LABEL: Record<Semester, string> = {
  "2025H": "2025 Høst",
  "2026V": "2026 Vår",
  all: "Total",
};

export function PersonPage() {
  const { id } = useParams();
  const nav = useNavigate(); // NYTT: For navigering
  const [semester, setSemester] = useState<Semester>("2026V");
  const [data, setData] = useState<Resp | null>(null);
  
  const [participants, setParticipants] = useState<{id: string, name: string}[]>([]);
  const [compareId, setCompareId] = useState<string>("");
  const [compareData, setCompareData] = useState<Resp | null>(null);


  // 1. Hent alle deltakere for sammenligning
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`/api/participants?includeGuests=true`);
        const json = await res.json();
        
        const list = json
          .filter((r: any) => {
            if (String(r.id) === String(id)) return false;
            return r.isRegular || (r.attempts >= 4);
          })
          .map((r: any) => ({ 
            id: String(r.id), 
            name: r.isRegular ? r.name : `${r.name} (Gjest)` 
          }));
        
        const uniqueList = Array.from(new Map(list.map((item: any) => [item.id, item])).values())
          .sort((a: any, b: any) => a.name.localeCompare(b.name));

        setParticipants(uniqueList as {id: string, name: string}[]);
      } catch (e) {
        console.error("Kunne ikke hente deltakere", e);
      }
    })();
  }, [id]);

  // 2. Hent hovedpersonens data
  useEffect(() => {
    (async () => {
      const res = await apiFetch(`/api/person/${id}?semester=${semester}`);
      const json: Resp = await res.json();
      setData(json);
    })();
  }, [id, semester]);

  // 3. Hent sammenligningspersonens data
  useEffect(() => {
    if (!compareId) {
      setCompareData(null);
      return;
    }
    (async () => {
      const res = await apiFetch(`/api/person/${compareId}?semester=${semester}`);
      const json: Resp = await res.json();
      setCompareData(json);
    })();
  }, [compareId, semester]);

  const chartData = useMemo(() => {
    if (!data) return [];

    if (!compareData) {
      const pts = data.points.map((p, i) => ({
        ...p,
        idx: i,
        date: fmtDDMMYYYY(p.dateISO)
      }));

      if (pts.length < 2) return pts;

      const xs = pts.map(p => p.idx);
      const ys = pts.map(p => p.seconds);
      const n = xs.length;
      const sumX = xs.reduce((a, b) => a + b, 0);
      const sumY = ys.reduce((a, b) => a + b, 0);
      const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
      const sumXX = xs.reduce((a, x) => a + x * x, 0);
      const denom = n * sumXX - sumX * sumX;
      const m = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
      const b = (sumY - m * sumX) / n;

      return pts.map(p => ({ ...p, trend: m * p.idx + b }));
    }

    const dateMap = new Map<string, any>();
    const addData = (points: Point[], key: string, sessionKey: string) => {
      points.forEach(p => {
        const d = fmtDDMMYYYY(p.dateISO);
        if (!dateMap.has(d)) {
          dateMap.set(d, { dateISO: p.dateISO, date: d });
        }
        dateMap.get(d)[key] = p.seconds;
        dateMap.get(d)[sessionKey] = p.sessionId;
      });
    };
    addData(data.points, "mainSeconds", "mainSessionId");
    addData(compareData.points, "compSeconds", "compSessionId");

    return Array.from(dateMap.values()).sort(
      (a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime()
    );
  }, [data, compareData]);

  if (!data) {
    return (
      <LoadingCard
        className="person__loading"
        title="Laster profil..."
        subtitle="Henter statistikk og historikk"
      />
    );
  }

  const p = data.participant;
  const bestClean = data.stats.bestClean;
  const profileRanking = data.profileRanking ?? {
    ...EMPTY_PROFILE_RANKING,
    violationCount: countViolationsFromPoints(data.points),
  };
  const rankingQuery = new URLSearchParams({ semester });
  if (!p.isRegular) {
    rankingQuery.set("includeGuests", "1");
  }
  const leaderboardHref = `/leaderboard?${rankingQuery.toString()}`;
  const violationsHref = `/violations?${rankingQuery.toString()}`;

  let changeSinceStart = null;
  let last3Avg = null;
  let projectedNext = null;
  let trendPerAttempt = null;
  let medianTime = null;
  let timeSpread = null;
  let standardDeviation = null;
  let recentVsAverage = null;

  if (data.points.length > 0) {
    const pts = data.points;
    const sortedTimes = pts.map((pt) => pt.seconds).sort((left, right) => left - right);
    const medianIndex = Math.floor(sortedTimes.length / 2);

    medianTime = sortedTimes.length % 2 === 0
      ? (sortedTimes[medianIndex - 1] + sortedTimes[medianIndex]) / 2
      : sortedTimes[medianIndex];

    if (pts.length >= 2) {
      changeSinceStart = pts[0].seconds - pts[pts.length - 1].seconds; 
      const n = pts.length;
      const sumX = pts.map((_, i) => i).reduce((a, b) => a + b, 0);
      const sumY = pts.reduce((a, pt) => a + pt.seconds, 0);
      const sumXY = pts.map((pt, i) => i * pt.seconds).reduce((a, b) => a + b, 0);
      const sumXX = pts.map((_, i) => i * i).reduce((a, b) => a + b, 0);
      const denom = n * sumXX - sumX * sumX;
      const m = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
      const b = (sumY - m * sumX) / n;
      const mean = sumY / n;

      trendPerAttempt = m;
      timeSpread = sortedTimes[sortedTimes.length - 1] - sortedTimes[0];
      standardDeviation = Math.sqrt(
        pts.reduce((sum, pt) => sum + (pt.seconds - mean) ** 2, 0) / n
      );
      projectedNext = Math.max(0, m * n + b); 
    }
    const last3 = pts.slice(-3);
    last3Avg = last3.reduce((sum, pt) => sum + pt.seconds, 0) / last3.length;
    recentVsAverage = data.stats.avg == null ? null : data.stats.avg - last3Avg;
  }

  let headToHeadAvg = "Uavgjort / Mangler data";
  let headToHeadBest = "Uavgjort / Mangler data";
  let headToHeadConsistency = "Uavgjort / Mangler data";
  let headToHeadRecentForm = "Uavgjort / Mangler data";
  let headToHeadVolume = "Like mange";

  if (compareData) {
    if (data.stats.avg && compareData.stats.avg) {
      const diff = data.stats.avg - compareData.stats.avg;
      if (diff < 0) headToHeadAvg = `${p.name} (-${Math.abs(diff).toFixed(2)}s)`;
      else if (diff > 0) headToHeadAvg = `${compareData.participant.name} (-${diff.toFixed(2)}s)`;
    }
    if (data.stats.bestClean && compareData.stats.bestClean) {
      const diff = data.stats.bestClean - compareData.stats.bestClean;
      if (diff < 0) headToHeadBest = `${p.name} (-${Math.abs(diff).toFixed(2)}s)`;
      else if (diff > 0) headToHeadBest = `${compareData.participant.name} (-${diff.toFixed(2)}s)`;
    }
    if (data.points.length >= 2 && compareData.points.length >= 2) {
      const getGap = (pts: Point[]) => Math.max(...pts.map(pt => pt.seconds)) - Math.min(...pts.map(pt => pt.seconds));
      const myGap = getGap(data.points);
      const compGap = getGap(compareData.points);
      if (myGap < compGap) headToHeadConsistency = p.name;
      else if (myGap > compGap) headToHeadConsistency = compareData.participant.name;
      else headToHeadConsistency = "Likt gap";
    }

    const compareLast3 = compareData.points.slice(-3);
    const compareLast3Avg = compareLast3.length
      ? compareLast3.reduce((sum, pt) => sum + pt.seconds, 0) / compareLast3.length
      : null;

    if (last3Avg != null && compareLast3Avg != null) {
      const diff = last3Avg - compareLast3Avg;
      if (diff < 0) headToHeadRecentForm = `${p.name} (-${Math.abs(diff).toFixed(2)}s)`;
      else if (diff > 0) headToHeadRecentForm = `${compareData.participant.name} (-${diff.toFixed(2)}s)`;
      else headToHeadRecentForm = "Lik form";
    }

    if (data.points.length !== compareData.points.length) {
      headToHeadVolume = data.points.length > compareData.points.length ? p.name : compareData.participant.name;
    } else if (!data.points.length && !compareData.points.length) {
      headToHeadVolume = "Mangler data";
    }
  }

    const performanceStats: BottomStat[] = [
      {
        label: "Endring siden start",
        value:
          changeSinceStart == null
            ? "—"
            : changeSinceStart > 0
              ? `Bedre (${changeSinceStart.toFixed(2)}s)`
              : changeSinceStart < 0
                ? `Tregere (${Math.abs(changeSinceStart).toFixed(2)}s)`
                : "Uendret",
        tone:
          changeSinceStart == null
            ? undefined
            : changeSinceStart > 0
              ? "better"
              : changeSinceStart < 0
                ? "worse"
                : undefined,
      },
      {
        label: "Snitt siste 3 forsøk",
        value: last3Avg == null ? "—" : `${last3Avg.toFixed(2)}s`,
      },
      {
        label: "Siste 3 mot snitt",
        value:
          recentVsAverage == null
            ? "—"
            : recentVsAverage > 0
              ? `${recentVsAverage.toFixed(2)}s raskere`
              : recentVsAverage < 0
                ? `${Math.abs(recentVsAverage).toFixed(2)}s tregere`
                : "Lik snittfart",
        tone:
          recentVsAverage == null
            ? undefined
            : recentVsAverage > 0
              ? "better"
              : recentVsAverage < 0
                ? "worse"
                : undefined,
      },
      {
        label: "Trend per forsøk",
        value:
          trendPerAttempt == null
            ? "—"
            : trendPerAttempt < 0
              ? `${Math.abs(trendPerAttempt).toFixed(2)}s raskere`
              : trendPerAttempt > 0
                ? `${trendPerAttempt.toFixed(2)}s tregere`
                : "Flat trend",
        tone:
          trendPerAttempt == null
            ? undefined
            : trendPerAttempt < 0
              ? "better"
              : trendPerAttempt > 0
                ? "worse"
                : undefined,
      },
      {
        label: "Median tid",
        value: medianTime == null ? "—" : `${medianTime.toFixed(2)}s`,
      },
      {
        label: "Standardavvik",
        value: standardDeviation == null ? "—" : `${standardDeviation.toFixed(2)}s`,
      },
      {
        label: "Spenn",
        value: timeSpread == null ? "—" : `${timeSpread.toFixed(2)}s`,
      },
      {
        label: "Projisert neste tid",
        value: projectedNext == null ? "—" : `${projectedNext.toFixed(2)}s`,
        tone: projectedNext == null ? undefined : "accent",
      },
    ];

    const comparisonStats: BottomStat[] = [
      {
        label: "Raskest i snitt (totalt)",
        value: headToHeadAvg,
      },
      {
        label: "Beste clean tid",
        value: headToHeadBest,
      },
      {
        label: "Form siste 3",
        value: headToHeadRecentForm,
      },
      {
        label: "Mest konsekvent",
        value: headToHeadConsistency,
      },
      {
        label: "Flest forsøk",
        value: headToHeadVolume,
      },
    ];

  // --- Derived UI values ---
  const accent = personColor(p.name);
  const initials = personInitials(p.name);
  const semesterLabel = SEMESTER_LABEL[semester];
  const earnedBadges = (data.badges ?? []).filter((b) => b.earned).length;
  const totalBadges = (data.badges ?? []).length;

  const pbPoint =
    bestClean != null ? data.points.find((pt) => pt.seconds === bestClean) ?? null : null;

  const trendChip =
    trendPerAttempt == null
      ? null
      : trendPerAttempt < -0.005
        ? {
            icon: "📈",
            text: `${Math.abs(trendPerAttempt).toFixed(2)}s raskere per forsøk`,
            tone: "better" as const,
          }
        : trendPerAttempt > 0.005
          ? {
              icon: "📉",
              text: `${trendPerAttempt.toFixed(2)}s tregere per forsøk`,
              tone: "worse" as const,
            }
          : { icon: "➡️", text: "Stabil utvikling", tone: "neutral" as const };

  const highlights = [
    {
      key: "pb",
      icon: "🏆",
      label: "Personlig rekord",
      value: bestClean == null ? "—" : `${bestClean.toFixed(2)}s`,
      sub: pbPoint
        ? `${fmtDDMMYYYY(pbPoint.dateISO)}${
            profileRanking.bestCleanRank != null ? ` · #${profileRanking.bestCleanRank} totalt` : ""
          }`
        : "Ingen ren tid registrert",
      onClick: pbPoint ? () => nav(`/session/${pbPoint.sessionId}`) : undefined,
      tone: "gold" as const,
    },
    {
      key: "form",
      icon: "🔥",
      label: "Form siste 3",
      value: last3Avg == null ? "—" : `${last3Avg.toFixed(2)}s`,
      sub:
        recentVsAverage == null
          ? "—"
          : recentVsAverage > 0
            ? `${recentVsAverage.toFixed(2)}s raskere enn snitt`
            : recentVsAverage < 0
              ? `${Math.abs(recentVsAverage).toFixed(2)}s tregere enn snitt`
              : "Lik snittfart",
      tone:
        recentVsAverage == null
          ? ("neutral" as const)
          : recentVsAverage > 0
            ? ("better" as const)
            : recentVsAverage < 0
              ? ("worse" as const)
              : ("neutral" as const),
    },
    {
      key: "consistency",
      icon: "📊",
      label: "Konsistens",
      value: standardDeviation == null ? "—" : `±${standardDeviation.toFixed(2)}s`,
      sub: timeSpread == null ? "—" : `Spenn ${timeSpread.toFixed(2)}s`,
      tone: "neutral" as const,
    },
    {
      key: "projected",
      icon: "🎯",
      label: "Projisert neste",
      value: projectedNext == null ? "—" : `${projectedNext.toFixed(2)}s`,
      sub: trendChip ? trendChip.text : "—",
      tone: "accent" as const,
    },
  ];

  const detailStats = compareData ? comparisonStats : performanceStats;

  return (
    <div className="person" style={{ ["--person-accent" as any]: accent }}>
      {/* ── HERO ── */}
      <section className="person-hero card">
        <div className="person-hero__bg" aria-hidden="true" />
        <div className="person-hero__photo">
          {p.imageUrl ? (
            <img src={p.imageUrl} alt={p.name} />
          ) : (
            <span className="person-hero__initials">{initials || "?"}</span>
          )}
        </div>
        <div className="person-hero__info">
          <div className="person-hero__pills">
            <span className="person-hero__pill person-hero__pill--role">
              {p.isRegular ? "👑 Fast" : "🎉 Gjest"}
            </span>
            <span className="person-hero__pill">{semesterLabel}</span>
          </div>
          <h1 className="person-hero__name">{p.name}</h1>

          <div className="person-hero__quick">
            <div className="person-hero__stat">
              <div className="person-hero__stat-num">{data.stats.attempts}</div>
              <div className="person-hero__stat-lbl">Forsøk</div>
            </div>
            <div className="person-hero__stat">
              <div className="person-hero__stat-num">
                {data.stats.best == null ? "—" : `${data.stats.best.toFixed(2)}s`}
              </div>
              <div className="person-hero__stat-lbl">
                {profileRanking.bestCleanRank != null ? (
                  <Link to={leaderboardHref} className="person-hero__stat-link">
                    PB · #{profileRanking.bestCleanRank}
                  </Link>
                ) : (
                  "PB"
                )}
              </div>
            </div>
            <div className="person-hero__stat">
              <div className="person-hero__stat-num">
                {data.stats.avg == null ? "—" : `${data.stats.avg.toFixed(2)}s`}
              </div>
              <div className="person-hero__stat-lbl">Snitt</div>
            </div>
            <div className="person-hero__stat">
              <div className="person-hero__stat-num">{profileRanking.violationCount}</div>
              <div className="person-hero__stat-lbl">
                {profileRanking.violationRank != null ? (
                  <Link to={violationsHref} className="person-hero__stat-link">
                    Kryss · #{profileRanking.violationRank}
                  </Link>
                ) : (
                  "Kryss"
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TOOLBAR ── */}
      <div className="person-toolbar card">
        <div className="tabs person-toolbar__tabs">
          <button
            className={`tab ${semester === "2025H" ? "tabActive" : ""}`}
            onClick={() => setSemester("2025H")}
          >
            2025 Høst
          </button>
          <button
            className={`tab ${semester === "2026V" ? "tabActive" : ""}`}
            onClick={() => setSemester("2026V")}
          >
            2026 Vår
          </button>
          <button
            className={`tab ${semester === "all" ? "tabActive" : ""}`}
            onClick={() => setSemester("all")}
          >
            Total
          </button>
        </div>
        <select
          className="input person-toolbar__compare"
          value={compareId}
          onChange={(e) => setCompareId(e.target.value)}
        >
          <option value="">Sammenlign med...</option>
          {participants.map((pt) => (
            <option key={pt.id} value={pt.id}>
              {pt.name}
            </option>
          ))}
        </select>
      </div>

      {/* ── HIGHLIGHTS ── */}
      <section className="person-highlights">
        {highlights.map((h) => (
          <article
            key={h.key}
            className={`card person-highlight person-highlight--${h.tone} ${
              h.onClick ? "person-highlight--clickable" : ""
            }`}
            onClick={h.onClick}
            role={h.onClick ? "button" : undefined}
            tabIndex={h.onClick ? 0 : undefined}
            onKeyDown={(e) => {
              if (h.onClick && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                h.onClick();
              }
            }}
          >
            <div className="person-highlight__icon" aria-hidden="true">
              {h.icon}
            </div>
            <div className="person-highlight__body">
              <div className="person-highlight__label">{h.label}</div>
              <div className="person-highlight__value">{h.value}</div>
              <div className="person-highlight__sub">{h.sub}</div>
            </div>
          </article>
        ))}
      </section>

      {/* ── CHART ── */}
      <section className="card person-chart-card">
        <div className="person-chart-card__head">
          <h2 className="u-mb-0">Utvikling</h2>
          {trendChip && (
            <span className={`person-chart-card__chip person-chart-card__chip--${trendChip.tone}`}>
              <span aria-hidden="true">{trendChip.icon}</span> {trendChip.text}
            </span>
          )}
        </div>
        <div className="person-chart-card__area">
          <ResponsiveContainer width="100%" height={300} minWidth={1} minHeight={300}>
            <LineChart data={chartData} margin={{ top: 16, right: 20, bottom: 26, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis
                dataKey="date"
                stroke="var(--text)"
                tick={{ fill: "var(--text)", fontSize: 12, fontWeight: 600 }}
                tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                minTickGap={16}
                tickMargin={8}
              />
              <YAxis
                domain={["auto", "auto"]}
                stroke="var(--text)"
                tick={{ fill: "var(--text)", fontSize: 12, fontWeight: 600 }}
                tickLine={{ stroke: "rgba(255,255,255,0.35)" }}
                width={56}
                tickFormatter={(tick: any) => `${tick}s`}
              />
              <Tooltip
                wrapperClassName="person__chart-tooltip"
                formatter={(v: any, name: any) => {
                  if (name === "trend") return [`${Number(v).toFixed(2)}s`, "Trend"];
                  if (name === "seconds" || name === "mainSeconds")
                    return [`${Number(v).toFixed(2)}s`, p.name];
                  if (name === "compSeconds" && compareData)
                    return [`${Number(v).toFixed(2)}s`, compareData.participant.name];
                  return [String(v), String(name)];
                }}
                labelFormatter={(label: any) => `${label}`}
              />

              {compareData && <Legend verticalAlign="top" height={36} />}

              <Line
                name={p.name}
                type="monotone"
                dataKey={compareData ? "mainSeconds" : "seconds"}
                stroke={accent}
                strokeWidth={3}
                dot={{ r: 4, fill: accent, cursor: "pointer" }}
                activeDot={{
                  r: 6,
                  cursor: "pointer",
                  onClick: (_: any, payload: any) => {
                    const sid = payload?.payload?.sessionId || payload?.payload?.mainSessionId;
                    if (sid) nav(`/session/${sid}`);
                  },
                }}
                connectNulls
              />

              {!compareData && (
                <Line
                  type="monotone"
                  dataKey="trend"
                  dot={false}
                  stroke="var(--accent2)"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
              )}

              {compareData && (
                <Line
                  name={compareData.participant.name}
                  type="monotone"
                  dataKey="compSeconds"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#f59e0b", cursor: "pointer" }}
                  activeDot={{
                    r: 6,
                    cursor: "pointer",
                    onClick: (_: any, payload: any) => {
                      const sid = payload?.payload?.compSessionId;
                      if (sid) nav(`/session/${sid}`);
                    },
                  }}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── DETAIL STATS ── */}
      <section className="card person-detail">
        <h2 className="u-mb-0 person-detail__title">
          {compareData ? `Mot ${compareData.participant.name}` : "Detaljert statistikk"}
        </h2>
        <div className="person-detail__grid">
          {detailStats.map((stat) => {
            const toneClass =
              stat.tone === "better"
                ? "person-detail__card--better"
                : stat.tone === "worse"
                  ? "person-detail__card--worse"
                  : stat.tone === "accent"
                    ? "person-detail__card--accent"
                    : "";
            return (
              <article key={stat.label} className={`person-detail__card ${toneClass}`}>
                <div className="person-detail__label">{stat.label}</div>
                <div className="person-detail__value">{stat.value}</div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ── BADGES ── */}
      <section className="card person-badges-card">
        <div className="person-badges-card__head">
          <h2 className="u-mb-0">Badges</h2>
          <span className="person-badges-card__count">
            {earnedBadges} / {totalBadges} oppnådd
          </span>
        </div>
        <div className="person__badges-grid">
          {(data.badges ?? []).map((badge) => (
            <div
              key={badge.id}
              className={`person__badge ${
                badge.earned ? "person__badge--earned" : "person__badge--locked"
              }`}
              data-category={badge.category}
              data-tooltip={badge.description}
            >
              <BadgeMedal badgeId={badge.id} category={badge.category} icon={badge.icon} />
              <div className="person__badge-title">{badge.title}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HISTORY ── */}
      <section className="card">
        <h2>Historikk</h2>
        <div className="tableWrap">
          <table className="person__history-table">
            <thead>
              <tr>
                <th className="person__history-th person__history-th--date">Dato</th>
                <th className="person__history-th person__history-th--time">Tid</th>
                <th className="person__history-th">Anmerkning</th>
              </tr>
            </thead>
            <tbody>
              {data.points.map((pt, i) => {
                const isPB = bestClean !== null && pt.seconds === bestClean;
                return (
                  <tr key={`${pt.dateISO}-${i}`} className={isPB ? "person__history-row--pb" : ""}>
                    <td className="person__history-cell">
                      <button
                        className="btnGhost person__history-date-btn"
                        onClick={() => nav(`/session/${pt.sessionId}`)}
                        title="Se detaljer for denne dagen"
                      >
                        {fmtDDMMYYYY(pt.dateISO)}
                      </button>
                    </td>
                    <td className={`person__history-cell ${isPB ? "person__pb-cell" : ""}`}>
                      {pt.seconds.toFixed(2)}s {isPB && "🌟"}
                    </td>
                    <td className="person__history-cell">
                      {pt.note ? (
                        <div className="person__history-note-list">
                          {pt.note.split(", ").map((code, idx) => (
                            <span
                              key={idx}
                              className={`badge person__note-code ${ruleCodeClass(code)}`}
                            >
                              {code.trim()}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="u-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!data.points.length && (
                <tr>
                  <td colSpan={3} className="u-text-muted u-text-center person__history-empty">
                    Ingen data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
