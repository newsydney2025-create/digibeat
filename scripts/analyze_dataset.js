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
    // Datasets provided by user
    const datasets = ['nRc8dNDg9WXQlBUam'];

    for (const datasetId of datasets) {
        console.log(`\n=== Inspecting Dataset: ${datasetId} ===`);

        const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}&limit=500`); // Increase limit to see more
        if (!res.ok) {
            console.error('Failed to fetch dataset:', await res.text());
            continue;
        }

        const items = await res.json();
        console.log(`Fetched ${items.length} total items.`);

        const accountCounts = {};
        const typeCounts = {};

        items.forEach(item => {
            // Count Types
            const t = item.type || 'unknown';
            typeCounts[t] = (typeCounts[t] || 0) + 1;

            // Count per Account
            const u = item.ownerUsername || 'unknown';
            accountCounts[u] = (accountCounts[u] || 0) + 1;
        });

        console.log('--- TYPE DISTRIBUTION ---');
        Object.keys(typeCounts).forEach(k => console.log(`${k}: ${typeCounts[k]}`));

        console.log('\n--- PER ACCOUNT COUNTS ---');
        // Sort by count descending
        Object.entries(accountCounts)
            .sort(([, a], [, b]) => b - a)
            .forEach(([user, count]) => {
                console.log(`${user}: ${count}`);
            });
    }
}

run();
