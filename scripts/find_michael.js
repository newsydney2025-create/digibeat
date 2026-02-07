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

async function findAndKill() {
    console.log('--- FINDING MICHAEL ---');

    // Check Instagram
    const { data: ig, error: err1 } = await supabase
        .from('instagram_accounts')
        .select('id, username')
        .ilike('username', '%michael%');

    if (ig && ig.length > 0) {
        console.log('Found in Instagram:', ig);
        // Kill if it's the one
        const badOnes = ig.filter(a => a.username.includes('benett'));
        if (badOnes.length > 0) {
            console.log('Refined Match (benett):', badOnes);
            const ids = badOnes.map(a => a.id);
            const { error: delErr } = await supabase.from('instagram_accounts').delete().in('id', ids);
            if (!delErr) console.log('Deleted from Instagram.');
            else console.error('Delete Error IG:', delErr);
        }
    } else {
        console.log('Not found in Instagram.');
    }

    // Check TikTok just in case
    const { data: tk, error: err2 } = await supabase
        .from('tiktok_accounts')
        .select('id, username')
        .ilike('username', '%michael%');

    if (tk && tk.length > 0) {
        console.log('Found in TikTok:', tk);
        const badOnes = tk.filter(a => a.username.includes('benett'));
        if (badOnes.length > 0) {
            console.log('Refined Match (benett):', badOnes);
            const ids = badOnes.map(a => a.id);
            const { error: delErr } = await supabase.from('tiktok_accounts').delete().in('id', ids);
            if (!delErr) console.log('Deleted from TikTok.');
            else console.error('Delete Error TK:', delErr);
        }
    } else {
        console.log('Not found in TikTok.');
    }
}

findAndKill();
