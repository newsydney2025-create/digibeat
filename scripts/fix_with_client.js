const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://okpanxhoqfzonltvqnvl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcGFueGhvcWZ6b25sdHZxbnZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAxMjQwOCwiZXhwIjoyMDg1NTg4NDA4fQ.jEevVDaPcihauDaGkOiJhQOX-W8-P6YF4RY7hCBrU10';
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
});

async function fix() {
    const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }); // 2026-02-12
    console.log(`Fixing with Client Lib (Start): ${date}`);

    // 1. Get Accounts
    const { data: accounts, error: accError } = await supabase
        .from('tiktok_accounts')
        .select('id, username')
        .ilike('username', '%lightmoments%');

    if (accError) { console.error(accError); return; }
    console.log(`Found ${accounts.length} accounts.`);

    if (accounts.length === 0) return;

    const target = accounts[0];
    console.log(`Target: ${target.username}`);

    // 2. Fetch History
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().split('T')[0];

    const { data: history } = await supabase
        .from('tiktok_video_history')
        .select('*')
        .eq('account_id', target.id)
        .eq('date', date);

    const { data: prevHistory } = await supabase
        .from('tiktok_video_history')
        .select('video_id, play_count, digg_count, comment_count, share_count')
        .eq('account_id', target.id)
        .eq('date', yesterday);

    const prevMap = new Map();
    if (prevHistory) prevHistory.forEach(h => prevMap.set(h.video_id, h));

    // 3. Calc Gains
    let gain_views = 0;
    let gain_likes = 0;
    let gain_comments = 0;
    let gain_shares = 0;
    let total_views = 0;

    for (const h of history) {
        const prev = prevMap.get(h.video_id);
        const g_views = Math.max(0, (h.play_count || 0) - (prev?.play_count || 0));
        const g_likes = Math.max(0, (h.digg_count || 0) - (prev?.digg_count || 0));
        const g_comments = Math.max(0, (h.comment_count || 0) - (prev?.comment_count || 0));
        const g_shares = Math.max(0, (h.share_count || 0) - (prev?.share_count || 0));

        gain_views += g_views;
        gain_likes += g_likes;
        gain_comments += g_comments;
        gain_shares += g_shares;
        total_views += (h.play_count || 0);
    }
    console.log(`Calculated Gains: ${gain_views}`);

    // 4. Update Snapshot
    const payload = {
        account_id: target.id,
        date: date,
        gain_views,
        gain_likes,
        gain_comments,
        gain_shares,
        total_views: total_views,
        updated_at: new Date().toISOString()
    };

    // Upsert
    const { data: updated, error: upError } = await supabase
        .from('daily_snapshots')
        .upsert(payload, { onConflict: 'account_id,date' })
        .select();

    if (upError) {
        console.error('Update Failed:', upError);
    } else {
        console.log('Update Success:', updated);
    }
}

fix();
