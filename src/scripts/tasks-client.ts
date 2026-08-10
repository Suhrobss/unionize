import tasksData from "../../data/tasks.json";
import quizData from "../../data/quiz.json";

interface TaskStep {
  action: string;
  url: string;
  button_label: string;
}
interface Task {
  id: string;
  title: string;
  steps: TaskStep[];
  verify_hint: string;
  active: boolean;
}
interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  status: string;
}

const tasks = (tasksData.tasks as Task[]).filter((t) => t.active);
const readyQuestions = (quizData.questions as QuizQuestion[]).filter((q) => q.status === "ready");

const QUIZ_MIN_TECHNICAL = 5;
const QUIZ_PASS_THRESHOLD = 3;
const QUIZ_LENGTH = 5;

// «Мішок»: перемішує й видає без повторів, доки не вичерпається (ІДЕЇ-ТЗ §2.4).
// Живе лише у вкладці (sessionStorage) — зникає із закриттям вкладки.
class Bag<T extends { id: string }> {
  private pool: T[];
  private remaining: T[] = [];
  private storageKey: string;

  constructor(pool: T[], storageKey: string) {
    this.pool = pool;
    this.storageKey = storageKey;
    this.restore();
  }

  private shuffle(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private restore() {
    try {
      const raw = sessionStorage.getItem(this.storageKey);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      const byId = new Map(this.pool.map((p) => [p.id, p]));
      this.remaining = ids.map((id) => byId.get(id)).filter((x): x is T => Boolean(x));
    } catch {
      this.remaining = [];
    }
    if (this.remaining.length === 0) this.refill();
  }

  private persist() {
    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify(this.remaining.map((x) => x.id)));
    } catch {
      /* приватний режим тощо — не критично */
    }
  }

  private refill() {
    this.remaining = this.shuffle(this.pool);
    this.persist();
  }

  draw(count = 1): T[] {
    const drawn: T[] = [];
    for (let i = 0; i < count; i++) {
      if (this.remaining.length === 0) this.refill();
      const next = this.remaining.shift();
      if (next) drawn.push(next);
    }
    this.persist();
    return drawn;
  }
}

const taskBag = new Bag(tasks, "unionize_task_bag");
const quizBag = new Bag(readyQuestions, "unionize_quiz_bag");

function $(id: string) {
  return document.getElementById(id);
}

function showOnly(id: string) {
  ["ap-screen-0", "ap-screen-1", "ap-screen-task", "ap-screen-quiz", "ap-screen-quiz-fail", "ap-screen-confirm"].forEach(
    (s) => {
      const el = $(s);
      if (el) el.hidden = s !== id;
    }
  );
}

// --- Гілка А: завдання ---
let currentTask: Task | null = null;

function renderTask(task: Task) {
  currentTask = task;
  ($("ap-task-title") as HTMLElement).textContent = task.title;
  for (let i = 0; i < 3; i++) {
    const stepEl = $(`ap-step-${i}`) as HTMLElement;
    const step = task.steps[i];
    if (!step) {
      stepEl.hidden = true;
      continue;
    }
    stepEl.hidden = false;
    ($(`ap-step-action-${i}`) as HTMLElement).textContent = step.action;
    (($(`ap-step-check-${i}`) as HTMLInputElement)).checked = false;
    const link = $(`ap-step-link-${i}`) as HTMLAnchorElement;
    link.href = step.url;
    link.textContent = step.button_label || "Відкрити";
  }
}

function pickNewTask() {
  const [task] = taskBag.draw(1);
  if (task) renderTask(task);
}

// --- Гілка Б: вікторина ---
interface ActiveQuestion {
  q: QuizQuestion;
  shuffledOptions: string[];
  correctIndex: number;
}

let quizSet: ActiveQuestion[] = [];
let quizIndex = 0;
let quizResults: boolean[] = [];
let answered = false;

function shuffleOptions(q: QuizQuestion): ActiveQuestion {
  const indices = q.options.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const shuffledOptions = indices.map((i) => q.options[i]);
  const correctIndex = indices.indexOf(q.correct);
  return { q, shuffledOptions, correctIndex };
}

function startQuiz() {
  const drawn = quizBag.draw(QUIZ_LENGTH);
  quizSet = drawn.map(shuffleOptions);
  quizIndex = 0;
  quizResults = [];
  renderQuizQuestion();
  showOnly("ap-screen-quiz");
}

function renderQuizQuestion() {
  answered = false;
  const item = quizSet[quizIndex];
  ($("ap-quiz-progress") as HTMLElement).textContent = `${quizIndex + 1} / ${quizSet.length}`;
  $("ap-quiz-scale")?.style.setProperty("--pct", `${(quizIndex / quizSet.length) * 100}%`);
  ($("ap-quiz-question") as HTMLElement).textContent = item.q.question;

  const letters = ["А", "Б", "В", "Г"];
  item.shuffledOptions.forEach((opt, i) => {
    const btn = $(`ap-quiz-opt-${i}`) as HTMLButtonElement;
    btn.className = "ap-quiz-option";
    btn.disabled = false;
    (btn.querySelector(".ap-quiz-option__letter") as HTMLElement).textContent = letters[i];
    (btn.querySelector(".ap-quiz-option__text") as HTMLElement).textContent = opt;
  });

  ($("ap-quiz-explanation") as HTMLElement).hidden = true;
  ($("ap-quiz-next") as HTMLElement).hidden = true;
}

function selectQuizOption(index: number) {
  if (answered) return;
  answered = true;
  const item = quizSet[quizIndex];
  const isCorrect = index === item.correctIndex;
  quizResults.push(isCorrect);

  for (let i = 0; i < item.shuffledOptions.length; i++) {
    const btn = $(`ap-quiz-opt-${i}`) as HTMLButtonElement;
    btn.disabled = true;
    if (i === item.correctIndex) btn.classList.add("is-correct");
    else if (i === index) btn.classList.add("is-incorrect");
    else btn.classList.add("is-dimmed");
  }

  const explanation = $("ap-quiz-explanation") as HTMLElement;
  explanation.hidden = false;
  explanation.className = `ap-quiz__explanation ${isCorrect ? "is-correct" : "is-incorrect"}`;
  ($("ap-quiz-explanation-title") as HTMLElement).textContent = isCorrect ? "Правильно" : "Неправильно";
  ($("ap-quiz-explanation-text") as HTMLElement).textContent = item.q.explanation;

  const nextBtn = $("ap-quiz-next") as HTMLElement;
  nextBtn.hidden = false;
  nextBtn.textContent = quizIndex === quizSet.length - 1 ? "Побачити результат" : "Далі";
}

function quizNext() {
  if (!answered) return;
  if (quizIndex === quizSet.length - 1) {
    finishQuiz();
    return;
  }
  quizIndex += 1;
  renderQuizQuestion();
}

function finishQuiz() {
  const correctCount = quizResults.filter(Boolean).length;
  if (correctCount >= QUIZ_PASS_THRESHOLD) {
    showConfirmation({ kind: "quiz", results: quizResults });
  } else {
    ($("ap-fail-title") as HTMLElement).innerHTML = `${correctCount} з ${quizResults.length} — <span class="outline-fail">не пройдено</span>`;
    showOnly("ap-screen-quiz-fail");
  }
}

// --- екран підтвердження ---
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const timePart = Date.now().toString(36).slice(-3).toUpperCase();
  return `${timePart}-${rand(3)}`;
}

function formatTime(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${dd}.${mm} · ${hh}:${min}`;
}

function showConfirmation(payload: { kind: "task"; verifyHint: string } | { kind: "quiz"; results: boolean[] }) {
  ($("ap-confirm-code") as HTMLElement).textContent = generateCode();
  ($("ap-confirm-time") as HTMLElement).textContent = formatTime();

  const verifyEl = $("ap-confirm-verify") as HTMLElement;
  if (payload.kind === "task") {
    verifyEl.innerHTML = `<p>• ${escapeHtml(payload.verifyHint)}</p>`;
  } else {
    const correctCount = payload.results.filter(Boolean).length;
    const marks = payload.results
      .map((ok, i) => `<span style="color:${ok ? "var(--pos)" : "var(--paper-neg)"}">${i + 1} ${ok ? "✓" : "✕"}</span>`)
      .join("&nbsp;&nbsp;");
    verifyEl.innerHTML = `<p style="font-family:var(--font-mono);font-weight:700;margin-bottom:8px">${correctCount} з ${payload.results.length}</p><p>${marks}</p>`;
  }

  showOnly("ap-screen-confirm");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function init() {
  $("ap-start")?.addEventListener("click", () => showOnly("ap-screen-1"));

  const quizAvailable = readyQuestions.length >= QUIZ_MIN_TECHNICAL;
  if (!quizAvailable) {
    $("ap-choose-quiz")?.classList.add("is-disabled");
    const note = $("ap-quiz-unavailable") as HTMLElement;
    note.hidden = false;
  }

  $("ap-choose-task")?.addEventListener("click", () => {
    pickNewTask();
    showOnly("ap-screen-task");
  });

  $("ap-choose-quiz")?.addEventListener("click", () => {
    if (!quizAvailable) return;
    startQuiz();
  });

  $("ap-task-shuffle")?.addEventListener("click", pickNewTask);
  $("ap-task-done")?.addEventListener("click", () => {
    if (currentTask) showConfirmation({ kind: "task", verifyHint: currentTask.verify_hint });
  });

  [0, 1, 2, 3].forEach((i) => $(`ap-quiz-opt-${i}`)?.addEventListener("click", () => selectQuizOption(i)));
  $("ap-quiz-next")?.addEventListener("click", quizNext);

  $("ap-fail-retry")?.addEventListener("click", startQuiz);
  $("ap-fail-back")?.addEventListener("click", () => showOnly("ap-screen-1"));

  $("ap-confirm-done")?.addEventListener("click", () => showOnly("ap-screen-0"));
}

init();
