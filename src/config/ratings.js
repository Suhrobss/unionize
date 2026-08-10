// Джерело даних — та сама Google-таблиця, що на старому сайті (гравці,
// аркуш 1). Власник керує нею вручну, без доступу до коду (ІДЕЇ-ТЗ §2.3).
export const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/180V6ZvXt9H3slJXJVJhV05Eexs_D0dRhPf5DaSGjga0/gviz/tq?gid=0&headers=1";

// Заглушка — у таблиці поки немає колонки "заклад" (потрібна для рейтингу
// закладів, ІДЕЇ-ТЗ §2.3). Змінити тут, коли сезон підтвердять.
export const SEASON_LABEL = "Осінь 2026";

export const TOP_PLAYERS_VISIBLE = 10;
export const TOP_INSTITUTION_PLAYERS = 5;
export const SEARCH_MIN_INSTITUTIONS = 15;
