// Кубік-безьє для JS-анімацій сцени — ті самі криві, що й у CSS-специфікаціях
// завдання (наприклад, cubic-bezier(.16,1,.28,1)).

export function cubicBezier(p1x, p1y, p2x, p2y) {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t) => (3 * ax * t + 2 * bx) * t + cx;

  function solveX(x) {
    let t = x;
    for (let i = 0; i < 6; i++) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-5) return t;
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    while (lo < hi) {
      const v = sampleX(t);
      if (Math.abs(v - x) < 1e-5) return t;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  }

  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return sampleY(solveX(x));
  };
}

// Основна крива сайту
export const easeSite = cubicBezier(0.16, 1, 0.28, 1);

// 1 − (1−t)³ — набігання підсумку й досідання кубика
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// Барабанний лічильник — cubic-bezier(.25,1.15,.45,1)
export const easeDrum = cubicBezier(0.25, 1.15, 0.45, 1);

export const easeSheen = cubicBezier(0.5, 0, 0.3, 1);

export const clamp01 = (t) => Math.max(0, Math.min(1, t));
