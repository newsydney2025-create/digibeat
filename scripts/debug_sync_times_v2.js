
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
    process.stdout.write('Logs 2026-02-12: ');
    const { data: logs, error } = await supabase
        .from('sync_logs')
        .select('started_at, platform, sync_type')
        .eq('sync_type', 'webhook')
        .gte('started_at', '2026-02-12T00:00:00Z')
        .lt('started_at', '2026-02-13T00:00:00Z')
        .order('started_at', { ascending: true });

    if (error) { console.error('Error:', error); return; }

    // Group by hour
    const hours = {};
    logs.forEach(l => {
        const h = l.started_at.substring(11, 13); // Extract HH
        hours[h] = (hours[h] || 0) + 1;
    });
    console.log(JSON.stringify(hours));
}

checkSyncLogs();
