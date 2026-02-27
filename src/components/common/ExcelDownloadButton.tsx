'use client'

import React, { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { DailySnapshot, TikTokAccount, InstagramAccount } from '@/types/database'

interface ExcelDownloadButtonProps {
    snapshots: DailySnapshot[]
    accounts: TikTokAccount[]
    instagramAccounts: InstagramAccount[]
}

interface ExcelRow {
    Platform: string
    Account: string
    Nickname: string
    Date: string
    'Total Followers': number | string
    'Total Views': number
    'Total Likes': number
    'Total Comments': number
    'Total Shares': number | string
    'Daily Views': number
    'Daily Likes': number
    'Daily Comments': number
    'Daily Shares': number | string
    'Video Count': number | string
}

interface WeeklySummaryRow {
    Platform: string
    Account: string
    Nickname: string
    'Period': string
    'Total Followers': number | string
    'Week Total Views Gain': number
    'Week Total Likes Gain': number
    'Week Total Comments Gain': number
    'Week Total Shares Gain': number | string
    'Avg Daily Views': number
    'Avg Daily Likes': number
    'Avg Daily Comments': number
    'Avg Daily Shares': number | string
    'Days with Data': number
}

export default function ExcelDownloadButton({ snapshots, accounts, instagramAccounts }: ExcelDownloadButtonProps) {
    const [showMenu, setShowMenu] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    // Close menu on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false)
            }
        }
        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showMenu])

    // Helper: build a row for an account + snapshot
    const buildRow = (
        platform: string,
        username: string,
        nickname: string,
        date: string,
        followerCount: number | string,
        snap: DailySnapshot | undefined
    ): ExcelRow => ({
        Platform: platform,
        Account: username,
        Nickname: nickname,
        Date: date,
        'Total Followers': followerCount,
        'Total Views': snap ? snap.total_views : 0,
        'Total Likes': snap ? snap.total_likes : 0,
        'Total Comments': snap ? snap.total_comments : 0,
        'Total Shares': platform === 'Instagram' ? 'N/A' : (snap ? snap.total_shares : 0),
        'Daily Views': snap ? snap.gain_views : 0,
        'Daily Likes': snap ? snap.gain_likes : 0,
        'Daily Comments': snap ? snap.gain_comments : 0,
        'Daily Shares': platform === 'Instagram' ? 'N/A' : (snap ? snap.gain_shares : 0),
        'Video Count': snap ? snap.video_count : 0,
    })

    // Column widths for the detail sheet
    const detailColWidths = [
        { wch: 10 },  // Platform
        { wch: 22 },  // Account
        { wch: 22 },  // Nickname
        { wch: 12 },  // Date
        { wch: 16 },  // Total Followers
        { wch: 14 },  // Total Views
        { wch: 14 },  // Total Likes
        { wch: 16 },  // Total Comments
        { wch: 14 },  // Total Shares
        { wch: 14 },  // Daily Views
        { wch: 14 },  // Daily Likes
        { wch: 16 },  // Daily Comments
        { wch: 14 },  // Daily Shares
        { wch: 14 },  // Video Count
    ]

    const sortExcelRows = (rows: ExcelRow[]) => {
        rows.sort((a, b) => {
            const aViews = typeof a['Daily Views'] === 'number' ? a['Daily Views'] : 0
            const bViews = typeof b['Daily Views'] === 'number' ? b['Daily Views'] : 0
            return bViews - aViews
        })
    }

    // ========== Daily Report ==========
    const handleDailyDownload = () => {
        if (!snapshots.length) {
            alert('No data available to download')
            return
        }

        const latestDate = snapshots.reduce((max, s) => s.date > max ? s.date : max, snapshots[0].date)
        const dailyData = snapshots.filter(s => s.date === latestDate)

        const tiktokRows: ExcelRow[] = []
        const instagramRows: ExcelRow[] = []

        // TikTok
        accounts.forEach(acc => {
            const snap = dailyData.find(s => s.account_id === acc.id)
            tiktokRows.push(buildRow('TikTok', acc.username, acc.nickname || '', latestDate, acc.follower_count, snap))
        })

        // Instagram
        instagramAccounts.forEach(acc => {
            const snap = dailyData.find(s => s.account_id === acc.id)
            instagramRows.push(buildRow('Instagram', acc.username, acc.full_name || '', latestDate, 'N/A', snap))
        })

        // Sort by Daily Views descending
        sortExcelRows(tiktokRows)
        sortExcelRows(instagramRows)

        const wb = XLSX.utils.book_new()

        const wsTiktok = XLSX.utils.json_to_sheet(tiktokRows)
        wsTiktok['!cols'] = detailColWidths
        XLSX.utils.book_append_sheet(wb, wsTiktok, `TikTok Daily`)

        const wsInstagram = XLSX.utils.json_to_sheet(instagramRows)
        wsInstagram['!cols'] = detailColWidths
        XLSX.utils.book_append_sheet(wb, wsInstagram, `Instagram Daily`)

        XLSX.writeFile(wb, `Digibeat_Daily_${latestDate}.xlsx`)

        setShowMenu(false)
    }

    // ========== Weekly Report ==========
    const handleWeeklyDownload = () => {
        if (!snapshots.length) {
            alert('No data available to download')
            return
        }

        const allDates = Array.from(new Set(snapshots.map(s => s.date))).sort((a, b) => b.localeCompare(a))
        const weekDates = allDates.slice(0, 7)
        const weekStart = weekDates[weekDates.length - 1]
        const weekEnd = weekDates[0]
        const weekData = snapshots.filter(s => weekDates.includes(s.date))

        // Collect all account IDs and their total weekly views for sorting
        const accountWeeklyViews: Map<string, number> = new Map()

        accounts.forEach(acc => {
            let totalGainViews = 0
            weekDates.forEach(date => {
                const snap = weekData.find(s => s.account_id === acc.id && s.date === date)
                totalGainViews += snap ? snap.gain_views : 0
            })
            accountWeeklyViews.set(acc.id, totalGainViews)
        })

        instagramAccounts.forEach(acc => {
            let totalGainViews = 0
            weekDates.forEach(date => {
                const snap = weekData.find(s => s.account_id === acc.id && s.date === date)
                totalGainViews += snap ? snap.gain_views : 0
            })
            accountWeeklyViews.set(acc.id, totalGainViews)
        })

        const sortedTikTok = [...accounts].sort((a, b) =>
            (accountWeeklyViews.get(b.id) || 0) - (accountWeeklyViews.get(a.id) || 0)
        )
        const sortedInstagram = [...instagramAccounts].sort((a, b) =>
            (accountWeeklyViews.get(b.id) || 0) - (accountWeeklyViews.get(a.id) || 0)
        )

        const sortedDatesAsc = [...weekDates].sort((a, b) => a.localeCompare(b))

        // ---- Detail Rows ----
        const detailRowsTiktok: ExcelRow[] = []
        const detailRowsInstagram: ExcelRow[] = []

        sortedTikTok.forEach(acc => {
            sortedDatesAsc.forEach(date => {
                const snap = weekData.find(s => s.account_id === acc.id && s.date === date)
                if (snap) {
                    detailRowsTiktok.push(buildRow('TikTok', acc.username, acc.nickname || '', date, acc.follower_count, snap))
                }
            })
        })

        sortedInstagram.forEach(acc => {
            sortedDatesAsc.forEach(date => {
                const snap = weekData.find(s => s.account_id === acc.id && s.date === date)
                if (snap) {
                    detailRowsInstagram.push(buildRow('Instagram', acc.username, acc.full_name || '', date, 'N/A', snap))
                }
            })
        })

        // ---- Summary Rows ----
        const summaryRowsTiktok: WeeklySummaryRow[] = []
        const summaryRowsInstagram: WeeklySummaryRow[] = []

        sortedTikTok.forEach(acc => {
            const accSnaps = weekData.filter(s => s.account_id === acc.id)
            const daysCount = accSnaps.length
            const totalViews = accSnaps.reduce((sum, s) => sum + s.gain_views, 0)
            const totalLikes = accSnaps.reduce((sum, s) => sum + s.gain_likes, 0)
            const totalComments = accSnaps.reduce((sum, s) => sum + s.gain_comments, 0)
            const totalShares = accSnaps.reduce((sum, s) => sum + s.gain_shares, 0)

            summaryRowsTiktok.push({
                Platform: 'TikTok',
                Account: acc.username,
                Nickname: acc.nickname || '',
                'Period': `${weekStart} ~ ${weekEnd}`,
                'Total Followers': acc.follower_count,
                'Week Total Views Gain': totalViews,
                'Week Total Likes Gain': totalLikes,
                'Week Total Comments Gain': totalComments,
                'Week Total Shares Gain': totalShares,
                'Avg Daily Views': daysCount > 0 ? Math.round(totalViews / daysCount) : 0,
                'Avg Daily Likes': daysCount > 0 ? Math.round(totalLikes / daysCount) : 0,
                'Avg Daily Comments': daysCount > 0 ? Math.round(totalComments / daysCount) : 0,
                'Avg Daily Shares': daysCount > 0 ? Math.round(totalShares / daysCount) : 0,
                'Days with Data': daysCount,
            })
        })

        sortedInstagram.forEach(acc => {
            const accSnaps = weekData.filter(s => s.account_id === acc.id)
            const daysCount = accSnaps.length
            const totalViews = accSnaps.reduce((sum, s) => sum + s.gain_views, 0)
            const totalLikes = accSnaps.reduce((sum, s) => sum + s.gain_likes, 0)
            const totalComments = accSnaps.reduce((sum, s) => sum + s.gain_comments, 0)

            summaryRowsInstagram.push({
                Platform: 'Instagram',
                Account: acc.username,
                Nickname: acc.full_name || '',
                'Period': `${weekStart} ~ ${weekEnd}`,
                'Total Followers': 'N/A',
                'Week Total Views Gain': totalViews,
                'Week Total Likes Gain': totalLikes,
                'Week Total Comments Gain': totalComments,
                'Week Total Shares Gain': 'N/A',
                'Avg Daily Views': daysCount > 0 ? Math.round(totalViews / daysCount) : 0,
                'Avg Daily Likes': daysCount > 0 ? Math.round(totalLikes / daysCount) : 0,
                'Avg Daily Comments': daysCount > 0 ? Math.round(totalComments / daysCount) : 0,
                'Avg Daily Shares': 'N/A',
                'Days with Data': daysCount,
            })
        })

        summaryRowsTiktok.sort((a, b) => b['Week Total Views Gain'] - a['Week Total Views Gain'])
        summaryRowsInstagram.sort((a, b) => b['Week Total Views Gain'] - a['Week Total Views Gain'])

        const wb = XLSX.utils.book_new()

        const summaryColWidths = [
            { wch: 10 },  // Platform
            { wch: 22 },  // Account
            { wch: 22 },  // Nickname
            { wch: 26 },  // Period
            { wch: 16 },  // Total Followers
            { wch: 22 },  // Week Total Views Gain
            { wch: 22 },  // Week Total Likes Gain
            { wch: 24 },  // Week Total Comments Gain
            { wch: 22 },  // Week Total Shares Gain
            { wch: 16 },  // Avg Daily Views
            { wch: 16 },  // Avg Daily Likes
            { wch: 18 },  // Avg Daily Comments
            { wch: 16 },  // Avg Daily Shares
            { wch: 14 },  // Days with Data
        ]

        const wsSummaryTiktok = XLSX.utils.json_to_sheet(summaryRowsTiktok)
        wsSummaryTiktok['!cols'] = summaryColWidths
        XLSX.utils.book_append_sheet(wb, wsSummaryTiktok, 'TikTok Weekly Summary')

        const wsDetailTiktok = XLSX.utils.json_to_sheet(detailRowsTiktok)
        wsDetailTiktok['!cols'] = detailColWidths
        XLSX.utils.book_append_sheet(wb, wsDetailTiktok, 'TikTok Daily Detail')

        const wsSummaryInstagram = XLSX.utils.json_to_sheet(summaryRowsInstagram)
        wsSummaryInstagram['!cols'] = summaryColWidths
        XLSX.utils.book_append_sheet(wb, wsSummaryInstagram, 'IG Weekly Summary')

        const wsDetailInstagram = XLSX.utils.json_to_sheet(detailRowsInstagram)
        wsDetailInstagram['!cols'] = detailColWidths
        XLSX.utils.book_append_sheet(wb, wsDetailInstagram, 'IG Daily Detail')

        XLSX.writeFile(wb, `Digibeat_Weekly_${weekStart}_to_${weekEnd}.xlsx`)

        setShowMenu(false)
    }

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setShowMenu(!showMenu)}
                className="group flex items-center gap-2 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 hover:border-green-500/50 rounded-lg transition-all"
                title="Download Excel Report"
            >
                <span className="text-lg">📊</span>
                <span className="text-xs font-mono font-bold text-green-400 group-hover:text-green-300">
                    EXPORT
                </span>
                <svg className={`w-3 h-3 text-green-400 transition-transform ${showMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
                    <div className="px-3 py-2 border-b border-white/5">
                        <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Export Options</span>
                    </div>
                    <button
                        onClick={handleDailyDownload}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                    >
                        <span className="text-base">📅</span>
                        <div>
                            <div className="text-xs font-semibold text-white">Daily Report</div>
                            <div className="text-[10px] text-gray-500">Latest day snapshot</div>
                        </div>
                    </button>
                    <button
                        onClick={handleWeeklyDownload}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
                    >
                        <span className="text-base">📆</span>
                        <div>
                            <div className="text-xs font-semibold text-white">Weekly Report</div>
                            <div className="text-[10px] text-gray-500">Last 7 days + summary</div>
                        </div>
                    </button>
                </div>
            )}
        </div>
    )
}
