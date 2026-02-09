import { InstagramReel, InstagramAccount, TikTokVideo, TikTokAccount, DailySnapshot } from '@/types/database'

/**
 * Converts InstagramReel[] to TikTokVideo[] format for chart compatibility
 */
export function adaptReelsToVideos(reels: InstagramReel[]): TikTokVideo[] {
    return reels.map((reel) => ({
        id: reel.id,
        video_id: reel.reel_id,
        account_id: reel.account_id || '',
        description: reel.caption || '',
        play_count: reel.video_play_count,
        digg_count: reel.likes_count,
        comment_count: reel.comments_count,
        share_count: 0, // Instagram API doesn't expose share count publicly
        collect_count: 0,
        duration: reel.video_duration || 0,
        cover_url: reel.thumbnail_url,
        video_url: reel.video_url,
        web_video_url: reel.url || '',
        hashtags: reel.hashtags,
        music_name: null,
        music_author: null,
        create_time: reel.timestamp || reel.created_at,
        is_ad: reel.is_paid_partnership,
        is_pinned: reel.is_pinned,
        created_at: reel.created_at,
        updated_at: reel.updated_at,
    }))
}

/**
 * Converts InstagramAccount[] to TikTokAccount[] format for chart compatibility
 */
export function adaptInstagramAccounts(accounts: InstagramAccount[]): TikTokAccount[] {
    return accounts.map((account) => ({
        id: account.id,
        username: account.username,
        nickname: account.full_name,
        avatar_url: account.avatar_url,
        follower_count: 0, // Not available from current schema
        following_count: 0,
        heart_count: 0,
        video_count: 0,
        signature: null,
        website: account.website, // Mapped website
        is_active: account.is_active,
        last_synced_at: account.last_synced_at,
        created_at: account.created_at,
    }))
}

/**
 * Generates synthetic DailySnapshot[] from Instagram Reels.
 * Since we don't have historical snapshots for Instagram, we mimic them by accumulating
 * video stats over time based on their post date.
 */
export function generateInstagramSnapshots(reels: InstagramReel[], accounts: InstagramAccount[]): DailySnapshot[] {
    const snapshots: DailySnapshot[] = []
    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Group reels by account
    const accountReels = new Map<string, InstagramReel[]>()
    reels.forEach(reel => {
        if (reel.account_id) {
            const current = accountReels.get(reel.account_id) || []
            current.push(reel)
            accountReels.set(reel.account_id, current)
        }
    })

    // Generate snapshots for each account
    accounts.forEach(account => {
        const accountVideos = accountReels.get(account.id) || []

        // iterate last 30 days
        for (let i = 0; i < 30; i++) {
            const date = new Date(thirtyDaysAgo)
            date.setDate(date.getDate() + i)
            const dateStr = date.toISOString().split('T')[0]

            // Calculate cumulative stats for this date 
            // Logic: Filter videos posted on/before date, Sort by Newest, Take Top 20 (matching backend logic)
            const activeReels = accountVideos
                .filter(v => {
                    const postDate = new Date(v.timestamp || v.created_at)
                    return postDate <= date
                })
                .sort((a, b) => new Date(b.timestamp || b.created_at).getTime() - new Date(a.timestamp || a.created_at).getTime())
                .slice(0, 20)

            const totalViews = activeReels.reduce((sum, v) => sum + v.video_play_count, 0)
            const totalLikes = activeReels.reduce((sum, v) => sum + v.likes_count, 0)
            const totalComments = activeReels.reduce((sum, v) => sum + v.comments_count, 0)

            // Approximate gains (since this is synthetic data)
            const gainViews = i > 0 ? Math.max(0, totalViews - snapshots[i - 1].total_views) : 0
            const gainLikes = i > 0 ? Math.max(0, totalLikes - snapshots[i - 1].total_likes) : 0
            const gainComments = i > 0 ? Math.max(0, totalComments - snapshots[i - 1].total_comments) : 0

            snapshots.push({
                id: `snap-${account.id}-${dateStr}`,
                account_id: account.id,
                date: dateStr,
                total_views: totalViews,
                total_likes: totalLikes,
                total_comments: totalComments,
                total_shares: 0,
                gain_views: gainViews,
                gain_likes: gainLikes,
                gain_comments: gainComments,
                gain_shares: 0,
                video_count: activeReels.length,
                created_at: new Date().toISOString()
            })
        }
    })

    return snapshots
}
