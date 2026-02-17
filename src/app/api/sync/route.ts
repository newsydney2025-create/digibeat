import { NextRequest, NextResponse } from 'next/server'
// import { createClient } from '@/lib/supabase/server'
import { SCRAPING_TARGETS } from '@/config/scraping_targets'

export const maxDuration = 60 // Triggering is fast

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const { platform = 'all', is_daily = true } = body

        return await handleTrigger(request, platform, is_daily, 'manual')
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}

// Helper to check for existing recent cron logs (Deduplication)
async function hasRecentCron(supabase: any): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
        .from('sync_logs')
        .select('id')
        .eq('sync_type', 'cron')
        .gte('started_at', oneHourAgo)
        .limit(1)

    if (error) {
        console.error('Dedup check failed:', error)
        return false // Fail open (allow sync if check fails)
    }
    return data && data.length > 0
}

export async function GET(request: NextRequest) {
    // Check Cron
    const authHeader = request.headers.get('authorization')
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}` ||
        request.headers.get('x-vercel-cron') === '1'

    if (isCron) {
        // Init Supabase for check
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        if (await hasRecentCron(supabase)) {
            return NextResponse.json({ message: 'Skipped: Cron already ran recently.' })
        }

        return await handleTrigger(request, 'all', true, 'cron')
    }

    return NextResponse.json({
        message: 'Sync API (Async Mode)',
        targets: SCRAPING_TARGETS,
        usage: 'POST /api/sync { "platform": "tiktok" | "instagram" | "all" }'
    })
}

async function handleTrigger(request: NextRequest, platform: string, isDaily: boolean, source: string) {
    const apiToken = process.env.APIFY_API_TOKEN
    if (!apiToken) return NextResponse.json({ error: 'No API Token' }, { status: 500 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    if (!appUrl) return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL not set' }, { status: 500 })

    // Use Service Role Key to bypass RLS for sync logging
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )
    const results: any = { triggered: [] }

    // --- TikTok ---
    if (platform === 'all' || platform === 'tiktok') {
        if (SCRAPING_TARGETS.tiktok.length > 0) {
            const runId = await triggerApifyRun(
                apiToken,
                'clockworks~tiktok-scraper',
                {
                    profiles: SCRAPING_TARGETS.tiktok,
                    resultsPerPage: 20, // INCREASED LIMIT
                    profileScrapeSections: ['videos'],
                    profileSorting: 'latest'
                },
                `${appUrl}/api/webhook/apify?platform=tiktok&secret=${process.env.CRON_SECRET}`
            )
            results.triggered.push({ platform: 'tiktok', runId })
        }
    }

    // --- Instagram ---
    if (platform === 'all' || platform === 'instagram') {
        if (SCRAPING_TARGETS.instagram.length > 0) {
            // Profile Scrape (Optional, but good for metadata)
            // Triggering 2 runs might use more CU, but it's cleaner. 
            // Let's Skip Profile Scrape for now to focus on fixing the main issue (Snapshots) which comes from posts.
            // Wait, if I skip profile scrape, account metadata (avatar) might be stale/missing?
            // I'll leave it for now. User needs metrics.

            // Post Scrape
            const runId = await triggerApifyRun(
                apiToken,
                'apify~instagram-scraper',
                {
                    directUrls: SCRAPING_TARGETS.instagram,
                    resultsLimit: 20, // INCREASED LIMIT
                    scrapePosts: true,
                    scrapeComments: false,
                    resultsType: 'posts',
                    searchLimit: 1
                },
                `${appUrl}/api/webhook/apify?platform=instagram&secret=${process.env.CRON_SECRET}`
            )
            results.triggered.push({ platform: 'instagram', runId })
        }
    }

    // Log Trigger (use type assertion since sync_logs isn't in generated types)
    await (supabase.from('sync_logs') as any).insert({
        sync_type: source, // 'cron' or 'manual'
        platform: platform,
        status: 'triggered',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        error_message: `Async Sync Triggered. Runs: ${JSON.stringify(results.triggered)}`
    })

    return NextResponse.json({ success: true, mode: 'async', results })
}

async function triggerApifyRun(token: string, actorId: string, input: any, webhookUrl: string) {
    // Apify requires webhooks to be Base64-encoded JSON in the query parameter
    const webhooksConfig = [{
        eventTypes: ['ACTOR.RUN.SUCCEEDED'],
        requestUrl: webhookUrl
    }]
    const webhooksBase64 = Buffer.from(JSON.stringify(webhooksConfig)).toString('base64')

    const res = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${token}&webhooks=${webhooksBase64}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
    })

    if (!res.ok) throw new Error(`Apify trigger failed: ${await res.text()}`)
    const data = await res.json()
    console.log(`Apify run started: ${data.data.id}, webhook: ${webhookUrl}`)
    return data.data.id
}
