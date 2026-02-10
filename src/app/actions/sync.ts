'use server'

import { createClient } from '@/lib/supabase/server'

export async function getLatestSyncStatus() {
    const supabase = await createClient()

    // Get the most recent sync log
    const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1)
        .single()

    if (error) {
        // If no logs found (e.g. empty table), return null
        if (error.code === 'PGRST116') return null
        console.error('Error fetching sync status:', error)
        return null
    }

    return {
        id: data.id,
        status: data.status, // 'triggered', 'processing', 'completed', 'error'
        started_at: data.started_at,
        completed_at: data.completed_at
    }
}
