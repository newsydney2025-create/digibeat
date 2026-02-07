const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const TARGETS = [
    'lena.artlens', 'sydneydiary.zoe', 'elliesoftdays', 'ave.lightmoments', 'maya.motionlife',
    'hey.lexi3', 'ashleighmoments', 'its.choletime', 'jacko.explores', 'storiesof.ehtanella',
    'mamalinh0', 'sophie.miller86', 'Iris.in.syd', 'anitasharma0111', 'daisy187715',
    'hellennguyen01', 'isabellajohnson001', 'mayathompson01', 'alexcooper0001', 'jordanmiller0001',
    'joyfulsydney', 'GoWithJessie', 'sydneymomdiary', 'janesyd2', 'TechWithJonny',
    'leoafterhours1', 'dadventures_au', 'novadays3', 'we2insydney', 'honestmumdiary',
    'Ninimama46', 'moe_satogo', 'Mia_110510', 'getthedog01', 'rachelllll_0815',
    'cozylightdairy', 'Energracie', 'Letsdosydney', 'chloe.noahescapes', 'grace_wilson0',
    'claire_mumjourney', 'Oliverslens', 'SophiesSydneyDiary', 'SinclairWellness'
].map(u => u.toLowerCase());

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
    console.log(`Using Key: ${env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE' : 'ANON'}`);
    console.log(`Config Targets: ${TARGETS.length}`);

    // Fetch DB Accounts
    const { data: accounts, error } = await supabase.from('tiktok_accounts').select('username');
    if (error) { console.error('DB Error:', error); return; }
    console.log(`DB Count: ${accounts.length}`);

    const meta = new Set(TARGETS);
    const toDelete = accounts.filter(a => {
        if (!a.username) return false;
        return !meta.has(a.username.toLowerCase());
    });

    console.log(`\nFound ${toDelete.length} accounts to delete (Not in Config):`);
    toDelete.forEach(a => console.log(`- ${a.username}`));

    if (toDelete.length > 0) {
        const usernamesToDelete = toDelete.map(a => a.username);
        const { error: delErr } = await supabase
            .from('tiktok_accounts')
            .delete()
            .in('username', usernamesToDelete);

        if (delErr) {
            console.error('Delete failed:', delErr);
            console.log('NOTE: Deletion might fail with ANON key due to RLS. Please use Service Key if needed.');
        } else {
            console.log('Successfully deleted extra accounts.');
        }
    } else {
        console.log('No extra accounts found.');
    }
}

run();
