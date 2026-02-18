
import { createClient } from '@supabase/supabase-js'
import { SCRAPING_TARGETS } from '@/config/scraping_targets'

// Shared logic to trigger Apify Actor
export async function triggerSyncProcess(platform: string = 'all', source: string = 'manual') {
    const apiToken = process.env.APIFY_API_TOKEN
    if (!apiToken) throw new Error('No API Token')

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL not set')

    // Use Service Role Key for logging
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
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
                    resultsPerPage: 20,
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
            const runId = await triggerApifyRun(
                apiToken,
                'apify~instagram-scraper',
                {
                    directUrls: SCRAPING_TARGETS.instagram,
                    resultsLimit: 20,
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

    // Log Trigger
    await (supabase.from('sync_logs') as any).insert({
        sync_type: source,
        platform: platform,
        status: 'triggered',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        error_message: `Async Sync Triggered. Runs: ${JSON.stringify(results.triggered)}`
    })

    return results
}

async function triggerApifyRun(token: string, actorId: string, input: any, webhookUrl: string) {
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
