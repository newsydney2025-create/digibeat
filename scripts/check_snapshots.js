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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    // 1. Get total account count
    const { count: accountCount } = await supabase
        .from('tiktok_accounts')
        .select('*', { count: 'exact', head: true });

    // 2. Get snapshot count for today (Sydney time)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
    const { count: snapshotCount, data: snapshots } = await supabase
        .from('daily_snapshots')
        .select('account_id', { count: 'exact' })
        .eq('date', today);

    console.log(`TikTok Accounts: ${accountCount}`);
    console.log(`Snapshots for ${today}: ${snapshotCount}`);

    if (accountCount > snapshotCount) {
        console.log('WARNING: Snapshots are missing for some accounts.');
        // Which ones?
        const { data: accounts } = await supabase.from('tiktok_accounts').select('id, username');
        const coveredIds = snapshots.map(s => s.account_id);
        const missing = accounts.filter(a => !coveredIds.includes(a.id));
        console.log(`Missing Snapshots for: ${missing.length} accounts`);
        if (missing.length > 0) {
            console.log('Examples:', missing.slice(0, 5).map(a => a.username));
        }
    } else {
        console.log('SUCCESS: All accounts have snapshots.');
    }
}

check();
