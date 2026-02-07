const http = require('http');

const target = 'jacko.explores';

console.log(`Debugging sync for: ${target}`);

const data = JSON.stringify({
    profiles: [target],
    resultsPerPage: 1,
    profileScrapeSections: ['videos'],
    profileSorting: 'latest'
});

// We need to call Apify directly to see the error, OR use our internal API but modify it to log more.
// Since we can't easily modify the running server's log level dynamically without restart/code change,
// let's try to run a standalone script that mimics the API logic exactly but runs locally in Node.

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load Env
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

async function run() {
    const apiToken = env.APIFY_API_TOKEN;
    if (!apiToken) { console.error('No APIFY_API_TOKEN'); return; }

    console.log('Starting direct Apify call...');

    // 1. Start Run
    const runRes = await fetch(
        `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/runs?token=${apiToken}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                profiles: [target],
                resultsPerPage: 1,
                profileScrapeSections: ['videos'],
                profileSorting: 'latest',
            }),
        }
    );

    const runData = await runRes.json();
    if (!runRes.ok) {
        console.error('Apify Start Failed:', runData);
        return;
    }

    const runId = runData.data.id;
    console.log(`Run started: ${runId}`);

    // 2. Poll
    let status = 'RUNNING';
    while (status === 'RUNNING') {
        await new Promise(r => setTimeout(r, 4000));
        const checkRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apiToken}`);
        const checkData = await checkRes.json();
        status = checkData.data.status;
        console.log(`Status: ${status}`);
    }

    if (status !== 'SUCCEEDED') {
        console.error('Run failed!');
        // Get log
        const logRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/log?token=${apiToken}`);
        const logText = await logRes.text();
        console.log('--- LOG START ---');
        console.log(logText.substring(0, 2000)); // First 2000 chars
        console.log('--- LOG END ---');
        return;
    }

    // 3. Get Data
    const dataRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apiToken}`);
    const items = await dataRes.json();
    console.log(`Items found: ${items.length}`);
    if (items.length > 0) {
        console.log('First item author:', items[0].authorMeta?.name);
    } else {
        console.log('No items returned. Ensure profile is public and has videos.');
    }
}

run();
