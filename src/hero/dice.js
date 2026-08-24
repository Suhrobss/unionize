// Кубики: заокруглений корпус, крапки-геометрія, спрощена власна балістика,
// гарантоване досідання в оголошену грань (завдання «3D-вступ» §3).
import {
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BOARD_TOP_Y, contactShadowTexture } from "./scene.js";
import { easeOutCubic, clamp01 } from "./easing.js";

const SIZE = 0.58;
const HALF = SIZE / 2;
const CORNER = 0.072;   // фаска: досить, щоб не було прямого кута, і не «мило»
const PIP_R = 0.046;
const PIP_STEP = 0.145; // крок сітки крапок від центра грані

export const REST_Y = BOARD_TOP_Y + HALF;

// Протилежні пари: 3+4, 1+6, 2+5 — усі дають 7, як на справжніх кубиках.
const FACE_NORMALS = {
  3: new Vector3(1, 0, 0),
  4: new Vector3(-1, 0, 0),
  1: new Vector3(0, 1, 0),
  6: new Vector3(0, -1, 0),
  2: new Vector3(0, 0, 1),
  5: new Vector3(0, 0, -1),
};

// Для кожної грані — нормаль і дві осі в її площині. Задає, куди лягає
// сітка крапок; напрямки підібрані так, щоб сусідні грані не дзеркалились.
const FACE_BASIS = {
  1: { u: [1, 0, 0], v: [0, 0, 1] },
  6: { u: [1, 0, 0], v: [0, 0, -1] },
  3: { u: [0, 0, -1], v: [0, 1, 0] },
  4: { u: [0, 0, 1], v: [0, 1, 0] },
  2: { u: [1, 0, 0], v: [0, 1, 0] },
  5: { u: [-1, 0, 0], v: [0, 1, 0] },
};

// Сітка крапок у кроках PIP_STEP від центра грані.
const PIP_GRID = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
};

// Крапки — не намальовані кружечки на текстурі, а окремі тіла, втоплені
// в грань так, що назовні лишається пласка шапочка. Саме вона ловить
// світло й дає кубику вигляд предмета, а не куба з наклейкою.
function pipGeometries() {
  const dark = [];
  const brass = [];
  const proto = new SphereGeometry(PIP_R, 14, 10);

  for (const value of [1, 2, 3, 4, 5, 6]) {
    const n = FACE_NORMALS[value];
    const { u, v } = FACE_BASIS[value];
    for (const [gu, gv] of PIP_GRID[value]) {
      const g = proto.clone();
      // 0.7 радіуса всередині корпусу: назовні лишається пласка лінза.
      // Глибший виступ читається як приклеєна намистина, мілкіший —
      // як пляма фарби.
      const d = HALF - PIP_R * 0.7;
      g.translate(
        n.x * d + u[0] * gu * PIP_STEP + v[0] * gv * PIP_STEP,
        n.y * d + u[1] * gu * PIP_STEP + v[1] * gv * PIP_STEP,
        n.z * d + u[2] * gu * PIP_STEP + v[2] * gv * PIP_STEP
      );
      // Одиниця — латунна. Той самий прийом, що й червона одиниця на
      // класичних кубиках: одна грань відрізняється, і кидок читається.
      (value === 1 ? brass : dark).push(g);
    }
  }
  proto.dispose();
  return { dark: mergeGeometries(dark), brass: mergeGeometries(brass) };
}

const UP = new Vector3(0, 1, 0);

// Кватерніон, за якого грань value дивиться строго вгору (+ випадковий
// поворот навколо вертикалі, щоб кубики не лягали однаково).
function targetQuaternion(value, yaw) {
  const q = new Quaternion().setFromUnitVectors(FACE_NORMALS[value], UP);
  const qYaw = new Quaternion().setFromAxisAngle(UP, yaw);
  return qYaw.multiply(q);
}

export function createDice(scene, fx, castShadow) {
  const homes = [new Vector3(-0.85, REST_Y, 0.5), new Vector3(0.55, REST_Y, 1.0)];
  // Геометрії спільні для обох кубиків — рахуються один раз.
  const bodyGeo = new RoundedBoxGeometry(SIZE, SIZE, SIZE, 4, CORNER);
  const pips = pipGeometries();
  // Кістяна смола з тонким лаком: clearcoat дає вузький відблиск поверх
  // матової основи. Без нього кубик виглядає пластиковою заготовкою.
  // Полірована кістяна смола. Головне тут — clearcoatRoughness: широкий
  // м'який відблиск читався як сірий наліт, вузький читається як лак.
  const bodyMat = new MeshPhysicalMaterial({
    color: 0xF6F0E2,
    roughness: 0.3,
    metalness: 0,
    clearcoat: 0.95,
    clearcoatRoughness: 0.07,
    envMapIntensity: 0.9,
  });
  // Крапки теж глянцеві: матова чорна пляма виглядає намальованою,
  // глянцева ловить ту саму лампу, що й корпус, і стає заливкою в лунці.
  // Лак на крапках тримаємо стриманим: на повній силі відбиття лампи
  // забивало чорну заливку, і крапки сіріли до ледь помітних плям.
  const pipMat = new MeshPhysicalMaterial({
    color: 0x0A1017,
    roughness: 0.26,
    metalness: 0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.1,
    envMapIntensity: 0.45,
  });
  const pipBrassMat = new MeshStandardMaterial({
    color: 0xC9A253,
    roughness: 0.19,
    metalness: 0.95,
    envMapIntensity: 1.3,
  });

  const shadowGeo = new PlaneGeometry(1, 1);
  const shadowTex = contactShadowTexture();

  const dice = homes.map((home, i) => {
    const mesh = new Mesh(bodyGeo, bodyMat);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = castShadow;
    mesh.add(new Mesh(pips.dark, pipMat));
    mesh.add(new Mesh(pips.brass, pipBrassMat));
    mesh.visible = false;
    scene.add(mesh);

    // Пляма лежить окремо від кубика: вона не обертається разом із ним,
    // а тільки їздить за його положенням по полю.
    const shadow = new Mesh(
      shadowGeo,
      new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = BOARD_TOP_Y + 0.004;
    shadow.renderOrder = -1;
    shadow.visible = false;
    scene.add(shadow);

    return {
      mesh,
      shadow,
      home,
      startY: i === 0 ? 3.6 : 4.1,
      vel: new Vector3(),
      angVel: new Vector3(),
      bounces: 0,
      state: "hidden", // hidden | flying | settling | rest
      settleFrom: null,
      settleTo: null,
      settlePos: null,
      settleStart: 0,
      result: 1,
      firstImpactDone: false,
    };
  });

  const rand = (a, b) => a + Math.random() * (b - a);
  const sign = () => (Math.random() < 0.5 ? -1 : 1);

  function roll(results, onSettled) {
    dice.forEach((d, i) => {
      d.mesh.visible = true;
      d.shadow.visible = true;
      d.state = "flying";
      d.bounces = 0;
      d.firstImpactDone = false;
      d.result = results[i];
      d.mesh.position.set(d.home.x + rand(-0.6, 0.6), d.startY, d.home.z + 2.6);
      d.mesh.quaternion.setFromAxisAngle(
        new Vector3(Math.random(), Math.random(), Math.random()).normalize(),
        Math.random() * Math.PI * 2
      );
      d.vel.set(0.6 * sign(), -1.5, -rand(3.2, 4.2));
      d.angVel.set(rand(6, 13) * sign(), rand(6, 13) * sign(), rand(6, 13) * sign());
    });
    settledCallback = onSettled;
    settledCount = 0;
  }

  // Миттєво покласти кубики з готовим результатом (повторний візит,
  // prefers-reduced-motion) — без анімації.
  function setToResult(results) {
    dice.forEach((d, i) => {
      d.mesh.visible = true;
      d.shadow.visible = true;
      d.state = "rest";
      d.result = results[i];
      d.mesh.position.copy(d.home);
      d.mesh.quaternion.copy(targetQuaternion(results[i], rand(0, Math.PI * 2)));
    });
  }

  let settledCallback = null;
  let settledCount = 0;

  const tmpQ = new Quaternion();
  const tmpAxis = new Vector3();

  // Що вище кубик — то більша й блідіша пляма. Це єдиний натяк на висоту,
  // який лишається, коли кубик у польоті.
  function updateShadow(d) {
    if (!d.shadow.visible) return;
    const h = Math.max(0, d.mesh.position.y - REST_Y);
    const k = clamp01(h / 2.6);
    const s = SIZE * (1.15 + k * 1.5);
    d.shadow.scale.set(s, s, 1);
    d.shadow.position.x = d.mesh.position.x;
    d.shadow.position.z = d.mesh.position.z;
    d.shadow.material.opacity = 0.85 * (1 - k * 0.78);
  }

  function update(dt, now) {
    for (const d of dice) {
      updateShadow(d);
      if (d.state === "flying") {
        d.vel.y -= 13.5 * dt;
        d.mesh.position.addScaledVector(d.vel, dt);
        const w = d.angVel.length();
        if (w > 0.0001) {
          tmpAxis.copy(d.angVel).normalize();
          tmpQ.setFromAxisAngle(tmpAxis, w * dt);
          d.mesh.quaternion.premultiply(tmpQ);
        }
        if (d.mesh.position.y <= REST_Y && d.vel.y < 0) {
          d.mesh.position.y = REST_Y;
          d.vel.y = -d.vel.y * 0.4;
          d.vel.x *= 0.72;
          d.vel.z *= 0.72;
          d.angVel.multiplyScalar(0.6);
          d.bounces += 1;
          fx.spawnWave(d.mesh.position, d.firstImpactDone
            ? { color: 0x22b8c6, duration: 600, scale: 14 }
            : { color: 0xe4d2a6, duration: 900, scale: 26 });
          d.firstImpactDone = true;
          fx.flashLight();
          if (d.bounces >= 3 || Math.abs(d.vel.y) < 1.1) {
            d.state = "settling";
            d.settleStart = now;
            d.settleFrom = d.mesh.quaternion.clone();
            d.settleTo = targetQuaternion(d.result, rand(0, Math.PI * 2));
            d.settlePos = d.mesh.position.clone();
          }
        }
      } else if (d.state === "settling") {
        const t = clamp01((now - d.settleStart) / 420);
        const e = easeOutCubic(t);
        d.mesh.quaternion.slerpQuaternions(d.settleFrom, d.settleTo, e);
        d.mesh.position.lerpVectors(d.settlePos, d.home, e);
        if (t >= 1) {
          d.state = "rest";
          settledCount += 1;
          if (settledCount === dice.length && settledCallback) {
            const cb = settledCallback;
            settledCallback = null;
            cb();
          }
        }
      }
    }
  }

  const allResting = () => dice.every((d) => d.state === "rest");
  const midpoint = () => {
    const m = new Vector3();
    dice.forEach((d) => m.add(d.mesh.position));
    return m.multiplyScalar(0.5);
  };

  return { roll, setToResult, update, allResting, midpoint, dice };
}
