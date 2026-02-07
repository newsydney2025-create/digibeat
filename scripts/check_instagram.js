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
    // Check for specific accounts
    const oldAccount = 'michael.benett';
    const newAccount = 'novaaadays';

    // In DB, username might store full URL or just username. Typically username part?
    // Let's check both possibilities or search.

    const { data: accounts, error } = await supabase.from('instagram_accounts').select('username');
    if (error) { console.error('DB Error:', error); return; }

    const usernames = accounts.map(a => a.username);
    console.log('Total Instagram Accounts in DB:', usernames.length);

    const foundOld = usernames.find(u => u.includes(oldAccount) || oldAccount.includes(u));
    const foundNew = usernames.find(u => u.includes(newAccount) || newAccount.includes(u));

    if (foundOld) console.log(`Found OLD account in DB: ${foundOld}`);
    else console.log(`OLD account NOT in DB: ${oldAccount}`);

    if (foundNew) console.log(`Found NEW account in DB: ${foundNew}`);
    else console.log(`NEW account NOT in DB: ${newAccount}`);
}

run();
