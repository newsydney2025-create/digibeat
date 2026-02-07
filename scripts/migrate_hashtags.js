const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Adding hashtags column to instagram_reels...');

    const { error } = await supabase.rpc('execute_sql', {
        query: "ALTER TABLE instagram_reels ADD COLUMN IF NOT EXISTS hashtags TEXT[] DEFAULT '{}';"
    });

    if (error) {
        console.error('Error adding column via RPC:', error);
        // Fallback: try direct SQL if RPC fails (though RPC is standard for this user setup)
        // Actually, let's just log it. If RPC fails, user might not have it enabled.
    } else {
        console.log('Success!');
    }
}

run();
