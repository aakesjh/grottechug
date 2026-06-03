import { useRef, useState } from "react";

type Attempt = {
  participantId: string;
  name: string;
  seconds: number;
};

type Props = {
  dateLabel: string;
  note: string | null;
  avgTime: number | null;
  participantCount: number;
  wetRate: number;
  fastest: Attempt | null;
  slowest: Attempt | null;
  top: Attempt[]; // sorted fastest first
};

const W = 1080;
const H = 1350;

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function SessionPosterButton(props: Props) {
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

      // Background gradient
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#0f172a");
      g.addColorStop(0.6, "#1e1b4b");
      g.addColorStop(1, "#312e81");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Glow circle
      const radial = ctx.createRadialGradient(W / 2, 360, 60, W / 2, 360, 700);
      radial.addColorStop(0, "rgba(99,102,241,0.55)");
      radial.addColorStop(1, "rgba(99,102,241,0)");
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, W, H);

      // Brand
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = "600 32px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("GROTTECHUG", W / 2, 110);

      // Date
      ctx.fillStyle = "#a5b4fc";
      ctx.font = "500 28px system-ui, sans-serif";
      ctx.fillText(props.dateLabel.toUpperCase(), W / 2, 160);

      // Headline (fastest)
      if (props.fastest) {
        ctx.fillStyle = "#facc15";
        ctx.font = "700 56px system-ui, sans-serif";
        ctx.fillText("🏆 DAGENS RASKESTE", W / 2, 270);

        ctx.fillStyle = "#fff";
        ctx.font = "800 120px system-ui, sans-serif";
        ctx.fillText(props.fastest.name, W / 2, 410);

        ctx.fillStyle = "#facc15";
        ctx.font = "900 220px system-ui, sans-serif";
        ctx.fillText(`${props.fastest.seconds.toFixed(2)}s`, W / 2, 620);
      }

      // Note quote
      if (props.note) {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = "italic 36px Georgia, serif";
        const lines = wrapText(ctx, `"${props.note}"`, W - 160);
        lines.slice(0, 2).forEach((line, i) => {
          ctx.fillText(line, W / 2, 720 + i * 52);
        });
      }

      // Stat row
      const statsY = 870;
      const drawStat = (label: string, value: string, x: number, color: string) => {
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.font = "600 26px system-ui, sans-serif";
        ctx.fillText(label, x, statsY);
        ctx.fillStyle = color;
        ctx.font = "800 64px system-ui, sans-serif";
        ctx.fillText(value, x, statsY + 70);
      };
      drawStat(
        "SNITT",
        props.avgTime != null ? `${props.avgTime.toFixed(2)}s` : "–",
        W * 0.22,
        "#fff"
      );
      drawStat("DELTAKERE", String(props.participantCount), W * 0.5, "#fff");
      drawStat(
        "WET-RATE",
        `${props.wetRate.toFixed(0)}%`,
        W * 0.78,
        "#38bdf8"
      );

      // Slowest of the day
      if (props.slowest) {
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.font = "700 26px system-ui, sans-serif";
        ctx.fillText("🐢 DAGENS TREGESTE", W / 2, 998);
        ctx.fillStyle = "#fff";
        ctx.font = "800 42px system-ui, sans-serif";
        ctx.fillText(`${props.slowest.name} · ${props.slowest.seconds.toFixed(2)}s`, W / 2, 1044);
      }

      // Top 3 podium
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = "700 30px system-ui, sans-serif";
      ctx.fillText("PALL", W / 2, 1110);

      const medals = ["🥇", "🥈", "🥉"];
      props.top.slice(0, 3).forEach((p, i) => {
        const y = 1158 + i * 50;
        ctx.textAlign = "left";
        ctx.fillStyle = "#fff";
        ctx.font = "700 36px system-ui, sans-serif";
        ctx.fillText(`${medals[i]}  ${p.name}`, 200, y);
        ctx.textAlign = "right";
        ctx.fillStyle = "#facc15";
        ctx.fillText(`${p.seconds.toFixed(2)}s`, W - 200, y);
      });

      // Footer
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "500 22px system-ui, sans-serif";
      ctx.fillText("grottechug.no", W / 2, H - 50);

      const dataUrl = canvas.toDataURL("image/png");

      // Try Web Share if available with file support
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], "grottechug-session.png", { type: "image/png" });
        const navAny = navigator as Navigator & {
          canShare?: (data: { files?: File[] }) => boolean;
          share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
        };
        if (navAny.canShare?.({ files: [file] })) {
          await navAny.share?.({
            files: [file],
            title: "Grottechug",
            text: `Resultater ${props.dateLabel}`,
          });
          setBusy(false);
          return;
        }
      } catch {
        // fall through to download
      }

      if (linkRef.current) {
        linkRef.current.href = dataUrl;
        linkRef.current.download = `grottechug-${props.dateLabel.replace(/\//g, "-")}.png`;
        linkRef.current.click();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn session-poster-btn"
        onClick={handleClick}
        disabled={busy}
        title={busy ? "Lager poster…" : "Del poster"}
        aria-label={busy ? "Lager poster" : "Del poster"}
      >
        {busy ? "…" : "🔗"}
      </button>
      <a ref={linkRef} style={{ display: "none" }} aria-hidden="true" />
    </>
  );
}
