'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import LandingPage from '@/components/landing/LandingPage'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import ParticleCanvas from '@/components/landing/ParticleCanvas'
import DashboardLoadingOverlay from '@/components/dashboard/DashboardLoadingOverlay'
import { generateSessionId } from '@/lib/utils/format'
import { TikTokAccount, TikTokVideo, InstagramAccount, InstagramReel, Platform } from '@/types/database'
import { fetchAccounts, fetchVideos, fetchVideoStats } from '@/app/actions/tiktok'
import { fetchInstagramAccounts, fetchInstagramReels, fetchInstagramReelStats } from '@/app/actions/instagram'

type ViewState = 'landing' | 'dashboard'

interface LoadStatus {
    visible: boolean
    title: string
    detail: string
    progress: number
}

const INITIAL_LOAD_STATUS: LoadStatus = {
    visible: true,
    title: 'Preparing dashboard',
    detail: 'Loading the first screen',
    progress: 12,
}

const LIVE_DATA_SOFT_TIMEOUT_MS = 8000

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Mock data for demo purposes when database is empty
const MOCK_ACCOUNTS: TikTokAccount[] = [
    {
        id: '1',
        username: 'digipark_official',
        nickname: 'DigiPark',
        avatar_url: null,
        follower_count: 125000,
        following_count: 250,
        heart_count: 2500000,
        video_count: 85,
        signature: 'Digital Innovation Hub',
        is_active: true,
        last_synced_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        website: 'https://digipark.com',
    },
    {
        id: '2',
        username: 'tech_trends_daily',
        nickname: 'Tech Trends',
        avatar_url: null,
        follower_count: 89000,
        following_count: 120,
        heart_count: 1800000,
        video_count: 120,
        signature: 'Your daily dose of tech',
        is_active: true,
        last_synced_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        website: null,
    },
    {
        id: '3',
        username: 'future_creators',
        nickname: 'Future Creators',
        avatar_url: null,
        follower_count: 156000,
        following_count: 180,
        heart_count: 3200000,
        video_count: 95,
        signature: 'Creating the future',
        is_active: true,
        last_synced_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        website: 'https://futurecreators.io',
    },
]

const MOCK_INSTAGRAM_ACCOUNTS: InstagramAccount[] = [
    {
        id: 'ig-1',
        instagram_id: 'inst_1',
        username: 'visual_vibes',
        full_name: 'Visual Vibes Studio',
        avatar_url: null,
        website: 'https://visualvibes.studio',
        is_active: true,
        last_synced_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: 'ig-2',
        instagram_id: 'inst_2',
        username: 'urban_explorer',
        full_name: 'Urban Explorer',
        avatar_url: null,
        website: null,
        is_active: true,
        last_synced_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }
]

// Generate mock videos
function generateMockVideos(): TikTokVideo[] {
    const descriptions = [
        'Check out this amazing tech innovation! 🚀 #tech #innovation',
        'The future is here and it looks incredible ✨ #future #ai',
        'You wont believe what we built today 🔥 #coding #dev',
        'This changed everything for our workflow 💡 #productivity',
        'Behind the scenes at DigiPark HQ 🎬 #behindthescenes',
        'New feature drop! Let us know what you think 👇 #newfeature',
        'The response has been incredible! Thank you all 🙏 #grateful',
        'Tutorial: How to build this in 5 minutes ⏱️ #tutorial',
        'We did not expect this to go viral 🤯 #viral',
        'Day in the life of a tech creator 📱 #dayinthelife',
    ]

    const hashtags = [
        ['tech', 'innovation', 'startup'],
        ['future', 'ai', 'ml'],
        ['coding', 'dev', 'programming'],
        ['productivity', 'workflow', 'tips'],
        ['behindthescenes', 'vlog', 'office'],
        ['newfeature', 'update', 'launch'],
        ['grateful', 'community', 'thankyou'],
        ['tutorial', 'howto', 'learn'],
        ['viral', 'trending', 'fyp'],
        ['dayinthelife', 'lifestyle', 'tech'],
    ]

    const videos: TikTokVideo[] = []
    const now = Date.now()

    MOCK_ACCOUNTS.forEach((account, accountIndex) => {
        for (let i = 0; i < 15; i++) {
            const descIndex = (accountIndex * 5 + i) % descriptions.length
            const daysAgo = Math.floor(Math.random() * 30)
            const createTime = new Date(now - daysAgo * 24 * 60 * 60 * 1000)

            videos.push({
                id: `video-${account.id}-${i}`,
                video_id: `${account.id}${i}${Date.now()}`,
                account_id: account.id,
                description: descriptions[descIndex],
                play_count: Math.floor(Math.random() * 500000) + 10000,
                digg_count: Math.floor(Math.random() * 50000) + 1000,
                comment_count: Math.floor(Math.random() * 2000) + 50,
                share_count: Math.floor(Math.random() * 5000) + 100,
                collect_count: Math.floor(Math.random() * 3000) + 50,
                duration: Math.floor(Math.random() * 60) + 10,
                cover_url: null,
                video_url: null,
                web_video_url: `https://www.tiktok.com/@${account.username}/video/${account.id}${i}`,
                hashtags: hashtags[descIndex],
                music_name: 'Original Sound',
                music_author: account.username,
                create_time: createTime.toISOString(),
                is_ad: false,
                is_pinned: i === 0,
                created_at: createTime.toISOString(),
                updated_at: new Date().toISOString(),
            })
        }
    })

    return videos
}

function generateMockReels(): InstagramReel[] {
    const reels: InstagramReel[] = []
    const now = Date.now()

    MOCK_INSTAGRAM_ACCOUNTS.forEach((account) => {
        for (let i = 0; i < 10; i++) {
            const daysAgo = Math.floor(Math.random() * 30)
            const createTime = new Date(now - daysAgo * 24 * 60 * 60 * 1000)

            reels.push({
                id: `reel-${account.id}-${i}`,
                reel_id: `ig-${account.id}-${i}`,
                short_code: `CODE${i}`,
                account_id: account.id,
                caption: `Instagram Reel content #${i} 📸`,
                hashtags: ['instagram', 'reels', 'viral'],
                mentions: [],
                url: `https://instagram.com/p/CODE${i}`,
                likes_count: Math.floor(Math.random() * 10000),
                comments_count: Math.floor(Math.random() * 500),
                video_play_count: Math.floor(Math.random() * 50000),
                video_duration: 15 + Math.random() * 45,
                thumbnail_url: null,
                video_url: null,
                is_pinned: false,
                is_paid_partnership: false,
                timestamp: createTime.toISOString(),
                created_at: createTime.toISOString(),
                updated_at: createTime.toISOString(),
            })
        }
    })
    return reels
}

export default function DashboardApp() {
    // Default to dashboard directly
    const [view, setView] = useState<ViewState>('dashboard')
    const [sessionId, setSessionId] = useState('')
    const [platform, setPlatform] = useState<Platform>('tiktok')
    const [accounts, setAccounts] = useState<TikTokAccount[]>([])
    const [videos, setVideos] = useState<TikTokVideo[]>([])
    const [videoStats, setVideoStats] = useState<any[]>([])
    const [instagramAccounts, setInstagramAccounts] = useState<InstagramAccount[]>([])
    const [instagramReels, setInstagramReels] = useState<InstagramReel[]>([])
    const [instagramReelStats, setInstagramReelStats] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true) // Tracks the first critical data pass.
    const [loadStatus, setLoadStatus] = useState<LoadStatus>(INITIAL_LOAD_STATUS)
    const hasStartedRef = useRef(false)
    const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const loadTikTokData = useCallback(async (timestamp: number, onPrimaryReady?: () => void) => {
        let primarySettled = false
        let hasRealAccounts = false

        const markPrimaryReady = () => {
            if (primarySettled) return
            primarySettled = true
            onPrimaryReady?.()
        }

        const accountsTask = fetchAccounts(timestamp)
            .then((fetchedAccounts) => {
                hasRealAccounts = fetchedAccounts.length > 0

                if (hasRealAccounts) {
                    setAccounts(fetchedAccounts)
                } else {
                    setAccounts(MOCK_ACCOUNTS)
                    setVideos(generateMockVideos())
                    setVideoStats([])
                }

                markPrimaryReady()
            })
            .catch((error) => {
                console.error('Error fetching TikTok accounts:', error)
                setAccounts(MOCK_ACCOUNTS)
                setVideos(generateMockVideos())
                setVideoStats([])
                markPrimaryReady()
            })

        const videosTask = fetchVideos(timestamp)
            .then((fetchedVideos) => {
                if (hasRealAccounts || fetchedVideos.length > 0) {
                    setVideos(fetchedVideos)
                }
            })
            .catch((error) => {
                console.error('Error fetching TikTok videos:', error)
            })

        const statsTask = delay(1800)
            .then(() => fetchVideoStats(timestamp))
            .then((fetchedVideoStats) => {
                if (hasRealAccounts || fetchedVideoStats.length > 0) {
                    setVideoStats(fetchedVideoStats)
                }
            })
            .catch((error) => {
                console.error('Error fetching TikTok video stats:', error)
            })

        void statsTask

        await Promise.allSettled([accountsTask, videosTask])
        markPrimaryReady()
    }, [])

    const loadInstagramData = useCallback(async (timestamp: number) => {
        try {
            const [igAccounts, igReels, igReelStats] = await Promise.all([
                fetchInstagramAccounts(timestamp),
                fetchInstagramReels(undefined, timestamp),
                fetchInstagramReelStats(undefined, timestamp),
            ])

            if (igAccounts.length > 0) {
                setInstagramAccounts(igAccounts)
                setInstagramReels(igReels)
                setInstagramReelStats(igReelStats)
            } else {
                setInstagramAccounts(MOCK_INSTAGRAM_ACCOUNTS)
                setInstagramReels(generateMockReels())
                setInstagramReelStats([])
            }
        } catch (error) {
            console.error('Error fetching Instagram data:', error)
            setInstagramAccounts(MOCK_INSTAGRAM_ACCOUNTS)
            setInstagramReels(generateMockReels())
            setInstagramReelStats([])
        }
    }, [])

    const hideLoadStatusSoon = useCallback(() => {
        if (dismissTimerRef.current) {
            clearTimeout(dismissTimerRef.current)
        }
        dismissTimerRef.current = setTimeout(() => {
            setLoadStatus((current) => ({ ...current, visible: false }))
        }, 650)
    }, [])

    const handleStart = useCallback(async (showLoader = true) => {
        if (dismissTimerRef.current) {
            clearTimeout(dismissTimerRef.current)
        }

        const timestamp = Date.now()
        setView('dashboard')
        setLoadStatus({
            visible: true,
            title: showLoader ? 'Connecting data sources' : 'Refreshing dashboard',
            detail: showLoader ? 'Fetching priority TikTok metrics' : 'Updating metrics in the background',
            progress: showLoader ? 18 : 45,
        })

        if (showLoader) {
            setIsLoading(true)
        }

        let renderedCriticalData = false
        const markCriticalDataReady = () => {
            if (renderedCriticalData) return
            renderedCriticalData = true
            setIsLoading(false)
            setLoadStatus({
                visible: true,
                title: 'Dashboard ready',
                detail: 'Rendering charts while secondary data finishes',
                progress: 72,
            })
        }

        const instagramTask = loadInstagramData(timestamp)
        const tiktokTask = loadTikTokData(timestamp, markCriticalDataReady)

        const liveDataTask = Promise.allSettled([tiktokTask, instagramTask]).then(() => {
            markCriticalDataReady()
            setLoadStatus({
                visible: true,
                title: 'Dashboard ready',
                detail: 'Primary metrics are ready; totals continue in the background',
                progress: 100,
            })
            hideLoadStatusSoon()
        })

        if (!showLoader) {
            await liveDataTask
            return
        }

        const fallbackTask = delay(LIVE_DATA_SOFT_TIMEOUT_MS).then(() => {
            if (renderedCriticalData) return
            setLoadStatus({
                visible: true,
                title: 'Still loading live data',
                detail: 'Keeping the dashboard ready while data finishes',
                progress: 86,
            })
        })

        await Promise.race([liveDataTask, fallbackTask])
    }, [hideLoadStatusSoon, loadInstagramData, loadTikTokData])

    useEffect(() => {
        setSessionId(generateSessionId())
        if (!hasStartedRef.current) {
            hasStartedRef.current = true
            handleStart()
        }

        return () => {
            if (dismissTimerRef.current) {
                clearTimeout(dismissTimerRef.current)
            }
        }
    }, [handleStart])

    const handlePlatformChange = (newPlatform: Platform) => {
        setPlatform(newPlatform)
    }

    const handleLogout = () => {
        setIsLoading(false)
        setLoadStatus((current) => ({ ...current, visible: false }))
        setView('landing')
    }

    return (
        <main className="relative z-10 w-full min-h-screen flex flex-col">
            {loadStatus.visible && view === 'dashboard' && (
                <DashboardLoadingOverlay
                    title={loadStatus.title}
                    detail={loadStatus.detail}
                    progress={loadStatus.progress}
                />
            )}

            {view === 'landing' && !isLoading && (
                <LandingPage sessionId={sessionId} onStart={handleStart} />
            )}

            {view === 'dashboard' && (
                <>
                    <ParticleCanvas />
                    <DashboardLayout
                        sessionId={sessionId}
                        accounts={accounts}
                        videos={videos}
                        videoStats={videoStats}
                        instagramAccounts={instagramAccounts}
                        instagramReels={instagramReels}
                        instagramReelStats={instagramReelStats}
                        platform={platform}
                        onPlatformChange={handlePlatformChange}
                        onDataRefresh={() => handleStart(false)}
                        onLogout={handleLogout}
                        isDataLoading={isLoading}
                    />
                </>
            )}
        </main>
    )
}
