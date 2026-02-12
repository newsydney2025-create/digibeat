
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processTikTokDataBulk, processInstagramDataBulk, ApifyTikTokData, ApifyInstagramData } from '../../../../lib/sync'

export const maxDuration = 300 // Set max duration to 5 mins (Vercel Pro) just in case, though we expect <10s

export async function POST(request: NextRequest) {
    try {
        const url = new URL(request.url)
        const platform = url.searchParams.get('platform')
        const secret = url.searchParams.get('secret')

        // Security Check
        if (secret !== process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        // Apify webhook payload structure:
        // { userId, createdAt, eventType, eventData: { actorId, runId, ... }, resource: { id, ... } }
        const runId = body.resource?.id
        const eventType = body.eventType

        if (eventType !== 'ACTOR.RUN.SUCCEEDED') {
            return NextResponse.json({ message: 'Ignoring non-success event' })
        }

        if (!runId) {
            return NextResponse.json({ error: 'No runId found' }, { status: 400 })
        }

        console.log(`Webhook received for ${platform}, runId: ${runId}`)

        // Use Service Role Key to bypass RLS for webhook ingestion
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

        const apiToken = process.env.APIFY_API_TOKEN!

        // Fetch results from Apify
        const datasetResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apiToken}`)

        if (!datasetResponse.ok) {
            throw new Error(`Failed to fetch dataset: ${datasetResponse.statusText}`)
        }

        // --- PROCESSING LOGIC (BULK) ---

        if (platform === 'tiktok') {
            const items: ApifyTikTokData[] = await datasetResponse.json()
            console.log(`Processing ${items.length} TikTok items...`)
            await processTikTokDataBulk(supabase, items, true) // Assume isDaily=true for webhook
        } else if (platform === 'instagram') {
            const items: ApifyInstagramData[] = await datasetResponse.json()
            console.log(`Processing ${items.length} Instagram items...`)
            await processInstagramDataBulk(supabase, items, true)
        } else {
            return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
        }

        // Log success
        await (supabase.from('sync_logs') as any).insert({
            sync_type: 'webhook',
            platform: platform,
            status: 'success',
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            videos_synced: 0, // We could count items, but bulk function handles it. 
            error_message: `Run ${runId} processed successfully via Bulk Upsert`
        })

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Webhook processing failed:', error)
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}
