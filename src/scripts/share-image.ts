import { SITE_URL } from "../config/site.js";

interface ScaleInfo {
  label: string;
  percent: number;
}

interface ShareImageData {
  archetypeName: string;
  motto: string;
  scales: ScaleInfo[];
  rarityText?: string;
}

const W = 1080;
const H = 1920;
const MARGIN = 120;

// ДИЗАЙН-ТЗ §2.1/§8.4: малювати напряму на canvas (html2canvas заборонений),
// дочекатися document.fonts.ready перед першим fillText.
export async function drawShareImage(canvas: HTMLCanvasElement, data: ShareImageData): Promise<void> {
  await document.fonts.ready;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const styles = getComputedStyle(document.documentElement);
  const inkBg = styles.getPropertyValue("--ink-800").trim() || "#060C12";
  const champ = styles.getPropertyValue("--champ").trim() || "#E4D2A6";
  const bone = styles.getPropertyValue("--bone").trim() || "#F4F4F0";
  const steel = styles.getPropertyValue("--steel").trim() || "#8FA0AE";
  const dim = styles.getPropertyValue("--dim").trim() || "#5D6E7C";
  const brass = styles.getPropertyValue("--brass").trim() || "#B9924A";
  const ink600 = styles.getPropertyValue("--ink-600").trim() || "#16232E";

  ctx.fillStyle = inkBg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = champ;
  ctx.font = "500 32px 'JetBrains Mono', ui-monospace, monospace";
  drawTracked(ctx, "ПРОФІЛЬ ПРОФСПІЛКОВОЇ ПОВЕДІНКИ", W / 2, 300, 0.2);

  ctx.fillStyle = bone;
  ctx.font = "900 132px 'Unbounded', system-ui, sans-serif";
  ctx.fillText(data.archetypeName.toUpperCase(), W / 2, 480);

  ctx.fillStyle = steel;
  ctx.font = "400 44px 'Inter', system-ui, sans-serif";
  wrapText(ctx, `«${data.motto}»`, W / 2, 680, W - MARGIN * 2, 56);

  let y = 900;
  const barW = W - MARGIN * 2;
  for (const scale of data.scales) {
    ctx.textAlign = "left";
    ctx.fillStyle = bone;
    ctx.font = "500 30px 'Inter', system-ui, sans-serif";
    ctx.fillText(scale.label, MARGIN, y - 24);

    ctx.fillStyle = ink600;
    ctx.fillRect(MARGIN, y, barW, 16);
    ctx.fillStyle = champ;
    ctx.fillRect(MARGIN, y, (barW * scale.percent) / 100, 16);

    ctx.textAlign = "right";
    ctx.fillStyle = dim;
    ctx.font = "700 28px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillText(`${scale.percent}%`, MARGIN + barW, y - 24);

    y += 110;
  }

  ctx.textAlign = "center";
  if (data.rarityText) {
    ctx.fillStyle = dim;
    ctx.font = "500 34px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillText(data.rarityText, W / 2, 1330);
  }

  ctx.strokeStyle = brass;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 320, 1700);
  ctx.lineTo(W / 2 + 320, 1700);
  ctx.stroke();

  ctx.fillStyle = bone;
  ctx.font = "900 76px 'Unbounded', system-ui, sans-serif";
  ctx.fillText("UNIONIZE", W / 2, 1770);

  const domain = SITE_URL.replace(/^https?:\/\//, "");
  ctx.fillStyle = champ;
  ctx.font = "500 34px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillText(domain, W / 2, 1850);
}

function drawTracked(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, tracking: number) {
  const fontSize = parseInt(ctx.font.match(/(\d+)px/)?.[1] ?? "16", 10);
  const letters = text.split("");
  let totalWidth = 0;
  const widths = letters.map((l) => {
    const w = ctx.measureText(l).width;
    totalWidth += w + tracking * fontSize;
    return w;
  });
  totalWidth -= tracking * fontSize;

  ctx.textAlign = "left";
  let x = cx - totalWidth / 2;
  letters.forEach((l, i) => {
    ctx.fillText(l, x, y);
    x += widths[i] + tracking * fontSize;
  });
  ctx.textAlign = "center";
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  const lines: string[] = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * lineHeight));
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
