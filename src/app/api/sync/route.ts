import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TikTokVideo, InstagramReel } from '@/types/database'
import { SCRAPING_TARGETS } from '@/config/scraping_targets'

// --- Types ---

interface ApifyTikTokData {
    id: string
    text: string
    createTime: number
    createTimeISO: string
    isAd: boolean
    authorMeta: {
        id: string
        name: string
        profileUrl: string
        nickName: string
        verified: boolean
        signature: string
        avatar: string
        fans: number
        following: number
        heart: number
        video: number
    }
    webVideoUrl: string
    diggCount: number
    shareCount: number
    playCount: number
    collectCount: number
    commentCount: number
    hashtags: { name: string }[]
    musicMeta?: {
        musicName: string
        musicAuthor: string
    }
    videoMeta?: {
        duration: number
        coverUrl: string
    }
    isPinned: boolean
}

// Data shape when scraping profiles
interface ApifyInstagramProfile {
    id: string
    username: string
    fullName?: string
    biography?: string
    externalUrl?: string
    profilePicUrl?: string
    followersCount?: number
    followsCount?: number
    highlightReelCount?: number
    postsCount?: number
    isPrivate?: boolean
    isVerified?: boolean
}

interface ApifyInstagramData {
    id: string
    type: string
    shortCode: string
    caption: string
    hashtags: string[]
    mentions: string[]
    url: string
    commentsCount: number
    firstComment: string
    latestComments: any[]
    dimensionsHeight: number
    dimensionsWidth: number
    displayUrl: string
    images: any[]
    videoUrl?: string
    alt: string | null
    likesCount: number
    videoViewCount?: number
    timestamp: string
    childPosts: any[]
    ownerId: string
    productType: string
    videoPlayCount?: number // Often present in reel data
    ownerUsername: string
}

// --- Main Handler ---

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        // Default to all platforms and daily snapshot generation
        const { platform = 'all', is_daily = true } = body as { platform?: 'tiktok' | 'instagram' | 'all', is_daily?: boolean }

        const apiToken = process.env.APIFY_API_TOKEN
        if (!apiToken) {
            return NextResponse.json({ error: 'APIFY_API_TOKEN not configured' }, { status: 500 })
        }

        const supabase = await createClient()
        const results = {
            tiktok: { processed: 0, snapshots: 0 },
            instagram: { processed: 0, snapshots: 0 },
            errors: [] as string[]
        }

        // --- TikTok Sync ---
        if (platform === 'all' || platform === 'tiktok') {
            if (SCRAPING_TARGETS.tiktok.length > 0) {
                try {
                    const tkResults = await runTikTokSync(supabase, apiToken, SCRAPING_TARGETS.tiktok, is_daily)
                    results.tiktok = tkResults
                } catch (e) {
                    console.error('TikTok sync failed:', e)
                    results.errors.push(`TikTok: ${e instanceof Error ? e.message : String(e)}`)
                }
            } else {
                console.log('No TikTok targets configured, skipping.')
            }
        }

        // --- Instagram Sync ---
        if (platform === 'all' || platform === 'instagram') {
            if (SCRAPING_TARGETS.instagram.length > 0) {
                try {
                    const igResults = await runInstagramSync(supabase, apiToken, SCRAPING_TARGETS.instagram, is_daily)
                    results.instagram = igResults
                } catch (e) {
                    console.error('Instagram sync failed:', e)
                    results.errors.push(`Instagram: ${e instanceof Error ? e.message : String(e)}`)
                }
            } else {
                console.log('No Instagram targets configured, skipping.')
            }
        }

        return NextResponse.json({
            success: true,
            results
        })

    } catch (error) {
        console.error('Sync error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}

export async function GET() {
    return NextResponse.json({
        message: 'Sync API',
        targets: SCRAPING_TARGETS,
        usage: 'POST /api/sync { "platform": "tiktok" | "instagram" | "all" }'
    })
}

// --- Helpers ---

async function runTikTokSync(supabase: any, apiToken: string, profiles: string[], isDaily: boolean) {
    // Start Actor
    const runResponse = await fetch(
        `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/runs?token=${apiToken}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                profiles: profiles,
                resultsPerPage: 20, // PRODUCTION LIMIT: 20 videos per account
                profileScrapeSections: ['videos'],
                profileSorting: 'latest',
            }),
        }
    )

    if (!runResponse.ok) throw new Error(`Apify start failed: ${await runResponse.text()}`)
    const runData = await runResponse.json()
    const runId = runData.data.id

    await waitForRun(runId, apiToken)

    const datasetResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apiToken}`)
    const items: ApifyTikTokData[] = await datasetResponse.json()

    let processed = 0
    const accountVideosMap = new Map<string, TikTokVideo[]>()
    // const accountIdMap = new Map<string, string>()

    for (const item of items) {
        if (!item.authorMeta) {
            console.warn(`Skipping item ${item.id}: Missing authorMeta`)
            continue
        }
        const { data: account } = await supabase
            .from('tiktok_accounts')
            .upsert({
                username: item.authorMeta.name,
                nickname: item.authorMeta.nickName,
                avatar_url: item.authorMeta.avatar,
                follower_count: item.authorMeta.fans || 0,
                following_count: item.authorMeta.following || 0,
                heart_count: item.authorMeta.heart || 0,
                video_count: item.authorMeta.video || 0,
                signature: item.authorMeta.signature,
                last_synced_at: new Date().toISOString(),
                // TikTok often does not expose the bio link in basic scraping, 
                // but if we had it, we'd map it here.
            }, { onConflict: 'username' })
            .select()
            .single()

        if (account) {
            // accountIdMap.set(account.username, account.id)
            const { data: video } = await supabase.from('tiktok_videos').upsert({
                video_id: item.id,
                account_id: account.id,
                description: item.text,
                play_count: item.playCount || 0,
                digg_count: item.diggCount || 0,
                comment_count: item.commentCount || 0,
                share_count: item.shareCount || 0,
                collect_count: item.collectCount || 0,
                duration: item.videoMeta?.duration || 0,
                cover_url: item.videoMeta?.coverUrl,
                web_video_url: item.webVideoUrl,
                hashtags: item.hashtags?.map((h) => h.name) || [],
                music_name: item.musicMeta?.musicName,
                music_author: item.musicMeta?.musicAuthor,
                create_time: item.createTimeISO,
                is_ad: item.isAd || false,
                is_pinned: item.isPinned || false,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'video_id' }).select().single()

            if (video) {
                if (!accountVideosMap.has(account.id)) accountVideosMap.set(account.id, [])
                accountVideosMap.get(account.id)?.push(video)
                processed++

                // Insert into history table if daily sync
                if (isDaily) {
                    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
                    await supabase.from('tiktok_video_history').upsert({
                        video_id: video.video_id,
                        account_id: account.id,
                        date: today,
                        play_count: video.play_count,
                        digg_count: video.digg_count,
                        comment_count: video.comment_count,
                        share_count: video.share_count,
                        created_at: new Date().toISOString()
                    }, { onConflict: 'video_id, date' })
                }
            }
        }
    }

    let snapshots = 0
    if (isDaily) {
        snapshots = await generateSnapshots(supabase, accountVideosMap, 'tiktok')
    }

    return { processed, snapshots }
}

async function runInstagramSync(supabase: any, apiToken: string, profiles: string[], isDaily: boolean) {
    // Stage 1: Scrape Profiles (to get website/bio link)
    // We use a separate run configured to fetch details.

    // Update: Using directUrls as configured in scraping_targets.ts
    console.log('Starting Instagram Profile Scrape...')
    const profileRunRef = await fetch(
        `https://api.apify.com/v2/acts/apify~instagram-scraper/runs?token=${apiToken}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                directUrls: profiles, // Changed from usernames to directUrls
                resultsType: 'details',
                searchLimit: 1,
            }),
        }
    )

    if (profileRunRef.ok) {
        const pData = await profileRunRef.json()
        const pRunId = pData.data.id
        await waitForRun(pRunId, apiToken)

        const pRes = await fetch(`https://api.apify.com/v2/actor-runs/${pRunId}/dataset/items?token=${apiToken}`)
        const profileItems: ApifyInstagramProfile[] = await pRes.json()

        // Update Accounts
        for (const p of profileItems) {
            if (!p.username) continue
            await supabase.from('instagram_accounts').upsert({
                username: p.username,
                instagram_id: p.id,
                full_name: p.fullName,
                avatar_url: p.profilePicUrl,
                website: p.externalUrl, // Map the website link
                last_synced_at: new Date().toISOString(),
            }, { onConflict: 'username' })
        }
    } else {
        console.error('Failed to start profile scrape', await profileRunRef.text())
    }

    // Stage 2: Scrape Posts (to get reels)
    console.log('Starting Instagram Posts Scrape...')
    const postRunRef = await fetch(
        `https://api.apify.com/v2/acts/apify~instagram-scraper/runs?token=${apiToken}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                directUrls: profiles, // Changed from usernames to directUrls
                // DYNAMIC LIMIT: User confirmed resultsLimit is PER ACCOUNT.
                // So we set it to flat 20 instead of multiplying.
                resultsLimit: 20, // PRODUCTION MODE: 20 videos per account
                scrapePosts: true,
                scrapeComments: false, // EXPLICITLY DISABLE COMMENTS
                resultsType: 'posts', // Changed back to 'posts' to match user's correct sample
                searchLimit: 1,
            }),
        }
    )

    if (!postRunRef.ok) throw new Error(`Apify IG posts start failed: ${await postRunRef.text()}`)
    const runData = await postRunRef.json()
    const runId = runData.data.id

    await waitForRun(runId, apiToken)

    const datasetResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apiToken}`)
    const items: ApifyInstagramData[] = await datasetResponse.json()

    let processed = 0
    const accountReelsMap = new Map<string, InstagramReel[]>()

    // Re-upsert accounts (legacy check) and videos
    for (const item of items) {
        if (!item.ownerUsername) continue

        const { data: account } = await supabase
            .from('instagram_accounts')
            .upsert({
                username: item.ownerUsername,
                instagram_id: item.ownerId,
                last_synced_at: new Date().toISOString(),
            }, { onConflict: 'username', ignoreDuplicates: false })
            .select()
            .single()

        if (account) {
            const { data: reel } = await supabase.from('instagram_reels').upsert({
                account_id: account.id,
                reel_id: item.id,
                short_code: item.shortCode,
                caption: item.caption,
                video_play_count: item.videoPlayCount || item.videoViewCount || 0,
                likes_count: item.likesCount || 0,
                comments_count: item.commentsCount || 0,
                thumbnail_url: item.displayUrl,
                timestamp: item.timestamp,
                created_at: new Date().toISOString(),
                // Added new fields
                url: item.url,
                video_url: item.videoUrl,
                hashtags: item.hashtags || []
            }, { onConflict: 'short_code' }).select().single()

            if (reel) {
                if (!accountReelsMap.has(account.id)) accountReelsMap.set(account.id, [])
                accountReelsMap.get(account.id)?.push(reel)
                processed++

                // Insert into history table if daily sync
                if (isDaily) {
                    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
                    await supabase.from('instagram_reel_history').upsert({
                        reel_id: reel.reel_id,
                        account_id: account.id,
                        date: today,
                        video_play_count: reel.video_play_count,
                        likes_count: reel.likes_count,
                        comments_count: reel.comments_count,
                        created_at: new Date().toISOString()
                    }, { onConflict: 'reel_id, date' })
                }
            }
        }
    }

    let snapshots = 0
    if (isDaily) {
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
        for (const [accountId, reels] of Array.from(accountReelsMap.entries())) {
            // Modified to use 20 to match TikTok
            const activeReels = reels.slice(0, 20)
            if (activeReels.length > 0) {
                const totals = activeReels.reduce((acc, r) => ({
                    views: acc.views + (r.video_play_count || 0),
                    likes: acc.likes + (r.likes_count || 0),
                    comments: acc.comments + (r.comments_count || 0)
                }), { views: 0, likes: 0, comments: 0 })

                await supabase.from('daily_snapshots').upsert({
                    account_id: accountId,
                    date: today,
                    total_views: totals.views,
                    total_likes: totals.likes,
                    total_comments: totals.comments,
                    total_shares: 0,
                    video_count: activeReels.length,
                    created_at: new Date().toISOString()
                }, { onConflict: 'account_id, date' })
                snapshots++
            }
        }
    }

    return { processed, snapshots }
}

async function waitForRun(runId: string, apiToken: string) {
    let status = 'RUNNING'
    let attempts = 0
    const maxAttempts = 300 // Increased to 25 mins for larger batches

    while (status === 'RUNNING' && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000))
        const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apiToken}`)
        const data = await res.json()
        status = data.data.status
        attempts++
    }
    if (status !== 'SUCCEEDED') throw new Error(`Run finished with status: ${status}`)
}

async function generateSnapshots(supabase: any, accountVideosMap: Map<string, any[]>, platform: string) {
    let count = 0
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })

    const accountIds = Array.from(accountVideosMap.keys())

    // Process in parallel chunks to avoid timeout
    const chunkSize = 10
    for (let i = 0; i < accountIds.length; i += chunkSize) {
        const chunk = accountIds.slice(i, i + chunkSize)
        await Promise.all(chunk.map(async (accountId) => {
            // Fetch Top 20 from DB (including the newly synced one and older ones)
            // This prevents "Chart Drop" when only scraping 1 video.
            const table = platform === 'instagram' ? 'instagram_reels' : 'tiktok_videos'
            const sortColumn = platform === 'instagram' ? 'timestamp' : 'create_time'



            const selectString = platform === 'instagram'
                ? 'video_play_count, likes_count, comments_count'
                : 'play_count, digg_count, comment_count, share_count'

            const { data: topVideos } = await supabase
                .from(table)
                .select(selectString)
                .eq('account_id', accountId)
                .order(sortColumn, { ascending: false })
                .limit(20)

            if (topVideos && topVideos.length > 0) {
                // Map IG fields to generic fields
                const mappedVideos = topVideos.map((v: any) => ({
                    play_count: v.play_count ?? v.video_play_count ?? 0,
                    digg_count: v.digg_count ?? v.likes_count ?? 0,
                    comment_count: v.comment_count ?? v.comments_count ?? 0,
                    share_count: v.share_count ?? 0 // IG has no share count in scraped data usually
                }))

                const totals = mappedVideos.reduce((acc: any, v: any) => ({
                    views: acc.views + (v.play_count || 0),
                    likes: acc.likes + (v.digg_count || 0),
                    comments: acc.comments + (v.comment_count || 0),
                    shares: acc.shares + (v.share_count || 0)
                }), { views: 0, likes: 0, comments: 0, shares: 0 })

                await supabase.from('daily_snapshots').upsert({
                    account_id: accountId,
                    date: today,
                    total_views: totals.views,
                    total_likes: totals.likes,
                    total_comments: totals.comments,
                    total_shares: totals.shares,
                    video_count: topVideos.length,
                    created_at: new Date().toISOString()
                }, { onConflict: 'account_id, date' })
                count++
            }
        }))
    }
    return count
}
