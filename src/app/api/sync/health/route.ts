import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const SYDNEY_TIME_ZONE = 'Australia/Sydney'
const HISTORY_ROWS_PER_ACCOUNT_WARNING = 10
const SNAPSHOT_ACCOUNT_COVERAGE_WARNING = 0.8
type CountQueryResult = PromiseLike<{
    count: number | null
    error: { message: string } | null
}>

function verifySecret(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    return authHeader === `Bearer ${process.env.CRON_SECRET}` ||
        request.headers.get('x-vercel-cron') === '1'
}

function sydneyDateKey(value: string | number | Date | null | undefined) {
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

async function fetchExactCount(query: CountQueryResult) {
    const { count, error } = await query
    if (error) throw error
    return count || 0
}

export async function GET(request: NextRequest) {
    if (!verifySecret(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const supabase = createAdminClient()
        const url = new URL(request.url)
        const date = url.searchParams.get('date') || sydneyDateKey(new Date())

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return NextResponse.json({ error: 'Invalid or missing date' }, { status: 400 })
        }

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
        const expectedSnapshotCount = tiktokAccounts.length + instagramAccounts.length
        const minSnapshotCount = Math.max(1, Math.floor(expectedSnapshotCount * SNAPSHOT_ACCOUNT_COVERAGE_WARNING))
        const minTiktokHistoryCount = Math.max(tiktokAccounts.length, tiktokAccounts.length * HISTORY_ROWS_PER_ACCOUNT_WARNING)
        const minInstagramHistoryCount = Math.max(instagramAccounts.length, instagramAccounts.length * HISTORY_ROWS_PER_ACCOUNT_WARNING)

        const checks = [
            {
                name: 'daily_snapshots',
                ok: snapshots.length >= minSnapshotCount,
                actual: snapshots.length,
                expected_at_least: minSnapshotCount,
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
        const healthy = checks.every((check) => check.ok)

        return NextResponse.json({
            healthy,
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
        }, { status: healthy ? 200 : 500 })
    } catch (error) {
        return NextResponse.json({
            healthy: false,
            error: String(error),
        }, { status: 500 })
    }
}
