import cellsData from "../../data/board-cells.json";
import { CELL_TYPES } from "../config/cellTypes.js";
import { initModal } from "./modal.js";

interface Cell {
  id: string;
  name: string;
  type: string;
  side: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cost?: number;
  fee?: number;
  draft?: boolean;
  story?: string;
  link?: string;
}

const cells = (cellsData as { cells: Cell[] }).cells;

function escapeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(n: number): string {
  return n.toLocaleString("uk-UA");
}

function cellPanelHtml(cell: Cell): string {
  const meta = CELL_TYPES[cell.type as keyof typeof CELL_TYPES];
  const color = meta?.color ?? "var(--dim)";
  const rotateClass = cell.type === "Криза" ? " cell-panel__badge--crisis" : "";

  const counters =
    cell.type === "ППО" && cell.cost != null && cell.fee != null
      ? `<div class="cell-panel__counters">
          <div>
            <p class="label cell-panel__counter-label">Вартість</p>
            <span class="reel-mount" data-value="${cell.cost}" data-variant="uc"></span>
          </div>
          <div>
            <p class="label cell-panel__counter-label">Внесок</p>
            <span class="reel-mount" data-value="${cell.fee}" data-variant="uc"></span>
          </div>
        </div>`
      : "";

  const bodyText = cell.story
    ? `<p class="cell-panel__story">${escapeHtml(cell.story)}</p>`
    : `<p class="cell-panel__rule">${escapeHtml(meta?.rule ?? "")}</p>
       ${cell.type === "ППО" ? `<p class="label cell-panel__note">Історію цього закладу ще пишемо</p>` : ""}`;

  const link = cell.link
    ? `<a class="cell-panel__link" href="${escapeHtml(cell.link)}" target="_blank" rel="noopener">→ Сайт закладу</a>`
    : "";

  return `
    <span class="label cell-panel__badge${rotateClass}" style="background: color-mix(in srgb, ${color} 18%, transparent); color: ${color}">${escapeHtml(cell.type)}</span>
    <h2 class="cell-panel__name">${escapeHtml(cell.name)}</h2>
    ${counters}
    ${bodyText}
    ${link}
  `;
}

function revealReels(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>(".reel-mount").forEach((mount) => {
    const value = Number(mount.dataset.value) || 0;
    const variant = mount.dataset.variant || "neutral";
    const digits = String(Math.max(0, Math.trunc(value))).split("");
    const total = digits.length;
    const digitEls = digits
      .map((d, i) => {
        const gap = i > 0 && (total - i) % 3 === 0 ? '<span class="reel__gap"></span>' : "";
        const nums = Array.from({ length: 10 }, (_, n) => `<span class="reel__num">${n}</span>`).join("");
        return `${gap}<span class="reel__digit" data-digit="${d}"><span class="reel__strip">${nums}</span></span>`;
      })
      .join("");
    mount.innerHTML = `<span class="reel reel--${variant}">${digitEls}</span>`;
    requestAnimationFrame(() => {
      mount.querySelectorAll<HTMLElement>(".reel__digit").forEach((el) => {
        const strip = el.querySelector<HTMLElement>(".reel__strip");
        const d = Number(el.dataset.digit);
        if (strip) strip.style.transform = `translateY(-${d * 1.2}em)`;
      });
    });
  });
}

function renderHotspots(container: HTMLElement, onSelect: (cell: Cell, el: HTMLElement) => void) {
  container.innerHTML = "";
  cells.forEach((cell) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hotspot";
    btn.dataset.cellId = cell.id;
    btn.dataset.type = cell.type;
    btn.style.left = `${cell.x}%`;
    btn.style.top = `${cell.y}%`;
    btn.style.width = `${cell.w}%`;
    btn.style.height = `${cell.h}%`;
    btn.setAttribute("aria-label", `${cell.type}: ${cell.name}`);
    btn.addEventListener("click", () => onSelect(cell, btn));
    btn.addEventListener("mouseenter", () => document.querySelectorAll(`[data-cell-id="${cell.id}"]`).forEach((el) => el.classList.add("is-hover")));
    btn.addEventListener("mouseleave", () => document.querySelectorAll(`[data-cell-id="${cell.id}"]`).forEach((el) => el.classList.remove("is-hover")));
    container.appendChild(btn);
  });
}

function renderList(container: HTMLElement, onSelect: (cell: Cell, el: HTMLElement) => void) {
  container.innerHTML = cells
    .map((cell) => {
      const meta = CELL_TYPES[cell.type as keyof typeof CELL_TYPES];
      const color = meta?.color ?? "var(--dim)";
      const sub =
        cell.type === "ППО" && cell.cost != null
          ? `${cell.type} · ${fmt(cell.cost)} UC · внесок ${fmt(cell.fee ?? 0)}`
          : cell.type;
      return `
        <button type="button" class="board-row" data-cell-id="${cell.id}" data-type="${cell.type}" style="--row-color: ${color}">
          <span class="board-row__name">${escapeHtml(cell.name)}</span>
          <span class="label board-row__sub">${escapeHtml(sub)}</span>
        </button>`;
    })
    .join("");

  container.querySelectorAll<HTMLButtonElement>(".board-row").forEach((row) => {
    const cell = cells.find((c) => c.id === row.dataset.cellId);
    if (!cell) return;
    row.addEventListener("click", () => onSelect(cell, row));
    row.addEventListener("mouseenter", () => document.querySelectorAll(`[data-cell-id="${cell.id}"]`).forEach((el) => el.classList.add("is-hover")));
    row.addEventListener("mouseleave", () => document.querySelectorAll(`[data-cell-id="${cell.id}"]`).forEach((el) => el.classList.remove("is-hover")));
  });
}

function setupFilter(root: HTMLElement, apply: (type: string) => void) {
  root.querySelectorAll<HTMLButtonElement>(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      root.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-active", c === chip));
      apply(chip.dataset.typeFilter ?? "all");
    });
  });
}

function applyFilter(type: string) {
  document.querySelectorAll<HTMLElement>("[data-cell-id]").forEach((el) => {
    const matches = type === "all" || el.dataset.type === type;
    el.classList.toggle("is-filtered-out", !matches);
  });
}

function setupPinchZoom(viewport: HTMLElement, stage: HTMLElement) {
  let scale = 1;
  let originX = 0;
  let originY = 0;
  const pointers = new Map<number, { x: number; y: number }>();
  let lastDist = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function apply() {
    stage.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
  }

  function clampScale(s: number) {
    return Math.min(4, Math.max(1, s));
  }

  viewport.addEventListener("pointerdown", (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragging = scale > 1;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });

  viewport.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastDist) {
        scale = clampScale(scale * (dist / lastDist));
        apply();
      }
      lastDist = dist;
    } else if (pointers.size === 1 && dragging) {
      originX += e.clientX - lastX;
      originY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      apply();
    }
  });

  function endPointer(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) lastDist = 0;
    if (pointers.size === 0) dragging = false;
    if (scale <= 1) {
      scale = 1;
      originX = 0;
      originY = 0;
      apply();
    }
  }

  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);

  let lastTap = 0;
  viewport.addEventListener("pointerup", () => {
    const now = Date.now();
    if (now - lastTap < 300 && pointers.size === 0) {
      scale = scale > 1 ? 1 : 2.4;
      if (scale === 1) {
        originX = 0;
        originY = 0;
      }
      apply();
    }
    lastTap = now;
  });

  return () => {
    scale = 1;
    originX = 0;
    originY = 0;
    apply();
  };
}

function init() {
  const modalApi = initModal("cell-modal");
  if (!modalApi) return;
  const { open: openModal } = modalApi;

  function openCell(cell: Cell, triggerEl: HTMLElement) {
    openModal(cellPanelHtml(cell), triggerEl);
    const body = document.getElementById("cell-modal-body");
    if (body) revealReels(body);
  }

  const desktopHotspots = document.getElementById("board-hotspots");
  const fullscreenHotspots = document.getElementById("board-fullscreen-hotspots");
  const listEl = document.getElementById("board-list");
  const filterEl = document.getElementById("board-filter");

  if (desktopHotspots) renderHotspots(desktopHotspots, openCell);
  if (fullscreenHotspots) renderHotspots(fullscreenHotspots, openCell);
  if (listEl) renderList(listEl, openCell);
  if (filterEl) setupFilter(filterEl, applyFilter);

  const toggleBtn = document.getElementById("board-view-toggle");
  const fullscreen = document.getElementById("board-fullscreen");
  const fullscreenClose = document.getElementById("board-fullscreen-close");
  const viewport = document.getElementById("board-fullscreen-viewport");
  const stage = document.getElementById("board-fullscreen-stage");

  let resetZoom: (() => void) | null = null;
  if (viewport && stage) resetZoom = setupPinchZoom(viewport, stage);

  toggleBtn?.addEventListener("click", () => {
    if (fullscreen) {
      fullscreen.hidden = false;
      document.body.style.overflow = "hidden";
    }
  });
  fullscreenClose?.addEventListener("click", () => {
    if (fullscreen) fullscreen.hidden = true;
    document.body.style.overflow = "";
    resetZoom?.();
  });
}

init();
