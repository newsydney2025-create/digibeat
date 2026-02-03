import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TikTokVideo } from '@/types/database'

interface ApifyVideoData {
    id: string
    text: string
    createTime: number
    createTimeISO: string
    isAd: boolean
    authorMeta: {
        id: string
        name: string
        profileUrl: string
        nickName: string
        verified: boolean
        signature: string
        avatar: string
        fans: number
        following: number
        heart: number
        video: number
    }
    webVideoUrl: string
    diggCount: number
    shareCount: number
    playCount: number
    collectCount: number
    commentCount: number
    hashtags: { name: string }[]
    musicMeta?: {
        musicName: string
        musicAuthor: string
    }
    videoMeta?: {
        duration: number
        coverUrl: string
    }
    isPinned: boolean
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { profiles, is_daily } = body as { profiles: string[], is_daily?: boolean }

        if (!profiles || profiles.length === 0) {
            return NextResponse.json(
                { error: 'Profiles array is required' },
                { status: 400 }
            )
        }

        const apiToken = process.env.APIFY_API_TOKEN
        if (!apiToken) {
            return NextResponse.json(
                { error: 'APIFY_API_TOKEN not configured' },
                { status: 500 }
            )
        }

        const supabase = await createClient()

        // Start Apify actor run
        const runResponse = await fetch(
            `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/runs?token=${apiToken}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    profiles: profiles,
                    resultsPerPage: 50, // Get top 50 to ensure we have enough non-pinned
                    profileScrapeSections: ['videos'],
                    profileSorting: 'latest',
                }),
            }
        )

        if (!runResponse.ok) {
            const errorText = await runResponse.text()
            return NextResponse.json(
                { error: `Apify error: ${errorText}` },
                { status: runResponse.status }
            )
        }

        const runData = await runResponse.json()
        const runId = runData.data.id

        // Wait for run to complete (with timeout)
        let status = 'RUNNING'
        let attempts = 0
        const maxAttempts = 60 // 5 minutes max

        while (status === 'RUNNING' && attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 5000))

            const statusResponse = await fetch(
                `https://api.apify.com/v2/actor-runs/${runId}?token=${apiToken}`
            )
            const statusData = await statusResponse.json()
            status = statusData.data.status
            attempts++
        }

        if (status !== 'SUCCEEDED') {
            return NextResponse.json(
                { error: `Run failed with status: ${status}` },
                { status: 500 }
            )
        }

        // Get results from dataset
        const datasetResponse = await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apiToken}`
        )
        const items: ApifyVideoData[] = await datasetResponse.json()

        let videosProcessed = 0
        const accountVideosMap = new Map<string, TikTokVideo[]>()
        const accountIdMap = new Map<string, string>() // username -> account_id

        for (const item of items) {
            // Upsert account
            const { data: account } = await supabase
                .from('tiktok_accounts')
                .upsert(
                    {
                        username: item.authorMeta.name,
                        nickname: item.authorMeta.nickName,
                        avatar_url: item.authorMeta.avatar,
                        follower_count: item.authorMeta.fans || 0,
                        following_count: item.authorMeta.following || 0,
                        heart_count: item.authorMeta.heart || 0,
                        video_count: item.authorMeta.video || 0,
                        signature: item.authorMeta.signature,
                        last_synced_at: new Date().toISOString(),
                    } as any,
                    { onConflict: 'username' }
                )
                .select()
                .single()

            if (account) {
                accountIdMap.set((account as any).username, (account as any).id)

                // Upsert video
                const { data: video } = await supabase.from('tiktok_videos').upsert(
                    {
                        video_id: item.id,
                        account_id: (account as any).id,
                        description: item.text,
                        play_count: item.playCount || 0,
                        digg_count: item.diggCount || 0,
                        comment_count: item.commentCount || 0,
                        share_count: item.shareCount || 0,
                        collect_count: item.collectCount || 0,
                        duration: item.videoMeta?.duration || 0,
                        cover_url: item.videoMeta?.coverUrl,
                        web_video_url: item.webVideoUrl,
                        hashtags: item.hashtags?.map((h) => h.name) || [],
                        music_name: item.musicMeta?.musicName,
                        music_author: item.musicMeta?.musicAuthor,
                        create_time: item.createTimeISO,
                        is_ad: item.isAd || false,
                        is_pinned: item.isPinned || false,
                        updated_at: new Date().toISOString(),
                    } as any,
                    { onConflict: 'video_id' }
                ).select().single()

                if (video) {
                    if (!accountVideosMap.has((account as any).id)) {
                        accountVideosMap.set((account as any).id, [])
                    }
                    accountVideosMap.get((account as any).id)?.push(video as TikTokVideo)
                    videosProcessed++
                }
            }
        }

        // Daily Snapshot Logic
        let snapshotsCreated = 0
        if (is_daily) {
            const today = new Date().toISOString().split('T')[0]

            for (const [accountId, videos] of Array.from(accountVideosMap.entries())) {
                // Filter out pinned videos and sort by create_time desc (latest first)
                // Note: Apify usually returns filtered list, but we ensure correctness here
                const nonPinnedVideos = videos
                    .filter((v: TikTokVideo) => !v.is_pinned)
                    .sort((a: TikTokVideo, b: TikTokVideo) => new Date(b.create_time || '1970-01-01').getTime() - new Date(a.create_time || '1970-01-01').getTime())
                    .slice(0, 20) // Take top 20

                if (nonPinnedVideos.length > 0) {
                    const totals = nonPinnedVideos.reduce((acc: { views: number; likes: number; comments: number; shares: number }, v: TikTokVideo) => ({
                        views: acc.views + v.play_count,
                        likes: acc.likes + v.digg_count,
                        comments: acc.comments + v.comment_count,
                        shares: acc.shares + v.share_count
                    }), { views: 0, likes: 0, comments: 0, shares: 0 })

                    // Upsert daily snapshot
                    await supabase.from('daily_snapshots').upsert({
                        account_id: accountId,
                        date: today,
                        total_views: totals.views,
                        total_likes: totals.likes,
                        total_comments: totals.comments,
                        total_shares: totals.shares,
                        video_count: nonPinnedVideos.length,
                        created_at: new Date().toISOString()
                    } as any, { onConflict: 'account_id, date' })

                    snapshotsCreated++
                }
            }
        }

        return NextResponse.json({
            success: true,
            videosProcessed,
            snapshotsCreated,
            runId,
        })
    } catch (error) {
        console.error('Sync error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}

export async function GET() {
    return NextResponse.json({
        message: 'TikTok Sync API',
        usage: 'POST /api/sync with { profiles: ["username1"], is_daily: true }',
    })
}
