import { createAdminClient } from '@/lib/supabase/admin'

const SYDNEY_TIME_ZONE = 'Australia/Sydney'
const HISTORY_ROWS_PER_ACCOUNT_WARNING = 10

type CountQueryResult = PromiseLike<{
    count: number | null
    error: { message: string } | null
}>

export interface DailySyncCheck {
    name: string
    ok: boolean
    actual: number
    expected_at_least: number
}

export interface DailySyncHealth {
    healthy: boolean
    date: string
    counts: {
        active_tiktok_accounts: number
        active_instagram_accounts: number
        daily_snapshots: number
        tiktok_snapshots: number
        instagram_snapshots: number
        tiktok_video_history: number
        instagram_reel_history: number
    }
    checks: DailySyncCheck[]
}

export function isDateKey(value: string | null | undefined): value is string {
    return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function sydneyDateKey(value: string | number | Date | null | undefined = new Date()) {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null

    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: SYDNEY_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date)

    const year = parts.find((part) => part.type === 'year')?.value
    const month = parts.find((part) => part.type === 'month')?.value
    const day = parts.find((part) => part.type === 'day')?.value

    return year && month && day ? `${year}-${month}-${day}` : null
}

function sydneyHour(value: Date) {
    const hour = new Intl.DateTimeFormat('en-AU', {
        timeZone: SYDNEY_TIME_ZONE,
        hour: '2-digit',
        hour12: false,
    }).format(value)

    return Number.parseInt(hour, 10)
}

export function previousDateKey(dateKey: string) {
    const [year, month, day] = dateKey.split('-').map((part) => Number.parseInt(part, 10))
    const date = new Date(Date.UTC(year, month - 1, day))
    date.setUTCDate(date.getUTCDate() - 1)
    return date.toISOString().slice(0, 10)
}

export function eveningBackupTargetDate(now = new Date()) {
    const currentDate = sydneyDateKey(now)
    if (!currentDate) return null

    // If a nightly backup is delayed past midnight, keep checking the business
    // date it was meant to protect instead of silently moving to the new day.
    return sydneyHour(now) < 12 ? previousDateKey(currentDate) : currentDate
}

async function fetchExactCount(query: CountQueryResult) {
    const { count, error } = await query
    if (error) throw error
    return count || 0
}

export async function getDailySyncHealth(date: string): Promise<DailySyncHealth> {
    const supabase = createAdminClient()

    const [tiktokAccountsResult, instagramAccountsResult, snapshotsResult, tiktokHistoryCount, instagramHistoryCount] = await Promise.all([
        supabase
            .from('tiktok_accounts')
            .select('id, username')
            .eq('is_active', true),
        supabase
            .from('instagram_accounts')
            .select('id, username')
            .eq('is_active', true),
        supabase
            .from('daily_snapshots')
            .select('account_id, video_count')
            .eq('date', date),
        fetchExactCount(supabase
            .from('tiktok_video_history')
            .select('*', { count: 'exact', head: true })
            .eq('date', date)),
        fetchExactCount(supabase
            .from('instagram_reel_history')
            .select('*', { count: 'exact', head: true })
            .eq('date', date)),
    ])

    if (tiktokAccountsResult.error) throw tiktokAccountsResult.error
    if (instagramAccountsResult.error) throw instagramAccountsResult.error
    if (snapshotsResult.error) throw snapshotsResult.error

    const tiktokAccounts = tiktokAccountsResult.data || []
    const instagramAccounts = instagramAccountsResult.data || []
    const snapshots = snapshotsResult.data || []
    const tiktokAccountIds = new Set(tiktokAccounts.map((account) => account.id))
    const instagramAccountIds = new Set(instagramAccounts.map((account) => account.id))
    const tiktokSnapshotCount = snapshots.filter((snapshot) => tiktokAccountIds.has(snapshot.account_id)).length
    const instagramSnapshotCount = snapshots.filter((snapshot) => instagramAccountIds.has(snapshot.account_id)).length
    const minTiktokHistoryCount = Math.max(tiktokAccounts.length, tiktokAccounts.length * HISTORY_ROWS_PER_ACCOUNT_WARNING)
    const minInstagramHistoryCount = Math.max(instagramAccounts.length, instagramAccounts.length * HISTORY_ROWS_PER_ACCOUNT_WARNING)

    const checks = [
        {
            name: 'daily_snapshots',
            ok: snapshots.length > 0,
            actual: snapshots.length,
            expected_at_least: 1,
        },
        {
            name: 'tiktok_video_history',
            ok: tiktokHistoryCount >= minTiktokHistoryCount,
            actual: tiktokHistoryCount,
            expected_at_least: minTiktokHistoryCount,
        },
        {
            name: 'instagram_reel_history',
            ok: instagramHistoryCount >= minInstagramHistoryCount,
            actual: instagramHistoryCount,
            expected_at_least: minInstagramHistoryCount,
        },
    ]

    return {
        healthy: checks.every((check) => check.ok),
        date,
        counts: {
            active_tiktok_accounts: tiktokAccounts.length,
            active_instagram_accounts: instagramAccounts.length,
            daily_snapshots: snapshots.length,
            tiktok_snapshots: tiktokSnapshotCount,
            instagram_snapshots: instagramSnapshotCount,
            tiktok_video_history: tiktokHistoryCount,
            instagram_reel_history: instagramHistoryCount,
        },
        checks,
    }
}
