// Ігрова картка: прилітає з-за кадру після зупинки кубиків і лягає на поле
// (завдання «3D-вступ» §4).
import {
  BoxGeometry,
  CanvasTexture,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from "three";
import { easeSite, clamp01 } from "./easing.js";

const START = new Vector3(3.2, 2.8, 3.4);
const END = new Vector3(2.1, 0.1, 1.4);

// Якщо public/images/hero/card-face.webp не завантажилось — малюємо лице на
// canvas. Тексту справжньої картки тут немає свідомо: вміст колоди не
// публікується, у сцені лежить фірмовий бік із назвою гри.
function drawFaceFallback() {
  const c = document.createElement("canvas");
  c.width = 320;
  c.height = 480;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#0C161F";
  ctx.fillRect(0, 0, 320, 480);
  ctx.fillStyle = "#E8871E";
  ctx.fillRect(0, 0, 320, 8);
  ctx.strokeStyle = "rgba(185,146,74,.6)";
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 20, 296, 448);
  ctx.textAlign = "center";
  ctx.fillStyle = "#E8871E";
  ctx.font = "500 13px 'JetBrains Mono', monospace";
  ctx.fillText("П О Д І Ї", 160, 70);
  ctx.fillStyle = "#F4F4F0";
  ctx.font = "900 30px Unbounded, system-ui, sans-serif";
  ctx.fillText("UNIONIZE", 160, 250);
  ctx.fillStyle = "rgba(228,210,166,.6)";
  ctx.fillRect(130, 274, 60, 2);
  ctx.fillStyle = "#8FA0AE";
  ctx.font = "400 12px 'JetBrains Mono', monospace";
  ctx.fillText("ПРМТУ", 160, 420);
  return new CanvasTexture(c);
}

function drawBack() {
  const c = document.createElement("canvas");
  c.width = 320;
  c.height = 480;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#04090E";
  ctx.fillRect(0, 0, 320, 480);
  ctx.strokeStyle = "rgba(185,146,74,.8)";
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, 292, 452);
  ctx.strokeStyle = "rgba(228,210,166,.25)";
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 24, 272, 432);
  return new CanvasTexture(c);
}

export function createCard(scene, fx, castShadow) {
  const side = new MeshStandardMaterial({ color: 0x0c161f, roughness: 0.7 });
  const faceMat = new MeshStandardMaterial({ roughness: 0.6 });
  const backTex = drawBack();
  backTex.colorSpace = SRGBColorSpace;
  const backMat = new MeshStandardMaterial({ map: backTex, roughness: 0.7 });

  new TextureLoader().load(
    "/images/hero/card-face.webp",
    (tex) => {
      tex.colorSpace = SRGBColorSpace;
      faceMat.map = tex;
      faceMat.needsUpdate = true;
    },
    undefined,
    () => {
      const tex = drawFaceFallback();
      tex.colorSpace = SRGBColorSpace;
      faceMat.map = tex;
      faceMat.needsUpdate = true;
    }
  );

  // BoxGeometry(1.6,.012,2.4): [+x, -x, +y (лице), -y (рубашка), +z, -z]
  const mesh = new Mesh(new BoxGeometry(1.6, 0.012, 2.4), [side, side, faceMat, backMat, side, side]);
  mesh.castShadow = castShadow;
  const edges = new LineSegments(
    new EdgesGeometry(mesh.geometry),
    new LineBasicMaterial({ color: 0xb9924a, transparent: true, opacity: 0.4 })
  );
  mesh.add(edges);
  mesh.visible = false;
  scene.add(mesh);

  let anim = null; // { start } | null
  let bounceStart = -1;

  function flyIn(now, onLanded) {
    mesh.visible = true;
    anim = { start: now, onLanded };
  }

  function setLanded() {
    mesh.visible = true;
    mesh.position.copy(END);
    mesh.rotation.set(0, -0.16, 0);
    anim = null;
  }

  function update(now) {
    if (bounceStart >= 0) {
      const t = clamp01((now - bounceStart) / 40);
      mesh.position.y = END.y + 0.02 * Math.sin(t * Math.PI);
      if (t >= 1) bounceStart = -1;
      return;
    }
    if (!anim) return;
    const t = clamp01((now - anim.start) / 900);
    const e = easeSite(t);
    // дуга: xz — лінійно за кривою, y — параболічна арка поверх
    mesh.position.lerpVectors(START, END, e);
    mesh.position.y += Math.sin(e * Math.PI) * 1.1;
    // один оберт по осі X: рубашкою догори (π) → лицем догори (0), із
    // повним додатковим обертом для читабельного перевороту в польоті
    mesh.rotation.x = (1 - e) * Math.PI * 3;
    mesh.rotation.y = -0.16 * e;
    if (t >= 1) {
      const done = anim.onLanded;
      anim = null;
      mesh.rotation.x = 0;
      mesh.position.copy(END);
      fx.spawnWave(END, { color: 0xe4d2a6, duration: 500, scale: 10 });
      bounceStart = now;
      if (done) done();
    }
  }

  return { mesh, flyIn, setLanded, update };
}
