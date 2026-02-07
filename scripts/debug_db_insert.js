const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load Env
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
                if (key && val && !key.startsWith('#')) {
                    env[key] = val;
                }
            }
        });
        return env;
    } catch (e) {
        console.error('Failed to load .env.local', e);
        return {};
    }
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Testing DB Insertion...');

    // 1. Get Account
    const username = 'hellen_nguyen01';
    const { data: account, error: accError } = await supabase
        .from('instagram_accounts')
        .select('*')
        .eq('username', username)
        .single();

    if (accError || !account) {
        console.error('Account lookup failed:', accError);
        // Try upserting account first
        console.log('Upserting account...');
        const { data: newAcc, error: upsertError } = await supabase
            .from('instagram_accounts')
            .upsert({
                username: username,
                instagram_id: 'test_id_123',
                updated_at: new Date().toISOString()
            }, { onConflict: 'username' })
            .select()
            .single();

        if (upsertError) {
            console.error('Account upsert failed:', upsertError);
            return;
        }
        console.log('Account upserted:', newAcc.id);
    } else {
        console.log('Account found:', account.id);
    }

    // 2. Try Insert Reel
    // Data from debug_apify_data.json sample
    const reelData = {
        account_id: account ? account.id : 'ea0b3f8b-9679-4592-a982-598441434310', // fallback
        short_code: 'DUHmDP9Ejih', // From logs
        caption: 'Test Caption',
        video_play_count: 61,
        likes_count: 0,
        comments_count: 0,
        thumbnail_url: 'https://example.com/thumb.jpg',
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString()
    };

    console.log('Upserting reel:', reelData);

    const { data: reel, error: reelError } = await supabase
        .from('instagram_reels')
        .upsert(reelData, { onConflict: 'short_code' })
        .select()
        .single();

    if (reelError) {
        console.error('Reel upsert FAILED:', reelError);
    } else {
        console.log('Reel upsert SUCCESS:', reel.id);
    }
}

run();
