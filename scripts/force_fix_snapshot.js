
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcGFueGhvcWZ6b25sdHZxbnZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAxMjQwOCwiZXhwIjoyMDg1NTg4NDA4fQ.jEevVDaPcihauDaGkOiJhQOX-W8-P6YF4RY7hCBrU10';
const baseUrl = 'https://okpanxhoqfzonltvqnvl.supabase.co/rest/v1';

async function fix() {
    const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }); // 2026-02-12
    console.log(`Force fixing ALL ACCOUNTS on ${date} (Upsert Mode)`);

    // 1. Get Accounts (ALL)
    const accRes = await fetch(`${baseUrl}/tiktok_accounts?select=id,username`, {
        headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
    });
    const accounts = await accRes.json();
    console.log(`Found ${accounts.length} accounts.`);

    // NO FILTER - Process ALL
    const targetAccounts = accounts;
    console.log(`Processing all ${targetAccounts.length} accounts...`);

    for (const target of targetAccounts) {
        try {
            console.log(`Processing ${target.username} (${target.id})...`);

            // 2. Fetch History
            const d = new Date(date);
            d.setDate(d.getDate() - 1);
            const yesterday = d.toISOString().split('T')[0];

            const histRes = await fetch(`${baseUrl}/tiktok_video_history?account_id=eq.${target.id}&date=eq.${date}&select=*`, {
                headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
            });
            const history = await histRes.json();

            const prevRes = await fetch(`${baseUrl}/tiktok_video_history?account_id=eq.${target.id}&date=eq.${yesterday}&select=video_id,play_count,digg_count,comment_count,share_count`, {
                headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
            });
            const prevHistory = await prevRes.json();
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

            console.log(`.. Gains: +${gain_views} views`);

            // 4. Update Snapshot
            const snapRes = await fetch(`${baseUrl}/daily_snapshots?account_id=eq.${target.id}&date=eq.${date}&select=id`, {
                headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
            });
            const snaps = await snapRes.json();

            const payload = {
                gain_views,
                gain_likes,
                gain_comments,
                gain_shares,
                total_views: total_views
                // updated_at removed
            };

            if (snaps && snaps.length > 0) {
                // Upsert (POST) with ID to update
                const upsertPayload = {
                    id: snaps[0].id,
                    account_id: target.id,
                    date: date,
                    ...payload
                };

                const res = await fetch(`${baseUrl}/daily_snapshots`, {
                    method: 'POST',
                    headers: {
                        'apikey': key,
                        'Authorization': 'Bearer ' + key,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates'
                    },
                    body: JSON.stringify(upsertPayload)
                });

                if (res.ok) console.log('.. Updated snapshot (200 OK - Upsert).');
                else {
                    console.log(`.. Update FAILED: ${res.status} ${res.statusText}`);
                    const err = await res.text();
                    console.log(err);
                }
            } else {
                await fetch(`${baseUrl}/daily_snapshots`, {
                    method: 'POST',
                    headers: {
                        'apikey': key,
                        'Authorization': 'Bearer ' + key,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({
                        account_id: target.id,
                        date: date,
                        ...payload
                    })
                });
                console.log('.. Inserted snapshot.');
            }

        } catch (err) {
            console.error(`Error processing ${target.username}:`, err);
        }
    }
}

fix();
