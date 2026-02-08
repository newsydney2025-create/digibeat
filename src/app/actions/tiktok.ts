'use server'

import { createClient } from '@/lib/supabase/server'
import { TikTokAccount, TikTokVideo, SyncLog, DailySnapshot } from '@/types/database'

/**
 * Fetch daily snapshots for chart history
 */
export async function fetchSnapshots(): Promise<DailySnapshot[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('daily_snapshots')
        .select('*')
        .order('date', { ascending: true })

    if (error) {
        console.error('Error fetching snapshots:', error)
        return []
    }

    return data || []
}

/**
 * Fetch all TikTok accounts from the database
 */
export async function fetchAccounts(): Promise<TikTokAccount[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('tiktok_accounts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Error fetching accounts:', error)
        return []
    }

    return data || []
}

/**
 * Fetch all TikTok videos from the database
 */
export async function fetchVideos(): Promise<TikTokVideo[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('tiktok_videos')
        .select('*')
        .order('create_time', { ascending: false })

    if (error) {
        console.error('Error fetching videos:', error)
        return []
    }

    return data || []
}

/**
 * Trigger a data sync from Apify
 */
export async function triggerSync(profiles: string[]): Promise<SyncLog | null> {
    const supabase = await createClient()

    // Create sync log entry
    const { data: log, error: logError } = await supabase
        .from('sync_logs')
        .insert({
            sync_type: 'manual',
            status: 'running',
        } as any)
        .select()
        .single()

    if (logError || !log) {
        console.error('Error creating sync log:', logError)
        return null
    }

    try {
        // Call Apify API
        const apiToken = process.env.APIFY_API_TOKEN
        if (!apiToken) {
            throw new Error('APIFY_API_TOKEN not set')
        }

        const response = await fetch(
            'https://api.apify.com/v2/acts/clockworks~tiktok-scraper/runs?token=' + apiToken,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    profiles: profiles,
                    resultsPerPage: 50,
                    profileScrapeSections: ['videos'],
                    profileSorting: 'latest',
                }),
            }
        )

        if (!response.ok) {
            throw new Error(`Apify API error: ${response.status}`)
        }

        const result = await response.json()

        // Update sync log
        await (supabase
            .from('sync_logs') as any)
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
            })
            .eq('id', (log as any).id)

        return log
    } catch (error) {
        console.error('Sync error:', error)

        // Update sync log with error
        await (supabase
            .from('sync_logs') as any)
            .update({
                status: 'failed',
                error_message: error instanceof Error ? error.message : 'Unknown error',
                completed_at: new Date().toISOString(),
            })
            .eq('id', (log as any).id)

        return null
    }
}

/**
 * Insert or update accounts from Apify data
 */
export async function upsertAccount(accountData: {
    username: string
    nickname?: string
    avatar_url?: string
    follower_count?: number
    following_count?: number
    heart_count?: number
    video_count?: number
    signature?: string
}): Promise<TikTokAccount | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('tiktok_accounts')
        .upsert(
            {
                username: accountData.username,
                nickname: accountData.nickname,
                avatar_url: accountData.avatar_url,
                follower_count: accountData.follower_count || 0,
                following_count: accountData.following_count || 0,
                heart_count: accountData.heart_count || 0,
                video_count: accountData.video_count || 0,
                signature: accountData.signature,
                last_synced_at: new Date().toISOString(),
            } as any,
            { onConflict: 'username' }
        )
        .select()
        .single()

    if (error) {
        console.error('Error upserting account:', error)
        return null
    }

    return data
}

/**
 * Insert or update videos from Apify data
 */
export async function upsertVideo(videoData: {
    video_id: string
    account_id: string
    description?: string
    play_count?: number
    digg_count?: number
    comment_count?: number
    share_count?: number
    collect_count?: number
    duration?: number
    cover_url?: string
    video_url?: string
    web_video_url?: string
    hashtags?: string[]
    music_name?: string
    music_author?: string
    create_time?: string
    is_ad?: boolean
    is_pinned?: boolean
}): Promise<TikTokVideo | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('tiktok_videos')
        .upsert(
            {
                video_id: videoData.video_id,
                account_id: videoData.account_id,
                description: videoData.description,
                play_count: videoData.play_count || 0,
                digg_count: videoData.digg_count || 0,
                comment_count: videoData.comment_count || 0,
                share_count: videoData.share_count || 0,
                collect_count: videoData.collect_count || 0,
                duration: videoData.duration || 0,
                cover_url: videoData.cover_url,
                video_url: videoData.video_url,
                web_video_url: videoData.web_video_url,
                hashtags: videoData.hashtags || [],
                music_name: videoData.music_name,
                music_author: videoData.music_author,
                create_time: videoData.create_time,
                is_ad: videoData.is_ad || false,
                is_pinned: videoData.is_pinned || false,
                updated_at: new Date().toISOString(),
            } as any,
            { onConflict: 'video_id' }
        )
        .select()
        .single()

    if (error) {
        console.error('Error upserting video:', error)
        return null
    }

    return data
}

/**
 * Fetch daily video breakdown (Simulated)
 */
export async function fetchDailyVideoBreakdown(
    accountId: string,
    date: string,
    dailyGains: { views: number, likes: number, comments: number, shares: number }
): Promise<any[]> {
    const supabase = await createClient()

    // 1. Determine platform by checking account tables
    const { data: tkAccount } = await supabase
        .from('tiktok_accounts')
        .select('username')
        .eq('id', accountId)
        .single()

    const platform = tkAccount ? 'tiktok' : 'instagram'
    const historyTable = platform === 'instagram' ? 'instagram_reel_history' : 'tiktok_video_history'
    const videosTable = platform === 'instagram' ? 'instagram_reels' : 'tiktok_videos'
    const idField = platform === 'instagram' ? 'reel_id' : 'video_id'

    // 2. Find previous date for gains calculation
    const previousDate = new Date(date)
    previousDate.setDate(previousDate.getDate() - 1)
    const prevDateStr = previousDate.toISOString().split('T')[0]

    // 3. Fetch history records for selected date (this defines which videos to show)
    const { data: currentDayHistory } = await supabase
        .from(historyTable as any)
        .select('*')
        .eq('account_id', accountId)
        .eq('date', date)

    if (!currentDayHistory || currentDayHistory.length === 0) {
        console.log(`[fetchDailyVideoBreakdown] No history for ${accountId} on ${date}`)
        return []
    }

    // 4. Fetch previous day history for gains calculation
    const videoIds = currentDayHistory.map((h: any) => h[idField])
    const { data: prevDayHistory } = await supabase
        .from(historyTable as any)
        .select('*')
        .eq('account_id', accountId)
        .eq('date', prevDateStr)
        .in(idField, videoIds)

    // Build prev day lookup map
    const prevMap = new Map<string, any>()
    if (prevDayHistory) {
        prevDayHistory.forEach((h: any) => prevMap.set(h[idField], h))
    }

    // 5. Fetch video metadata for display (title, cover, etc.)
    const { data: videoMetadata } = await supabase
        .from(videosTable as any)
        .select('*')
        .in(idField, videoIds)

    const metadataMap = new Map<string, any>()
    if (videoMetadata) {
        videoMetadata.forEach((v: any) => metadataMap.set(v[idField], v))
    }

    // 6. Build result: combine history gains with video metadata
    return currentDayHistory.map((curr: any) => {
        const videoId = curr[idField]
        const prev = prevMap.get(videoId) || {}
        const metadata = metadataMap.get(videoId) || {}

        let stats: { views: number, likes: number, comments: number, shares: number }

        if (platform === 'instagram') {
            stats = {
                views: Math.max(0, (curr.video_play_count || 0) - (prev.video_play_count || 0)),
                likes: Math.max(0, (curr.likes_count || 0) - (prev.likes_count || 0)),
                comments: Math.max(0, (curr.comments_count || 0) - (prev.comments_count || 0)),
                shares: 0
            }
        } else {
            stats = {
                views: Math.max(0, (curr.play_count || 0) - (prev.play_count || 0)),
                likes: Math.max(0, (curr.digg_count || 0) - (prev.digg_count || 0)),
                comments: Math.max(0, (curr.comment_count || 0) - (prev.comment_count || 0)),
                shares: Math.max(0, (curr.share_count || 0) - (prev.share_count || 0))
            }
        }

        // Get display fields from metadata
        const title = platform === 'instagram' ? metadata.caption : metadata.description
        const cover = platform === 'instagram' ? metadata.thumbnail_url : metadata.cover_url
        const webVideoUrl = platform === 'instagram' ? (metadata.url || metadata.video_url) : metadata.web_video_url
        const createdAt = platform === 'instagram' ? (metadata.timestamp || metadata.created_at) : (metadata.create_time || metadata.created_at)

        return {
            video_id: videoId || 'unknown',
            title: title || '',
            cover: cover || '',
            web_video_url: webVideoUrl || '',
            created_at: createdAt || '',
            stats: stats
        }
    }).sort((a, b) => b.stats.views - a.stats.views)  // Sort by views gain descending
}

// ==================== Account Groups ====================

import { AccountGroup } from '@/types/database'

// Note: account_groups and account_group_members tables are new and not in generated types
// Using type assertions until types are regenerated

/**
 * Fetch all account groups with their members
 */
export async function fetchAccountGroups(): Promise<AccountGroup[]> {
    const supabase = await createClient()

    const { data: groups, error } = await supabase
        .from('account_groups' as any)
        .select('*')
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Error fetching groups:', error)
        return []
    }

    // Fetch members for each group
    const groupsWithMembers = await Promise.all(
        ((groups || []) as any[]).map(async (group: any) => {
            const { data: members } = await supabase
                .from('account_group_members' as any)
                .select('account_id')
                .eq('group_id', group.id)

            return {
                ...group,
                members: ((members || []) as any[]).map((m: any) => m.account_id),
            } as AccountGroup
        })
    )

    return groupsWithMembers
}

/**
 * Create a new account group
 */
export async function createAccountGroup(
    name: string,
    color: string = '#22d3ee',
    accountIds: string[] = []
): Promise<AccountGroup | null> {
    const supabase = await createClient()

    // Create group
    const { data: group, error } = await supabase
        .from('account_groups' as any)
        .insert({ name, color } as any)
        .select()
        .single()

    if (error || !group) {
        console.error('Error creating group:', error)
        return null
    }

    // Add members if provided
    if (accountIds.length > 0) {
        const members = accountIds.map((account_id) => ({
            group_id: (group as any).id,
            account_id,
        }))

        await supabase.from('account_group_members' as any).insert(members as any)
    }

    return { ...(group as any), members: accountIds } as AccountGroup
}

/**
 * Update group members
 */
export async function updateGroupMembers(
    groupId: string,
    accountIds: string[]
): Promise<boolean> {
    const supabase = await createClient()

    // Remove existing members
    await supabase
        .from('account_group_members' as any)
        .delete()
        .eq('group_id', groupId)

    // Add new members
    if (accountIds.length > 0) {
        const members = accountIds.map((account_id) => ({
            group_id: groupId,
            account_id,
        }))

        const { error } = await supabase.from('account_group_members' as any).insert(members as any)
        if (error) {
            console.error('Error updating members:', error)
            return false
        }
    }

    return true
}

/**
 * Delete an account group
 */
export async function deleteAccountGroup(groupId: string): Promise<boolean> {
    const supabase = await createClient()

    const { error } = await supabase
        .from('account_groups' as any)
        .delete()
        .eq('id', groupId)

    if (error) {
        console.error('Error deleting group:', error)
        return false
    }

    return true
}
