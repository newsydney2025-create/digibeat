
-- Run this in Supabase Dashboard -> SQL Editor

-- 1. Force Schema Cache Reload
NOTIFY pgrst, 'reload schema';

-- 2. Grant Permissions
GRANT ALL ON TABLE daily_snapshots TO service_role;
GRANT ALL ON TABLE daily_snapshots TO postgres;
GRANT ALL ON TABLE daily_snapshots TO anon;
GRANT ALL ON TABLE daily_snapshots TO authenticated;

-- 3. Ensure RLS allows Service Role
ALTER TABLE daily_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service Role Full Access" ON daily_snapshots;

CREATE POLICY "Service Role Full Access"
ON daily_snapshots
TO service_role
USING (true)
WITH CHECK (true);

-- 4. Verify Columns (Optional check)
COMMENT ON TABLE daily_snapshots IS 'Stores daily metrics snapshot';
