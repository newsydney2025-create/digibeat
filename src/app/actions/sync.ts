'use server'

import { createClient } from '@/lib/supabase/server'

import { triggerSyncProcess } from '@/lib/sync-trigger'

export async function triggerSync(platform: string = 'all') {
    try {
        const results = await triggerSyncProcess(platform, 'manual')
        return { success: true, results }
    } catch (error) {
        console.error('Sync trigger failed:', error)
        return { success: false, error: String(error) }
    }
}

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

    const log = data as any

    return {
        id: log.id,
        status: log.status, // 'triggered', 'processing', 'completed', 'error'
        started_at: log.started_at,
        completed_at: log.completed_at
    }
}
