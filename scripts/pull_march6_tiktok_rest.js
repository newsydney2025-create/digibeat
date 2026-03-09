const fs = require('fs');
const dotenv = require('dotenv');

// Load env
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

async function sbFetch(path, method, body = null) {
    const opts = {
        method,
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation,resolution=merge-duplicates'
        }
    };
    if (body) opts.body = JSON.stringify(body);
    const url = `${supabaseUrl}/rest/v1/${path}`;

    console.log("Fetching URL:", url);

    const res = await fetch(url, opts);
    if (!res.ok) {
        console.log("=== SUPABASE ERROR ON " + path + " ===");
        console.log("URL:", url);
        console.log(await res.text());
        process.exit(1);
    }
    return res.json();
}

async function processTikTokDataBulk(items, dateStr) {
    console.log(`Processing ${items.length} items for date ${dateStr}...`);

    // Format for DB
    const accountsToUpsert = [];
    const videosToUpsert = [];

    // Add item.id validation
    items.forEach(item => {
        if (!item.id || !item.authorMeta || !item.authorMeta.name) return;

        accountsToUpsert.push({
            username: item.authorMeta.name,
            nickname: item.authorMeta.nickName || '',
            avatar_url: item.authorMeta.avatar || '',
            follower_count: item.authorMeta.fans || 0,
            following_count: item.authorMeta.following || 0,
            heart_count: item.authorMeta.heart || 0,
            video_count: item.authorMeta.video || 0,
            signature: item.authorMeta.signature || '',
            last_synced_at: new Date().toISOString()
        });

        const videoId = String(item.id);
        videosToUpsert.push({
            video_id: videoId,
            username: item.authorMeta.name,
            description: item.text || '',
            create_time: item.createTime ? new Date(item.createTime * 1000).toISOString() : null,
            play_count: item.playCount || 0,
            digg_count: item.diggCount || 0,
            comment_count: item.commentCount || 0,
            share_count: item.shareCount || 0,
            cover_url: item.covers && item.covers.default ? item.covers.default : null,
            duration: item.videoMeta && item.videoMeta.duration ? item.videoMeta.duration : 0
        });
    });

    const uniqueAccounts = Array.from(new Map(accountsToUpsert.map(item => [item.username, item])).values());
    console.log(`Unique TikTok accounts to upsert: ${uniqueAccounts.length}`);

    // Upsert accounts via REST (return representation gets the IDs back)
    const accountsData = await sbFetch('tiktok_accounts?on_conflict=username&select=id,username', 'POST', uniqueAccounts);

    const accountIdMap = new Map();
    accountsData.forEach(row => accountIdMap.set(row.username, row.id));

    const uniqueVideos = Array.from(new Map(videosToUpsert.map(item => [item.video_id, item])).values());
    uniqueVideos.forEach(v => { v.account_id = accountIdMap.get(v.username); });

    const videosWithAccounts = uniqueVideos.filter(v => v.account_id);
    console.log(`Unique videos to upsert: ${videosWithAccounts.length}`);

    // Clean videos before sending
    const cleanVideos = videosWithAccounts.map(({ username, ...rest }) => rest);

    // Upsert videos
    for (let i = 0; i < cleanVideos.length; i += 500) {
        await sbFetch('tiktok_videos?on_conflict=video_id', 'POST', cleanVideos.slice(i, i + 500));
    }

    const d = new Date(`${dateStr}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    const yesterdayDateStr = d.toISOString().split('T')[0];

    console.log(`Target date: ${dateStr}, Yesterday date: ${yesterdayDateStr}`);

    const yesterdayHist = await sbFetch(`tiktok_video_history?date=eq.${yesterdayDateStr}&select=*`, 'GET');
    const historyMap = new Map();
    (yesterdayHist || []).forEach(h => historyMap.set(h.video_id, h));

    const historyToUpsert = [];
    const snapshotMap = new Map();

    videosWithAccounts.forEach(v => {
        const hist = historyMap.get(v.video_id);
        let gViews = 0, gLikes = 0, gComments = 0, gShares = 0;

        if (hist) {
            gViews = Math.max(0, (v.play_count || 0) - (hist.play_count || 0));
            gLikes = Math.max(0, (v.digg_count || 0) - (hist.digg_count || 0));
            gComments = Math.max(0, (v.comment_count || 0) - (hist.comment_count || 0));
            gShares = Math.max(0, (v.share_count || 0) - (hist.share_count || 0));
        } else {
            const createTime = new Date(v.create_time || 0);
            const isNewVideo = createTime >= new Date(yesterdayDateStr);
            if (isNewVideo) {
                gViews = v.play_count || 0;
                gLikes = v.digg_count || 0;
                gComments = v.comment_count || 0;
                gShares = v.share_count || 0;
            }
        }

        historyToUpsert.push({
            video_id: v.video_id,
            account_id: v.account_id,
            date: dateStr,
            play_count: v.play_count,
            digg_count: v.digg_count,
            comment_count: v.comment_count,
            share_count: v.share_count
        });

        if (!snapshotMap.has(v.account_id)) {
            snapshotMap.set(v.account_id, {
                gain_views: 0, gain_likes: 0, gain_comments: 0, gain_shares: 0,
                total_views: 0, total_likes: 0, total_comments: 0, total_shares: 0,
                video_count: 0
            });
        }

        const snap = snapshotMap.get(v.account_id);
        snap.gain_views += gViews;
        snap.gain_likes += gLikes;
        snap.gain_comments += gComments;
        snap.gain_shares += gShares;

        snap.total_views += v.play_count;
        snap.total_likes += v.digg_count;
        snap.total_comments += v.comment_count;
        snap.total_shares += v.share_count;
        snap.video_count += 1;
    });

    console.log(`History to push: ${historyToUpsert.length}`);
    for (let i = 0; i < historyToUpsert.length; i += 500) {
        await sbFetch('tiktok_video_history?on_conflict=video_id,date', 'POST', historyToUpsert.slice(i, i + 500));
    }

    const snapsToUpsert = [];
    for (const [account_id, data] of snapshotMap.entries()) {
        snapsToUpsert.push({ account_id, date: dateStr, ...data });
    }

    console.log(`Snapshots to push: ${snapsToUpsert.length}`);
    await sbFetch('daily_snapshots?on_conflict=account_id,date', 'POST', snapsToUpsert);

    console.log("Database updated successfully!");
}

async function run() {
    console.log("Starting missing days manual import...");
    const missingDays = [
        { date: '2026-03-06', dsId: '2lOakuLpS1qwUaqjn' },
        { date: '2026-03-07', dsId: '2YVz9heeZZwwOAc1x' },
        { date: '2026-03-08', dsId: 'hXtGcUOfwoMLEVrEZ' }
    ];

    for (const { date, dsId } of missingDays) {
        console.log(`\n============================`);
        console.log(`Fetching dataset ${dsId} for ${date}`);
        const res = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${APIFY_TOKEN}`);
        const items = await res.json();

        console.log(`Got ${items.length} items from dataset. Processing...`);
        await processTikTokDataBulk(items, date);
    }
}

run();
