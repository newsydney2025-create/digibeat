
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    console.log('Starting migration for video history tables...');

    // 1. Create tiktok_video_history table
    const createTikTokTable = `
    CREATE TABLE IF NOT EXISTS tiktok_video_history (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      video_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      date DATE NOT NULL,
      play_count BIGINT DEFAULT 0,
      digg_count BIGINT DEFAULT 0,
      comment_count BIGINT DEFAULT 0,
      share_count BIGINT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(video_id, date)
    );
  `;

    // 2. Create instagram_reel_history table
    const createInstagramTable = `
    CREATE TABLE IF NOT EXISTS instagram_reel_history (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      reel_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      date DATE NOT NULL,
      video_play_count BIGINT DEFAULT 0,
      likes_count BIGINT DEFAULT 0,
      comments_count BIGINT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(reel_id, date)
    );
  `;

    // Execute SQL via RPC if available, or try simply informing user if we can't runs SQL directly via client.
    // Actually, supabase-js doesn't run raw DDL easily without a specific RPC function defined on server.
    // I will assume the user has the 'execute_sql' RPC function from previous context or standard setup.
    // If not, I might fail here.

    try {
        const { error: error1 } = await supabase.rpc('execute_sql', { query: createTikTokTable });
        if (error1) {
            console.error('Error creating tiktok table via RPC:', error1);
            // Fallback: This usually means RPC doesn't exist.
            // We might need to ask user to run SQL in dashboard, but let's try.
        } else {
            console.log('tiktok_video_history table created/verified.');
        }

        const { error: error2 } = await supabase.rpc('execute_sql', { query: createInstagramTable });
        if (error2) {
            console.error('Error creating instagram table via RPC:', error2);
        } else {
            console.log('instagram_reel_history table created/verified.');
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

runMigration();
