
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
    console.log('Fetching WEBHOOK logs for 2026-02-14...');
    const { data: logs, error } = await supabase
        .from('sync_logs')
        .select('started_at, platform, sync_type')
        .eq('sync_type', 'webhook')
        .gte('started_at', '2026-02-14T00:00:00Z')
        .lt('started_at', '2026-02-15T00:00:00Z')
        .order('started_at', { ascending: true }); // Chronological

    if (error) { console.error('Error:', error); return; }

    logs.forEach(l => {
        console.log(`[${l.started_at}] Platform: ${l.platform}`);
    });
}

checkSyncLogs();
