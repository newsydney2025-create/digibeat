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
    const lines = [];

    // 1. March snapshots - platform breakdown
    const { data: allMarch } = await supabase
        .from('daily_snapshots')
        .select('platform, date, account_id')
        .gte('date', '2026-03-01');

    const platforms = {};
    const datesByPlatform = {};
    (allMarch || []).forEach(s => {
        const p = s.platform || 'null';
        platforms[p] = (platforms[p] || 0) + 1;
        if (!datesByPlatform[p]) datesByPlatform[p] = new Set();
        datesByPlatform[p].add(s.date);
    });
    lines.push('March Snapshots by Platform:');
    Object.entries(platforms).forEach(([k, v]) => {
        lines.push(`  ${k}: ${v} records, dates: ${[...datesByPlatform[k]].sort().join(', ')}`);
    });

    // 2. Check if fetchSnapshots would return March data (it selects all from daily_snapshots)
    const { data: allSnapshots } = await supabase
        .from('daily_snapshots')
        .select('date, platform')
        .order('date', { ascending: false })
        .limit(20);

    lines.push('\nLatest 20 snapshots:');
    (allSnapshots || []).forEach(s => lines.push(`  ${s.date} | platform=${s.platform}`));

    // 3. Check if the TK dashboard is filtering by platform
    // fetchSnapshots() in tiktok.ts does NOT filter by platform - it fetches all
    // But DashboardLayout filters snapshots by selectedAccounts (account IDs)
    // So if March snapshots have account_ids that match TK accounts, they should show

    // Get current TK account IDs
    const { data: tkAccts } = await supabase
        .from('tiktok_accounts')
        .select('id')
        .eq('is_active', true);
    const tkIds = new Set((tkAccts || []).map(a => a.id));

    // Check how many March snapshots belong to TK accounts
    const marchTkCount = (allMarch || []).filter(s => tkIds.has(s.account_id)).length;
    const marchIgCount = (allMarch || []).filter(s => !tkIds.has(s.account_id)).length;
    lines.push(`\nMarch TK snapshots: ${marchTkCount}`);
    lines.push(`March IG snapshots: ${marchIgCount}`);

    // 4. Get all unique dates across ALL snapshots
    const { data: allDates } = await supabase
        .from('daily_snapshots')
        .select('date')
        .order('date', { ascending: true });
    const uniqueDates = [...new Set((allDates || []).map(d => d.date))].sort();
    lines.push(`\nAll unique snapshot dates (${uniqueDates.length}):`);
    uniqueDates.forEach(d => lines.push(`  ${d}`));

    fs.writeFileSync(path.join(__dirname, 'debug_output.txt'), lines.join('\n'), 'utf8');
    process.stdout.write('Done - check scripts/debug_output.txt\n');
}

main().catch(console.error);
