// Кубики: текстури граней на canvas, спрощена власна балістика,
// гарантоване досідання в оголошену грань (завдання «3D-вступ» §3).
import {
  BoxGeometry,
  CanvasTexture,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from "three";
import { BOARD_TOP_Y } from "./scene.js";
import { easeOutCubic, clamp01 } from "./easing.js";

const SIZE = 0.58;
export const REST_Y = BOARD_TOP_Y + SIZE / 2;

// Порядок граней у матеріалі: [+x, -x, +y, -y, +z, -z] = [3, 4, 1, 6, 2, 5].
// Протилежні пари: 3+4, 1+6, 2+5 — усі дають 7, як на справжніх кубиках.
const FACE_ORDER = [3, 4, 1, 6, 2, 5];
const FACE_NORMALS = {
  3: new Vector3(1, 0, 0),
  4: new Vector3(-1, 0, 0),
  1: new Vector3(0, 1, 0),
  6: new Vector3(0, -1, 0),
  2: new Vector3(0, 0, 1),
  5: new Vector3(0, 0, -1),
};

const PIPS = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.28, 0.22], [0.72, 0.22], [0.28, 0.5], [0.72, 0.5], [0.28, 0.78], [0.72, 0.78]],
};

function faceTexture(value) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#EFE8D6";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(70,55,20,.35)";
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 244, 244);
  ctx.fillStyle = "#141A22";
  for (const [px, py] of PIPS[value]) {
    ctx.beginPath();
    ctx.arc(px * 256, py * 256, 26, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
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
  const dice = homes.map((home, i) => {
    const mats = FACE_ORDER.map(
      (v) => new MeshStandardMaterial({ map: faceTexture(v), roughness: 0.55 })
    );
    const mesh = new Mesh(new BoxGeometry(SIZE, SIZE, SIZE), mats);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = castShadow;
    const edges = new LineSegments(
      new EdgesGeometry(mesh.geometry),
      new LineBasicMaterial({ color: 0xb9924a, transparent: true, opacity: 0.55 })
    );
    mesh.add(edges);
    mesh.visible = false;
    scene.add(mesh);
    return {
      mesh,
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

  function update(dt, now) {
    for (const d of dice) {
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
