
import { NextRequest, NextResponse } from 'next/server'
import { SCRAPING_TARGETS } from '@/config/scraping_targets'
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
        const { platform = 'all' } = body

        const results = await triggerSyncProcess(platform, 'manual')
        return NextResponse.json({ success: true, results })
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    // Check Cron
    if (verifySecret(request)) {
        if (await hasRecentCron()) {
            return NextResponse.json({ message: 'Skipped: Cron already ran recently.' })
        }

        try {
            const results = await triggerSyncProcess('all', 'cron')
            return NextResponse.json({ success: true, mode: 'cron', results })
        } catch (error) {
            return NextResponse.json({ error: String(error) }, { status: 500 })
        }
    }

    return NextResponse.json({
        message: 'Sync API (Async Mode)',
        targets: SCRAPING_TARGETS,
        usage: 'POST /api/sync { "platform": "tiktok" | "instagram" | "all" } - Requires Auth'
    })
}
