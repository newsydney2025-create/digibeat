import { NextRequest, NextResponse } from 'next/server'
import { getDailySyncHealth, isDateKey, sydneyDateKey } from '@/lib/sync-health'

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
        const date = url.searchParams.get('date') || sydneyDateKey(new Date())

        if (!isDateKey(date)) {
            return NextResponse.json({ error: 'Invalid or missing date' }, { status: 400 })
        }

        const health = await getDailySyncHealth(date)

        return NextResponse.json(health, { status: health.healthy ? 200 : 500 })
    } catch (error) {
        return NextResponse.json({
            healthy: false,
            error: String(error),
        }, { status: 500 })
    }
}
