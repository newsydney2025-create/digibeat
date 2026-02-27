'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { TikTokAccount, TikTokVideo, MetricKey, DashboardMetrics, DailySnapshot, AccountGroup, InstagramAccount, InstagramReel, Platform } from '@/types/database'
import Header from './Header'
import AccountSidebar from './AccountSidebar'
import MetricCards from './MetricCards'
import TimelineChart from './TimelineChart'
import SmallMultiplesGrid from './SmallMultiplesGrid'
import TopContentChart from './TopContentChart'
import DailyVideoList from './DailyVideoList'
import ImpactScatterChart from './ImpactScatterChart'
import HashtagChart from './HashtagChart'
import TrafficShareChart from './TrafficShareChart'
import VideoDetailTable from './VideoDetailTable'
import GroupManager from './GroupManager'
import { generateSessionId } from '@/lib/utils/format'
import { fetchSnapshots, fetchAccountGroups } from '@/app/actions/tiktok'
import PlatformSwitcher from '@/components/common/PlatformSwitcher'
import { adaptReelsToVideos, adaptInstagramAccounts } from '@/lib/utils/platformAdapter'

interface DashboardLayoutProps {
    sessionId: string // kept for display
    accounts: TikTokAccount[]
    videos: TikTokVideo[]
    instagramAccounts: InstagramAccount[]
    instagramReels: InstagramReel[]
    platform: Platform
    onPlatformChange: (platform: Platform) => void
    onLogout: () => void
}

type TimeRange = '3D' | '7D' | '30D' | '90D'

export default function DashboardLayout({
    sessionId,
    accounts,
    videos,
    instagramAccounts,
    instagramReels,
    platform,
    onPlatformChange,
    onLogout,
}: DashboardLayoutProps) {
    const [selectedAccounts, setSelectedAccounts] = useState<string[]>(
        accounts.map((a) => a.id)
    )
    const [currentMetric, setCurrentMetric] = useState<MetricKey>('playCount')
    const [timeRange, setTimeRange] = useState<TimeRange>('30D')
    const [snapshots, setSnapshots] = useState<DailySnapshot[]>([])
    const [groups, setGroups] = useState<AccountGroup[]>([])
    const [groupManagerOpen, setGroupManagerOpen] = useState(false)

    // Hoisted state variables (must be before useMemo)
    const [viewMode, setViewMode] = useState<'total' | 'daily'>('daily')
    const [showAverage, setShowAverage] = useState(true) // New: show average line
    const [hoveredAccount, setHoveredAccount] = useState<string | null>(null) // New: hover sync
    const [chartViewMode, setChartViewMode] = useState<'chart' | 'grid'>('chart') // New: chart vs small multiples

    // Platform-aware data: use adapter to convert Instagram data to TikTok format
    const activeAccounts = useMemo(() => {
        if (platform === 'instagram') {
            return adaptInstagramAccounts(instagramAccounts)
        }
        return accounts
    }, [platform, accounts, instagramAccounts])

    const activeVideos = useMemo(() => {
        if (platform === 'instagram') {
            return adaptReelsToVideos(instagramReels)
        }
        return videos
    }, [platform, videos, instagramReels])

    // Generate snapshots for each account
    // Fixed: Always use DB snapshots for strict daily recording logic
    const activeSnapshots = useMemo(() => {
        return snapshots
    }, [snapshots])

    // Update selected accounts when platform or accounts change
    useEffect(() => {
        if (activeAccounts.length > 0) {
            setSelectedAccounts(activeAccounts.map((a) => a.id))
        }
    }, [activeAccounts])

    // Reset metric if shares is selected but we switch to Instagram (where shares are hidden)
    useEffect(() => {
        if (platform === 'instagram' && currentMetric === 'shareCount') {
            setCurrentMetric('playCount')
        }
    }, [platform, currentMetric])

    // Fetch daily snapshots and groups
    useEffect(() => {
        const loadData = async () => {
            try {
                const [snapshotsData, groupsData] = await Promise.all([
                    fetchSnapshots(),
                    fetchAccountGroups()
                ])
                console.log('Fetched snapshots:', snapshotsData.length, snapshotsData.slice(0, 3))
                setSnapshots(snapshotsData)
                setGroups(groupsData)
            } catch (error) {
                console.error('Failed to load data', error)
            }
        }
        loadData()
    }, [])

    // Filter videos by selected accounts
    const filteredVideos = useMemo(() => {
        return activeVideos.filter((v) => selectedAccounts.includes(v.account_id || ''))
    }, [activeVideos, selectedAccounts])

    // Calculate aggregated metrics
    const totals = useMemo<DashboardMetrics>(() => {
        if (viewMode === 'daily') {
            // Use precomputed per-video gains (gain_views, gain_likes, etc.)
            // These are calculated at sync time: sum of (today - yesterday) for each video
            const latestDate = activeSnapshots.length > 0
                ? activeSnapshots.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b).date
                : null

            if (!latestDate) return { playCount: 0, diggCount: 0, commentCount: 0, shareCount: 0, collectCount: 0 }

            return selectedAccounts.reduce((acc, accountId) => {
                const todaySnap = activeSnapshots.find(s => s.account_id === accountId && s.date === latestDate)

                if (todaySnap) {
                    // Use precomputed gains (already per-video aggregated)
                    acc.playCount += todaySnap.gain_views || 0
                    acc.diggCount += todaySnap.gain_likes || 0
                    acc.commentCount += todaySnap.gain_comments || 0
                    acc.shareCount += todaySnap.gain_shares || 0
                }
                return acc
            }, { playCount: 0, diggCount: 0, commentCount: 0, shareCount: 0, collectCount: 0 })
        }

        // Total view: Sum all current video stats
        return filteredVideos.reduce(
            (acc, video) => ({
                playCount: acc.playCount + video.play_count,
                diggCount: acc.diggCount + video.digg_count,
                commentCount: acc.commentCount + video.comment_count,
                shareCount: acc.shareCount + video.share_count,
                collectCount: acc.collectCount + (video.collect_count || 0),
            }),
            {
                playCount: 0,
                diggCount: 0,
                commentCount: 0,
                shareCount: 0,
                collectCount: 0,
            }
        )
    }, [filteredVideos, viewMode, activeSnapshots, selectedAccounts])

    // State for restoring view after drill-down
    const [viewHistory, setViewHistory] = useState<{
        selectedAccounts: string[],
        timeRange: TimeRange,
        currentMetric: MetricKey
    } | null>(null)

    // Ref for scrolling to detail table
    const tableRef = useRef<HTMLDivElement>(null)
    const [detailView, setDetailView] = useState<{ date: string; username: string; videos: any[] } | null>(null)

    // Handle chart click to drill down
    const handleChartClick = async (username: string, date: string) => {
        // Find account by username
        const account = activeAccounts.find((a) => a.username === username)
        if (account) {
            // Save current state before drilling down
            setViewHistory({
                selectedAccounts: [...selectedAccounts],
                timeRange,
                currentMetric
            })

            // Select only this account for the focused view
            setSelectedAccounts([account.id])

            // Calculate daily gains for simulation
            // Find current snapshot
            const currentSnapshot = activeSnapshots.find(s => s.account_id === account.id && s.date === date)
            let dailyGains = { views: 5000, likes: 500, comments: 50, shares: 20 } // default fallback

            if (currentSnapshot) {
                // Use precomputed per-video gains
                dailyGains = {
                    views: currentSnapshot.gain_views || 0,
                    likes: currentSnapshot.gain_likes || 0,
                    comments: currentSnapshot.gain_comments || 0,
                    shares: currentSnapshot.gain_shares || 0
                }
            }

            // Fetch daily breakdown (simulated)
            try {
                // Import dynamically to avoid server/client issues if not careful, but actions are safe
                const { fetchDailyVideoBreakdown } = await import('@/app/actions/tiktok')
                const breakdown = await fetchDailyVideoBreakdown(account.id, date, dailyGains)

                setDetailView({
                    date,
                    username,
                    videos: breakdown
                })

                console.log(`Drilling down to account: ${username} on date: ${date}`, breakdown)
            } catch (err) {
                console.error('Failed to fetch breakdown', err)
            }
        }
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-cyan-500/30">
            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-900/10 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 flex h-screen overflow-hidden">
                <AccountSidebar
                    accounts={activeAccounts}
                    selectedAccounts={selectedAccounts}
                    onToggleAccount={(id) => {
                        setSelectedAccounts((prev) =>
                            prev.includes(id)
                                ? prev.filter((i) => i !== id)
                                : [...prev, id]
                        )
                    }}
                    onToggleAll={() => {
                        setSelectedAccounts(
                            selectedAccounts.length === activeAccounts.length
                                ? []
                                : activeAccounts.map(a => a.id)
                        )
                    }}
                    videos={activeVideos}
                    hoveredAccount={hoveredAccount}
                    onAccountHover={setHoveredAccount}
                    groups={groups}
                    onOpenGroupManager={() => setGroupManagerOpen(true)}
                    onSelectGroup={(groupId) => {
                        const group = groups.find(g => g.id === groupId)
                        if (group?.members) {
                            // Toggle: if all selected, deselect all; otherwise select all
                            const allSelected = group.members.every(id => selectedAccounts.includes(id))
                            if (allSelected) {
                                setSelectedAccounts(prev => prev.filter(id => !group.members!.includes(id)))
                            } else {
                                setSelectedAccounts(prev => Array.from(new Set([...prev, ...group.members!])))
                            }
                        }
                    }}
                />

                <main className="flex-1 flex flex-col min-w-0 h-full p-6 gap-6 overflow-y-auto custom-scrollbar">
                    <div className="flex items-center justify-between relative z-20" style={{ overflow: 'visible' }}>
                        <Header
                            sessionId={sessionId}
                            onLogout={onLogout}
                            snapshots={activeSnapshots}
                            accounts={accounts} // Pass raw accounts for full list (or activeAccounts if we want filtered)
                            // User likely wants ALL accounts download, not just platform filtered.
                            // But DashboardLayout handles platform switching.
                            // Let's pass ALL available data (props.accounts + props.instagramAccounts)
                            // But Header needs correct props.
                            // Actually DashboardLayout has `accounts` and `instagramAccounts` from props.
                            // `activeSnapshots` contains ALL snapshots (fetchSnapshots returns all).
                            // So we pass them all.
                            instagramAccounts={instagramAccounts}
                        />
                        <PlatformSwitcher
                            platform={platform}
                            onChange={(p) => {
                                onPlatformChange(p)
                                setDetailView(null)
                            }}
                        />
                    </div>

                    {/* Top Row: Performance Metrics - Main Visual Focus */}
                    <div className="glass-panel p-6 rounded-xl flex flex-col min-h-0 relative group h-[650px] shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl pointer-events-none" />

                        <div className="flex justify-between items-start mb-4 z-10">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-3">
                                    <span className="w-1.5 h-8 bg-cyan-400 rounded-full shadow-[0_0_15px_#22d3ee]" />
                                    PERFORMANCE METRICS
                                </h2>
                                <p className="text-xs text-gray-500 mt-1 font-mono uppercase tracking-wider">
                                    daily traffic analysis
                                </p>
                            </div>

                            <div className="flex gap-4 items-center">
                                {/* View Mode Toggle */}
                                <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                                    <button
                                        onClick={() => {
                                            setViewMode('daily')
                                            setDetailView(null)
                                        }}
                                        title="Daily Growth: Traffic gained today by the top 20 most recent videos"
                                        className={`px-3 py-1.5 text-xs font-mono rounded-md transition-all ${viewMode === 'daily'
                                            ? 'bg-white/10 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                                            : 'text-gray-500 hover:text-gray-300'
                                            }`}
                                    >
                                        DAILY
                                    </button>
                                    <button
                                        onClick={() => {
                                            setViewMode('total')
                                            setDetailView(null)
                                        }}
                                        title="Cumulative Total: Current total traffic of the top 20 most recent videos"
                                        className={`px-3 py-1.5 text-xs font-mono rounded-md transition-all ${viewMode === 'total'
                                            ? 'bg-white/10 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                                            : 'text-gray-500 hover:text-gray-300'
                                            }`}
                                    >
                                        TOTAL
                                    </button>
                                </div>

                                <div className="w-px h-6 bg-white/10 mx-2" />

                                {/* Chart Type Toggle */}
                                <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                                    <button
                                        onClick={() => {
                                            setChartViewMode('chart')
                                            setDetailView(null)
                                        }}
                                        className={`px-2 py-1 text-xs font-mono rounded transition-all ${chartViewMode === 'chart'
                                            ? 'bg-white/10 text-cyan-400'
                                            : 'text-gray-500 hover:text-gray-300'
                                            }`}
                                        title="Combined Chart"
                                    >
                                        📈
                                    </button>
                                    <button
                                        onClick={() => {
                                            setChartViewMode('grid')
                                            setDetailView(null)
                                        }}
                                        className={`px-2 py-1 text-xs font-mono rounded transition-all ${chartViewMode === 'grid'
                                            ? 'bg-white/10 text-cyan-400'
                                            : 'text-gray-500 hover:text-gray-300'
                                            }`}
                                        title="Small Multiples Grid"
                                    >
                                        ⊞
                                    </button>
                                </div>
                                {/* Average Toggle (only show in chart mode) */}
                                {chartViewMode === 'chart' && (
                                    <button
                                        onClick={() => setShowAverage(!showAverage)}
                                        className={`px-3 py-1.5 text-xs font-mono rounded-md border transition-all ${showAverage
                                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                                            : 'bg-black/40 border-white/10 text-gray-500 hover:text-gray-300'
                                            }`}
                                    >
                                        {showAverage ? '⊕ AVG' : '≡ ALL'}
                                    </button>
                                )}
                                {/* Time Range Selector */}
                                <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                                    {(['3D', '7D', '30D', '90D'] as TimeRange[]).map((range) => (
                                        <button
                                            key={range}
                                            onClick={() => {
                                                setTimeRange(range)
                                                setDetailView(null)
                                            }}
                                            className={`px-3 py-1.5 text-xs font-mono rounded-md transition-all ${timeRange === range
                                                ? 'bg-white/10 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                                                : 'text-gray-500 hover:text-gray-300'
                                                }`}
                                        >
                                            {range}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {!detailView && (
                            <MetricCards
                                totals={totals}
                                currentMetric={currentMetric}
                                onSelectMetric={setCurrentMetric}
                                platform={platform}
                            />
                        )}

                        <div className={`flex-1 w-full mt-4 relative z-10 min-h-0 ${detailView ? 'h-full' : ''}`}>
                            {detailView ? (
                                <DailyVideoList
                                    date={detailView.date}
                                    username={detailView.username}
                                    videos={detailView.videos}
                                    onBack={() => {
                                        setDetailView(null)
                                        // Restore previous state if exists
                                        if (viewHistory) {
                                            setSelectedAccounts(viewHistory.selectedAccounts)
                                            setTimeRange(viewHistory.timeRange)
                                            setCurrentMetric(viewHistory.currentMetric)
                                            setViewHistory(null)
                                        }
                                    }}
                                    platform={platform}
                                />
                            ) : chartViewMode === 'grid' ? (
                                <SmallMultiplesGrid
                                    snapshots={activeSnapshots}
                                    accounts={activeAccounts}
                                    selectedAccounts={selectedAccounts}
                                    currentMetric={currentMetric}
                                    timeRange={timeRange}
                                    viewMode={viewMode}
                                    onAccountClick={(id) => {
                                        // Focus on this account when clicked in grid
                                        setSelectedAccounts([id])
                                        setChartViewMode('chart')
                                    }}
                                />
                            ) : (
                                <TimelineChart
                                    snapshots={activeSnapshots}
                                    accounts={activeAccounts}
                                    selectedAccounts={selectedAccounts}
                                    currentMetric={currentMetric}
                                    timeRange={timeRange}
                                    onDataClick={handleChartClick}
                                    viewMode={viewMode}
                                    showAverage={showAverage && selectedAccounts.length > 1}
                                    hoveredAccount={hoveredAccount}
                                    onAccountHover={setHoveredAccount}
                                />
                            )}
                        </div>
                    </div>

                    {/* Second Row: Charts */}
                    <div className="grid grid-cols-12 gap-6 h-[280px] shrink-0">
                        <div className="col-span-4 glass-panel p-4 rounded-xl flex flex-col min-h-0">
                            <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">Traffic Share</h3>
                            <TrafficShareChart
                                videos={filteredVideos}
                                accounts={activeAccounts}
                                selectedAccounts={selectedAccounts}
                                currentMetric={currentMetric}
                            />
                        </div>
                        <div className="col-span-4 glass-panel p-4 rounded-xl flex flex-col min-h-0">
                            <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">Top Performing</h3>
                            <TopContentChart
                                videos={filteredVideos}
                                accounts={activeAccounts}
                                currentMetric={currentMetric}
                                onVideoClick={(url) => window.open(url, '_blank')}
                            />
                        </div>
                        <div className="col-span-4 glass-panel p-4 rounded-xl flex flex-col min-h-0">
                            <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">Hot Hashtags</h3>
                            <HashtagChart videos={filteredVideos} />
                        </div>
                    </div>

                    {/* Third Row: Impact Analysis */}
                    <div className="glass-panel p-4 rounded-xl flex flex-col min-h-0 h-[280px] shrink-0">
                        <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-widest">Impact Scatter Analysis</h3>
                        <ImpactScatterChart videos={filteredVideos} accounts={activeAccounts} onVideoClick={(url) => window.open(url, '_blank')} />
                    </div>

                    {/* Bottom Row: Detailed Table */}
                    <div ref={tableRef} className="h-[400px] shrink-0">
                        <VideoDetailTable videos={filteredVideos} accounts={activeAccounts} platform={platform} />
                    </div>
                </main>
            </div>

            {/* Group Manager Modal */}
            <GroupManager
                accounts={activeAccounts}
                isOpen={groupManagerOpen}
                onClose={() => setGroupManagerOpen(false)}
                onGroupsChange={setGroups}
            />
        </div>
    )
}
