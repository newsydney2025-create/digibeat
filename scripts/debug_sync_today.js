
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkSyncLogs() {
    console.log('Fetching logs for 2026-02-17/18 (UTC)...');
    // 9am Sydney on Feb 18 is Feb 17 22:00 UTC.
    // Check from Feb 17 20:00 UTC to Feb 18 02:00 UTC (6 hour window)
    const { data: logs, error } = await supabase
        .from('sync_logs')
        .select('*')
        .gte('started_at', '2026-02-17T20:00:00Z')
        .lte('started_at', '2026-02-18T05:00:00Z')
        .order('started_at', { ascending: true });

    if (error) { console.error('Error:', error); return; }

    logs.forEach(l => {
        console.log(`[${l.started_at}] Type: ${l.sync_type} | Platform: ${l.platform} | Status: ${l.status}`);
    });
}

checkSyncLogs();
