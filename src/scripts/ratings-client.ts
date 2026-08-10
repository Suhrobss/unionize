import { SHEET_URL, TOP_PLAYERS_VISIBLE, TOP_INSTITUTION_PLAYERS, SEARCH_MIN_INSTITUTIONS } from "../config/ratings.js";
import { initReveal } from "./reveal.js";

interface PlayerRow {
  name: string;
  rating: number;
  uc: number;
  ppoCount: number;
  ppoValue: number;
  total: number;
  institution: string | null;
}

interface InstitutionRow {
  name: string;
  total: number;
  participants: number;
}

interface SheetCol {
  label: string;
}
interface SheetCell {
  v: unknown;
}
interface SheetRow {
  c: (SheetCell | null)[];
}
interface SheetResponse {
  table: { cols: SheetCol[]; rows: SheetRow[] };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadSheet(timeoutMs = 8000): Promise<SheetResponse> {
  return new Promise((resolve, reject) => {
    const cbName = `__unionizeRatings_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("timeout"));
    }, timeoutMs);

    function cleanup() {
      delete (window as unknown as Record<string, unknown>)[cbName];
      script.remove();
      clearTimeout(timer);
    }

    (window as unknown as Record<string, unknown>)[cbName] = (data: SheetResponse) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(data);
    };

    const script = document.createElement("script");
    script.src = `${SHEET_URL}&tqx=responseHandler:${cbName}`;
    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("script error"));
    };
    document.body.appendChild(script);
  });
}

function findCol(cols: SheetCol[], test: (label: string) => boolean): number {
  return cols.findIndex((c) => test(c.label || ""));
}

function parsePlayers(data: SheetResponse): PlayerRow[] {
  const cols = data.table.cols;
  const idx = {
    name: findCol(cols, (l) => /ім.?я|прізвище/i.test(l)),
    rating: findCol(cols, (l) => /рейтинг/i.test(l) && !/всього/i.test(l)),
    uc: findCol(cols, (l) => l.trim().toLowerCase() === "uc"),
    ppoCount: findCol(cols, (l) => /(підприємств|ппо)/i.test(l) && !/вартість/i.test(l)),
    ppoValue: findCol(cols, (l) => /вартість/i.test(l)),
    total: findCol(cols, (l) => /всього/i.test(l)),
    institution: findCol(cols, (l) => /заклад/i.test(l)),
  };

  const cellAt = (row: SheetRow, i: number) => (i >= 0 ? row.c[i]?.v : undefined);

  return data.table.rows
    .map((row): PlayerRow | null => {
      const name = cellAt(row, idx.name);
      if (!name) return null;
      const rating = Number(cellAt(row, idx.rating)) || 0;
      const uc = Number(cellAt(row, idx.uc)) || 0;
      const ppoValue = Number(cellAt(row, idx.ppoValue)) || 0;
      const totalRaw = cellAt(row, idx.total);
      const total = totalRaw != null && totalRaw !== "" ? Number(totalRaw) : rating * 100 + uc + ppoValue;
      const institutionRaw = idx.institution >= 0 ? cellAt(row, idx.institution) : null;
      return {
        name: String(name),
        rating,
        uc,
        ppoCount: Number(cellAt(row, idx.ppoCount)) || 0,
        ppoValue,
        total,
        institution: institutionRaw ? String(institutionRaw).trim() || null : null,
      };
    })
    .filter((row): row is PlayerRow => row !== null)
    .sort((a, b) => b.total - a.total);
}

function computeInstitutions(players: PlayerRow[]): InstitutionRow[] {
  const groups = new Map<string, PlayerRow[]>();
  for (const p of players) {
    if (!p.institution) continue;
    if (!groups.has(p.institution)) groups.set(p.institution, []);
    groups.get(p.institution)!.push(p);
  }
  const result: InstitutionRow[] = [];
  for (const [name, list] of groups) {
    const top = [...list].sort((a, b) => b.total - a.total).slice(0, TOP_INSTITUTION_PLAYERS);
    result.push({
      name,
      total: top.reduce((sum, p) => sum + p.total, 0),
      participants: list.length,
    });
  }
  return result.sort((a, b) => b.total - a.total);
}

function fmt(n: number): string {
  return n.toLocaleString("uk-UA");
}

function podiumCard(entry: { name: string; total: number; sub: string }, place: number): string {
  return `
    <div class="podium__card podium__card--${place}" data-reveal data-reveal-group="podium">
      <p class="podium__place">${place}</p>
      <p class="podium__name">${escapeHtml(entry.name)}</p>
      <p class="podium__total">${fmt(entry.total)}</p>
      <p class="label podium__sub">${escapeHtml(entry.sub)}</p>
    </div>`;
}

function listRow(entry: { name: string; total: number; sub: string }, place: number): string {
  return `
    <div class="rlist__row" data-reveal data-reveal-group="rlist">
      <span class="rlist__place">${place}</span>
      <span class="rlist__name">${escapeHtml(entry.name)}<br /><span class="label rlist__sub">${escapeHtml(entry.sub)}</span></span>
      <span class="rlist__total">${fmt(entry.total)}</span>
    </div>`;
}

function renderBoard(
  container: HTMLElement,
  entries: { name: string; total: number; sub: string }[],
  emptyMessage: string
) {
  if (entries.length === 0) {
    container.innerHTML = `<p class="ratings__note">${emptyMessage}</p>`;
    return;
  }

  // DOM-порядок — природний (1·2·3), як того вимагає мобільна верстка
  // (§7.2 "Мобільний: 1 · 2 · 3 стовпчиком"). Десктопне 2·1·3 — це лише
  // візуальне переставлення через CSS `order`, не порядок у розмітці.
  const top3 = entries.slice(0, 3);
  const podiumHtml = top3.length
    ? `<div class="podium">${top3.map((e, i) => podiumCard(e, i + 1)).join("")}</div>`
    : "";

  const rest = entries.slice(3, TOP_PLAYERS_VISIBLE);
  const overflow = entries.slice(TOP_PLAYERS_VISIBLE);

  const listHtml = `<div class="rlist">${rest.map((e, i) => listRow(e, i + 4)).join("")}</div>`;
  const overflowHtml = overflow.length
    ? `<div class="rlist rlist--overflow" hidden>${overflow
        .map((e, i) => listRow(e, i + TOP_PLAYERS_VISIBLE + 1))
        .join("")}</div>
       <button type="button" class="btn-outline ratings__show-all">Показати всіх</button>`
    : "";

  container.innerHTML = podiumHtml + listHtml + overflowHtml;
  initReveal();

  const showAllBtn = container.querySelector<HTMLButtonElement>(".ratings__show-all");
  const overflowEl = container.querySelector<HTMLElement>(".rlist--overflow");
  showAllBtn?.addEventListener("click", () => {
    overflowEl?.removeAttribute("hidden");
    showAllBtn.remove();
    initReveal();
  });
}

function renderSkeleton(container: HTMLElement) {
  container.innerHTML = `<div class="skeleton">${Array.from({ length: 6 })
    .map(() => `<div class="skeleton__row"></div>`)
    .join("")}</div>`;
}

function renderError(container: HTMLElement) {
  container.innerHTML = `
    <div class="ratings__error">
      <p>Рейтинг зараз не завантажується.</p>
      <p class="ratings__error-sub">Спробуйте оновити сторінку за кілька хвилин.</p>
      <button type="button" class="btn-outline ratings__retry">Оновити</button>
    </div>`;
  container.querySelector(".ratings__retry")?.addEventListener("click", () => window.location.reload());
}

async function init() {
  const playersPanel = document.getElementById("ratings-players");
  const institutionsPanel = document.getElementById("ratings-institutions");
  const searchWrap = document.getElementById("ratings-search-wrap");
  const searchInput = document.getElementById("ratings-search") as HTMLInputElement | null;
  const tabs = document.querySelectorAll<HTMLButtonElement>(".ratings-tab");
  if (!playersPanel || !institutionsPanel) return;

  renderSkeleton(playersPanel);
  renderSkeleton(institutionsPanel);

  let players: PlayerRow[] = [];
  let institutions: InstitutionRow[] = [];

  try {
    const data = await loadSheet();
    players = parsePlayers(data);
    institutions = computeInstitutions(players);
  } catch {
    renderError(playersPanel);
    renderError(institutionsPanel);
    return;
  }

  const playerEntries = players.map((p) => ({ name: p.name, total: p.total, sub: `${p.ppoCount} ППО · ${fmt(p.rating)} рейтингу` }));
  renderBoard(
    playersPanel,
    playerEntries,
    "Сезон щойно почався. Перші результати з'являться після найближчого турніру."
  );

  if (institutions.length === 0) {
    institutionsPanel.innerHTML = `<p class="ratings__note">Дані про заклади ще не додані в таблицю. Рейтинг з'явиться, щойно організатор турніру вкаже заклад гравця.</p>`;
  } else {
    const institutionEntries = institutions.map((i) => ({ name: i.name, total: i.total, sub: `${i.participants} учасників` }));
    renderBoard(institutionsPanel, institutionEntries, "");

    if (institutions.length >= SEARCH_MIN_INSTITUTIONS && searchWrap && searchInput) {
      searchWrap.hidden = false;
      searchInput.addEventListener("input", () => {
        const q = searchInput.value.trim().toLowerCase();
        const filtered = institutionEntries.filter((e) => e.name.toLowerCase().includes(q));
        if (q && filtered.length === 0) {
          institutionsPanel.innerHTML = `
            <div class="ratings__note">
              <p><strong>Твоєї академії тут ще немає.</strong> Проведи турнір — і вона з'явиться в рейтингу.</p>
            </div>`;
        } else {
          renderBoard(institutionsPanel, filtered, "");
        }
      });
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.toggle("is-active", t === tab));
      const target = tab.dataset.tab;
      playersPanel.hidden = target !== "players";
      institutionsPanel.hidden = target !== "institutions";
      if (searchWrap) searchWrap.hidden = target !== "institutions" || institutions.length < SEARCH_MIN_INSTITUTIONS;
    });
  });
}

init();
