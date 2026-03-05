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

    // Simulate exact fetchSnapshots() query
    const { data: snapshots, error } = await supabase
        .from('daily_snapshots')
        .select('*')
        .order('date', { ascending: true })
        .limit(10000);

    lines.push(`Total snapshots fetched: ${snapshots.length}`);
    if (error) lines.push(`Error: ${JSON.stringify(error)}`);

    // Get unique dates
    const uniqueDates = [...new Set(snapshots.map(s => s.date))].sort();
    lines.push(`\nUnique dates fetched (${uniqueDates.length}):`);
    uniqueDates.forEach(d => lines.push(`  ${d}`));

    // Find the absolute latest date using the DashboardLayout logic
    const latestDate = snapshots.length > 0
        ? snapshots.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b).date
        : null;

    lines.push(`\nCalculated latestDate: ${latestDate}`);

    fs.writeFileSync(path.join(__dirname, 'sim_output_clean.txt'), lines.join('\n'), 'utf8');
    console.log('Done');
}

main().catch(console.error);
