import questionsData from "../../data/archetype-questions.json";
import archetypesData from "../../data/archetypes.json";
import { SUPABASE_URL, SUPABASE_ANON_KEY, RARITY_MIN_SAMPLES } from "../config/archetype.js";
import { drawShareImage, canvasToBlob } from "./share-image.js";
import { initReveal } from "./reveal.js";

type Axis = "A" | "B" | "C";

interface Option {
  text: string;
  pole: string;
}
interface Question {
  id: string;
  axis: Axis;
  weight: number;
  situation: string;
  options: Option[];
}
interface Archetype {
  code: string;
  slug: string;
  name: string;
  motto: string;
  essence: string;
  ally: string;
  opponent: string;
  rarityFallback: number;
  aboutYou: string[];
  strengths: string[];
  blindSpot: string[];
  howYouPlay: string;
  lifeMeaning: string;
}
const questions = questionsData.questions as Question[];
const axisLabels = questionsData._meta.axes as unknown as Record<
  Axis,
  { poles: [string, string]; labels: Record<string, string> }
>;
const archetypes = archetypesData.archetypes as Archetype[];
const bySlug = new Map(archetypes.map((a) => [a.slug, a]));
const byCode = new Map(archetypes.map((a) => [a.code, a]));

const answers: (number | null)[] = Array(questions.length).fill(null);
let currentIndex = 0;

function $(id: string) {
  return document.getElementById(id);
}

function showScreen(name: "intro" | "question" | "result") {
  ($("screen-intro") as HTMLElement).hidden = name !== "intro";
  ($("screen-question") as HTMLElement).hidden = name !== "question";
  ($("screen-result") as HTMLElement).hidden = name !== "result";
}

function renderQuestion(index: number) {
  const q = questions[index];
  ($("q-progress-label") as HTMLElement).textContent = `${index + 1} / ${questions.length}`;
  const scale = $("quiz-progress") as HTMLElement | null;
  scale?.style.setProperty("--pct", `${((index + (answers[index] !== null ? 1 : 0)) / questions.length) * 100}%`);

  ($("q-situation") as HTMLElement).textContent = q.situation;

  q.options.forEach((opt, i) => {
    const btn = $(`opt-${i}`) as HTMLButtonElement;
    btn.textContent = opt.text;
    btn.classList.toggle("is-selected", answers[index] === i);
  });

  ($("q-back") as HTMLButtonElement).hidden = index === 0;
  const nextBtn = $("q-next") as HTMLButtonElement;
  nextBtn.disabled = answers[index] === null;
  nextBtn.textContent = index === questions.length - 1 ? "Побачити результат" : "Далі";
}

function selectOption(i: number) {
  answers[currentIndex] = i;
  renderQuestion(currentIndex);
}

function goNext() {
  if (answers[currentIndex] === null) return;
  if (currentIndex === questions.length - 1) {
    finish();
    return;
  }
  currentIndex += 1;
  renderQuestion(currentIndex);
}

function goBack() {
  if (currentIndex === 0) return;
  currentIndex -= 1;
  renderQuestion(currentIndex);
}

interface AxisResult {
  winnerPole: string;
  loserPole: string;
  winnerScore: number;
  percent: number;
}

function computeScores(): Record<Axis, AxisResult> {
  const totals: Record<Axis, Record<string, number>> = { A: {}, B: {}, C: {} };
  questions.forEach((q, i) => {
    const choice = answers[i];
    if (choice === null) return;
    const pole = q.options[choice].pole;
    totals[q.axis][pole] = (totals[q.axis][pole] || 0) + q.weight;
  });

  const result = {} as Record<Axis, AxisResult>;
  (["A", "B", "C"] as Axis[]).forEach((axis) => {
    const [poleX, poleY] = axisLabels[axis].poles;
    const scoreX = totals[axis][poleX] || 0;
    const scoreY = totals[axis][poleY] || 0;
    const winnerPole = scoreX >= scoreY ? poleX : poleY;
    const loserPole = scoreX >= scoreY ? poleY : poleX;
    const winnerScore = Math.max(scoreX, scoreY);
    result[axis] = { winnerPole, loserPole, winnerScore, percent: Math.round((winnerScore / 5) * 100) };
  });
  return result;
}

async function fetchRarity(code: string): Promise<{ percent: number; isReal: boolean } | null> {
  const archetype = byCode.get(code);
  const fallback = archetype ? { percent: archetype.rarityFallback, isReal: false } : null;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return fallback;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/archetype_rarity_view`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return fallback;
    const rows = (await res.json()) as { archetype_code: string; count: number }[];
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    if (total < RARITY_MIN_SAMPLES) return null; // недостатньо даних — рядок не показуємо взагалі
    const mine = rows.find((r) => r.archetype_code === code)?.count || 0;
    return { percent: Math.round((mine / total) * 100), isReal: true };
  } catch {
    return fallback;
  }
}

function recordResult(code: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  fetch(`${SUPABASE_URL}/rest/v1/archetype_results`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ archetype_code: code }),
  }).catch(() => {
    /* тихо ігноруємо — це лічильник рідкості, не критична функція */
  });
}

async function finish() {
  const scores = computeScores();
  const code = `${scores.A.winnerPole}-${scores.B.winnerPole}-${scores.C.winnerPole}`;
  const archetype = byCode.get(code);
  if (!archetype) return;

  recordResult(code);
  renderResult(archetype, scores);
  showScreen("result");
  initReveal();

  const rarity = await fetchRarity(code);
  const rarityEl = $("r-rarity") as HTMLElement;
  if (rarity) {
    rarityEl.hidden = false;
    rarityEl.textContent = rarity.isReal
      ? `За поточними даними — ${rarity.percent}%`
      : `За поточними даними — ${rarity.percent}%`;
  } else {
    rarityEl.hidden = true;
  }
}

const AXIS_TITLES: Record<Axis, string> = {
  A: "Що ти захищаєш",
  B: "Як ти дієш",
  C: "Через що ти дієш",
};

function renderResult(a: Archetype, scores: Record<Axis, AxisResult>) {
  ($("r-name") as HTMLElement).textContent = a.name;
  ($("r-motto") as HTMLElement).textContent = a.essence ? `«${a.motto}» — ${a.essence}` : `«${a.motto}»`;

  ($("r-about-1") as HTMLElement).textContent = a.aboutYou[0] || "";
  ($("r-about-2") as HTMLElement).textContent = a.aboutYou[1] || "";
  ($("r-about-3") as HTMLElement).textContent = a.aboutYou[2] || "";

  (["A", "B", "C"] as Axis[]).forEach((axis) => {
    const s = scores[axis];
    const [poleX, poleY] = axisLabels[axis].poles;
    const winnerLabel = axisLabels[axis].labels[s.winnerPole];
    (document.getElementById(`r-scale-${axis.toLowerCase()}-label`) as HTMLElement).textContent = AXIS_TITLES[axis];
    (document.getElementById(`r-scale-${axis.toLowerCase()}-value`) as HTMLElement).textContent = `${winnerLabel} · ${s.percent}%`;
    (document.getElementById(`r-scale-${axis.toLowerCase()}-poles`) as HTMLElement).textContent =
      `${axisLabels[axis].labels[poleY]} ← → ${axisLabels[axis].labels[poleX]}`;
    document.getElementById(`r-scale-${axis.toLowerCase()}`)?.style.setProperty("--pct", `${s.percent}%`);
  });

  const strengthsEl = $("r-strengths") as HTMLElement;
  strengthsEl.innerHTML = a.strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join("");
  const blindSpotEl = $("r-blindspot") as HTMLElement;
  blindSpotEl.innerHTML = a.blindSpot.map((s) => `<li>${escapeHtml(s)}</li>`).join("");

  ($("r-howyouplay") as HTMLElement).textContent = a.howYouPlay;

  const ally = bySlug.get(a.ally);
  const opponent = bySlug.get(a.opponent);
  if (ally) {
    ($("r-ally-name") as HTMLElement).textContent = ally.name;
    const link = $("r-ally-link") as HTMLAnchorElement;
    link.textContent = "Дізнатись більше →";
    link.href = `/archetype/${ally.slug}`;
  }
  if (opponent) {
    ($("r-opponent-name") as HTMLElement).textContent = opponent.name;
    const link = $("r-opponent-link") as HTMLAnchorElement;
    link.textContent = "Дізнатись більше →";
    link.href = `/archetype/${opponent.slug}`;
  }

  ($("r-life") as HTMLElement).textContent = a.lifeMeaning;

  const shareBtn = $("r-share") as HTMLButtonElement;
  shareBtn.onclick = () => handleShare(a, scores);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function handleShare(a: Archetype, scores: Record<Axis, AxisResult>) {
  const canvas = $("share-canvas") as HTMLCanvasElement;
  const rarityEl = $("r-rarity") as HTMLElement;

  await drawShareImage(canvas, {
    archetypeName: a.name,
    motto: a.motto,
    scales: (["A", "B", "C"] as Axis[]).map((axis) => ({
      label: axisLabels[axis].labels[scores[axis].winnerPole],
      percent: scores[axis].percent,
    })),
    rarityText: !rarityEl.hidden ? rarityEl.textContent || undefined : undefined,
  });

  const blob = await canvasToBlob(canvas);
  if (!blob) return;
  const file = new File([blob], "unionize-profile.png", { type: "image/png" });

  const shareBtn = $("r-share") as HTMLButtonElement;

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Unionize" });
      return;
    } catch {
      /* користувач скасував — не помилка */
      return;
    }
  }

  // Фолбек: збереження файлу
  const url = URL.createObjectURL(blob);
  const a_ = document.createElement("a");
  a_.href = url;
  a_.download = "unionize-profile.png";
  a_.click();
  URL.revokeObjectURL(url);
  shareBtn.textContent = "Збережено";
  setTimeout(() => {
    shareBtn.textContent = "Зберегти зображення";
  }, 2000);
}

function restart() {
  answers.fill(null);
  currentIndex = 0;
  renderQuestion(0);
  showScreen("question");
}

function init() {
  const startBtn = $("start-test");
  startBtn?.addEventListener("click", () => {
    currentIndex = 0;
    renderQuestion(0);
    showScreen("question");
  });

  $("opt-0")?.addEventListener("click", () => selectOption(0));
  $("opt-1")?.addEventListener("click", () => selectOption(1));
  $("q-next")?.addEventListener("click", goNext);
  $("q-back")?.addEventListener("click", goBack);
  $("r-retry")?.addEventListener("click", restart);

  document.addEventListener("keydown", (e) => {
    const questionVisible = !($("screen-question") as HTMLElement).hidden;
    if (!questionVisible) return;
    if (e.key === "1") selectOption(0);
    if (e.key === "2") selectOption(1);
    if (e.key === "Enter") goNext();
    if (e.key === "Backspace") goBack();
  });
}

init();
