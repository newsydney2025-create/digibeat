'use server'

import { createClient } from '@/lib/supabase/server'
import { InstagramAccount, InstagramReel } from '@/types/database'
import { unstable_noStore as noStore } from 'next/cache'

export async function fetchInstagramAccounts(_t?: number): Promise<InstagramAccount[]> {
    noStore()
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('instagram_accounts')
        .select('*')
        .eq('is_active', true)
        .order('username')

    if (error) {
        console.error('Error fetching Instagram accounts:', error)
        return []
    }

    return data || []
}

export async function fetchInstagramReels(accountIds?: string[], _t?: number): Promise<InstagramReel[]> {
    noStore()
    const supabase = await createClient()

    let query = supabase
        .from('instagram_reels')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(200)

    if (accountIds && accountIds.length > 0) {
        query = query.in('account_id', accountIds)
    }

    const { data, error } = await query

    if (error) {
        console.error('Error fetching Instagram reels:', error)
        return []
    }

    return data || []
}

/**
 * Fetch simplified reel stats for total aggregation to avoid downloading massive payloads
 */
export async function fetchInstagramReelStats(accountIds?: string[], _t?: number): Promise<{ account_id: string, video_play_count: number, likes_count: number, comments_count: number }[]> {
    noStore()
    const supabase = await createClient()

    let allData: { account_id: string, video_play_count: number, likes_count: number, comments_count: number }[] = []
    let hasMore = true
    let page = 0
    const pageSize = 1000

    while (hasMore) {
        let query = supabase
            .from('instagram_reels')
            .select('account_id, video_play_count, likes_count, comments_count')
            .range(page * pageSize, (page + 1) * pageSize - 1)

        if (accountIds && accountIds.length > 0) {
            query = query.in('account_id', accountIds)
        }

        const { data, error } = await query

        if (error) {
            console.error('Error fetching Instagram reel stats:', error)
            break
        }

        if (data && data.length > 0) {
            allData = [...allData, ...data]
            page++
            if (data.length < pageSize) {
                hasMore = false
            }
        } else {
            hasMore = false
        }
    }

    return allData
}
