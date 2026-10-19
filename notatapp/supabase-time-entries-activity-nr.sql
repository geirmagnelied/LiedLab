-- Aktivitetsnummer per timeoppføring (Timar), 19. okt. 2026. Køyrt via Supabase MCP.
alter table public.time_entries add column if not exists activity_nr text;
