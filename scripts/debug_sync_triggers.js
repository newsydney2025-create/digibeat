
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
    console.log('Fetching TRIGGER logs (cron/manual)...');
    const { data: logs, error } = await supabase
        .from('sync_logs')
        .select('id, started_at, sync_type')
        .in('sync_type', ['cron', 'manual'])
        .order('started_at', { ascending: false })
        .limit(20);

    if (error) { console.error('Error:', error); return; }

    logs.forEach(l => {
        console.log(`TIME: ${l.started_at} | TYPE: ${l.sync_type}`);
    });
}

checkSyncLogs();
