
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://okpanxhoqfzonltvqnvl.supabase.co';
// Service Role
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcGFueGhvcWZ6b25sdHZxbnZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAxMjQwOCwiZXhwIjoyMDg1NTg4NDA4fQ.jEevVDaPcihauDaGkOiJhQOX-W8-P6YF4RY7hCBrU10';
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
});

async function debug() {
    const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }); // 2026-02-12
    console.log(`Debugging joyfulsydney on ${date}`);

    // 1. Get Account
    const { data: accounts } = await supabase
        .from('tiktok_accounts')
        .select('id, username')
        .ilike('username', '%joyfulsydney%');

    if (!accounts || accounts.length === 0) { console.log('Account not found'); return; }
    const target = accounts[0];
    console.log(`Account: ${target.username} (${target.id})`);

    // 2. Get Snapshot
    const { data: snaps } = await supabase
        .from('daily_snapshots')
        .select('*')
        .eq('account_id', target.id)
        .eq('date', date);

    const snapshot_views = snaps?.[0]?.gain_views || 0;
    console.log(`!!! SNAPSHOT VALUE: ${snapshot_views} !!!`);

    // 3. Get Video History
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().split('T')[0];

    const { data: history } = await supabase
        .from('tiktok_video_history')
        .select('video_id, play_count')
        .eq('account_id', target.id)
        .eq('date', date);

    const { data: prevHistory } = await supabase
        .from('tiktok_video_history')
        .select('video_id, play_count')
        .eq('account_id', target.id)
        .eq('date', yesterday);

    const prevMap = new Map();
    if (prevHistory) prevHistory.forEach(h => prevMap.set(h.video_id, h));

    let sum = 0;
    // console.log('\nDetailed Video Gains:'); 
    // Disable detailed log to prevent truncation of SNAPSHOT VALUE if large
    if (history) {
        history.forEach(h => {
            const prev = prevMap.get(h.video_id);
            const gain = Math.max(0, (h.play_count || 0) - (prev?.play_count || 0));
            sum += gain;
            // if (gain > 0) {
            // console.log(`Video ID: ${h.video_id} | Gain: +${gain}`);
            // }
        });
    }
    console.log(`\nSum of Detailed Gains: ${sum}`);

    if (sum === snapshot_views) console.log('MATCHED');
    else console.log('MISMATCH');
}

debug();
