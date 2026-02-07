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

async function run() {
    const apiToken = env.APIFY_API_TOKEN;
    if (!apiToken) {
        console.error('APIFY_API_TOKEN not found.');
        return;
    }

    // List recent runs for instagram-scraper matches
    // Actor ID for apify/instagram-scraper is usually 'shu8hvrXbJbY3Eb9W' or similar, 
    // but we can list runs and filter by actor ID or just list all recent.

    console.log('Fetching recent runs...');
    const res = await fetch(`https://api.apify.com/v2/acts/apify~instagram-scraper/runs?token=${apiToken}&desc=true&limit=5`);
    const data = await res.json();

    if (!data.data || data.data.items.length === 0) {
        console.log('No recent Instagram runs found directly via actor slug. Checking all runs...');
        const allRes = await fetch(`https://api.apify.com/v2/actor-runs?token=${apiToken}&desc=true&limit=5`);
        const allData = await allRes.json();
        console.log('Recent raw runs:');
        allData.data.items.forEach(r => {
            console.log(`- ${r.id} | Status: ${r.status} | Started: ${r.startedAt} | Dur: ${r.finishedAt ? (new Date(r.finishedAt) - new Date(r.startedAt)) / 1000 + 's' : 'Running'}`);
        });
        return;
    }

    const lastRun = data.data.items.find(r => r.status === 'SUCCEEDED') || data.data.items[0];

    const inputRes = await fetch(`https://api.apify.com/v2/actor-runs/${lastRun.id}/input?token=${apiToken}`);
    const input = await inputRes.json();

    console.log(`\n--- INPUT: ${lastRun.id} (${lastRun.status}) ---`);
    console.log(JSON.stringify(input, null, 2));
}

run();
