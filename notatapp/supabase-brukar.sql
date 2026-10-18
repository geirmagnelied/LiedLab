-- Brukarprofil + bøtte for bilete (kjørt via Supabase MCP 18. okt. 2026). Sjå claude/brukar-modul.md.
CREATE TABLE IF NOT EXISTS brukar_profil (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  namn TEXT DEFAULT '', adresse TEXT DEFAULT '', postnr TEXT DEFAULT '', poststad TEXT DEFAULT '',
  fodselsaar INT, tittel TEXT DEFAULT '', sprak TEXT NOT NULL DEFAULT 'nn', bilete_sti TEXT DEFAULT '',
  kompetanse JSONB NOT NULL DEFAULT '[]'::jsonb, prosjekterfaring JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE brukar_profil ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brukar_profil_select" ON brukar_profil FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "brukar_profil_insert" ON brukar_profil FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "brukar_profil_update" ON brukar_profil FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "brukar_profil_delete" ON brukar_profil FOR DELETE USING (auth.uid() = user_id);
INSERT INTO storage.buckets (id, name, public) VALUES ('brukar', 'brukar', false) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "brukar_storage_all" ON storage.objects FOR ALL
  USING (bucket_id = 'brukar' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'brukar' AND (storage.foldername(name))[1] = auth.uid()::text);
