// Script with CORRECT video-level gain calculation
// Run with: node scripts/sync-with-gains.mjs

import fs from 'fs';
import path from 'path';

// Load env vars from .env.local if available
const envPath = path.resolve(process.cwd(), '.env.local');
let env = {};
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) env[match[1].trim()] = match[2].trim();
    });
}

const APIFY_TOKEN = process.env.APIFY_API_TOKEN || env.APIFY_API_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// TikTok accounts to scrape
const TIKTOK_ACCOUNTS = [
    'sydneydiary.zoe', 'lena.artlens', 'rachelllll_0815', 'mia_110510',
    'we2insydney', 'moe_satogo', 'dadventures_au', 'ninimama46',
    'honestmumdiary', 'leoafterhours1', 'getthedog01', 'elliesoftdays',
    'moe.memos', 'avitasun', 'cozlylightdairy', 'the.park.diaries',
    'sydneyscenee', 'oatsandmemories', 'ellierubylife', 'ellieruby5',
    'phoebe_insydney', 'sydneymumma', 'miss.ellenaa', 'chloessweetdiary',
    'layla.eats', 'thekoalas2023', 'xiao.mia.dou', 'austhreemom',
    'laladiary__', 'gilly.studio_', 'thefortunateape', 'littlegreenfrog21',
    'sylvia_in_syd', 'miss_yangz', 'hellobetty_life', 'thatlunafairy',
    'rubyinaustralia', 'sinclair_wellness', 'sydcoffeerun', 'mumisalwaystired',
    'coffeefuelledmum', 'ellenbythecoffee', 'leoafterhours', 'nikkiandlucy_insyd'
];

// Instagram accounts to scrape
const INSTAGRAM_ACCOUNTS = [
    'https://www.instagram.com/its.choletime/',
    'https://www.instagram.com/moe_satogo/',
    'https://www.instagram.com/gowithjessie5/',
    'https://www.instagram.com/chloe709973/',
    'https://www.instagram.com/grace__wilson0/',
    'https://www.instagram.com/ave.artslife/',
    'https://www.instagram.com/daisy18cute/',
    'https://www.instagram.com/hellen_nguyen01/',
    'https://www.instagram.com/ashleighmoments3/',
    'https://www.instagram.com/ellie417600/',
    'https://www.instagram.com/cozylightdairy/',
    'https://www.instagram.com/theparkdiaries/',
    'https://www.instagram.com/ethanellasyd/',
    'https://www.instagram.com/juliettexshaw/',
    'https://www.instagram.com/sydney_mama5/',
    'https://www.instagram.com/kellyanne.k/',
    'https://www.instagram.com/energracie/',
    'https://www.instagram.com/laylaeatss/',
    'https://www.instagram.com/ninimama46/',
    'https://www.instagram.com/aussydmum/',
    'https://www.instagram.com/janesyd01/',
    'https://www.instagram.com/laladiary__/',
    'https://www.instagram.com/leoafterhours/',
    'https://www.instagram.com/kimikocurious/',
    'https://www.instagram.com/helloluna.au/',
    'https://www.instagram.com/rubyymummyy/',
    'https://www.instagram.com/sinclairwellness/',
    'https://www.instagram.com/sydney_coffee_run/',
    'https://www.instagram.com/that_luna_fairy/',
    'https://www.instagram.com/michael.benett/',
    'https://www.instagram.com/ellanotes1/',
    'https://www.instagram.com/sylviainsyd/',
    'https://www.instagram.com/lena.artlens/'
];

async function main() {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
    const yesterday = getYesterdayDate(today);

    console.log('=== Sync with Video-Level Gains ===');
    console.log('Today:', today);
    console.log('Yesterday:', yesterday);

    // Run TikTok scrape
    console.log('\n--- TikTok Scrape ---');
    const tkItems = await runApifyActor('clockworks~tiktok-scraper', {
        profiles: TIKTOK_ACCOUNTS,
        resultsPerPage: 4, // TEST MODE
        profileScrapeSections: ['videos'],
        profileSorting: 'latest'
    });

    if (tkItems && tkItems.length > 0) {
        console.log('Got', tkItems.length, 'TikTok items');
        await processTikTokData(tkItems, today, yesterday);
    }

    // Run Instagram scrape
    console.log('\n--- Instagram Scrape ---');
    const igItems = await runApifyActor('apify~instagram-scraper', {
        directUrls: INSTAGRAM_ACCOUNTS,
        resultsLimit: 4, // TEST MODE
        scrapePosts: true,
        scrapeComments: false,
        resultsType: 'posts',
        searchLimit: 1
    });

    if (igItems && igItems.length > 0) {
        console.log('Got', igItems.length, 'Instagram items');
        await processInstagramData(igItems, today, yesterday);
    }

    console.log('\n=== Sync Complete ===');
}

function getYesterdayDate(todayStr) {
    const d = new Date(todayStr + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
}

async function runApifyActor(actorId, input) {
    console.log('Starting actor:', actorId);

    const startRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    });

    if (!startRes.ok) {
        console.error('Failed to start actor:', await startRes.text());
        return null;
    }

    const runData = await startRes.json();
    const runId = runData.data.id;
    console.log('Run started:', runId);

    // Poll for completion
    const maxWait = 10 * 60 * 1000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
        const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
        const statusData = await statusRes.json();
        const status = statusData.data.status;

        console.log('Status:', status, '(', Math.round((Date.now() - startTime) / 1000), 's)');

        if (status === 'SUCCEEDED') {
            const datasetRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}`);
            return await datasetRes.json();
        } else if (status === 'FAILED' || status === 'ABORTED') {
            console.error('Run failed');
            return null;
        }

        await new Promise(r => setTimeout(r, 10000));
    }

    console.error('Timeout');
    return null;
}

async function supabaseQuery(path, options = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${path}`;
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': options.prefer || 'return=representation'
    };

    const res = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!res.ok) {
        const text = await res.text();
        if (!text.includes('duplicate key')) {
            console.error('Supabase error:', res.status, text.substring(0, 200));
        }
    }

    try {
        return await res.json();
    } catch {
        return null;
    }
}

async function processTikTokData(items, today, yesterday) {
    console.log('Processing TikTok for', today, 'vs', yesterday);

    // Group items by account
    const accountItems = new Map();
    for (const item of items) {
        if (!item.authorMeta) continue;
        const username = item.authorMeta.name;
        if (!accountItems.has(username)) {
            accountItems.set(username, []);
        }
        accountItems.get(username).push(item);
    }

    console.log('Found', accountItems.size, 'accounts');

    for (const [username, videos] of accountItems) {
        // Get or create account
        let accounts = await supabaseQuery(`tiktok_accounts?username=eq.${encodeURIComponent(username)}`);
        let account = accounts?.[0];

        if (!account) {
            const first = videos[0];
            const created = await supabaseQuery('tiktok_accounts', {
                method: 'POST',
                body: {
                    username: first.authorMeta.name,
                    nickname: first.authorMeta.nickName,
                    avatar_url: first.authorMeta.avatar,
                    follower_count: first.authorMeta.fans || 0,
                    last_synced_at: new Date().toISOString()
                }
            });
            account = created?.[0];
        }

        if (!account) continue;

        // Process each video and calculate gains
        let gainViews = 0, gainLikes = 0, gainComments = 0, gainShares = 0;
        let totalViews = 0, totalLikes = 0, totalComments = 0, totalShares = 0;

        for (const item of videos) {
            const videoId = item.id;
            const todayViews = item.playCount || 0;
            const todayLikes = item.diggCount || 0;
            const todayComments = item.commentCount || 0;
            const todayShares = item.shareCount || 0;

            // Update video record
            await supabaseQuery(`tiktok_videos?video_id=eq.${encodeURIComponent(videoId)}`, {
                method: 'PATCH',
                body: {
                    play_count: todayViews,
                    digg_count: todayLikes,
                    comment_count: todayComments,
                    share_count: todayShares,
                    updated_at: new Date().toISOString()
                }
            });

            // Get yesterday's history for THIS VIDEO
            const historyRecords = await supabaseQuery(
                `tiktok_video_history?video_id=eq.${encodeURIComponent(videoId)}&date=eq.${yesterday}`
            );
            const yesterdayHistory = historyRecords?.[0];

            const yesterdayViews = yesterdayHistory?.play_count || 0;
            const yesterdayLikes = yesterdayHistory?.digg_count || 0;
            const yesterdayComments = yesterdayHistory?.comment_count || 0;
            const yesterdayShares = yesterdayHistory?.share_count || 0;

            // Calculate per-video gain (max 0 to avoid negative)
            gainViews += Math.max(0, todayViews - yesterdayViews);
            gainLikes += Math.max(0, todayLikes - yesterdayLikes);
            gainComments += Math.max(0, todayComments - yesterdayComments);
            gainShares += Math.max(0, todayShares - yesterdayShares);

            // Track absolute totals
            totalViews += todayViews;
            totalLikes += todayLikes;
            totalComments += todayComments;
            totalShares += todayShares;

            // Save today's history
            await supabaseQuery(
                `tiktok_video_history?video_id=eq.${encodeURIComponent(videoId)}&date=eq.${today}`,
                { method: 'DELETE' }
            );
            await supabaseQuery('tiktok_video_history', {
                method: 'POST',
                body: {
                    video_id: videoId,
                    account_id: account.id,
                    date: today,
                    play_count: todayViews,
                    digg_count: todayLikes,
                    comment_count: todayComments,
                    share_count: todayShares,
                    created_at: new Date().toISOString()
                }
            });
        }

        console.log(`${username}: gain=${gainViews} views, total=${totalViews} views`);

        // Save snapshot with BOTH absolute totals AND gains
        await supabaseQuery(
            `daily_snapshots?account_id=eq.${account.id}&date=eq.${today}`,
            { method: 'DELETE' }
        );
        await supabaseQuery('daily_snapshots', {
            method: 'POST',
            body: {
                account_id: account.id,
                date: today,
                // Absolute totals (sum of current scraped videos)
                total_views: totalViews,
                total_likes: totalLikes,
                total_comments: totalComments,
                total_shares: totalShares,
                // Per-video gains (sum of differences)
                gain_views: gainViews,
                gain_likes: gainLikes,
                gain_comments: gainComments,
                gain_shares: gainShares,
                video_count: videos.length,
                created_at: new Date().toISOString()
            }
        });
    }

    console.log('TikTok processing complete');
}

async function processInstagramData(items, today, yesterday) {
    console.log('Processing Instagram for', today, 'vs', yesterday);

    // Group by owner
    const accountItems = new Map();
    for (const item of items) {
        if (!item.ownerUsername) continue;
        if (!accountItems.has(item.ownerUsername)) {
            accountItems.set(item.ownerUsername, []);
        }
        accountItems.get(item.ownerUsername).push(item);
    }

    console.log('Found', accountItems.size, 'Instagram accounts');

    for (const [username, posts] of accountItems) {
        let accounts = await supabaseQuery(`instagram_accounts?username=eq.${encodeURIComponent(username)}`);
        let account = accounts?.[0];

        if (!account) {
            const created = await supabaseQuery('instagram_accounts', {
                method: 'POST',
                body: { username, last_synced_at: new Date().toISOString() }
            });
            account = created?.[0];
        }

        if (!account) continue;

        let gainViews = 0, gainLikes = 0, gainComments = 0;
        let totalViews = 0, totalLikes = 0, totalComments = 0;

        for (const item of posts) {
            const reelId = item.id || item.shortCode;
            const todayViews = item.videoPlayCount || item.videoViewCount || 0;
            const todayLikes = item.likesCount || 0;
            const todayComments = item.commentsCount || 0;

            // Update reel
            await supabaseQuery(`instagram_reels?instagram_id=eq.${encodeURIComponent(reelId)}`, {
                method: 'PATCH',
                body: {
                    video_play_count: todayViews,
                    likes_count: todayLikes,
                    comments_count: todayComments,
                    updated_at: new Date().toISOString()
                }
            });

            // Get yesterday's history
            const historyRecords = await supabaseQuery(
                `instagram_reel_history?instagram_id=eq.${encodeURIComponent(reelId)}&date=eq.${yesterday}`
            );
            const yesterdayHistory = historyRecords?.[0];

            const yesterdayViews = yesterdayHistory?.video_play_count || 0;
            const yesterdayLikes = yesterdayHistory?.likes_count || 0;
            const yesterdayComments = yesterdayHistory?.comments_count || 0;

            // Per-video gain
            gainViews += Math.max(0, todayViews - yesterdayViews);
            gainLikes += Math.max(0, todayLikes - yesterdayLikes);
            gainComments += Math.max(0, todayComments - yesterdayComments);

            totalViews += todayViews;
            totalLikes += todayLikes;
            totalComments += todayComments;

            // Save today's history
            await supabaseQuery(
                `instagram_reel_history?instagram_id=eq.${encodeURIComponent(reelId)}&date=eq.${today}`,
                { method: 'DELETE' }
            );
            await supabaseQuery('instagram_reel_history', {
                method: 'POST',
                body: {
                    instagram_id: reelId,
                    account_id: account.id,
                    date: today,
                    video_play_count: todayViews,
                    likes_count: todayLikes,
                    comments_count: todayComments,
                    created_at: new Date().toISOString()
                }
            });
        }

        console.log(`${username}: gain=${gainViews} views, total=${totalViews} views`);

        // Save snapshot
        await supabaseQuery(
            `daily_snapshots?account_id=eq.${account.id}&date=eq.${today}`,
            { method: 'DELETE' }
        );
        await supabaseQuery('daily_snapshots', {
            method: 'POST',
            body: {
                account_id: account.id,
                date: today,
                total_views: totalViews,
                total_likes: totalLikes,
                total_comments: totalComments,
                total_shares: 0,
                gain_views: gainViews,
                gain_likes: gainLikes,
                gain_comments: gainComments,
                gain_shares: 0,
                video_count: posts.length,
                created_at: new Date().toISOString()
            }
        });
    }

    console.log('Instagram processing complete');
}

main().catch(console.error);
