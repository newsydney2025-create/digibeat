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
    // List of suspect accounts from screenshot
    const suspects = ['novadays', 'its.chloetime', 'hey.lexi_', 'janesyd', 'oliverlens', 'energracie'];

    for (const username of suspects) {
        // Get Account
        const { data: account } = await supabase
            .from('tiktok_accounts')
            .select('id, username')
            .eq('username', username)
            .single();

        if (account) {
            // Count Videos
            const { count } = await supabase
                .from('tiktok_videos')
                .select('*', { count: 'exact', head: true })
                .eq('account_id', account.id);

            console.log(`Account: ${username.padEnd(20)} | ID: ${account.id} | Videos: ${count}`);
        } else {
            console.log(`Account: ${username.padEnd(20)} | Not found in DB`);
        }
    }
}

check();
