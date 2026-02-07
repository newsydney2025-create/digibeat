const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Re-import config targets for comparison
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

async function diagnose() {
    console.log('--- DIAGNOSIS START ---');

    // 1. Check for michael.benett
    const { data: tkGhost } = await supabase.from('tiktok_accounts').select('*').ilike('username', '%michael.benett%');
    const { data: igGhost } = await supabase.from('instagram_accounts').select('*').ilike('username', '%michael.benett%');

    console.log(`Ghosts Found:`);
    console.log(`- TikTok: ${tkGhost?.length || 0}`);
    if (tkGhost?.length) console.log(tkGhost);
    console.log(`- Instagram: ${igGhost?.length || 0}`);
    if (igGhost?.length) console.log(igGhost);

    // 2. Check TikTok Missing
    const { data: accounts } = await supabase.from('tiktok_accounts').select('username');
    const dbUsernames = new Set(accounts.map(a => a.username.toLowerCase()));

    const missing = TARGETS.filter(t => !dbUsernames.has(t));
    console.log(`\nTikTok Accounts in DB: ${accounts.length}`);
    console.log(`Missing Accounts (${missing.length}):`);
    missing.forEach(m => console.log(`- ${m}`));

    console.log('--- DIAGNOSIS END ---');
}

diagnose();
