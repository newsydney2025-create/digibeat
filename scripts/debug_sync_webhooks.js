
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
    console.log('Fetching WEBHOOK logs and grouping by day...');
    const { data: logs, error } = await supabase
        .from('sync_logs')
        .select('started_at, sync_type')
        .eq('sync_type', 'webhook')
        .order('started_at', { ascending: false })
        .limit(100);

    if (error) { console.error('Error:', error); return; }

    const counts = {};
    logs.forEach(l => {
        const date = l.started_at.split('T')[0];
        counts[date] = (counts[date] || 0) + 1;
    });

    console.table(counts);
}

checkSyncLogs();
