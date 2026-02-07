const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
    try {
        const envPath = path.join(__dirname, '..', '.env.local');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const env = {};
        envContent.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
                if (key && !key.startsWith('#')) env[key] = val;
            }
        });
        return env;
    } catch (e) { return {}; }
}

const env = loadEnv();
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, supabaseKey);

async function wipe() {
    console.log('WARNING: Starting Data Wipe for Production Launch...');
    console.log('Using Key:', env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE' : 'ANON');

    // 1. Delete TikTok Videos
    const { error: errTK } = await supabase.from('tiktok_videos').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    if (errTK) console.error('Error wiping tiktok_videos:', errTK);
    else console.log('wiped: tiktok_videos');

    // 2. Delete Instagram Reels
    const { error: errIG } = await supabase.from('instagram_reels').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errIG) console.error('Error wiping instagram_reels:', errIG);
    else console.log('wiped: instagram_reels');

    // 3. Delete Daily Snapshots
    const { error: errSnap } = await supabase.from('daily_snapshots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errSnap) console.error('Error wiping daily_snapshots:', errSnap);
    else console.log('wiped: daily_snapshots');

    console.log('Data Wipe Complete. Accounts preserved.');
}

wipe();
