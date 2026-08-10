// Supabase — лише для лічильника рідкості архетипів (ІДЕЇ-ТЗ §2.1).
// Без цих змінних середовища модуль тихо працює на фолбек-відсотках з
// data/archetypes.json (rarityFallback) — це штатний, а не аварійний режим.
export const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || "";
export const RARITY_MIN_SAMPLES = 200;
