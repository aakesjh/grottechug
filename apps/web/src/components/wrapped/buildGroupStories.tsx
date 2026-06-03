import type { WrappedCard } from "./WrappedStories";
import type { GroupWrapped, AwardWinner } from "./types";
import { PersonHighlight, RoundAvatar } from "./WrappedBits";
import { fmtSeconds } from "./types";

const BG = {
  intro: "linear-gradient(160deg, #2e1065 0%, #7c3aed 55%, #db2777 100%)",
  blue: "linear-gradient(160deg, #0c4a6e 0%, #0284c7 60%, #22d3ee 100%)",
  green: "linear-gradient(160deg, #064e3b 0%, #059669 60%, #34d399 100%)",
  amber: "linear-gradient(160deg, #7c2d12 0%, #ea580c 55%, #facc15 100%)",
  gold: "linear-gradient(160deg, #713f12 0%, #ca8a04 55%, #fde047 100%)",
  award: "linear-gradient(160deg, #4c1d95 0%, #7c3aed 55%, #c084fc 100%)",
  roast: "linear-gradient(160deg, #450a0a 0%, #b91c1c 55%, #fb7185 100%)",
  rivalry: "linear-gradient(160deg, #172554 0%, #1d4ed8 50%, #7c3aed 100%)",
  finale: "linear-gradient(160deg, #3b0764 0%, #9333ea 50%, #ec4899 100%)",
};

type AwardMeta = { key: string; kicker: string; emoji: string };

const AWARD_ORDER: AwardMeta[] = [
  { key: "raskest", kicker: "ÅRETS RASKESTE", emoji: "⚡" },
  { key: "mestForbedret", kicker: "MEST FORBEDRET", emoji: "📈" },
  { key: "mestStabil", kicker: "MEST STABIL", emoji: "🎯" },
  { key: "comeback", kicker: "ÅRETS COMEBACK", emoji: "🔥" },
  { key: "trofast", kicker: "MEST TROFAST", emoji: "🗿" },
];

const ROAST_ORDER: AwardMeta[] = [
  { key: "villeste", kicker: "ÅRETS VILLESTE", emoji: "💧" },
  { key: "syndaren", kicker: "SYNDAREN", emoji: "😈" },
  { key: "tregest", kicker: "ÅRETS TREGESTE", emoji: "🐢" },
  { key: "skuffet", kicker: "SKUFFET MEST", emoji: "📉" },
  { key: "brekker", kicker: "BREKKER'N", emoji: "🤮" },
];

function awardCard(meta: AwardMeta, w: AwardWinner, bg: string, confettiOn: boolean): WrappedCard | null {
  if (!w) return null;
  const shared = (w.winners?.length ?? 0) > 1;
  const content = shared ? (
    <div className="wrapped-award-avatars-lg">
      {w.winners!.map((x) => (
        <RoundAvatar key={x.participantId} name={x.name} imageUrl={x.imageUrl} size={92} ring="rgba(255,255,255,0.85)" />
      ))}
    </div>
  ) : (
    <PersonHighlight name={w.name} imageUrl={w.imageUrl} ring="rgba(255,255,255,0.85)" />
  );
  return {
    id: `award-${meta.key}`,
    bg,
    confetti: confettiOn,
    kicker: meta.kicker,
    emoji: meta.emoji,
    content,
    heading: w.name,
    big: w.value,
    meta: w.detail,
  };
}

export function buildGroupStories(d: GroupWrapped): WrappedCard[] {
  const cards: WrappedCard[] = [];
  const t = d.totals;

  // 1 — Intro
  cards.push({
    id: "intro",
    bg: BG.intro,
    emoji: "🍻",
    kicker: d.semesterLabel,
    heading: "Grottechug Wrapped",
    sub: d.meta.rangeLabel,
    meta: `${t.sessions} samlinger på Grotta`,
    durationMs: 4200,
  });

  // 2 — Total chugs
  cards.push({
    id: "chugs",
    bg: BG.blue,
    kicker: "SAMMEN CHUGGET DERE",
    bigCountUp: t.chugs,
    bigSuffix: " chugs",
    sub: `Fordelt på ${t.participants} sjeler — ${t.regulars} faste og ${t.guests} gjester.`,
  });

  // 3 — Litres
  cards.push({
    id: "litres",
    bg: BG.amber,
    emoji: "🍺",
    kicker: "DET BLE TIL OMTRENT",
    bigCountUp: t.totalLitres,
    bigDecimals: t.totalLitres % 1 === 0 ? 0 : 1,
    bigSuffix: " liter øl",
    sub: `≈ ${t.totalBeers} halvlitere ned i ett strekk.`,
  });

  // 4 — Time spent
  cards.push({
    id: "time",
    bg: BG.green,
    emoji: "⏱️",
    kicker: "TID BRUKT PÅ Å CHUGGE",
    bigCountUp: t.totalMinutes,
    bigDecimals: 1,
    bigSuffix: " min",
    sub: "Ren, konsentrert chugge-tid. Ikke verst.",
  });

  // 5 — Year average
  if (t.avg != null) {
    cards.push({
      id: "avg",
      bg: BG.blue,
      kicker: "SNITTET FOR ÅRET",
      bigCountUp: t.avg,
      bigDecimals: 2,
      bigSuffix: "s",
      sub: `${t.cleanRate}% av chuggene var rene. ${t.wetRate}% endte vått. 💧`,
    });
  }

  // 6 — Fastest moment of the year
  if (t.fastestClean) {
    cards.push({
      id: "fastest",
      bg: BG.gold,
      confetti: true,
      kicker: "ÅRETS RASKESTE ØYEBLIKK",
      content: <PersonHighlight name={t.fastestClean.name} imageUrl={t.fastestClean.imageUrl} ring="#fde047" />,
      heading: t.fastestClean.name,
      big: fmtSeconds(t.fastestClean.seconds),
      meta: "Tidenes raskeste rene chug i kullet 🏆",
    });
  }

  // 7 — Podium of the year
  if (d.podium.length > 0) {
    cards.push({
      id: "podium",
      bg: BG.award,
      confetti: true,
      kicker: "TOPP 3 RENESTE TIDER",
      heading: "Årets pall",
      content: (
        <div className="wrapped-podium-list">
          {d.podium.map((p, i) => (
            <div key={p.participantId} className={`wrapped-podium-row wrapped-podium-row--${i}`}>
              <span className="wrapped-podium-row__medal">{["🥇", "🥈", "🥉"][i]}</span>
              <RoundAvatar name={p.name} imageUrl={p.imageUrl} size={46} />
              <span className="wrapped-podium-row__name">{p.name}</span>
              <span className="wrapped-podium-row__time">{fmtSeconds(p.seconds)}</span>
            </div>
          ))}
        </div>
      ),
    });
  }

  // 8 — Awards intro
  cards.push({
    id: "awards-intro",
    bg: BG.award,
    emoji: "🏆",
    heading: "Grottechug Awards",
    sub: "Årets utmerkelser deles ut...",
    durationMs: 3200,
  });

  // 9 — Celebratory awards
  for (const meta of AWARD_ORDER) {
    const c = awardCard(meta, d.awards[meta.key], BG.award, true);
    if (c) cards.push(c);
  }

  // 10 — Roast intro
  cards.push({
    id: "roast-intro",
    bg: BG.roast,
    emoji: "😈",
    heading: "...og de mindre stolte øyeblikkene",
    sub: "Noen må jo ta støyten.",
    durationMs: 3200,
  });

  // 11 — Roasts
  for (const meta of ROAST_ORDER) {
    const c = awardCard(meta, d.roasts[meta.key], BG.roast, false);
    if (c) cards.push(c);
  }

  // 12 — Rivalry
  if (d.rivalry) {
    const r = d.rivalry;
    cards.push({
      id: "rivalry",
      bg: BG.rivalry,
      kicker: "ÅRETS RIVALISERING",
      heading: `${r.a.name} vs ${r.b.name}`,
      content: (
        <div className="wrapped-rivalry">
          <div className="wrapped-rivalry__side">
            <RoundAvatar name={r.a.name} imageUrl={r.a.imageUrl} size={84} ring="#22d3ee" />
            <div className="wrapped-rivalry__wins">{r.a.wins}</div>
            <div className="wrapped-rivalry__wins-label">seire</div>
            <div className="wrapped-rivalry__name">{r.a.name}</div>
          </div>
          <div className="wrapped-rivalry__vs">VS</div>
          <div className="wrapped-rivalry__side">
            <RoundAvatar name={r.b.name} imageUrl={r.b.imageUrl} size={84} ring="#c084fc" />
            <div className="wrapped-rivalry__wins">{r.b.wins}</div>
            <div className="wrapped-rivalry__wins-label">seire</div>
            <div className="wrapped-rivalry__name">{r.b.name}</div>
          </div>
        </div>
      ),
      meta: `${r.a.wins}–${r.b.wins} i innbyrdes seire over ${r.shared} felles chugs`,
    });
  }

  // 12.5 — Ting ingen spurte om (deadpan)
  const pctOfYear = (t.totalSeconds / (365 * 24 * 3600)) * 100;
  cards.push({
    id: "useless",
    bg: BG.blue,
    kicker: "TING INGEN SPURTE OM",
    big: `${t.totalMinutes.toFixed(0)} min`,
    sub: `Total chuggetid i år. Det er ${pctOfYear.toFixed(5)} % av hele året.`,
    meta: "Godt brukt tid.",
  });

  // 13 — Crosses
  if (t.totalCrosses > 0) {
    const top = d.charts.crossBreakdown[0];
    cards.push({
      id: "crosses",
      bg: BG.roast,
      emoji: "❌",
      kicker: "KRYSS UTDELT I ÅR",
      bigCountUp: t.totalCrosses,
      bigDecimals: t.totalCrosses % 1 === 0 ? 0 : 1,
      bigSuffix: " kryss",
      sub: top ? `Mest vanlig: ${top.label} (${top.count} stk)` : undefined,
    });
  }

  // 14 — Finale
  cards.push({
    id: "finale",
    bg: BG.finale,
    confetti: true,
    emoji: "🍺",
    heading: "Takk for et år på Grotta",
    sub: "Skål til neste kull 🥂",
    meta: "grottechug.no",
    durationMs: 6000,
  });

  return cards;
}
