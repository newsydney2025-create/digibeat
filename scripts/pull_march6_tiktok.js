const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) process.env[k] = envConfig[k];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase credentials not found in .env.local');
}

// We use the service role key to bypass RLS in this CLI script
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Based on the user's screenshot, the 6th of March TikTok Scrape finished with 782 items.
// We'll fetch the Apify dataset using the Apify API token.
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

// We will use the exact dataset ID found for March 6: hXtGcUOfwoMLEVrEZ
async function run() {
    console.log("Using dataset hXtGcUOfwoMLEVrEZ for March 6...");
    const dsId = 'hXtGcUOfwoMLEVrEZ';

    console.log("Fetching dataset " + dsId);
    const res = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${APIFY_TOKEN}`);
    const items = await res.json();

    console.log(`Got ${items.length} items from dataset. Processing...`);
    await processTikTokDataBulk(items, '2026-03-06');
}

run();

// Minimal port of sync logic for TikTok
async function processTikTokDataBulk(items, dateStr) {
    console.log(`Processing ${items.length} items for date ${dateStr}...`);

    // Format for DB
    const accountsToUpsert = [];
    const videosToUpsert = [];

    items.forEach(item => {
        if (!item.authorMeta || !item.authorMeta.name) return;

        accountsToUpsert.push({
            username: item.authorMeta.name,
            nickname: item.authorMeta.nickName || '',
            avatar_url: item.authorMeta.avatar || '',
            follower_count: item.authorMeta.fans || 0,
            following_count: item.authorMeta.following || 0,
            heart_count: item.authorMeta.heart || 0,
            video_count: item.authorMeta.video || 0,
            is_verified: item.authorMeta.verified || false,
            platform: 'tiktok',
            sec_uid: item.authorMeta.secUid || null
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

    // We deduplicate accounts
    const uniqueAccounts = Array.from(new Map(accountsToUpsert.map(item => [item.username, item])).values());
    console.log(`Unique TikTok accounts to upsert: ${uniqueAccounts.length}`);

    // Upsert accounts
    const { data: accountsData, error: accError } = await supabase
        .from('tiktok_accounts')
        .upsert(uniqueAccounts, { onConflict: 'username' })
        .select('id, username');

    if (accError) {
        console.error("Account upsert error:", accError);
        return;
    }

    const accountIdMap = new Map();
    accountsData.forEach(row => accountIdMap.set(row.username, row.id));

    // Dedup videos
    const uniqueVideos = Array.from(new Map(videosToUpsert.map(item => [item.video_id, item])).values());

    // Add account_ids to videos
    uniqueVideos.forEach(v => {
        v.account_id = accountIdMap.get(v.username);
    });

    const videosWithAccounts = uniqueVideos.filter(v => v.account_id);
    console.log(`Unique videos to upsert: ${videosWithAccounts.length}`);

    // Upsert videos
    for (let i = 0; i < videosWithAccounts.length; i += 500) {
        const chunk = videosWithAccounts.slice(i, i + 500);
        const { error: vidError } = await supabase
            .from('tiktok_videos')
            .upsert(chunk, { onConflict: 'video_id' });
        if (vidError) console.error("Video upsert error:", vidError);
    }

    // NOW FOR HISTORY AND SNAPSHOTS
    // We recreate processTikTokDataBulk historical logic.
    // 1. Fetch yesterday's history
    const d = new Date(`${dateStr}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    const yesterdayDateStr = d.toISOString().split('T')[0];

    console.log(`Target date: ${dateStr}, Yesterday date: ${yesterdayDateStr}`);

    const { data: yesterdayHist, error: yErr } = await supabase
        .from('tiktok_video_history')
        .select('*')
        .eq('date', yesterdayDateStr);

    if (yErr) console.error("Yest hist error:", yErr);

    const historyMap = new Map();
    (yesterdayHist || []).forEach(h => historyMap.set(h.video_id, h));

    const historyToUpsert = [];
    const snapshotMap = new Map(); // account_id -> { gains/totals }

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
        const chunk = historyToUpsert.slice(i, i + 500);
        await supabase.from('tiktok_video_history').upsert(chunk, { onConflict: 'video_id,date' });
    }

    const snapsToUpsert = [];
    for (const [account_id, data] of snapshotMap.entries()) {
        snapsToUpsert.push({
            account_id,
            date: dateStr,
            ...data
        });
    }

    console.log(`Snapshots to push: ${snapsToUpsert.length}`);
    const { error: snapErr } = await supabase.from('daily_snapshots').upsert(snapsToUpsert, { onConflict: 'account_id,date' });
    if (snapErr) console.error("Snap err:", snapErr);

    console.log("Done successfully!");
}

async function run() {
    console.log("Looking for March 6 dataset...");
    const dsId = await getDatasetIdForDate('2026-03-06');
    if (!dsId) {
        console.error("Could not find run for March 6.");
        return;
    }

    console.log("Fetching dataset " + dsId);
    const res = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${APIFY_TOKEN}`);
    const items = await res.json();

    console.log(`Got ${items.length} items from dataset. Processing...`);
    await processTikTokDataBulk(items, '2026-03-06');
}

run();
