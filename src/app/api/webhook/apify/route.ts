import { NextRequest, NextResponse } from 'next/server'
// import { createClient } from '@/lib/supabase/server'
import { TikTokVideo, InstagramReel } from '@/types/database'

// --- Types ---
// (Copy necessary types from sync/route.ts or import them if I move them to a shared file)
// For now, I'll redefine or import if possible. 
// Ideally I should move types to types/apify.ts but to be quick I might duplicate or import.
// Let's redefine for safety/speed and refactor later.

interface ApifyTikTokData {
    id: string
    text: string
    createTimeISO: string
    isAd: boolean
    authorMeta: {
        id: string
        name: string
        nickName: string
        avatar: string
        fans: number
        following: number
        heart: number
        video: number
        signature: string
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

interface ApifyInstagramData {
    id: string
    type: string
    shortCode: string
    caption: string
    hashtags: string[]
    mentions: string[]
    url: string
    commentsCount: number
    firstComment?: string
    latestComments?: {
        id: string
        text: string
        ownerUsername: string
        ownerProfilePicUrl: string
        timestamp: string
        likesCount: number
    }[]
    dimensionsHeight: number
    dimensionsWidth: number
    displayUrl: string
    images: string[]
    videoUrl?: string
    alt?: string
    likesCount: number
    timestamp: string
    childPosts?: any[]
    ownerUsername: string // Important for linking
    ownerId?: string
    productType?: string
    videoPlayCount?: number
    videoViewCount?: number
}

// Reuse generateSnapshots logic - ideally import from a shared helper
// But generateSnapshots is in sync/route.ts and not exported? 
// I should move generateSnapshots to a lib file.
// For now, I will DUPLICATE it to ensure isolation and then refactor. 
// Or better: Export it from sync/route.ts? 
// Next.js route handlers are module scopes, exporting a function makes it available? Yes.
// But importing from 'app/api/sync/route.ts' is weird.
// Better to create `src/lib/sync-helpers.ts`.

export async function POST(request: NextRequest) {
    try {
        const url = new URL(request.url)
        const platform = url.searchParams.get('platform')
        const secret = url.searchParams.get('secret')

        // Security Check
        if (secret !== process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        // Apify webhook payload structure:
        // { userId, createdAt, eventType, eventData: { actorId, runId, ... }, resource: { id, ... } }
        const runId = body.resource?.id
        const eventType = body.eventType

        if (eventType !== 'ACTOR.RUN.SUCCEEDED') {
            return NextResponse.json({ message: 'Ignoring non-success event' })
        }

        if (!runId) {
            return NextResponse.json({ error: 'No runId found' }, { status: 400 })
        }

        console.log(`Webhook received for ${platform}, runId: ${runId}`)

        console.log(`Webhook received for ${platform}, runId: ${runId}`)

        // Use Service Role Key to bypass RLS for webhook ingestion
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        const apiToken = process.env.APIFY_API_TOKEN!

        // Fetch results from Apify
        const datasetResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apiToken}`)

        if (!datasetResponse.ok) {
            throw new Error(`Failed to fetch dataset: ${datasetResponse.statusText}`)
        }

        // --- PROCESSING LOGIC ---
        // This mirrors the logic extracted from sync/route.ts

        if (platform === 'tiktok') {
            const items: ApifyTikTokData[] = await datasetResponse.json()
            await processTikTokData(supabase, items, true) // Assume isDaily=true for webhook for now
        } else if (platform === 'instagram') {
            const items: ApifyInstagramData[] = await datasetResponse.json()
            await processInstagramData(supabase, items, true)
        } else {
            return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
        }

        // Log success (use type assertion since sync_logs isn't in generated types)
        await (supabase.from('sync_logs') as any).insert({
            sync_type: 'webhook',
            platform: platform,
            status: 'success',
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            videos_synced: 0,
            error_message: `Run ${runId} processed successfully`
        })

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Webhook processing failed:', error)
        // Log error to DB?
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}

// --- HELPER FUNCTIONS (Refactored from sync/route.ts) ---

async function processTikTokData(supabase: any, items: ApifyTikTokData[], isDaily: boolean) {
    let processed = 0
    const accountVideosMap = new Map<string, any[]>()
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })

    // Calculate yesterday properly relative to today string
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    const yesterday = d.toISOString().split('T')[0]

    for (const item of items) {
        if (!item.authorMeta) continue

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
            }, { onConflict: 'username' })
            .select()
            .single()

        if (account) {
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
                create_time: item.createTimeISO,
                is_ad: item.isAd || false,
                is_pinned: item.isPinned || false,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'video_id' }).select().single()

            if (video) {
                // Calculate Gains if Daily
                let gains = { views: 0, likes: 0, comments: 0, shares: 0 }
                if (isDaily) {
                    // Fetch yesterday's history
                    const { data: history } = await supabase
                        .from('tiktok_video_history')
                        .select('play_count, digg_count, comment_count, share_count')
                        .eq('video_id', video.video_id)
                        .eq('date', yesterday)
                        .single()

                    if (history) {
                        gains.views = Math.max(0, (video.play_count || 0) - (history.play_count || 0))
                        gains.likes = Math.max(0, (video.digg_count || 0) - (history.digg_count || 0))
                        gains.comments = Math.max(0, (video.comment_count || 0) - (history.comment_count || 0))
                        gains.shares = Math.max(0, (video.share_count || 0) - (history.share_count || 0))
                    } else {
                        // New video today or no history yesterday: gain = current (assuming daily scrape captures new growth)
                        // OR if it's an old video first scraped today?
                        // Logic in sync script: gain = current - 0 = current.
                        gains.views = video.play_count || 0
                        gains.likes = video.digg_count || 0
                        gains.comments = video.comment_count || 0
                        gains.shares = video.share_count || 0

                        // BUT: If the video create_time is old, this might be a huge spike. 
                        // However, we only scrape "latest 20", so usually they are recent.
                        // If we want to be safe and only count gain if we have history: 
                        // But user logic "Day 1 0, Day 2 Gain" implies Day 1 (first scrape) counts as 0 gain?
                        // No, user said: "Day 3 scrape... video 5,6 no data yesterday... current - 0 = current"
                        // So yes, default to current value IS the correct logic per user request.
                    }

                    // Upsert Today's History
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

                // Attach gains to video object for snapshot aggregation
                const videoWithGains = { ...video, ...gains }

                if (!accountVideosMap.has(account.id)) accountVideosMap.set(account.id, [])
                accountVideosMap.get(account.id)?.push(videoWithGains)
                processed++
            }
        }
    }

    if (isDaily) {
        await generateSnapshots(supabase, accountVideosMap)
    }
}

async function processInstagramData(supabase: any, items: ApifyInstagramData[], isDaily: boolean) {
    const accountVideosMap = new Map<string, any[]>()
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })

    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    const yesterday = d.toISOString().split('T')[0]

    for (const item of items) {
        if (!item.ownerUsername) continue

        // Find or create account
        const { data: account } = await supabase
            .from('instagram_accounts')
            .select('id')
            .eq('username', item.ownerUsername)
            .single()

        let accountId = account?.id

        if (!accountId) {
            // Create basic account
            const { data: newAccount } = await supabase
                .from('instagram_accounts')
                .insert({
                    username: item.ownerUsername,
                    last_synced_at: new Date().toISOString()
                })
                .select()
                .single()
            accountId = newAccount?.id
        }

        if (accountId) {
            // Upsert Reel/Post
            const videoId = item.id || item.shortCode
            const { data: reel } = await supabase.from('instagram_reels').upsert({
                reel_id: videoId,
                short_code: item.shortCode,
                account_id: accountId,
                caption: item.caption,
                video_url: item.videoUrl || item.displayUrl, // Fallback
                thumbnail_url: item.displayUrl,
                video_play_count: item.videoPlayCount || item.videoViewCount || 0,
                likes_count: item.likesCount || 0,
                comments_count: item.commentsCount || 0,
                timestamp: item.timestamp,
                url: item.url,
                updated_at: new Date().toISOString()
            }, { onConflict: 'reel_id' }).select().single()

            if (reel) {
                // Calculate Gains if Daily
                let gains = { views: 0, likes: 0, comments: 0 }
                if (isDaily) {
                    // Fetch yesterday's history
                    const { data: history } = await supabase
                        .from('instagram_reel_history')
                        .select('video_play_count, likes_count, comments_count')
                        .eq('reel_id', reel.reel_id)
                        .eq('date', yesterday)
                        .single()

                    if (history) {
                        gains.views = Math.max(0, (reel.video_play_count || 0) - (history.video_play_count || 0))
                        gains.likes = Math.max(0, (reel.likes_count || 0) - (history.likes_count || 0))
                        gains.comments = Math.max(0, (reel.comments_count || 0) - (history.comments_count || 0))
                    } else {
                        gains.views = reel.video_play_count || 0
                        gains.likes = reel.likes_count || 0
                        gains.comments = reel.comments_count || 0
                    }

                    // Upsert Today's History
                    await supabase.from('instagram_reel_history').upsert({
                        reel_id: reel.reel_id,
                        account_id: accountId,
                        date: today,
                        video_play_count: reel.video_play_count,
                        likes_count: reel.likes_count,
                        comments_count: reel.comments_count,
                        created_at: new Date().toISOString()
                    }, { onConflict: 'reel_id, date' })
                }

                // Attach gains
                const reelWithGains = { ...reel, ...gains }

                if (!accountVideosMap.has(accountId)) accountVideosMap.set(accountId, [])
                accountVideosMap.get(accountId)?.push(reelWithGains)
            }
        }
    }

    if (isDaily) {
        await generateSnapshots(supabase, accountVideosMap)
    }
}

async function generateSnapshots(supabase: any, accountVideosMap: Map<string, any[]>) {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
    const accountIds = Array.from(accountVideosMap.keys())

    for (const accountId of accountIds) {
        const videos = accountVideosMap.get(accountId) || []
        if (videos.length > 0) {
            const totals = videos.reduce((acc: any, v: any) => ({
                views: acc.views + (v.play_count || v.video_play_count || 0),
                likes: acc.likes + (v.digg_count || v.likes_count || 0),
                comments: acc.comments + (v.comment_count || v.comments_count || 0),
                shares: acc.shares + (v.share_count || 0),
                // Sum Up Gains
                gain_views: acc.gain_views + (v.views || 0), // Note: property name on object is 'views'/'likes' from gain calc
                gain_likes: acc.gain_likes + (v.likes || 0),
                gain_comments: acc.gain_comments + (v.comments || 0),
                gain_shares: acc.gain_shares + (v.shares || 0)
            }), {
                views: 0, likes: 0, comments: 0, shares: 0,
                gain_views: 0, gain_likes: 0, gain_comments: 0, gain_shares: 0
            })

            await supabase.from('daily_snapshots').upsert({
                account_id: accountId,
                date: today,
                total_views: totals.views,
                total_likes: totals.likes,
                total_comments: totals.comments,
                total_shares: totals.shares,
                gain_views: totals.gain_views,
                gain_likes: totals.gain_likes,
                gain_comments: totals.gain_comments,
                gain_shares: totals.gain_shares,
                video_count: videos.length,
                created_at: new Date().toISOString()
            }, { onConflict: 'account_id, date' })
        }
    }
}
