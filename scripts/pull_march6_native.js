const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
require('ts-node').register({ transpileOnly: true });

// Load environment variables
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase credentials not found in .env.local');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

const { processTikTokDataBulk } = require('./src/lib/sync.ts');

async function run() {
    console.log("Starting manual import for March 6 TikTok scrape (Dataset: hXtGcUOfwoMLEVrEZ)...");
    const dsId = 'hXtGcUOfwoMLEVrEZ';

    console.log("Fetching dataset " + dsId);
    const res = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${APIFY_TOKEN}`);
    const items = await res.json();

    console.log(`Got ${items.length} items from dataset. Processing...`);

    // Let's monkey-patch the global Date object to trick the sync.ts script into thinking it's March 7 Sydney time.
    // March 7 Sydney time = "2026-03-07T00:00:00+11:00" = "2026-03-06T13:00:00Z"
    // Then "yesterday" inside the script (which calculates today - 1) will be '2026-03-06'.
    const OriginalDate = Date;
    global.Date = class extends OriginalDate {
        constructor(...args) {
            if (args.length === 0) {
                // Return a date equivalent to midday March 7 in Sydney
                return new OriginalDate('2026-03-07T12:00:00+11:00');
            }
            return new OriginalDate(...args);
        }
    };
    global.Date.now = () => new OriginalDate('2026-03-07T12:00:00+11:00').getTime();

    // Now trigger the bulk processing logic precisely as the server normally does
    await processTikTokDataBulk(supabase, items, true);
    console.log("Database updated successfully with native sync logic!");
}

run();
