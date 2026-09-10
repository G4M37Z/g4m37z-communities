-- V3.7 Creators policies (additive, non-destructive)
ALTER TABLE creator_profiles ENABLE ROW LEVEL SECURITY; ALTER TABLE creator_content ENABLE ROW LEVEL SECURITY; ALTER TABLE creator_followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY creator_profiles_select ON creator_profiles FOR SELECT USING (true);
CREATE POLICY creator_profiles_insert ON creator_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY creator_profiles_update ON creator_profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY creator_content_select ON creator_content FOR SELECT USING (true);
CREATE POLICY creator_content_insert ON creator_content FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY creator_content_update ON creator_content FOR UPDATE USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE POLICY creator_followers_select ON creator_followers FOR SELECT USING (true);
CREATE POLICY creator_followers_insert ON creator_followers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY creator_followers_delete ON creator_followers FOR DELETE USING (auth.uid() = user_id);
