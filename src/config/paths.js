// Помічник для будь-якого шляху всередині сайту.
//
// Astro сам виставляє import.meta.env.BASE_URL зі значення base в
// astro.config.mjs, тож u() однаково правильно працює і в підпапці
// (/unionize/…), і в корені домену (/…) — без правок у компонентах.
//
// Навмисно НЕ імпортується в astro.config.mjs: там немає import.meta.env.

const BASE = (import.meta.env && import.meta.env.BASE_URL) || "/";

export function u(path = "/") {
  // зовнішні адреси, якорі й порожнє лишаємо як є
  if (!path || /^([a-z]+:)?\/\//i.test(path) || path.startsWith("#") || path.startsWith("mailto:")) {
    return path;
  }

  const base = BASE.replace(/\/+$/, "");
  if (!base) return path;

  // ідемпотентність: якщо префікс уже на місці, не додаємо вдруге
  if (path === base || path.startsWith(base + "/")) return path;

  return (base + "/" + path.replace(/^\/+/, "")).replace(/([^:])\/{2,}/g, "$1/");
}
