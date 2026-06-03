
import { createClient } from '@supabase/supabase-js'
import { SCRAPING_TARGETS } from '@/config/scraping_targets'

function isDateKey(value: string | null | undefined): value is string {
    return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

// Shared logic to trigger Apify Actor
export async function triggerSyncProcess(platform: string = 'all', source: string = 'manual', targetDate?: string | null) {
    const apiToken = process.env.APIFY_API_TOKEN
    if (!apiToken) throw new Error('No API Token')
    if (targetDate && !isDateKey(targetDate)) throw new Error(`Invalid target date: ${targetDate}`)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL not set')

    // Use Service Role Key for logging
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const results: any = { triggered: [] }
    const targets = await fetchActiveScrapingTargets(supabase)
    const webhookDateParam = targetDate ? `&date=${encodeURIComponent(targetDate)}` : ''

    // --- TikTok ---
    if (platform === 'all' || platform === 'tiktok') {
        if (targets.tiktok.length > 0) {
            const runId = await triggerApifyRun(
                apiToken,
                'clockworks~tiktok-scraper',
                {
                    profiles: targets.tiktok,
                    resultsPerPage: 20,
                    profileScrapeSections: ['videos'],
                    profileSorting: 'latest'
                },
                `${appUrl}/api/webhook/apify?platform=tiktok&secret=${process.env.CRON_SECRET}${webhookDateParam}`
            )
            results.triggered.push({ platform: 'tiktok', runId })
        }
    }

    // --- Instagram ---
    if (platform === 'all' || platform === 'instagram') {
        if (targets.instagram.length > 0) {
            const runId = await triggerApifyRun(
                apiToken,
                'apify~instagram-scraper',
                {
                    directUrls: targets.instagram,
                    resultsLimit: 20,
                    scrapePosts: true,
                    scrapeComments: false,
                    resultsType: 'posts',
                    searchLimit: 1
                },
                `${appUrl}/api/webhook/apify?platform=instagram&secret=${process.env.CRON_SECRET}${webhookDateParam}`
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
        error_message: `Async Sync Triggered. Target date: ${targetDate || 'auto'}. Runs: ${JSON.stringify(results.triggered)}`
    })

    return results
}

async function fetchActiveScrapingTargets(supabase: any) {
    const [tkResult, igResult] = await Promise.all([
        supabase
            .from('tiktok_accounts')
            .select('username')
            .eq('is_active', true),
        supabase
            .from('instagram_accounts')
            .select('username, website')
            .eq('is_active', true),
    ])

    if (tkResult.error) {
        console.warn('Falling back to configured TikTok targets:', tkResult.error.message)
    }

    if (igResult.error) {
        console.warn('Falling back to configured Instagram targets:', igResult.error.message)
    }

    const tiktok = tkResult.data?.length
        ? Array.from(new Set(tkResult.data.map((account: any) => account.username).filter(Boolean)))
        : SCRAPING_TARGETS.tiktok

    const instagram = igResult.data?.length
        ? Array.from(new Set(igResult.data.map((account: any) => {
            const website = account.website?.trim()
            if (website && website.includes('instagram.com')) return website
            return `https://www.instagram.com/${account.username}/`
        }).filter(Boolean)))
        : SCRAPING_TARGETS.instagram

    return { tiktok, instagram }
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
