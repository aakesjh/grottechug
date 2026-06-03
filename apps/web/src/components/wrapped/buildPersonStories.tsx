import type { WrappedCard } from "./WrappedStories";
import type { PersonWrapped } from "./types";
import { PersonHighlight, RoundAvatar } from "./WrappedBits";
import { fmtSeconds, fmtShortDate } from "./types";

const BG = {
  intro: "linear-gradient(160deg, #2e1065 0%, #7c3aed 55%, #db2777 100%)",
  blue: "linear-gradient(160deg, #0c4a6e 0%, #0284c7 60%, #22d3ee 100%)",
  green: "linear-gradient(160deg, #064e3b 0%, #059669 60%, #34d399 100%)",
  amber: "linear-gradient(160deg, #7c2d12 0%, #ea580c 55%, #facc15 100%)",
  gold: "linear-gradient(160deg, #713f12 0%, #ca8a04 55%, #fde047 100%)",
  title: "linear-gradient(160deg, #4c1d95 0%, #db2777 55%, #f59e0b 100%)",
  roast: "linear-gradient(160deg, #450a0a 0%, #b91c1c 55%, #fb7185 100%)",
  slate: "linear-gradient(160deg, #0f172a 0%, #334155 55%, #64748b 100%)",
  finale: "linear-gradient(160deg, #3b0764 0%, #9333ea 50%, #ec4899 100%)",
};

export function buildPersonStories(d: PersonWrapped): WrappedCard[] {
  const cards: WrappedCard[] = [];
  const s = d.stats;
  const r = d.rankings;
  const name = d.participant.name;
  const isRegular = d.participant.isRegular;
  const bestTime = s.bestClean ?? s.best;

  // 1 — Intro
  cards.push({
    id: "intro",
    bg: BG.intro,
    emoji: "🍻",
    kicker: d.semesterLabel,
    heading: `${name}s Wrapped`,
    content: <PersonHighlight name={name} imageUrl={d.participant.imageUrl} ring="rgba(255,255,255,0.85)" />,
    sub: "La oss se på året ditt på Grotta...",
    durationMs: 4200,
  });

  // 2 — Chugs + attendance
  cards.push({
    id: "chugs",
    bg: BG.blue,
    kicker: "DU CHUGGET",
    bigCountUp: s.chugs,
    bigSuffix: s.chugs === 1 ? " gang" : " ganger",
    sub: s.totalSessions > 0 ? `Du var med ${s.attendance} av ${s.totalSessions} ganger.` : undefined,
  });

  // 3 — Litres + time
  cards.push({
    id: "litres",
    bg: BG.amber,
    emoji: "🍺",
    kicker: "DET BLE TIL OMTRENT",
    bigCountUp: s.totalLitres,
    bigDecimals: s.totalLitres % 1 === 0 ? 0 : 1,
    bigSuffix: " liter øl",
    sub: `${s.totalMinutes.toFixed(1)} minutter med ren chugging.`,
  });

  // 4 — Best clean time
  if (bestTime != null) {
    cards.push({
      id: "best",
      bg: BG.gold,
      confetti: true,
      kicker: "DIN RASKESTE TID",
      bigCountUp: bestTime,
      bigDecimals: 2,
      bigSuffix: "s",
      sub: s.bestCleanDateISO ? `Satt ${fmtShortDate(s.bestCleanDateISO)}` : undefined,
      meta: r.bestCleanRank != null ? `#${r.bestCleanRank} av ${r.totalRanked} i hele kullet` : undefined,
    });
  }

  // 5 — Percentile
  if (r.percentile != null) {
    cards.push({
      id: "percentile",
      bg: BG.blue,
      kicker: "DIN BESTE TID VAR RASKERE ENN",
      bigCountUp: r.percentile,
      bigDecimals: 1,
      bigSuffix: "%",
      sub: "...av alle chugs i kullet i år.",
      meta:
        r.bestCleanRankRegular != null
          ? `#${r.bestCleanRankRegular} av ${r.totalRankedRegular} faste medlemmer`
          : undefined,
    });
  }

  // 6 — Average vs group
  cards.push({
    id: "avg",
    bg: BG.green,
    kicker: "SNITTET DITT",
    bigCountUp: s.avg,
    bigDecimals: 2,
    bigSuffix: "s",
    sub:
      d.comparison.avgDelta != null
        ? d.comparison.avgDelta <= 0
          ? `${Math.abs(d.comparison.avgDelta).toFixed(2)}s raskere enn gruppa.`
          : `${d.comparison.avgDelta.toFixed(2)}s tregere enn gruppa.`
        : undefined,
  });

  // 7 — Improvement
  if (s.improvement > 0.1 && s.firstSeconds != null && s.bestClean != null) {
    cards.push({
      id: "improvement",
      bg: BG.green,
      confetti: true,
      emoji: "📈",
      kicker: "DU BLE BEDRE",
      bigCountUp: s.improvement,
      bigDecimals: 2,
      bigPrefix: "−",
      bigSuffix: "s",
      sub: `Fra ${fmtSeconds(s.firstSeconds)} til ${fmtSeconds(s.bestClean)}`,
      meta: `${s.improvementPct.toFixed(0)}% raskere enn da du startet`,
    });
  }

  // 8 — Consistency
  if (s.chugs >= 4) {
    cards.push({
      id: "consistency",
      bg: BG.blue,
      emoji: "🎯",
      kicker: "STABILITETEN DIN",
      bigCountUp: s.stddev,
      bigDecimals: 2,
      bigPrefix: "±",
      bigSuffix: "s",
      sub: s.stddev < 2 ? "Skummelt jevnt." : "Litt svingninger fra gang til gang.",
    });
  }

  // 8.5 — Monthly context
  if (d.monthly.length > 1) {
    const mostActive = d.monthly.reduce((a, b) => (b.chugs > a.chugs ? b : a));
    cards.push({
      id: "month-active",
      bg: BG.blue,
      emoji: "📅",
      kicker: "DIN MEST AKTIVE MÅNED",
      big: mostActive.label,
      sub: `${mostActive.chugs} chugs. Da var du på ditt mest engasjerte.`,
    });
    const months = d.monthly.filter((m) => m.bestClean != null);
    const bestMonth = months.length
      ? months.reduce((a, b) => ((b.bestClean as number) < (a.bestClean as number) ? b : a))
      : null;
    if (bestMonth) {
      cards.push({
        id: "month-best",
        bg: BG.green,
        emoji: "🌟",
        kicker: "DIN BESTE MÅNED",
        big: bestMonth.label,
        sub: `Beste tid ${fmtSeconds(bestMonth.bestClean)} — formtoppen din.`,
      });
    }
  }

  // 9 — Rival
  if (d.rival) {
    const rv = d.rival;
    const margin = Math.abs(rv.youWon - rv.theyWon);
    const lead =
      margin <= 1
        ? "Helt jevnt — ekte rivaler."
        : rv.youWon > rv.theyWon
          ? "Du leder det innbyrdes oppgjøret."
          : `${rv.name} leder det innbyrdes oppgjøret.`;
    cards.push({
      id: "rival",
      bg: BG.slate,
      kicker: "DIN STØRSTE RIVAL",
      content: (
        <div className="wrapped-rivalry">
          <div className="wrapped-rivalry__side">
            <RoundAvatar name={name} imageUrl={d.participant.imageUrl} size={72} ring="#22d3ee" />
            <div className="wrapped-rivalry__wins">{rv.youWon}</div>
            <div className="wrapped-rivalry__wins-label">seire</div>
            <div className="wrapped-rivalry__name">Deg</div>
          </div>
          <div className="wrapped-rivalry__vs">VS</div>
          <div className="wrapped-rivalry__side">
            <RoundAvatar name={rv.name} imageUrl={rv.imageUrl} size={72} ring="#fb7185" />
            <div className="wrapped-rivalry__wins">{rv.theyWon}</div>
            <div className="wrapped-rivalry__wins-label">seire</div>
            <div className="wrapped-rivalry__name">{rv.name}</div>
          </div>
        </div>
      ),
      sub: `${rv.youWon}–${rv.theyWon} på ${rv.meetings} felles chugs (hvem var raskest).`,
      meta: lead,
    });
  }

  // 10 — Chug aura
  cards.push({
    id: "aura",
    bg: BG.title,
    kicker: "DIN CHUG-AURA",
    big: d.aura.word,
    sub: d.aura.hint,
    durationMs: 4200,
  });

  // 11 — Personality title (the big reveal)
  cards.push({
    id: "title",
    bg: BG.title,
    confetti: true,
    kicker: "DIN GROTTECHUG-PERSONLIGHET",
    emoji: d.title.emoji,
    big: d.title.label,
    sub: d.title.blurb,
    durationMs: 6000,
  });

  // 12 — Awards won
  for (const a of d.awardsWon) {
    cards.push({
      id: `awardwon-${a.key}`,
      bg: a.kind === "award" ? BG.title : BG.roast,
      confetti: a.kind === "award",
      kicker: a.kind === "award" ? "DU VANT EN PRIS!" : "DU «VANT» EN PRIS...",
      emoji: a.emoji,
      heading: a.label,
      sub: a.kind === "award" ? "Vel fortjent." : "Noen måtte jo ta den.",
      durationMs: 4600,
    });
  }

  // 13 — Rap sheet (regulars only — kryss telles ikke for gjester)
  if (isRegular && s.crossesTotal > 0) {
    const top = d.crossBreakdown[0];
    cards.push({
      id: "crosses",
      bg: BG.roast,
      emoji: "❌",
      kicker: "SYNDEREGISTERET",
      bigCountUp: s.crossesTotal,
      bigDecimals: s.crossesTotal % 1 === 0 ? 0 : 1,
      bigSuffix: " kryss",
      sub: top ? `Mest: ${top.label} (${top.count}×)` : undefined,
      meta: r.crossRank != null ? `#${r.crossRank} mest kryss i kullet` : undefined,
    });
  } else if (isRegular) {
    cards.push({
      id: "clean",
      bg: BG.green,
      emoji: "😇",
      kicker: "REN SAMVITTIGHET",
      heading: "Null kryss i år",
      sub: "Plettfri vandel.",
    });
  }

  // 14 — Ting ingen spurte om (deadpan absurd stat)
  if (s.avg > 0) {
    const litersPerSec = 0.5 / s.avg;
    const bathtubMin = (150 / litersPerSec) / 60;
    cards.push({
      id: "useless",
      bg: BG.slate,
      kicker: "TING INGEN SPURTE OM",
      big: `${litersPerSec.toFixed(3)} L/s`,
      sub: "Snittfarten din.",
      meta: `I det tempoet tømmer du et badekar (150 L) på ${bathtubMin.toFixed(0)} minutter.`,
    });
  }

  // 15 — Geomatikk-spesial (datakvalitet)
  if (s.chugs >= 4) {
    const xs = d.timeSeries.map((p) => p.seconds);
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
    const outliers = sd > 0 ? xs.filter((x) => Math.abs((x - m) / sd) > 2).length : 0;
    const pct = (outliers / xs.length) * 100;
    cards.push({
      id: "geomatikk",
      bg: BG.slate,
      kicker: "GEOMATIKK-SPESIAL · DATAKVALITET",
      big: `${pct.toFixed(0)} %`,
      sub:
        outliers > 0
          ? "...av observasjonene dine ville blitt forkastet som spatial outliers i en masteroppgave."
          : "Ingen outliers. Eksemplariske data — godkjent.",
    });
  }

  // 16 — Season classification (the screenshot finale)
  cards.push({
    id: "classification",
    bg: BG.roast,
    kicker: "SESONGEN DIN KLASSIFISERT SOM",
    heading: `«${d.classification.label}»`,
    content: (
      <div className="wrapped-verdict">
        {d.classification.lines.map((line, i) => (
          <div key={i} className="wrapped-verdict__line">
            {line}
          </div>
        ))}
      </div>
    ),
    durationMs: 7000,
  });

  // 17 — Finale
  cards.push({
    id: "finale",
    bg: BG.finale,
    confetti: true,
    emoji: "🍺",
    heading: `Takk for i år, ${name}`,
    sub: "Vi sees på Grotta 🥂",
    meta: "grottechug.no",
    durationMs: 6000,
  });

  return cards;
}
