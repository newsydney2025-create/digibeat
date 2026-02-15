
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcGFueGhvcWZ6b25sdHZxbnZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAxMjQwOCwiZXhwIjoyMDg1NTg4NDA4fQ.jEevVDaPcihauDaGkOiJhQOX-W8-P6YF4RY7hCBrU10';
const baseUrl = 'https://okpanxhoqfzonltvqnvl.supabase.co/rest/v1';

async function fix() {
    const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }); // 2026-02-12
    console.log(`Fixing snapshots for date: ${date}`);

    // 1. Fetch Accounts
    const accRes = await fetch(`${baseUrl}/tiktok_accounts?select=id,username`, {
        headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
    });
    const accounts = await accRes.json();

    for (const account of accounts) {
        console.log(`Processing ${account.username}...`);

        // 2. Fetch History for Today
        const histRes = await fetch(`${baseUrl}/tiktok_video_history?account_id=eq.${account.id}&date=eq.${date}&select=*`, {
            headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
        });
        const history = await histRes.json();

        if (!history || history.length === 0) {
            console.log(`.. No history for today.`);
            continue;
        }

        // 3. Fetch History for Yesterday (to calc gains)
        const d = new Date(date);
        d.setDate(d.getDate() - 1);
        const yesterday = d.toISOString().split('T')[0];

        const prevHistRes = await fetch(`${baseUrl}/tiktok_video_history?account_id=eq.${account.id}&date=eq.${yesterday}&select=*`, {
            headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
        });
        const prevHistory = await prevHistRes.json();
        const prevMap = new Map();
        prevHistory.forEach(h => prevMap.set(h.video_id, h));

        // 4. Calculate Gains
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

        console.log(`.. Gains: +${gain_views} views`);

        // 5. Update Snapshot
        // Check if snapshot exists
        const snapRes = await fetch(`${baseUrl}/daily_snapshots?account_id=eq.${account.id}&date=eq.${date}&select=id`, {
            headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
        });
        const snaps = await snapRes.json();

        const payload = {
            gain_views,
            gain_likes,
            gain_comments,
            gain_shares,
            total_followers: account.follower_count || 0, // Fallback
            total_views: total_views, // Roughly
            updated_at: new Date().toISOString()
        };

        if (snaps && snaps.length > 0) {
            // Update
            await fetch(`${baseUrl}/daily_snapshots?id=eq.${snaps[0].id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': key,
                    'Authorization': 'Bearer ' + key,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(payload)
            });
            console.log(`.. Updated snapshot.`);
        } else {
            // Insert (unlikely if user sees data, but possible)
            await fetch(`${baseUrl}/daily_snapshots`, {
                method: 'POST',
                headers: {
                    'apikey': key,
                    'Authorization': 'Bearer ' + key,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    account_id: account.id,
                    date: date,
                    ...payload
                })
            });
            console.log(`.. Inserted snapshot.`);
        }
    }
    console.log('Finished fixing snapshots.');
}

fix();
