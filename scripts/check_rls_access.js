
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkPolicies() {
    // We cannot query pg_policies directly via JS client unless we use RPC or just check if we can read as anon.
    // Better test: Create ANON client and try to fetch data.

    const anonKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
    const anonClient = createClient(supabaseUrl, anonKey);

    const tables = [
        'tiktok_accounts',
        'tiktok_videos',
        'daily_snapshots',
        'account_groups',
        'instagram_accounts'
    ];

    console.log('Checking ANON read access...');

    for (const table of tables) {
        const { data, error } = await anonClient.from(table).select('count', { count: 'exact', head: true });
        if (error) {
            console.log(`[${table}] FAIL: ${error.message} (Code: ${error.code})`);
        } else {
            // count might be null if head=true? No, it returns count.
            // But strict count requires permission.
            // If error is NULL, it means access allowed (even if 0 rows).
            console.log(`[${table}] PASS (Status: OK)`);
        }
    }
}

checkPolicies();
