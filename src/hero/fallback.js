// 2D-фолбек першого екрана: без WebGL сайт працює повністю — постер замість
// сцени, двовимірні кубики, які так само кидаються скільки завгодно разів,
// і та сама плашка, що проявляється при прокрутці.
// Цей модуль НЕ імпортує three.js.
import { queryHud, setPhase, setLoadbar, rollDie } from "./hud.js";

// 3×3-сітка пунктів: які комірки видно для кожного значення
const PIP_CELLS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function buildDie() {
  const die = document.createElement("span");
  die.className = "die2d";
  for (let i = 0; i < 9; i++) {
    const pip = document.createElement("span");
    pip.className = "die2d__pip";
    die.appendChild(pip);
  }
  return die;
}

function setDieValue(die, value) {
  const cells = PIP_CELLS[value];
  [...die.children].forEach((pip, i) => {
    pip.style.visibility = cells.includes(i) ? "visible" : "hidden";
  });
}

export function initFallback(root, { reduced = false } = {}) {
  const hud = queryHud(root);
  root.classList.add("is-2d");
  setLoadbar(hud, 1);

  const dieEls = [buildDie(), buildDie()];
  dieEls.forEach((d, i) => {
    setDieValue(d, i ? 3 : 5);
    hud.dice2d?.appendChild(d);
  });

  let rolling = false;
  setPhase(hud, "scene");

  function startRoll() {
    if (rolling) return;
    rolling = true;
    setPhase(hud, "rolling");
    if (hud.rollBtn) hud.rollBtn.disabled = true;

    const results = [rollDie(), rollDie()];

    if (reduced) {
      dieEls.forEach((d, i) => setDieValue(d, results[i]));
      finish();
      return;
    }

    dieEls.forEach((d) => d.classList.add("is-rolling"));
    const shuffle = window.setInterval(() => {
      dieEls.forEach((d) => setDieValue(d, rollDie()));
    }, 140);

    window.setTimeout(() => {
      window.clearInterval(shuffle);
      dieEls.forEach((d, i) => {
        d.classList.remove("is-rolling");
        setDieValue(d, results[i]);
      });
      finish();
    }, 900);
  }

  function finish() {
    rolling = false;
    setPhase(hud, "scene");
    if (hud.rollBtn) hud.rollBtn.disabled = false;
  }

  hud.rollBtn?.addEventListener("click", startRoll);
}
