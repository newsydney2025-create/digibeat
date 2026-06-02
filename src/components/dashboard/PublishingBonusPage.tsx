'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import FullScreenLoader from '@/components/common/FullScreenLoader'
import PublishingBonusTable from './PublishingBonusTable'
import { fetchPublishingBonusStats } from '@/app/actions/account-management'
import { PublishingBonusStats } from '@/types/database'
import { formatNumber } from '@/lib/utils/format'

const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
})

function addDays(dateStr: string, amount: number) {
    const date = new Date(`${dateStr}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + amount)
    return date.toISOString().slice(0, 10)
}

function formatMoney(amount: number) {
    return currencyFormatter.format(amount)
}

export default function PublishingBonusPage() {
    const [stats, setStats] = useState<PublishingBonusStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    const loadStats = useCallback(async (start?: string, end?: string) => {
        setLoading(true)
        try {
            const data = await fetchPublishingBonusStats(start, end)
            setStats(data)
            setStartDate(data.startDate)
            setEndDate(data.endDate)
        } catch (error) {
            console.error('Failed to load publishing bonus stats', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadStats()
    }, [loadStats])

    const applyRange = (start: string, end: string) => {
        if (!start || !end || start > end) return
        loadStats(start, end)
    }

    const shiftRange = (direction: -1 | 1) => {
        if (!startDate || !endDate) return
        const dayCount = Math.max(1, Math.round((new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) / 86_400_000) + 1)
        const offset = direction * dayCount
        applyRange(addDays(startDate, offset), addDays(endDate, offset))
    }

    const showLastFourWeeks = () => {
        const anchorEnd = endDate || stats?.endDate
        if (!anchorEnd) return
        applyRange(addDays(anchorEnd, -27), anchorEnd)
    }

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null
            if (target?.tagName === 'INPUT') return

            if (event.key === '[') {
                event.preventDefault()
                shiftRange(-1)
            }

            if (event.key === ']') {
                event.preventDefault()
                shiftRange(1)
            }

            if (event.key === '4') {
                event.preventDefault()
                showLastFourWeeks()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [startDate, endDate, stats])

    const summary = useMemo(() => {
        if (!stats) {
            return {
                posts: 0,
                accounts: 0,
                managers: 0,
                bonus: 0,
                settlementVideos: 0,
                missing: 0,
            }
        }

        return {
            posts: stats.accountRows.reduce((sum, row) => sum + row.weekPublishCount, 0),
            accounts: new Set(stats.accountRows.map((row) => `${row.platform}:${row.accountId}`)).size,
            managers: stats.managerRows.filter((row) => row.groupType === 'manager').length,
            bonus: stats.accountRows.reduce((sum, row) => sum + row.bonusAmount, 0),
            settlementVideos: stats.accountRows.reduce((sum, row) => sum + row.bonusVideos.length, 0),
            missing: stats.accountRows.reduce((sum, row) => sum + row.bonusVideos.filter((video) => video.status === 'missing').length, 0),
        }
    }, [stats])

    return (
        <main className="finance-page">
            {loading && <FullScreenLoader message="Loading Publishing & Bonus..." />}

            <div className="finance-shell flex min-h-screen flex-col gap-5">
                <header className="finance-card p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                            <div className="finance-label text-blue-700">
                                Publishing & Bonus
                            </div>
                            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                                Finance Cycle Report
                            </h1>
                            <p className="finance-muted mt-1 text-sm">
                                {stats ? `${stats.startDate} to ${stats.endDate} | Australia/Sydney` : 'Loading report range'}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-end gap-2">
                            <div>
                                <label className="finance-label mb-1 block">Start</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(event) => setStartDate(event.target.value)}
                                    className="finance-input"
                                />
                            </div>
                            <div>
                                <label className="finance-label mb-1 block">End</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(event) => setEndDate(event.target.value)}
                                    className="finance-input"
                                />
                            </div>
                            <button
                                onClick={() => applyRange(startDate, endDate)}
                                className="finance-button finance-button-primary"
                            >
                                Apply
                            </button>
                            <button
                                onClick={() => shiftRange(-1)}
                                title="Previous period ([)"
                                className="finance-button"
                            >
                                Prev
                            </button>
                            <button
                                onClick={() => shiftRange(1)}
                                title="Next period (])"
                                className="finance-button"
                            >
                                Next
                            </button>
                            <button
                                onClick={showLastFourWeeks}
                                title="Last 4 weeks from selected end date (4)"
                                className="finance-button"
                            >
                                4 Weeks
                            </button>
                            <button
                                onClick={() => loadStats()}
                                className="finance-button"
                            >
                                Latest Week
                            </button>
                            <Link
                                href="/dashboard"
                                className="finance-button flex items-center"
                            >
                                Back Dashboard
                            </Link>
                        </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                        <div className="rounded-lg border border-slate-200 bg-emerald-50 p-4">
                            <div className="finance-label text-emerald-700">Published</div>
                            <div className="finance-number mt-2 text-2xl font-bold text-emerald-800">{formatNumber(summary.posts)}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-blue-50 p-4">
                            <div className="finance-label text-blue-700">Settlement Eligible</div>
                            <div className="finance-number mt-2 text-2xl font-bold text-blue-800">{formatNumber(summary.settlementVideos)}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="finance-label text-slate-600">Bonus Due</div>
                            <div className="finance-number mt-2 text-3xl font-bold text-slate-950">{formatMoney(summary.bonus)}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-amber-50 p-4">
                            <div className="finance-label text-amber-700">Missing Day-7</div>
                            <div className="finance-number mt-2 text-2xl font-bold text-amber-800">{formatNumber(summary.missing)}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <div className="finance-label">Accounts</div>
                            <div className="finance-number mt-2 text-2xl font-bold text-slate-900">{formatNumber(summary.accounts)}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <div className="finance-label">Managers</div>
                            <div className="finance-number mt-2 text-2xl font-bold text-slate-900">{formatNumber(summary.managers)}</div>
                        </div>
                    </div>
                </header>

                <PublishingBonusTable stats={stats} loading={loading} />
            </div>
        </main>
    )
}
