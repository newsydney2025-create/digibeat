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

// Manually extracted from scraping_targets.ts (since it's TS, cleaner to paste here for script)
const CONFIG_TIKTOK = [
    'lena.artlens', 'sydneydiary.zoe', 'elliesoftdays', 'ave.lightmoments', 'maya.motionlife',
    'hey.lexi_', 'ashleighmoments', 'its.chloetime', 'jacko.explores', 'storiesof.ehtanella',
    'mamalinh0', 'sophie.miller86', 'Iris.in.syd', 'anitasharma0111', 'daisy187715',
    'hellennguyen01', 'isabellajohnson001', 'mayathompson01', 'alexcooper0001', 'jordanmiller0001',
    'joyfulsydney', 'GoWithJessie', 'sydneymomdiary', 'janesyd', 'TechWithJonny',
    'leoafterhours1', 'dadventures_au', 'novadays', 'we2insydney', 'honestmumdiary',
    'Ninimama46', 'moe_satogo', 'Mia_110510', 'getthedog01', 'rachelllll_0815',
    'cozylightdairy', 'Energracie', 'Letsdosydney', 'chloe.noahescapes', 'grace_wilson0',
    'claire_mumjourney', 'OliverLens', 'SophiesSydneyDiary', 'SinclairWellness'
].map(u => u.toLowerCase());

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data: accounts } = await supabase.from('tiktok_accounts').select('username');
    const dbUsernames = accounts.map(a => a.username.toLowerCase());
    const configUsernames = new Set(CONFIG_TIKTOK);

    console.log(`Config Count: ${CONFIG_TIKTOK.length}`);
    console.log(`DB Count: ${dbUsernames.length}`);

    // Find Extra (In DB but not in Config)
    const extra = dbUsernames.filter(u => !configUsernames.has(u));

    console.log('\n--- EXTRA ACCOUNTS (In DB, Not in Config) ---');
    if (extra.length === 0) console.log('(None)');
    extra.forEach(u => console.log(u));

    // Find Missing (In Config but not in DB)
    const missing = [...configUsernames].filter(u => !dbUsernames.includes(u));

    console.log('\n--- MISSING ACCOUNTS (In Config, Not in DB) ---');
    if (missing.length === 0) console.log('(None)');
    missing.forEach(u => console.log(u));
}

check();
