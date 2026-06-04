import { useRef, useState } from "react";
import type { GroupWrapped, PersonWrapped } from "./types";

const W = 1080;
const H = 1350;

type Props =
  | { kind: "year"; data: GroupWrapped; label?: string }
  | { kind: "person"; data: PersonWrapped; label?: string };

function paintBackground(ctx: CanvasRenderingContext2D, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  for (const [pos, color] of stops) g.addColorStop(pos, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const radial = ctx.createRadialGradient(W / 2, 340, 60, W / 2, 340, 760);
  radial.addColorStop(0, "rgba(255,255,255,0.18)");
  radial.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, W, H);
}

function drawYear(ctx: CanvasRenderingContext2D, d: GroupWrapped) {
  paintBackground(ctx, [
    [0, "#2e1065"],
    [0.55, "#7c3aed"],
    [1, "#db2777"],
  ]);
  const t = d.totals;
  ctx.textAlign = "center";

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "700 34px system-ui, sans-serif";
  ctx.fillText("GROTTECHUG WRAPPED", W / 2, 110);
  ctx.fillStyle = "#fde047";
  ctx.font = "800 44px system-ui, sans-serif";
  ctx.fillText(d.semesterLabel.toUpperCase(), W / 2, 168);

  // Hero: total chugs
  ctx.fillStyle = "#fff";
  ctx.font = "900 210px system-ui, sans-serif";
  ctx.fillText(String(t.chugs), W / 2, 390);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "700 38px system-ui, sans-serif";
  ctx.fillText("CHUGS", W / 2, 450);

  const drawStat = (label: string, value: string, x: number, y: number, color = "#fff") => {
    ctx.fillStyle = color;
    ctx.font = "900 58px system-ui, sans-serif";
    ctx.fillText(value, x, y);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "600 25px system-ui, sans-serif";
    ctx.fillText(label, x, y + 42);
  };
  // Row 1
  drawStat("LITER ØL", `${t.totalLitres}`, W * 0.22, 575);
  drawStat("MINUTTER", `${t.totalMinutes.toFixed(0)}`, W * 0.5, 575);
  drawStat("SNITT", t.avg != null ? `${t.avg.toFixed(2)}s` : "–", W * 0.78, 575, "#22d3ee");
  // Row 2
  drawStat("SAMLINGER", `${t.sessions}`, W * 0.22, 690);
  drawStat("CHUGGERE", `${t.participants}`, W * 0.5, 690);
  drawStat("KRYSS", `${t.totalCrosses}`, W * 0.78, 690, "#fb7185");
  // clean / wet line
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "700 30px system-ui, sans-serif";
  ctx.fillText(`${t.cleanRate}% tørre · ${t.wetRate}% våte chugs`, W / 2, 770);

  // Fastest
  if (t.fastestClean) {
    ctx.fillStyle = "#fde047";
    ctx.font = "700 30px system-ui, sans-serif";
    ctx.fillText("⚡ ÅRETS RASKESTE", W / 2, 858);
    ctx.fillStyle = "#fff";
    ctx.font = "800 64px system-ui, sans-serif";
    ctx.fillText(`${t.fastestClean.name} · ${t.fastestClean.seconds.toFixed(2)}s`, W / 2, 922);
  }

  // Podium
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "700 30px system-ui, sans-serif";
  ctx.fillText("ÅRETS PALL", W / 2, 1020);
  const medals = ["🥇", "🥈", "🥉"];
  d.podium.slice(0, 3).forEach((p, i) => {
    const y = 1080 + i * 62;
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.font = "700 38px system-ui, sans-serif";
    ctx.fillText(`${medals[i]}  ${p.name}`, 190, y);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fde047";
    ctx.fillText(`${p.seconds.toFixed(2)}s`, W - 190, y);
    ctx.textAlign = "center";
  });

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "500 24px system-ui, sans-serif";
  ctx.fillText("grottechug.no", W / 2, H - 48);
}

function drawPerson(ctx: CanvasRenderingContext2D, d: PersonWrapped) {
  paintBackground(ctx, [
    [0, "#4c1d95"],
    [0.55, "#db2777"],
    [1, "#f59e0b"],
  ]);
  const s = d.stats;
  const r = d.rankings;
  ctx.textAlign = "center";

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "700 30px system-ui, sans-serif";
  ctx.fillText("GROTTECHUG WRAPPED", W / 2, 96);
  ctx.fillStyle = "#fde047";
  ctx.font = "700 28px system-ui, sans-serif";
  ctx.fillText(d.semesterLabel.toUpperCase(), W / 2, 140);

  // Name
  ctx.fillStyle = "#fff";
  ctx.font = "900 88px system-ui, sans-serif";
  ctx.fillText(d.participant.name, W / 2, 232);

  // Personality
  ctx.font = "800 50px system-ui, sans-serif";
  ctx.fillText(`${d.title.emoji} ${d.title.label}`, W / 2, 304);
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = "italic 28px Georgia, serif";
  ctx.fillText(d.title.blurb, W / 2, 348);
  // Aura
  ctx.fillStyle = "#fde047";
  ctx.font = "700 28px system-ui, sans-serif";
  ctx.fillText(`AURA: ${d.aura.word.toUpperCase()}`, W / 2, 402);

  // Best time hero
  const bestTime = s.bestClean ?? s.best;
  if (bestTime != null) {
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "700 28px system-ui, sans-serif";
    ctx.fillText("RASKESTE TID", W / 2, 490);
    ctx.fillStyle = "#fde047";
    ctx.font = "900 170px system-ui, sans-serif";
    ctx.fillText(`${bestTime.toFixed(2)}s`, W / 2, 640);
  }

  const drawStat = (label: string, value: string, x: number, y: number, color = "#fff") => {
    ctx.fillStyle = color;
    ctx.font = "900 58px system-ui, sans-serif";
    ctx.fillText(value, x, y);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "600 24px system-ui, sans-serif";
    ctx.fillText(label, x, y + 40);
  };
  // Row 1
  drawStat("CHUGS", String(s.chugs), W * 0.22, 760);
  drawStat("OPPMØTE", `${s.attendance}/${s.totalSessions}`, W * 0.5, 760);
  // Value clearly means "#1 of N faste" via the label — no cramped secondary here.
  drawStat(
    d.participant.isRegular ? `AV ${r.totalRanked} FASTE` : "RANK",
    r.bestCleanRank != null ? `#${r.bestCleanRank}` : "–",
    W * 0.78,
    760,
    "#fde047",
  );
  // Row 2
  drawStat("SNITT", `${s.avg.toFixed(2)}s`, W * 0.22, 880);
  drawStat("LITER ØL", String(s.totalLitres), W * 0.5, 880);
  if (d.participant.isRegular) drawStat("KRYSS", String(s.crossesTotal), W * 0.78, 880, "#fb7185");
  else drawStat("STABILITET", `±${s.stddev.toFixed(2)}`, W * 0.78, 880);

  // Guest-inclusive rank as its own clearly-separated centered line.
  if (d.participant.isRegular && r.bestCleanRankAll != null && r.bestCleanRankAll !== r.bestCleanRank) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "600 26px system-ui, sans-serif";
    ctx.fillText(`#${r.bestCleanRankAll} av ${r.totalRankedAll} medregnet gjester`, W / 2, 968);
  }

  if (r.percentile != null) {
    ctx.fillStyle = "#fff";
    ctx.font = "700 36px system-ui, sans-serif";
    ctx.fillText(`Raskere enn ${r.percentile.toFixed(0)}% av alle chugs`, W / 2, 1022);
  }
  if (s.improvement > 0.1) {
    ctx.fillStyle = "#bbf7d0";
    ctx.font = "700 32px system-ui, sans-serif";
    ctx.fillText(`📈 ${s.improvementPct.toFixed(0)}% bedre enn ved start`, W / 2, 1070);
  }

  // Classification
  ctx.fillStyle = "#fde047";
  ctx.font = "800 38px system-ui, sans-serif";
  ctx.fillText(`«${d.classification.label}»`, W / 2, 1130);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "500 24px system-ui, sans-serif";
  ctx.fillText("grottechug.no", W / 2, H - 48);
}

export function WrappedPosterButton(props: Props) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (props.kind === "year") drawYear(ctx, props.data);
      else drawPerson(ctx, props.data);

      const dataUrl = canvas.toDataURL("image/png");
      const fileName =
        props.kind === "year"
          ? `grottechug-wrapped-${props.data.semesterLabel.replace(/[^\w]+/g, "-")}.png`
          : `grottechug-wrapped-${props.data.participant.name.replace(/[^\w]+/g, "-")}.png`;

      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], fileName, { type: "image/png" });
        const navAny = navigator as Navigator & {
          canShare?: (data: { files?: File[] }) => boolean;
          share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
        };
        if (navAny.canShare?.({ files: [file] })) {
          await navAny.share?.({ files: [file], title: "Grottechug Wrapped" });
          setBusy(false);
          return;
        }
      } catch {
        /* fall through to download */
      }

      if (linkRef.current) {
        linkRef.current.href = dataUrl;
        linkRef.current.download = fileName;
        linkRef.current.click();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="btn wrapped-share-btn" onClick={handleClick} disabled={busy}>
        {busy ? "Lager…" : props.label ?? "📤 Del som bilde"}
      </button>
      <a ref={linkRef} style={{ display: "none" }} aria-hidden="true" />
    </>
  );
}
