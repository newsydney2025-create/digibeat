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
    const { data: allDates } = await supabase
        .from('daily_snapshots')
        .select('date');

    const dates = allDates.map(d => d.date);
    const uniqueDates = [...new Set(dates)].sort();

    // Write just the unique dates to a file
    fs.writeFileSync(path.join(__dirname, 'all_dates_exact.txt'), uniqueDates.join('\n'), 'utf8');
    console.log('Done');
}

main().catch(console.error);
