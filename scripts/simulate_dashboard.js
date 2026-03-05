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
    // 1. Get TikTok Active Accounts
    const { data: accounts } = await supabase
        .from('tiktok_accounts')
        .select('id')
        .eq('is_active', true);

    const selectedAccounts = accounts.map(a => a.id);
    console.log(`Selected accounts count: ${selectedAccounts.length}`);

    // 2. Get All Snapshots (mimicking fetchSnapshots)
    const { data: snapshots } = await supabase
        .from('daily_snapshots')
        .select('*')
        .order('date', { ascending: true })
        .limit(10000);

    console.log(`Total activeSnapshots count: ${snapshots.length}`);

    // 3. Mimic DashboardLayout activeSnapshots logic
    // (In dashboard: activeSnapshots = snapshots, no platform filtering for TK directly in activeSnapshots, 
    // it relies on selectedAccounts filtering)

    // 4. Find latest date
    const latestDate = snapshots.length > 0
        ? snapshots.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b).date
        : null;

    console.log(`Calculated latestDate: ${latestDate}`);

    // 5. Calculate totals
    const acc = { playCount: 0, diggCount: 0, commentCount: 0, shareCount: 0, collectCount: 0 };

    selectedAccounts.forEach(accountId => {
        const todaySnap = snapshots.find(s => s.account_id === accountId && s.date === latestDate);

        if (todaySnap) {
            acc.playCount += (todaySnap.gain_views || 0);
            acc.diggCount += (todaySnap.gain_likes || 0);
            acc.commentCount += (todaySnap.gain_comments || 0);
            acc.shareCount += (todaySnap.gain_shares || 0);
        }
    });

    console.log(`\nTotals for ${latestDate}:`, acc);

    // Check if March 5 actually exists in selectedAccounts
    const snapsOnLatest = snapshots.filter(s => s.date === latestDate);
    console.log(`\nAvailable snapshots on ${latestDate}: ${snapsOnLatest.length}`);
    let tkMatches = 0;
    snapsOnLatest.forEach(s => {
        if (selectedAccounts.includes(s.account_id)) tkMatches++;
    });
    console.log(`Matches in selectedAccounts: ${tkMatches}`);
}

main().catch(console.error);
