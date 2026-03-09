const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcGFueGhvcWZ6b25sdHZxbnZsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAxMjQwOCwiZXhwIjoyMDg1NTg4NDA4fQ.jEevVDaPcihauDaGkOiJhQOX-W8-P6YF4RY7hCBrU10';
const baseUrl = 'https://okpanxhoqfzonltvqnvl.supabase.co/rest/v1';

async function fetchAll(url) {
    let allData = [];
    let page = 0;
    while (true) {
        const joiner = url.includes('?') ? '&' : '?';
        const res = await fetch(`${url}${joiner}limit=1000&offset=${page * 1000}`, {
            headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
        });
        const data = await res.json();
        if (data && data.error) {
            console.error("API Error fetching", url, data);
            break;
        }
        if (!Array.isArray(data) || data.length === 0) break;
        allData = allData.concat(data);
        page++;
    }
    return allData;
}

async function fixPlatform(platform) {
    console.log(`\n=== Fixing historical snapshots for ${platform.toUpperCase()} ===`);
    const historyTable = platform === 'tiktok' ? 'tiktok_video_history' : 'instagram_reel_history';
    const videosTable = platform === 'tiktok' ? 'tiktok_videos' : 'instagram_reels';
    const histIdField = platform === 'tiktok' ? 'video_id' : 'reel_id';
    const vidIdField = platform === 'tiktok' ? 'video_id' : 'reel_id';
    const createTimeField = platform === 'tiktok' ? 'create_time' : 'timestamp';
    const playField = platform === 'tiktok' ? 'play_count' : 'video_play_count';

    // 1. Get all daily snapshots for accounts of this platform
    const accountsRes = await fetchAll(`${baseUrl}/${platform}_accounts?select=id`);
    const accountIds = new Set(accountsRes.map(a => a.id));
    if (accountIds.size === 0) {
        console.log(`No accounts found for ${platform}`);
        return;
    }

    const snaps = await fetchAll(`${baseUrl}/daily_snapshots?select=date,account_id,id`);
    const platformSnaps = snaps.filter(s => accountIds.has(s.account_id));

    // Group by date
    const dates = [...new Set(platformSnaps.map(s => s.date))].sort();
    console.log(`Found ${dates.length} distinct dates to process...`);

    // 2. Get all videos create_time
    const videos = await fetchAll(`${baseUrl}/${videosTable}?select=${vidIdField},${createTimeField}`);
    const videoMap = new Map();
    videos.forEach(v => videoMap.set(v[vidIdField], v[createTimeField]));

    // 3. Process each date
    for (const dStr of dates) {
        process.stdout.write(`Processing date ${dStr}... `);

        const d = new Date(dStr);
        d.setDate(d.getDate() - 1);
        const yesterdayStr = d.toISOString().split('T')[0];

        // fetch history for this date
        const history = await fetchAll(`${baseUrl}/${historyTable}?date=eq.${dStr}&select=*`);

        // fetch history for yesterday
        let selectStr = '';
        if (platform === 'tiktok') {
            selectStr = 'video_id,play_count,digg_count,comment_count,share_count';
        } else {
            selectStr = 'reel_id,video_play_count,likes_count,comments_count';
        }
        const prevHistory = await fetchAll(`${baseUrl}/${historyTable}?date=eq.${yesterdayStr}&select=${selectStr}`);

        const prevMap = new Map();
        prevHistory.forEach(h => prevMap.set(h[histIdField], h));

        const accountHistory = new Map();
        history.forEach(h => {
            if (!accountHistory.has(h.account_id)) accountHistory.set(h.account_id, []);
            accountHistory.get(h.account_id).push(h);
        });

        const dateSnaps = platformSnaps.filter(s => s.date === dStr);
        let updatedCount = 0;

        for (const snap of dateSnaps) {
            const accHistory = accountHistory.get(snap.account_id) || [];

            let gain_views = 0, gain_likes = 0, gain_comments = 0, gain_shares = 0;
            let total_views = 0, total_likes = 0, total_comments = 0, total_shares = 0;
            let video_count = accHistory.length;

            for (const h of accHistory) {
                const prev = prevMap.get(h[histIdField]);

                let g_views = 0, g_likes = 0, g_comments = 0, g_shares = 0;
                const h_views = h[playField] || 0;
                const h_likes = (platform === 'tiktok' ? h.digg_count : h.likes_count) || 0;
                const h_comments = h.comment_count || 0;
                const h_shares = h.share_count || 0;

                if (prev) {
                    const p_views = prev[playField] || 0;
                    const p_likes = (platform === 'tiktok' ? prev.digg_count : prev.likes_count) || 0;
                    const p_comments = prev.comment_count || 0;
                    const p_shares = prev.share_count || 0;

                    g_views = Math.max(0, h_views - p_views);
                    g_likes = Math.max(0, h_likes - p_likes);
                    g_comments = Math.max(0, h_comments - p_comments);
                    g_shares = Math.max(0, h_shares - p_shares);
                } else {
                    const createTimeStr = videoMap.get(h[histIdField]);
                    const createTime = new Date(createTimeStr || 0);
                    const isNewVideo = createTime >= new Date(yesterdayStr);

                    if (isNewVideo) {
                        g_views = h_views;
                        g_likes = h_likes;
                        g_comments = h_comments;
                        g_shares = h_shares;
                    }
                    // else gains stay 0 
                }

                gain_views += g_views;
                gain_likes += g_likes;
                gain_comments += g_comments;
                gain_shares += g_shares;
                total_views += h_views;
                total_likes += h_likes;
                total_comments += h_comments;
                total_shares += h_shares;
            }

            // update snap
            await fetch(`${baseUrl}/daily_snapshots?id=eq.${snap.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': key,
                    'Authorization': 'Bearer ' + key,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    gain_views, gain_likes, gain_comments, gain_shares,
                    total_views, total_likes, total_comments, total_shares,
                    video_count
                })
            });
            updatedCount++;
        }
        console.log(`Updated ${updatedCount} snapshots.`);
    }
}

async function run() {
    try {
        await fixPlatform('tiktok');
        await fixPlatform('instagram');
        console.log("\nDone recalculating all snapshots!");
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
