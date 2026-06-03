import { NextRequest, NextResponse } from 'next/server'
import { eveningBackupTargetDate, getDailySyncHealth, isDateKey } from '@/lib/sync-health'
import { triggerSyncProcess } from '@/lib/sync-trigger'

export const maxDuration = 60

function verifySecret(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    return authHeader === `Bearer ${process.env.CRON_SECRET}` ||
        request.headers.get('x-vercel-cron') === '1'
}

export async function GET(request: NextRequest) {
    if (!verifySecret(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const url = new URL(request.url)
        const targetDate = url.searchParams.get('date') || eveningBackupTargetDate(new Date())

        if (!isDateKey(targetDate)) {
            return NextResponse.json({ error: 'Invalid or missing target date' }, { status: 400 })
        }

        const health = await getDailySyncHealth(targetDate)

        if (health.healthy) {
            return NextResponse.json({
                success: true,
                mode: 'vercel-backup',
                action: 'skipped',
                targetDate,
                reason: 'Daily data already landed.',
                health,
            })
        }

        const results = await triggerSyncProcess('all', 'cron_backup', targetDate)

        return NextResponse.json({
            success: true,
            mode: 'vercel-backup',
            action: 'triggered',
            targetDate,
            health_before: health,
            results,
        })
    } catch (error) {
        return NextResponse.json({
            success: false,
            mode: 'vercel-backup',
            error: String(error),
        }, { status: 500 })
    }
}
