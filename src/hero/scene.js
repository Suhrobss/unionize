// Сцена першого екрана: рендерер, камера, світло, стіл із полем,
// штурманська роза, пил, ефекти ударних хвиль (завдання «3D-вступ» §2).
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  FogExp2,
  Group,
  LineBasicMaterial,
  LineDashedMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  RingGeometry,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from "three";
import { easeOutCubic, clamp01 } from "./easing.js";
import { u } from "../config/paths.js";

export const BOARD_TOP_Y = 0.09; // BoxGeometry(10,.18,10) із центром в origin

const CHAMP = 0xe4d2a6;
const LYMAN = 0x22b8c6;

function makeCircle(radius, segments, material) {
  const pts = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts[i * 3] = Math.cos(a) * radius;
    pts[i * 3 + 1] = 0;
    pts[i * 3 + 2] = Math.sin(a) * radius;
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pts, 3));
  const line = new LineLoop(geo, material);
  if (material.isLineDashedMaterial) line.computeLineDistances();
  return line;
}

function makeTicks(count, rInner, material) {
  const pos = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const long = i % 6 === 0;
    const r1 = rInner;
    const r2 = rInner + (long ? 0.34 : 0.16);
    pos.push(Math.cos(a) * r1, 0, Math.sin(a) * r1, Math.cos(a) * r2, 0, Math.sin(a) * r2);
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  return new LineSegments(geo, material);
}

export function createScene(canvas, profile) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.mobile ? 1.25 : 1.75));
  if (!profile.mobile) {
    renderer.shadowMap.enabled = true;
    // ТЗ просило PCFSoftShadowMap, але three 0.185 його оголосив застарілим
    // і сам підмінює на PCFShadowMap із попередженням у консоль щокадру
    renderer.shadowMap.type = PCFShadowMap;
  }

  const scene = new Scene();
  scene.background = new Color(0x060c12);
  scene.fog = new FogExp2(0x060c12, 0.05);

  const camera = new PerspectiveCamera(42, 1, 0.1, 80);
  camera.position.set(0, 6.4, 8.6);
  camera.lookAt(0, 0, 0);

  // Підлога
  const floor = new Mesh(
    new PlaneGeometry(80, 80),
    new MeshStandardMaterial({ color: 0x04090e, roughness: 0.95 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.09;
  floor.receiveShadow = !profile.mobile;
  scene.add(floor);

  // Поле
  const boardMats = [
    new MeshStandardMaterial({ color: 0x0c161f, roughness: 0.85 }), // +x
    new MeshStandardMaterial({ color: 0x0c161f, roughness: 0.85 }), // -x
    new MeshStandardMaterial({ color: 0x0c161f, roughness: 0.72 }), // +y (верх, отримає текстуру)
    new MeshStandardMaterial({ color: 0x04090e, roughness: 0.95 }), // -y
    new MeshStandardMaterial({ color: 0x0c161f, roughness: 0.85 }), // +z
    new MeshStandardMaterial({ color: 0x0c161f, roughness: 0.85 }), // -z
  ];
  const board = new Mesh(new BoxGeometry(10, 0.18, 10), boardMats);
  board.receiveShadow = !profile.mobile;
  board.castShadow = !profile.mobile;
  scene.add(board);

  const boardEdges = new LineSegments(
    new EdgesGeometry(board.geometry),
    new LineBasicMaterial({ color: CHAMP, transparent: true, opacity: 0.28 })
  );
  board.add(boardEdges);

  const textureReady = new Promise((resolve) => {
    // board-tex.jpg — оптимізована 1280px-версія board.jpg (оригінал 11,5 МБ
    // непридатний як текстура: одне завантаження з'їдає весь бюджет швидкості)
    new TextureLoader().load(
      u("/images/board/board-tex.jpg"),
      (tex) => {
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        boardMats[2].map = tex;
        boardMats[2].color.set(0xffffff);
        boardMats[2].needsUpdate = true;
        resolve(true);
      },
      undefined,
      () => resolve(false) // поле лишається суцільним 0x0C161F з рамкою — сцена не ламається
    );
  });

  // Штурманська роза
  const rose = new Group();
  rose.position.y = -0.085;
  rose.add(
    makeCircle(6.9, 128, new LineBasicMaterial({ color: CHAMP, transparent: true, opacity: 0.22 }))
  );
  const dashed = makeCircle(
    6.55,
    128,
    new LineDashedMaterial({ color: LYMAN, transparent: true, opacity: 0.15, dashSize: 0.28, gapSize: 0.2 })
  );
  rose.add(dashed);
  if (!profile.mobile) {
    rose.add(
      makeCircle(6.2, 128, new LineBasicMaterial({ color: CHAMP, transparent: true, opacity: 0.1 }))
    );
  }
  rose.add(
    makeTicks(
      profile.mobile ? 36 : 72,
      6.95,
      new LineBasicMaterial({ color: CHAMP, transparent: true, opacity: 0.2 })
    )
  );
  scene.add(rose);

  // Пил
  const dustCount = profile.mobile ? 90 : 240;
  const dustPos = new Float32Array(dustCount * 3);
  const dustVel = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 18;
    dustPos[i * 3 + 1] = Math.random() * 5 + 0.2;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 18;
    dustVel[i * 3] = (Math.random() - 0.5) * 0.05;
    dustVel[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
    dustVel[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute("position", new BufferAttribute(dustPos, 3));
  const dust = new Points(
    dustGeo,
    new PointsMaterial({
      color: 0x8fb6c9,
      size: 0.045,
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending,
      depthWrite: false,
    })
  );
  scene.add(dust);

  // Світло
  scene.add(new AmbientLight(0x24384a, 0.9));
  const key = new DirectionalLight(0xf2e4c0, 1.15);
  key.position.set(4, 8, 3);
  if (!profile.mobile) {
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
  }
  scene.add(key);
  const rim = new DirectionalLight(0x22b8c6, 0.55);
  rim.position.set(-6, 3, -6);
  scene.add(rim);
  const pulse = new PointLight(0xe4d2a6, 0.4, 10);
  pulse.position.set(0, 2.2, 0);
  scene.add(pulse);

  // Ударні хвилі — пул кілець, які розширюються й гаснуть
  const waves = [];
  function spawnWave(pos, { color = CHAMP, duration = 900, scale = 26 } = {}) {
    const ring = new Mesh(
      new RingGeometry(0.09, 0.115, 48),
      new MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, BOARD_TOP_Y + 0.012, pos.z);
    scene.add(ring);
    waves.push({ ring, born: performance.now(), duration, scale });
  }

  let flashStart = -1;
  function flashLight() {
    flashStart = performance.now();
  }

  function updateFx(now) {
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      const t = clamp01((now - w.born) / w.duration);
      const e = easeOutCubic(t);
      const s = 1 + e * w.scale;
      w.ring.scale.set(s, s, 1);
      w.ring.material.opacity = 0.85 * (1 - e);
      if (t >= 1) {
        scene.remove(w.ring);
        w.ring.geometry.dispose();
        w.ring.material.dispose();
        waves.splice(i, 1);
      }
    }
    if (flashStart >= 0) {
      const t = (now - flashStart) / 220;
      if (t >= 1) {
        pulse.intensity = 0.4;
        flashStart = -1;
      } else {
        // .4 → .75 → .4
        pulse.intensity = 0.4 + 0.35 * Math.sin(clamp01(t) * Math.PI);
      }
    }
  }

  function updateAmbient(dt) {
    rose.rotation.y += 0.03 * dt;
    const p = dustGeo.attributes.position.array;
    for (let i = 0; i < dustCount; i++) {
      p[i * 3] += dustVel[i * 3] * dt;
      p[i * 3 + 1] += dustVel[i * 3 + 1] * dt;
      p[i * 3 + 2] += dustVel[i * 3 + 2] * dt;
      if (Math.abs(p[i * 3]) > 9) p[i * 3] *= -0.98;
      if (p[i * 3 + 1] < 0.1 || p[i * 3 + 1] > 5.4) dustVel[i * 3 + 1] *= -1;
      if (Math.abs(p[i * 3 + 2]) > 9) p[i * 3 + 2] *= -0.98;
    }
    dustGeo.attributes.position.needsUpdate = true;
  }

  function setSize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  return {
    renderer,
    scene,
    camera,
    textureReady,
    spawnWave,
    flashLight,
    updateFx,
    updateAmbient,
    setSize,
    lookTarget: new Vector3(0, 0, 0),
  };
}
