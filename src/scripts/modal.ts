let lastFocused: HTMLElement | null = null;

export function initModal(id: string) {
  const modal = document.getElementById(id);
  const backdrop = document.getElementById(`${id}-backdrop`);
  const closeBtn = document.getElementById(`${id}-close`);
  const body = document.getElementById(`${id}-body`);
  if (!modal || !backdrop || !closeBtn || !body) return null;

  function open(html: string, triggerEl?: HTMLElement) {
    if (!modal || !backdrop || !body) return;
    lastFocused = triggerEl || (document.activeElement as HTMLElement);
    body.innerHTML = html;
    modal.hidden = false;
    backdrop.hidden = false;
    requestAnimationFrame(() => {
      modal.classList.add("is-open");
      backdrop.classList.add("is-visible");
    });
    document.body.style.overflow = "hidden";
    closeBtn?.focus();
    document.addEventListener("keydown", onKeydown);
  }

  function close() {
    if (!modal || !backdrop) return;
    modal.classList.remove("is-open");
    backdrop.classList.remove("is-visible");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKeydown);
    setTimeout(() => {
      if (modal) modal.hidden = true;
      if (backdrop) backdrop.hidden = true;
    }, 320);
    lastFocused?.focus();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") close();
    if (e.key === "Tab" && modal) {
      const focusable = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);

  return { open, close };
}
