
import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

// --- Types ---

export interface ApifyTikTokData {
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

export interface ApifyInstagramData {
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
    ownerUsername: string
    ownerId?: string
    productType?: string
    videoPlayCount?: number
    videoViewCount?: number
}

interface VideoGainStats {
    views: number
    likes: number
    comments: number
    shares: number
    // Gains
    gain_views: number
    gain_likes: number
    gain_comments: number
    gain_shares: number
}

// --- Bulk Processing Functions ---

export async function processTikTokDataBulk(supabase: SupabaseClient<Database>, items: ApifyTikTokData[], isDaily: boolean) {
    if (!items || items.length === 0) return

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    const yesterday = d.toISOString().split('T')[0]

    // 1. Prepare Accounts
    const accountsMap = new Map<string, any>() // username -> accountObj
    const accountUsernames = new Set<string>()

    // Deduplicate accounts from items
    for (const item of items) {
        if (item.authorMeta?.name) {
            const username = item.authorMeta.name
            if (!accountsMap.has(username)) {
                accountsMap.set(username, {
                    username: username,
                    nickname: item.authorMeta.nickName,
                    avatar_url: item.authorMeta.avatar,
                    follower_count: item.authorMeta.fans || 0,
                    following_count: item.authorMeta.following || 0,
                    heart_count: item.authorMeta.heart || 0,
                    video_count: item.authorMeta.video || 0,
                    signature: item.authorMeta.signature,
                    last_synced_at: new Date().toISOString(),
                })
                accountUsernames.add(username)
            }
        }
    }

    if (accountsMap.size === 0) return

    // BULK UPSERT ACCOUNTS
    const { data: upsertedAccounts, error: accountError } = await supabase
        .from('tiktok_accounts')
        .upsert(Array.from(accountsMap.values()), { onConflict: 'username' })
        .select('id, username')

    if (accountError) throw new Error(`Failed to upsert accounts: ${accountError.message}`)
    if (!upsertedAccounts) throw new Error('No accounts returned after upsert')

    // Create a map of username -> ID
    const usernameToId = new Map<string, string>()
    upsertedAccounts.forEach(acc => usernameToId.set(acc.username, acc.id))

    // 2. Prepare Videos & Snapshot Aggregation
    const videosToUpsert: any[] = []
    const videoIdsToCheck: string[] = []
    const accountVideosMap = new Map<string, VideoGainStats[]>() // accountId -> list of stats

    // First pass: Prepare Video Objects (without gains yet)
    // We need to fetch history first to calculate gains.
    // Video ID mapping: items map to videos using ID.

    for (const item of items) {
        if (!item.authorMeta?.name) continue
        const accountId = usernameToId.get(item.authorMeta.name)
        if (!accountId) continue

        const videoObj = {
            video_id: item.id,
            account_id: accountId,
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
            // Helper for history mapping (not for DB)
            _rawItem: item
        }
        videosToUpsert.push(videoObj)
        videoIdsToCheck.push(item.id)
    }

    // BULK UPSERT VIDEOS
    // Note: We strip _rawItem before upserting ideally, or Supabase ignores extra fields?
    // Supabase JS will warn or error on extra fields. We should clean it.
    const cleanVideos = videosToUpsert.map(({ _rawItem, ...v }) => v)
    const { error: videoError } = await supabase
        .from('tiktok_videos')
        .upsert(cleanVideos, { onConflict: 'video_id' })

    if (videoError) throw new Error(`Failed to upsert videos: ${videoError.message}`)

    // 3. History & Gains
    const historyToUpsert: any[] = []

    // Fetch Yesterday's History for ALL videos
    // Chunking might be needed if > 65000 params? unique video IDs.
    // Max 1000 items usually, so fine.
    const { data: yesterdayHistory } = await supabase
        .from('tiktok_video_history')
        .select('video_id, play_count, digg_count, comment_count, share_count')
        .in('video_id', videoIdsToCheck)
        .eq('date', yesterday)

    const historyMap = new Map<string, any>()
    yesterdayHistory?.forEach(h => historyMap.set(h.video_id, h))

    // Second Pass: Calculate Gains & Prepare History
    for (const v of videosToUpsert) {
        const item = v._rawItem as ApifyTikTokData // access original data needed? actually v has counts
        const hist = historyMap.get(v.video_id)

        let gains = { gain_views: 0, gain_likes: 0, gain_comments: 0, gain_shares: 0 }

        if (isDaily) {
            if (hist) {
                gains.gain_views = Math.max(0, (v.play_count || 0) - (hist.play_count || 0))
                gains.gain_likes = Math.max(0, (v.digg_count || 0) - (hist.digg_count || 0))
                gains.gain_comments = Math.max(0, (v.comment_count || 0) - (hist.comment_count || 0))
                gains.gain_shares = Math.max(0, (v.share_count || 0) - (hist.share_count || 0))
            } else {
                // No history: gain = current
                gains.gain_views = v.play_count || 0
                gains.gain_likes = v.digg_count || 0
                gains.gain_comments = v.comment_count || 0
                gains.gain_shares = v.share_count || 0
            }

            // Prepare Today's History Record
            historyToUpsert.push({
                video_id: v.video_id,
                account_id: v.account_id,
                date: today,
                play_count: v.play_count,
                digg_count: v.digg_count,
                comment_count: v.comment_count,
                share_count: v.share_count,
                created_at: new Date().toISOString()
            })
        }

        // Add to Snapshot Aggregation
        const stats: VideoGainStats = {
            views: v.play_count,
            likes: v.digg_count,
            comments: v.comment_count,
            shares: v.share_count,
            ...gains
        }

        if (!accountVideosMap.has(v.account_id)) accountVideosMap.set(v.account_id, [])
        accountVideosMap.get(v.account_id)?.push(stats)
    }

    // BULK UPSERT HISTORY
    if (historyToUpsert.length > 0) {
        const { error: histError } = await supabase
            .from('tiktok_video_history')
            .upsert(historyToUpsert, { onConflict: 'video_id, date' })

        if (histError) throw new Error(`Failed to upsert history: ${histError.message}`)
    }

    // 4. Snapshots
    if (isDaily && accountVideosMap.size > 0) {
        const snapshotsToUpsert: any[] = []


        // Fix iterator issue by converting to array
        for (const [accountId, videos] of Array.from(accountVideosMap.entries())) {
            const totals = videos.reduce((acc, v) => ({
                views: acc.views + (v.views || 0),
                likes: acc.likes + (v.likes || 0),
                comments: acc.comments + (v.comments || 0),
                shares: acc.shares + (v.shares || 0),
                gain_views: acc.gain_views + (v.gain_views || 0),
                gain_likes: acc.gain_likes + (v.gain_likes || 0),
                gain_comments: acc.gain_comments + (v.gain_comments || 0),
                gain_shares: acc.gain_shares + (v.gain_shares || 0)
            }), {
                views: 0, likes: 0, comments: 0, shares: 0,
                gain_views: 0, gain_likes: 0, gain_comments: 0, gain_shares: 0
            })

            snapshotsToUpsert.push({
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
            })
        }

        const { error: snapError } = await supabase
            .from('daily_snapshots')
            .upsert(snapshotsToUpsert, { onConflict: 'account_id, date' })

        if (snapError) throw new Error(`Failed to upsert snapshots: ${snapError.message}`)
    }
}

export async function processInstagramDataBulk(supabase: SupabaseClient<Database>, items: ApifyInstagramData[], isDaily: boolean) {
    if (!items || items.length === 0) return

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() - 1)
    const yesterday = d.toISOString().split('T')[0]

    // 1. Prepare Accounts
    const accountsMap = new Map<string, any>()

    for (const item of items) {
        if (item.ownerUsername) {
            // Instagram items don't strictly contain full profile info in media object always?
            // Apify Instagram scraper usually provides ownerUsername. 
            // We use basic info for account creation.
            const username = item.ownerUsername
            if (!accountsMap.has(username)) {
                accountsMap.set(username, {
                    username: username,
                    instagram_id: item.ownerId || 'unknown', // schema requires check
                    // last_synced_at: new Date().toISOString() 
                    // Note: instagram_accounts schema: instagram_id is required? 
                })
            }
        }
    }

    // Check if instagram_id is required in schema? 
    // Yes: "instagram_id: string". But usually Apify gives ownerId. If not, use 'unknown'?
    // Wait, original code did: insert({ username, last_synced_at }) -- Wait, original code did NOT provide instagram_id?
    // Let's check original code `processInstagramData`.
    // It did: insert({ username, last_synced_at }). 
    // Types say `instagram_id: string`. If Supabase allows null or default? 
    // In `types/database.ts`: `instagram_id: string`. NO `?`. 
    // How did previous code work? 
    // Maybe database has default? Or types are stricter than DB? 
    // I'll add a dummy ID 'TBD' if missing to be safe, or just use username?

    const accountsData = Array.from(accountsMap.values()).map(a => ({
        username: a.username,
        instagram_id: a.instagram_id || 'TBD',
        last_synced_at: new Date().toISOString()
    }))

    // Upsert Accounts (Note: using username as conflict key? Schema says `id` is PK. 
    // But usually username is unique? `types` doesn't show constraints.
    // Original code: `select('id').eq('username', ...)` then insert if missing.
    // To do bulk, we need a unique constraint on username. 
    // I'll assume `username` is unique. 

    const { data: upsertedAccounts, error: accountError } = await supabase
        .from('instagram_accounts')
        .upsert(accountsData, { onConflict: 'username' }) // IMPORTANT: Requires constraint on username
        .select('id, username')

    if (accountError) {
        // Fallback: If onConflict username fails (no constraint), we must do fetch-then-insert.
        console.warn('Bulk upsert on constraint username failed/not supported? trying fetch map.', accountError)
        // For now throw error to see.
        throw new Error(`Failed to upsert Instagram accounts: ${accountError.message}. Ensure 'instagram_accounts' has a unique constraint on 'username'.`)
    }

    if (!upsertedAccounts) throw new Error('No accounts returned')

    const usernameToId = new Map<string, string>()
    upsertedAccounts.forEach(acc => usernameToId.set(acc.username, acc.id))

    // 2. Videos & Aggregation
    const reelsToUpsert: any[] = []
    const reelIdsToCheck: string[] = []
    const accountVideosMap = new Map<string, VideoGainStats[]>()

    for (const item of items) {
        if (!item.ownerUsername) continue
        const accountId = usernameToId.get(item.ownerUsername)
        if (!accountId) continue

        const videoId = item.id || item.shortCode
        const reelObj = {
            reel_id: videoId,
            short_code: item.shortCode,
            account_id: accountId,
            caption: item.caption,
            video_url: item.videoUrl || item.displayUrl,
            thumbnail_url: item.displayUrl,
            video_play_count: item.videoPlayCount || item.videoViewCount || 0,
            likes_count: item.likesCount || 0,
            comments_count: item.commentsCount || 0,
            timestamp: item.timestamp,
            url: item.url,
            updated_at: new Date().toISOString(),
            _rawItem: item
        }
        reelsToUpsert.push(reelObj)
        reelIdsToCheck.push(videoId)
    }

    // Upsert Reels
    const cleanReels = reelsToUpsert.map(({ _rawItem, ...r }) => r)
    const { error: reelError } = await supabase
        .from('instagram_reels')
        .upsert(cleanReels, { onConflict: 'reel_id' })

    if (reelError) throw new Error(`Failed to upsert reels: ${reelError.message}`)

    // 3. History
    const historyToUpsert: any[] = []

    const { data: yesterdayHistory } = await supabase
        .from('instagram_reel_history')
        .select('reel_id, video_play_count, likes_count, comments_count')
        .in('reel_id', reelIdsToCheck)
        .eq('date', yesterday)

    const historyMap = new Map<string, any>()
    yesterdayHistory?.forEach(h => historyMap.set(h.reel_id, h))

    for (const r of reelsToUpsert) {
        const hist = historyMap.get(r.reel_id)
        let gains = { gain_views: 0, gain_likes: 0, gain_comments: 0, gain_shares: 0 }

        if (isDaily) {
            if (hist) {
                gains.gain_views = Math.max(0, (r.video_play_count || 0) - (hist.video_play_count || 0))
                gains.gain_likes = Math.max(0, (r.likes_count || 0) - (hist.likes_count || 0))
                gains.gain_comments = Math.max(0, (r.comments_count || 0) - (hist.comments_count || 0))
            } else {
                gains.gain_views = r.video_play_count || 0
                gains.gain_likes = r.likes_count || 0
                gains.gain_comments = r.comments_count || 0
            }

            historyToUpsert.push({
                reel_id: r.reel_id,
                account_id: r.account_id,
                date: today,
                video_play_count: r.video_play_count,
                likes_count: r.likes_count,
                comments_count: r.comments_count,
                created_at: new Date().toISOString()
            })
        }

        const stats: VideoGainStats = {
            views: r.video_play_count,
            likes: r.likes_count,
            comments: r.comments_count,
            shares: 0, // Instagram no shares?
            ...gains
        }

        if (!accountVideosMap.has(r.account_id)) accountVideosMap.set(r.account_id, [])
        accountVideosMap.get(r.account_id)?.push(stats)
    }

    if (historyToUpsert.length > 0) {
        const { error: histError } = await supabase
            .from('instagram_reel_history')
            .upsert(historyToUpsert, { onConflict: 'reel_id, date' })

        if (histError) throw new Error(`Failed to upsert history: ${histError.message}`)
    }

    // 4. Snapshots
    if (isDaily && accountVideosMap.size > 0) {
        const snapshotsToUpsert: any[] = []

        for (const [accountId, videos] of accountVideosMap.entries()) {
            const totals = videos.reduce((acc, v) => ({
                views: acc.views + (v.views || 0),
                likes: acc.likes + (v.likes || 0),
                comments: acc.comments + (v.comments || 0),
                shares: acc.shares + (v.shares || 0),
                gain_views: acc.gain_views + (v.gain_views || 0),
                gain_likes: acc.gain_likes + (v.gain_likes || 0),
                gain_comments: acc.gain_comments + (v.gain_comments || 0),
                gain_shares: acc.gain_shares + (v.gain_shares || 0)
            }), {
                views: 0, likes: 0, comments: 0, shares: 0,
                gain_views: 0, gain_likes: 0, gain_comments: 0, gain_shares: 0
            })

            snapshotsToUpsert.push({
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
            })
        }

        const { error: snapError } = await supabase
            .from('daily_snapshots')
            .upsert(snapshotsToUpsert, { onConflict: 'account_id, date' })

        if (snapError) throw new Error(`Failed to upsert snapshots: ${snapError.message}`)
    }
}
