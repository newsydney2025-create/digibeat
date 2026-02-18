
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
    process.stdout.write('Logs 17/18 UTC: \n');
    const { data: logs, error } = await supabase
        .from('sync_logs')
        .select('started_at, sync_type, platform')
        .gte('started_at', '2026-02-17T20:00:00Z')
        .lte('started_at', '2026-02-18T05:00:00Z')
        .order('started_at', { ascending: true });

    if (error) { console.error('Error:', error); return; }

    logs.forEach(l => {
        // Format: HH:MM type platform
        const time = l.started_at.split('T')[1].substring(0, 5);
        process.stdout.write(`${time} ${l.sync_type} ${l.platform}\n`);
    });
}

checkSyncLogs();
