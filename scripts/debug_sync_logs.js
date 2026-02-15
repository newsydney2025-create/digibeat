
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

// Use Service Role to read logs potentially
const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkSyncLogs() {
    console.log('Fetching last 20 sync logs...');
    const { data: logs, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.table(logs.map(l => ({
        id: l.id,
        type: l.sync_type,
        status: l.status,
        started: new Date(l.started_at).toLocaleString(),
        completed: l.completed_at ? new Date(l.completed_at).toLocaleString() : 'N/A',
        error: l.error_message ? l.error_message.substring(0, 50) : ''
    })));
}

checkSyncLogs();
