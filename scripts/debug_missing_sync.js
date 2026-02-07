const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// The 6 missing accounts identified previously
const MISSING = [
    'jacko.explores',
    'storiesof.ehtanella',
    'iris.in.syd',
    'mayathompson01',
    'cozylightdairy',
    'sophiessydneydiary'
];

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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const API_TOKEN = env.APIFY_API_TOKEN;

async function run() {
    console.log(`Starting Targeted Sync for ${MISSING.length} accounts...`);

    // Call Apify directly
    const runResponse = await fetch(
        `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/runs?token=${API_TOKEN}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                profiles: MISSING,
                resultsPerPage: 5, // Try 5 just to get *something*
                profileScrapeSections: ['videos'],
                profileSorting: 'latest',
            }),
        }
    );

    const runData = await runResponse.json();
    const runId = runData.data.id;
    console.log(`Run started: ${runId}`);

    // Wait
    let status = 'RUNNING';
    while (status === 'RUNNING') {
        await new Promise(r => setTimeout(r, 5000));
        const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${API_TOKEN}`);
        const d = await res.json();
        status = d.data.status;
        console.log(`Status: ${status}`);
    }

    if (status !== 'SUCCEEDED') {
        console.error('Run failed!');
        return;
    }

    // Fetch Items
    const datasetResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${API_TOKEN}`);
    const items = await datasetResponse.json();

    console.log(`Fetched ${items.length} items from Apify.`);

    // Inspect each item
    for (const item of items) {
        if (!item.authorMeta) {
            console.warn(`[BAD DATA] Item ID ${item.id} missing authorMeta. Raw keys: ${Object.keys(item)}`);
            // Print a snippet of the item to see what WE DID get
            console.log(JSON.stringify(item).substring(0, 200));
            continue;
        }
        console.log(`[GOOD DATA] Found: ${item.authorMeta.name}`);

        // Try insert
        const { error } = await supabase.from('tiktok_accounts').upsert({
            username: item.authorMeta.name,
            nickname: item.authorMeta.nickName,
            avatar_url: item.authorMeta.avatar,
            signature: item.authorMeta.signature,
            follower_count: item.authorMeta.fans,
            following_count: item.authorMeta.following,
            heart_count: item.authorMeta.heart,
            video_count: item.authorMeta.video,
            is_active: true,
            last_synced_at: new Date().toISOString()
        }, { onConflict: 'username' });

        if (error) console.error('DB Insert Error:', error);
        else console.log(`Saved to DB: ${item.authorMeta.name}`);
    }
}

run();
