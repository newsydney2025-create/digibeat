const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables manually
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
        console.error('Failed to load .env.local: ' + e);
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
    console.log('Starting backfill for 2026-02-03 (Baseline Zero)...');

    // 1. Get Accounts
    const { data: igAccounts, error: igError } = await supabase.from('instagram_accounts').select('id');
    const { data: tkAccounts, error: tkError } = await supabase.from('tiktok_accounts').select('id');

    if (igError) console.error('Error fetching IG accounts:', igError);
    if (tkError) console.error('Error fetching TK accounts:', tkError);

    const allAccounts = [
        ...(igAccounts || []),
        ...(tkAccounts || [])
    ];

    console.log(`Found ${allAccounts.length} accounts to backfill.`);

    // 2. Insert Zeros
    let upserted = 0;
    for (const acc of allAccounts) {
        const { error } = await supabase.from('daily_snapshots').upsert({
            account_id: acc.id,
            date: '2026-02-03', // Yesterday
            total_views: 0,
            total_likes: 0,
            total_comments: 0,
            total_shares: 0,
            video_count: 0,
            created_at: new Date().toISOString()
        }, { onConflict: 'account_id, date' });

        if (error) {
            console.error(`Failed to backfill for ${acc.id}:`, error.message);
        } else {
            upserted++;
        }
    }

    console.log(`Backfill complete. Upserted ${upserted} snapshots.`);
}

run();
