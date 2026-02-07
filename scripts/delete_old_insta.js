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

async function run() {
    console.log('Using Key:', env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE' : 'ANON');
    const oldAccount = 'michael.benett';

    // Find ID
    const { data: accounts, error } = await supabase
        .from('instagram_accounts')
        .select('*')
        .ilike('username', `%${oldAccount}%`);

    if (error) { console.error('Find Error:', error); return; }

    if (accounts.length === 0) {
        console.log(`Account ${oldAccount} not found to delete.`);
        return;
    }

    console.log(`Found ${accounts.length} occurrences of ${oldAccount}. IDs:`, accounts.map(a => a.id));

    const ids = accounts.map(a => a.id);
    const { error: delErr } = await supabase
        .from('instagram_accounts')
        .delete()
        .in('id', ids);

    if (delErr) console.error('Delete Error:', delErr);
    else console.log(`Successfully deleted ${ids.length} entries for ${oldAccount}.`);
}

run();
