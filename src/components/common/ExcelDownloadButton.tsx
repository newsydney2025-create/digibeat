
'use client'

import React from 'react'
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
}

export default function ExcelDownloadButton({ snapshots, accounts, instagramAccounts }: ExcelDownloadButtonProps) {

    const handleDownload = () => {
        if (!snapshots.length) {
            alert('No data available to download')
            return
        }

        // Find the latest date in snapshots
        // We use string comparison for ISO dates YYYY-MM-DD
        const latestDate = snapshots.reduce((max, s) => s.date > max ? s.date : max, snapshots[0].date)

        // Filter snapshots for this date
        const dailyData = snapshots.filter(s => s.date === latestDate)

        // Prepare rows
        const rows: ExcelRow[] = []

        // 1. TikTok Data
        accounts.forEach(acc => {
            const snap = dailyData.find(s => s.account_id === acc.id)
            rows.push({
                Platform: 'TikTok',
                Account: acc.username,
                Nickname: acc.nickname || '',
                Date: latestDate,
                'Total Followers': acc.follower_count,
                'Total Views': snap ? snap.total_views : 0,
                'Total Likes': snap ? snap.total_likes : 0,
                'Total Comments': snap ? snap.total_comments : 0,
                'Total Shares': snap ? snap.total_shares : 0,
                'Daily Views': snap ? snap.gain_views : 0,
                'Daily Likes': snap ? snap.gain_likes : 0,
                'Daily Comments': snap ? snap.gain_comments : 0,
                'Daily Shares': snap ? snap.gain_shares : 0,
            })
        })

        // 2. Instagram Data
        // Note: distinct snapshots for IG? 
        // Current architecture puts ALL snapshots in `daily_snapshots` table, linked by `account_id`.
        // So we just need to find the snapshot where account_id matches IG account id.
        instagramAccounts.forEach(acc => {
            const snap = dailyData.find(s => s.account_id === acc.id)
            rows.push({
                Platform: 'Instagram',
                Account: acc.username,
                Nickname: acc.full_name || '',
                Date: latestDate,
                'Total Followers': 'N/A', // IG generic scraper doesn't get followers reliably? Or we don't store it in `instagram_accounts`?
                // definition: query `instagram_accounts` has no `follower_count` column in `types/database.ts`.
                'Total Views': snap ? snap.total_views : 0,
                'Total Likes': snap ? snap.total_likes : 0,
                'Total Comments': snap ? snap.total_comments : 0,
                'Total Shares': 'N/A', // IG doesn't show public shares count usually
                'Daily Views': snap ? snap.gain_views : 0,
                'Daily Likes': snap ? snap.gain_likes : 0,
                'Daily Comments': snap ? snap.gain_comments : 0,
                'Daily Shares': 'N/A',
            })
        })

        // Create Workbook
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(rows)

        // Auto-width (rudimentary)
        const wscols = [
            { wch: 10 }, // Platform
            { wch: 20 }, // Account
            { wch: 20 }, // Nickname
            { wch: 12 }, // Date
            { wch: 15 }, // Followers
            { wch: 12 }, // Totals...
            { wch: 12 },
            { wch: 12 },
            { wch: 12 },
            { wch: 12 }, // Dailies...
            { wch: 12 },
            { wch: 12 },
            { wch: 12 },
        ]
        ws['!cols'] = wscols

        XLSX.utils.book_append_sheet(wb, ws, `Report ${latestDate}`)

        // Save
        XLSX.writeFile(wb, `Digibeat_Report_${latestDate}.xlsx`)
    }

    return (
        <button
            onClick={handleDownload}
            className="group flex items-center gap-2 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 hover:border-green-500/50 rounded-lg transition-all"
            title="Download Excel Report"
        >
            <span className="text-lg">📊</span>
            <span className="text-xs font-mono font-bold text-green-400 group-hover:text-green-300">
                EXPORT
            </span>
        </button>
    )
}
