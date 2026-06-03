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
  ctx.fillText("GROTTECHUG WRAPPED", W / 2, 120);
  ctx.fillStyle = "#fde047";
  ctx.font = "800 44px system-ui, sans-serif";
  ctx.fillText(d.semesterLabel.toUpperCase(), W / 2, 180);

  // Hero: total chugs
  ctx.fillStyle = "#fff";
  ctx.font = "900 280px system-ui, sans-serif";
  ctx.fillText(String(t.chugs), W / 2, 470);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "700 40px system-ui, sans-serif";
  ctx.fillText("CHUGS", W / 2, 540);

  // Stat row
  const statsY = 660;
  const drawStat = (label: string, value: string, x: number, color: string) => {
    ctx.fillStyle = color;
    ctx.font = "900 60px system-ui, sans-serif";
    ctx.fillText(value, x, statsY);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "600 26px system-ui, sans-serif";
    ctx.fillText(label, x, statsY + 44);
  };
  drawStat("LITER ØL", `${t.totalLitres}`, W * 0.22, "#fff");
  drawStat("MINUTTER", `${t.totalMinutes.toFixed(0)}`, W * 0.5, "#fff");
  drawStat("SNITT", t.avg != null ? `${t.avg.toFixed(2)}s` : "–", W * 0.78, "#22d3ee");

  // Fastest
  if (t.fastestClean) {
    ctx.fillStyle = "#fde047";
    ctx.font = "700 32px system-ui, sans-serif";
    ctx.fillText("⚡ ÅRETS RASKESTE", W / 2, 820);
    ctx.fillStyle = "#fff";
    ctx.font = "800 72px system-ui, sans-serif";
    ctx.fillText(`${t.fastestClean.name} · ${t.fastestClean.seconds.toFixed(2)}s`, W / 2, 895);
  }

  // Podium
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "700 30px system-ui, sans-serif";
  ctx.fillText("ÅRETS PALL", W / 2, 1010);
  const medals = ["🥇", "🥈", "🥉"];
  d.podium.slice(0, 3).forEach((p, i) => {
    const y = 1070 + i * 64;
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.font = "700 40px system-ui, sans-serif";
    ctx.fillText(`${medals[i]}  ${p.name}`, 190, y);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fde047";
    ctx.fillText(`${p.seconds.toFixed(2)}s`, W - 190, y);
    ctx.textAlign = "center";
  });

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "500 24px system-ui, sans-serif";
  ctx.fillText("grottechug.no", W / 2, H - 50);
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
  ctx.font = "700 32px system-ui, sans-serif";
  ctx.fillText("GROTTECHUG WRAPPED", W / 2, 110);
  ctx.fillStyle = "#fde047";
  ctx.font = "700 30px system-ui, sans-serif";
  ctx.fillText(d.semesterLabel.toUpperCase(), W / 2, 156);

  // Name
  ctx.fillStyle = "#fff";
  ctx.font = "900 96px system-ui, sans-serif";
  ctx.fillText(d.participant.name, W / 2, 270);

  // Personality
  ctx.font = "800 56px system-ui, sans-serif";
  ctx.fillText(`${d.title.emoji} ${d.title.label}`, W / 2, 360);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "italic 30px Georgia, serif";
  ctx.fillText(d.title.blurb, W / 2, 410);

  // Best time hero
  const bestTime = s.bestClean ?? s.best;
  if (bestTime != null) {
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "700 30px system-ui, sans-serif";
    ctx.fillText("RASKESTE RENE CHUG", W / 2, 560);
    ctx.fillStyle = "#fde047";
    ctx.font = "900 200px system-ui, sans-serif";
    ctx.fillText(`${bestTime.toFixed(2)}s`, W / 2, 740);
  }

  // Stat row
  const statsY = 900;
  const drawStat = (label: string, value: string, x: number) => {
    ctx.fillStyle = "#fff";
    ctx.font = "900 64px system-ui, sans-serif";
    ctx.fillText(value, x, statsY);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "600 26px system-ui, sans-serif";
    ctx.fillText(label, x, statsY + 46);
  };
  drawStat("CHUGS", String(s.chugs), W * 0.25);
  drawStat("LITER ØL", String(s.totalLitres), W * 0.5);
  drawStat(
    "RANK",
    r.bestCleanRank != null ? `#${r.bestCleanRank}` : "–",
    W * 0.75,
  );

  if (r.percentile != null) {
    ctx.fillStyle = "#fff";
    ctx.font = "700 40px system-ui, sans-serif";
    ctx.fillText(`Raskere enn ${r.percentile.toFixed(0)}% av alle chugs`, W / 2, 1080);
  }
  if (s.improvement > 0.1) {
    ctx.fillStyle = "#bbf7d0";
    ctx.font = "700 36px system-ui, sans-serif";
    ctx.fillText(`📈 ${s.improvementPct.toFixed(0)}% bedre enn ved start`, W / 2, 1145);
  }

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "500 24px system-ui, sans-serif";
  ctx.fillText("grottechug.no", W / 2, H - 50);
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
