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
                if (key && val && !key.startsWith('#')) {
                    env[key] = val;
                }
            }
        });
        return env;
    } catch (e) {
        return {};
    }
}

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    console.log('--- ALL ACCOUNTS ---');
    const { data: ig } = await supabase.from('instagram_accounts').select('id, username');
    const { data: tk } = await supabase.from('tiktok_accounts').select('id, username');

    (ig || []).forEach(a => console.log(`IG: ${a.username} [${a.id}]`));
    (tk || []).forEach(a => console.log(`TK: ${a.username} [${a.id}]`));

    console.log('\n--- ALL SNAPSHOTS ---');
    const { data: snaps, error } = await supabase.from('daily_snapshots').select('*').order('date', { ascending: true });
    if (error) console.log('Error:', error);

    (snaps || []).forEach(s => {
        let owner = 'ORPHANED';
        const isIg = (ig || []).find(a => a.id === s.account_id);
        const isTk = (tk || []).find(a => a.id === s.account_id);

        if (isIg) owner = `IG(${isIg.username})`;
        if (isTk) owner = `TK(${isTk.username})`;

        console.log(`[${s.date}] Owner: ${owner} | Views: ${s.total_views}`);
    });
}

check();
