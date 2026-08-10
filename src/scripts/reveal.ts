// Проявлення блоку при прокрутці (ДИЗАЙН-ТЗ §11, рядок 2): 900ms,
// крок між сусідами 90ms, cubic-bezier(.16,1,.28,1). Один раз, без
// повторного programу — не анімуємо елементи, що вже видні при завантаженні.
// Викликати повторно після того, як динамічний контент (рейтинги, поле)
// домалював свої [data-reveal]-елементи — початковий виклик їх ще не бачив.
export function initReveal() {
  const items = document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-revealed)");
  if (items.length === 0) return;

  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-revealed"));
    return;
  }

  const groups = new Map<string, HTMLElement[]>();
  items.forEach((el) => {
    const group = el.dataset.revealGroup || el.dataset.reveal || "solo";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(el);
  });
  groups.forEach((els) => {
    els.forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i, 6) * 90}ms`;
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  items.forEach((el) => observer.observe(el));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initReveal);
} else {
  initReveal();
}
