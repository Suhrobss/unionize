// ДИЗАЙН-ТЗ §5.5: "Числа у відповідях обгортаються в Mono 700: UC — --champ, рейтинг — --lyman".
// Колір визначається словом, що йде одразу за числом; решта чисел лишаються
// моноширинними без кольору (успадковують колір тексту).
const UC_PATTERN = /^\s*(unioncoin|uc\b)/i;
const RATING_PATTERN = /^\s*(бал|рейтинг)/i;

export function highlightNumbers(text: string): string {
  return text.replace(/\d+/g, (match, offset: number) => {
    const after = text.slice(offset + match.length, offset + match.length + 24);
    let variant = "";
    if (UC_PATTERN.test(after)) {
      variant = " num--uc";
    } else if (RATING_PATTERN.test(after)) {
      variant = " num--rating";
    }
    return `<span class="num${variant}">${match}</span>`;
  });
}
