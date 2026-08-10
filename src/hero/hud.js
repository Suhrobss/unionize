// Спільний шар керування першим екраном: пошук елементів, фази, прогрес
// прокрутки. Використовується і 3D-сценою (intro.js), і 2D-фолбеком
// (fallback.js) — тому тут НЕМАЄ three.js.

export function queryHud(root) {
  const q = (sel) => root.querySelector(sel);
  return {
    root,
    stage: q("[data-hero-stage]"),
    poster: q("[data-hero-poster]"),
    canvas: q("[data-hero-canvas]"),
    loadbar: q("[data-hero-loadbar]"),
    sceneUi: q("[data-hero-scene-ui]"),
    panel: q("[data-hero-panel]"),
    rollBtn: q("[data-hero-roll]"),
    scrollBtn: q("[data-hero-scroll-down]"),
    dice2d: q("[data-hero-dice2d]"),
  };
}

export function setPhase(hud, phase) {
  hud.root.dataset.phase = phase;
}

export function setLoadbar(hud, fraction) {
  if (!hud.loadbar) return;
  if (fraction >= 1) {
    hud.loadbar.style.width = "100%";
    hud.loadbar.style.opacity = "0";
  } else {
    hud.loadbar.style.width = `${Math.round(fraction * 100)}%`;
  }
}

export const clamp01 = (t) => Math.max(0, Math.min(1, t));

export const rollDie = () => 1 + Math.floor(Math.random() * 6);

// Прогрес прокрутки крізь закріплений перший екран: 0 — сцена з кубиками,
// 1 — плашка з назвою поверх сцени. Керує CSS-змінними (--hero-scene,
// --hero-panel) і повідомляє сцену, щоб та звела камеру до столу.
export function bindScrollProgress(hud, onProgress) {
  const root = hud.root;
  let raf = 0;

  function measure() {
    raf = 0;
    const total = root.offsetHeight - window.innerHeight;
    const scrolled = -root.getBoundingClientRect().top;
    const p = total > 0 ? clamp01(scrolled / total) : clamp01(scrolled);

    // сцена поступається в першій половині, плашка перебирає на себе з
    // невеликим перекриттям — щоб між ними не було порожньої паузи
    const scene = 1 - clamp01(p / 0.42);
    const panel = clamp01((p - 0.28) / 0.46);

    root.style.setProperty("--hero-scene", scene.toFixed(3));
    root.style.setProperty("--hero-panel", panel.toFixed(3));

    // виїзд літер вордмарку — одноразовий: клас не знімається при прокрутці вгору
    if (panel > 0.02) root.classList.add("is-panel");

    // невидиме не ловить кліки; фокус лишається доступним — плашка сама
    // проявиться через :focus-within, а h1 не зникає з дерева доступності
    root.classList.toggle("scene-live", scene > 0.05);
    root.classList.toggle("panel-live", panel > 0.05);

    if (onProgress) onProgress(p);
  }

  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(measure);
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);

  // Клавіатура: якщо фокус потрапив у блок, який зараз не на екрані,
  // доводимо сторінку до «його» екрана — щоб фокус ніколи не стояв
  // на невидимому. Для миші не спрацьовує: там фокус іде за кліком,
  // тобто по видимому.
  const bringIntoView = (el, target) => {
    el?.addEventListener("focusin", () => {
      if (!el.matches(":has(:focus-visible)")) return;
      const top = root.getBoundingClientRect().top + window.scrollY;
      const span = Math.max(0, root.offsetHeight - window.innerHeight);
      window.scrollTo({ top: top + span * target, behavior: "smooth" });
    });
  };
  bringIntoView(hud.sceneUi, 0);
  bringIntoView(hud.panel, 1);

  measure();
  return measure;
}

// Кнопка-стрілка: доводить до кінця закріпленого екрана, де плашка вже повна
export function bindScrollDown(hud) {
  hud.scrollBtn?.addEventListener("click", () => {
    const root = hud.root;
    const top = root.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: top + Math.max(0, root.offsetHeight - window.innerHeight),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  });
}
