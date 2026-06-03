
import { NextRequest, NextResponse } from 'next/server'
import { triggerSyncProcess } from '@/lib/sync-trigger'

export const maxDuration = 60

// Helper to check for existing recent cron logs (Deduplication)
// Note: We'll keep this check for GET (Cron) requests
async function hasRecentCron(): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    // We need a service role client here
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabase
        .from('sync_logs')
        .select('id')
        .eq('sync_type', 'cron')
        .gte('started_at', oneHourAgo)
        .limit(1)

    if (error) return false
    return data && data.length > 0
}

function verifySecret(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    return authHeader === `Bearer ${process.env.CRON_SECRET}` ||
        request.headers.get('x-vercel-cron') === '1'
}

export async function POST(request: NextRequest) {
    // SECURE: Require Secret for POST too!
    if (!verifySecret(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json().catch(() => ({}))
        const { platform = 'all', date = null } = body

        const results = await triggerSyncProcess(platform, 'manual', date)
        return NextResponse.json({ success: true, results })
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    if (!verifySecret(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (await hasRecentCron()) {
        return NextResponse.json({ message: 'Skipped: Cron already ran recently.' })
    }

    try {
        const url = new URL(request.url)
        const targetDate = url.searchParams.get('date')
        const results = await triggerSyncProcess('all', 'cron', targetDate)
        return NextResponse.json({ success: true, mode: 'cron', targetDate: targetDate || 'auto', results })
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}
