const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
    const { data: marchSnaps, error } = await supabase
        .from('daily_snapshots')
        .select('account_id, date')
        .gte('date', '2026-03-01');

    if (error) {
        console.error("DB Error:", error);
        return;
    }

    // Get all TK and IG account IDs
    const { data: tkAccounts } = await supabase.from('tiktok_accounts').select('id, username');
    const { data: igAccounts } = await supabase.from('instagram_accounts').select('id, username');

    const tkMap = {}; tkAccounts.forEach(a => tkMap[a.id] = a.username);
    const igMap = {}; igAccounts.forEach(a => igMap[a.id] = a.username);

    let tkCount = 0;
    let igCount = 0;
    let unknownCount = 0;

    // Check specific dates
    const dateCounts = { '2026-03-04': { tk: 0, ig: 0, unknown: 0 }, '2026-03-05': { tk: 0, ig: 0, unknown: 0 } };

    marchSnaps.forEach(s => {
        let type = 'unknown';
        if (tkMap[s.account_id]) {
            tkCount++;
            type = 'tk';
        } else if (igMap[s.account_id]) {
            igCount++;
            type = 'ig';
        } else {
            unknownCount++;
        }

        if (dateCounts[s.date]) {
            dateCounts[s.date][type]++;
        }
    });

    console.log(`Total March Snapshots: ${marchSnaps.length}`);
    console.log(`TK matches: ${tkCount}`);
    console.log(`IG matches: ${igCount}`);
    console.log(`Unknown matches: ${unknownCount}`);
    console.log('\nBreakdown by Date:');
    console.log(`March 4: TK=${dateCounts['2026-03-04'].tk}, IG=${dateCounts['2026-03-04'].ig}`);
    console.log(`March 5: TK=${dateCounts['2026-03-05'].tk}, IG=${dateCounts['2026-03-05'].ig}`);
}

main().catch(console.error);
