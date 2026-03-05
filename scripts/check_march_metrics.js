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
        .select('*')
        .gte('date', '2026-03-01')
        .order('date', { ascending: false });

    if (error) {
        console.error("DB Error:", error);
        return;
    }

    if (!marchSnaps || marchSnaps.length === 0) {
        console.log("No March snapshots found.");
        return;
    }

    console.log(`Found ${marchSnaps.length} March snapshots.`);

    // Check missing values
    let totalGainViews = 0;
    let zeroGainCount = 0;

    // Group by Date
    const byDate = { '2026-03-04': [], '2026-03-05': [] };

    marchSnaps.forEach(s => {
        totalGainViews += (s.gain_views || 0);
        if ((s.gain_views || 0) === 0) zeroGainCount++;
        if (byDate[s.date]) byDate[s.date].push(s);
    });

    console.log(`\nOverall: Total gain_views = ${totalGainViews}, Zero gain count = ${zeroGainCount}`);

    Object.keys(byDate).forEach(date => {
        const snaps = byDate[date];
        const sumGains = snaps.reduce((sum, s) => sum + (s.gain_views || 0), 0);
        const zeroGains = snaps.filter(s => (s.gain_views || 0) === 0).length;
        console.log(`Date: ${date} -> Snapshots: ${snaps.length}, Total Gain Views: ${sumGains}, Zero Gain Snaps: ${zeroGains}`);

        if (snaps.length > 0) {
            console.log(`  Sample snapshot ${date}:`);
            console.log(`    account_id: ${snaps[0].account_id}`);
            console.log(`    total_views: ${snaps[0].total_views}`);
            console.log(`    gain_views: ${snaps[0].gain_views}`);
            console.log(`    total_likes: ${snaps[0].total_likes}`);
            console.log(`    gain_likes: ${snaps[0].gain_likes}`);
        }
    });
}

main().catch(console.error);
