// Жива сцена першого екрана: стіл із полем, кубики, які гравець кидає
// скільки завгодно разів, і камера, що зводиться до столу в міру прокрутки —
// тоді поверх сцени проявляється плашка з назвою.
//
// Фази: loading → scene ⇄ rolling. Перехід «сцена → плашка» більше не фаза,
// а прогрес прокрутки (hud.bindScrollProgress).
//
// Рендер зупиняється, коли вкладка неактивна, сцена поза екраном або
// пристрій у режимі економії (вимога §1 п.4).
import { Vector3 } from "three";
import { createScene } from "./scene.js";
import { createDice, REST_Y } from "./dice.js";
import { createCard } from "./card.js";
import { queryHud, setPhase, setLoadbar, rollDie, clamp01 } from "./hud.js";
import { easeSite } from "./easing.js";

const LOOK_CENTER = new Vector3(0, 0, 0);
const ORBIT_R = 8.6;
const ROLL_POS = new Vector3(0, 4.7, 6.2);
const TABLE_LOOK = new Vector3(0, REST_Y, 1.2);
const IN_POS = new Vector3(0, 2.5, 4.7);
const IN_LOOK = new Vector3(0, 0.55, -0.4);

export function initIntro(root) {
  const hud = queryHud(root);
  const mobile =
    window.innerWidth <= 860 ||
    (navigator.hardwareConcurrency || 8) <= 4 ||
    (navigator.deviceMemory || 8) <= 4;

  const three = createScene(hud.canvas, { mobile });
  const { renderer, camera } = three;
  const dice = createDice(three.scene, three, !mobile);
  const card = createCard(three.scene, three, !mobile);
  setLoadbar(hud, 0.6);

  // --- стан ---------------------------------------------------------------
  let phase = "loading";
  let orbitAngle = 0.12;
  let bobT = 0;
  let camTween = null;
  let followDice = false;
  let rolledOnce = false;
  let scrollP = 0;
  let lowPower = false;
  let frameSkip = false;
  const pointer = { tx: 0, ty: 0, x: 0, y: 0 };
  const tableLook = TABLE_LOOK.clone();
  const basePos = new Vector3();
  const baseLook = new Vector3();

  // --- рендер-цикл із зупинками -------------------------------------------
  let rafId = 0;
  let running = false;
  let lastT = 0;
  let offscreen = false;

  function frame(now) {
    rafId = 0;
    if (!running) return;
    if (lowPower && (frameSkip = !frameSkip)) {
      rafId = requestAnimationFrame(frame);
      return;
    }
    const dt = Math.min(0.05, (now - lastT) / 1000) || 0.016;
    lastT = now;
    update(dt, now);
    renderer.render(three.scene, camera);
    rafId = requestAnimationFrame(frame);
  }

  function startRender() {
    if (running || offscreen || document.hidden) return;
    running = true;
    lastT = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function stopRender() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopRender();
    else startRender();
  });

  new IntersectionObserver(([entry]) => {
    offscreen = !entry.isIntersecting;
    if (offscreen) stopRender();
    else startRender();
  }).observe(root);

  // режим економії: майже порожня батарея — рендеримо кожен другий кадр
  if (navigator.getBattery) {
    navigator
      .getBattery()
      .then((b) => {
        const apply = () => {
          lowPower = !b.charging && b.level <= 0.15;
        };
        apply();
        b.addEventListener("levelchange", apply);
        b.addEventListener("chargingchange", apply);
      })
      .catch(() => {});
  }

  // --- камера -------------------------------------------------------------
  function tweenCamera(toPos, toLook, dur) {
    camTween = {
      fromP: basePos.clone(),
      toP: toPos.clone(),
      fromL: baseLook.clone(),
      toL: toLook.clone(),
      start: performance.now(),
      dur,
    };
  }

  function updateCamera(dt, now) {
    bobT += dt;

    if (camTween) {
      const e = easeSite(clamp01((now - camTween.start) / camTween.dur));
      basePos.lerpVectors(camTween.fromP, camTween.toP, e);
      baseLook.lerpVectors(camTween.fromL, camTween.toL, e);
      if (e >= 1) camTween = null;
    } else if (phase === "rolling" || rolledOnce) {
      // після першого кидка камера лишається біля столу
      basePos.copy(ROLL_POS);
      if (followDice) {
        const m = dice.midpoint();
        m.y = Math.min(m.y, 1.4);
        tableLook.lerp(m, Math.min(1, dt * 6));
      }
      baseLook.copy(tableLook);
    } else if (mobile) {
      basePos.set(0, 6.4 + Math.sin(bobT * 0.5) * 0.15, ORBIT_R);
      baseLook.copy(LOOK_CENTER);
    } else {
      orbitAngle += 0.07 * dt;
      basePos.set(
        Math.sin(orbitAngle) * ORBIT_R,
        6.4 + Math.sin(bobT * 0.7) * 0.15,
        Math.cos(orbitAngle) * ORBIT_R
      );
      baseLook.copy(LOOK_CENTER);
    }

    // прокрутка зводить камеру до столу — рівно тоді, коли наростає плашка
    const e = easeSite(scrollP);
    if (e > 0.0005) {
      basePos.lerp(IN_POS, e);
      baseLook.lerp(IN_LOOK, e);
    }

    // дихання за курсором — тільки коли плашка вже на екрані
    if (!mobile && e > 0.0005) {
      pointer.x += (pointer.tx - pointer.x) * 0.055;
      pointer.y += (pointer.ty - pointer.y) * 0.055;
      basePos.x += pointer.x * e;
      basePos.y += pointer.y * e;
    }

    camera.position.copy(basePos);
    camera.lookAt(baseLook);
  }

  function update(dt, now) {
    three.updateAmbient(dt);
    three.updateFx(now);
    dice.update(dt, now);
    card.update(now);
    updateCamera(dt, now);
  }

  // --- розміри ------------------------------------------------------------
  // Розмір беремо з закріпленої сцени (100svh), а не з секції (200svh)
  function resize() {
    const box = hud.stage || root;
    const r = box.getBoundingClientRect();
    three.setSize(Math.max(1, r.width), Math.max(1, r.height));
  }
  window.addEventListener("resize", resize);
  resize();

  // --- кидок --------------------------------------------------------------
  function startRoll() {
    if (phase !== "scene") return;
    phase = "rolling";
    setPhase(hud, "rolling");
    if (hud.rollBtn) hud.rollBtn.disabled = true;

    // щоразу нові числа
    const results = [rollDie(), rollDie()];
    followDice = true;
    if (!rolledOnce) {
      tableLook.copy(TABLE_LOOK);
      tweenCamera(ROLL_POS, TABLE_LOOK, 600);
    }
    dice.roll(results, onLanded);
  }

  function onLanded() {
    if (phase !== "rolling") return;
    phase = "scene";
    setPhase(hud, "scene");
    followDice = false;
    if (hud.rollBtn) hud.rollBtn.disabled = false;

    // картка прилітає один раз — після першого кидка — і лишається на полі
    if (!rolledOnce) {
      rolledOnce = true;
      window.setTimeout(() => card.flyIn(performance.now()), 350);
    }
  }

  hud.rollBtn?.addEventListener("click", startRoll);

  if (!mobile) {
    window.addEventListener("pointermove", (e) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2 * 1.1;
      pointer.ty = -(e.clientY / window.innerHeight - 0.5) * 2 * 0.55;
    });
  }

  // --- старт --------------------------------------------------------------
  startRender();
  three.textureReady.then(() => {
    setLoadbar(hud, 1);
    hud.poster?.classList.add("is-gone");
    hud.canvas.classList.add("is-live");
    if (phase !== "loading") return;
    phase = "scene";
    setPhase(hud, "scene");
  });

  return {
    onScroll(p) {
      scrollP = p;
    },
  };
}
