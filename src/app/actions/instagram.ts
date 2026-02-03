'use server'

import { createClient } from '@/lib/supabase/server'
import { InstagramAccount, InstagramReel } from '@/types/database'

export async function fetchInstagramAccounts(): Promise<InstagramAccount[]> {
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

export async function fetchInstagramReels(accountIds?: string[]): Promise<InstagramReel[]> {
    const supabase = await createClient()

    let query = supabase
        .from('instagram_reels')
        .select('*')
        .order('timestamp', { ascending: false })

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
