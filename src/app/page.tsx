'use client'

import { useState, useEffect } from 'react'
import LandingPage from '@/components/landing/LandingPage'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import ParticleCanvas from '@/components/landing/ParticleCanvas'
import { generateSessionId } from '@/lib/utils/format'
import { TikTokAccount, TikTokVideo, InstagramAccount, InstagramReel, Platform } from '@/types/database'
import { fetchAccounts, fetchVideos } from './actions/tiktok'
import { fetchInstagramAccounts, fetchInstagramReels } from './actions/instagram'

type ViewState = 'landing' | 'dashboard'

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

    MOCK_INSTAGRAM_ACCOUNTS.forEach((account, idx) => {
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

export default function Home() {
    // Default to dashboard directly
    const [view, setView] = useState<ViewState>('dashboard')
    const [sessionId, setSessionId] = useState('')
    const [platform, setPlatform] = useState<Platform>('tiktok')

    useEffect(() => {
        setSessionId(generateSessionId())
        // Auto-start (fetch data) on mount
        handleStart()
    }, [])

    const [accounts, setAccounts] = useState<TikTokAccount[]>([])
    const [videos, setVideos] = useState<TikTokVideo[]>([])
    const [instagramAccounts, setInstagramAccounts] = useState<InstagramAccount[]>([])
    const [instagramReels, setInstagramReels] = useState<InstagramReel[]>([])
    const [isLoading, setIsLoading] = useState(true) // Start loading immediately

    const handleStart = async () => {
        setIsLoading(true)

        try {
            // Fetch TikTok data
            const [fetchedAccounts, fetchedVideos] = await Promise.all([
                fetchAccounts(),
                fetchVideos(),
            ])

            if (fetchedAccounts.length > 0 && fetchedVideos.length > 0) {
                setAccounts(fetchedAccounts)
                setVideos(fetchedVideos)
            } else {
                // Use mock data for demo
                setAccounts(MOCK_ACCOUNTS)
                setVideos(generateMockVideos())
            }

            // Fetch Instagram data
            const [igAccounts, igReels] = await Promise.all([
                fetchInstagramAccounts(),
                fetchInstagramReels(),
            ])

            if (igAccounts.length > 0) {
                setInstagramAccounts(igAccounts)
                setInstagramReels(igReels)
            } else {
                setInstagramAccounts(MOCK_INSTAGRAM_ACCOUNTS)
                setInstagramReels(generateMockReels())
            }

        } catch (error) {
            console.error('Error fetching data:', error)
            // Fall back to mock data
            setAccounts(MOCK_ACCOUNTS)
            setVideos(generateMockVideos())
            setInstagramAccounts(MOCK_INSTAGRAM_ACCOUNTS)
            setInstagramReels(generateMockReels())
        }

        setView('dashboard')
        setIsLoading(false)
    }

    const handlePlatformChange = (newPlatform: Platform) => {
        setPlatform(newPlatform)
    }

    const handleLogout = () => {
        setView('landing')
    }

    return (
        <main className="relative z-10 w-full min-h-screen flex flex-col">
            {view === 'landing' && (
                <LandingPage sessionId={sessionId} onStart={handleStart} />
            )}
            {view === 'dashboard' && (
                <>
                    <ParticleCanvas />
                    <DashboardLayout
                        sessionId={sessionId}
                        accounts={accounts}
                        videos={videos}
                        instagramAccounts={instagramAccounts}
                        instagramReels={instagramReels}
                        platform={platform}
                        onPlatformChange={handlePlatformChange}
                        onLogout={handleLogout}
                    />
                </>
            )}
        </main>
    )
}
