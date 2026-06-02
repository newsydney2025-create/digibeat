'use client'

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
    PublishingBonusAccountRow,
    PublishingBonusManagerRow,
    PublishingBonusStats,
    PublishingBonusVideo,
} from '@/types/database'
import { formatNumber } from '@/lib/utils/format'

interface PublishingBonusTableProps {
    stats: PublishingBonusStats | null
    loading?: boolean
    className?: string
}

type WeekBucket = {
    id: string
    startDate: string
    endDate: string
    dates: string[]
}

type AccountPeriodRow = PublishingBonusAccountRow & {
    periodPublishedVideos: PublishingBonusVideo[]
    periodSettlementVideos: PublishingBonusVideo[]
    periodPublishedCount: number
    periodSettlementCount: number
    periodMissingCount: number
    periodBonus: number
}

type GroupPeriodRow = PublishingBonusManagerRow & {
    periodPublishedCount: number
    periodSettlementCount: number
    periodMissingCount: number
    periodBonus: number
    periodAccounts: AccountPeriodRow[]
}

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
})

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

function weekStart(dateStr: string) {
    const date = new Date(`${dateStr}T00:00:00Z`)
    const day = date.getUTCDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    return addDays(dateStr, mondayOffset)
}

function buildWeeks(dates: string[]): WeekBucket[] {
    const byWeek = new Map<string, string[]>()

    dates.forEach((date) => {
        const start = weekStart(date)
        const next = byWeek.get(start) || []
        next.push(date)
        byWeek.set(start, next)
    })

    return Array.from(byWeek.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([startDate, weekDates]) => ({
            id: startDate,
            startDate: weekDates[0],
            endDate: weekDates[weekDates.length - 1],
            dates: weekDates,
        }))
}

function weekdayLabel(date: string) {
    return weekdayFormatter.format(new Date(`${date}T00:00:00Z`))
}

function formatMoney(amount: number) {
    return currencyFormatter.format(amount)
}

function compactTitle(video: PublishingBonusVideo) {
    return video.title || video.videoId
}

function todaySydney() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
}

export default function PublishingBonusTable({ stats, loading = false, className = 'min-h-[640px]' }: PublishingBonusTableProps) {
    const [expandedWeeks, setExpandedWeeks] = useState<string[]>([])
    const [expandedGroups, setExpandedGroups] = useState<string[]>([])
    const [expandedAccounts, setExpandedAccounts] = useState<string[]>([])

    const weeks = useMemo(() => stats ? buildWeeks(stats.dates) : [], [stats])
    const today = todaySydney()

    useEffect(() => {
        if (weeks.length > 0 && expandedWeeks.length === 0) {
            setExpandedWeeks([weeks[0].id])
        }
    }, [weeks, expandedWeeks.length, today])

    const sourceChildrenByParent = useMemo(() => {
        const result = new Map<string | null, PublishingBonusManagerRow[]>()
        stats?.managerRows.forEach((row) => {
            if (row.groupType === 'unassigned') return
            const key = row.parentId || null
            const next = result.get(key) || []
            next.push(row)
            result.set(key, next)
        })
        result.forEach((rows) => rows.sort((a, b) => a.name.localeCompare(b.name)))
        return result
    }, [stats])

    const descendantManagerIds = (groupId: string | null): string[] => {
        if (!groupId) return []
        const children = sourceChildrenByParent.get(groupId) || []
        return children.flatMap((child) => [
            ...(child.groupType === 'manager' && child.groupId ? [child.groupId] : []),
            ...descendantManagerIds(child.groupId),
        ])
    }

    const buildAccountPeriodRow = (row: PublishingBonusAccountRow, week: WeekBucket): AccountPeriodRow => {
        const periodPublishedVideos = row.publishedVideos.filter((video) => video.publishedDate >= week.startDate && video.publishedDate <= week.endDate)
        const periodSettlementVideos = row.bonusVideos.filter((video) => video.settlementDate >= week.startDate && video.settlementDate <= week.endDate)

        return {
            ...row,
            periodPublishedVideos,
            periodSettlementVideos,
            periodPublishedCount: periodPublishedVideos.length,
            periodSettlementCount: periodSettlementVideos.length,
            periodMissingCount: periodSettlementVideos.filter((video) => video.status === 'missing').length,
            periodBonus: periodSettlementVideos.reduce((sum, video) => sum + video.bonusAmount, 0),
        }
    }

    const getAccountsForGroup = (row: PublishingBonusManagerRow, accountRows: AccountPeriodRow[]) => {
        if (row.groupType === 'unassigned') {
            return accountRows.filter((account) => !account.managerGroupId)
        }

        if (row.groupType === 'manager') {
            return accountRows.filter((account) => account.managerGroupId === row.groupId)
        }

        const managerIds = descendantManagerIds(row.groupId)
        return accountRows.filter((account) => account.managerGroupId && managerIds.includes(account.managerGroupId))
    }

    const buildGroupPeriodRow = (row: PublishingBonusManagerRow, accounts: AccountPeriodRow[]): GroupPeriodRow => ({
        ...row,
        periodPublishedCount: accounts.reduce((sum, account) => sum + account.periodPublishedCount, 0),
        periodSettlementCount: accounts.reduce((sum, account) => sum + account.periodSettlementCount, 0),
        periodMissingCount: accounts.reduce((sum, account) => sum + account.periodMissingCount, 0),
        periodBonus: accounts.reduce((sum, account) => sum + account.periodBonus, 0),
        periodAccounts: accounts,
    })

    const videoListItem = (video: PublishingBonusVideo, type: 'published' | 'settlement') => {
        const isMissing = video.status === 'missing'
        const rowClass = type === 'published'
            ? 'finance-video-new'
            : isMissing
                ? 'finance-video-missing'
                : 'finance-video-settle'

        return (
            <a
                key={`${type}:${video.platform}:${video.videoId}:${video.publishedDate}:${video.settlementDate}`}
                href={video.url || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className={`finance-video-row ${rowClass}`}
                title={compactTitle(video)}
            >
                <span className={`finance-chip ${type === 'published' ? 'border-emerald-200 bg-emerald-100 text-emerald-800' : isMissing ? 'border-amber-200 bg-amber-100 text-amber-800' : 'border-blue-200 bg-blue-100 text-blue-800'}`}>
                    {type === 'published' ? 'New' : isMissing ? 'Missing' : 'Settle'}
                </span>
                <div className="min-w-0">
                    <div className="finance-label">Manager</div>
                    <div className="truncate font-bold text-slate-950">{video.managerName || 'Unassigned'}</div>
                </div>
                <div>
                    <div className="finance-label">Platform</div>
                    <div className="finance-chip finance-chip-account w-fit">
                        {video.platform}
                    </div>
                </div>
                <div className="min-w-0">
                    <div className="finance-label">Account</div>
                    <div className="truncate font-bold text-slate-950">@{video.username}</div>
                </div>
                <div className="min-w-0 truncate font-medium text-slate-900">{compactTitle(video)}</div>
                <div>
                    <div className="finance-label">Published</div>
                    <div className="finance-number text-slate-700">{video.publishedDate}</div>
                </div>
                <div>
                    <div className="finance-label">Settlement</div>
                    <div className="finance-number text-slate-700">{video.settlementDate}</div>
                </div>
                <div className="text-right">
                    <div className="finance-number font-bold text-slate-950">
                        {type === 'published'
                            ? formatNumber(video.currentViews)
                            : video.settledViews === null
                                ? 'Missing'
                                : formatNumber(video.settledViews)}
                    </div>
                    <div className="text-xs text-slate-500">{type === 'published' ? 'current views' : 'day-7 views'}</div>
                </div>
                <div className="text-right">
                    <div className={`finance-number text-xl font-bold ${type === 'published' ? 'text-slate-400' : video.bonusAmount > 0 ? 'text-emerald-700' : 'text-slate-600'}`}>
                        {type === 'published' ? '-' : formatMoney(video.bonusAmount)}
                    </div>
                    <div className="finance-label">Bonus</div>
                </div>
            </a>
        )
    }

    const renderAccountActivity = (week: WeekBucket, accounts: AccountPeriodRow[], title: string) => {
        const eventsByDate = new Map<string, { published: PublishingBonusVideo[]; settlement: PublishingBonusVideo[] }>()
        week.dates.forEach((date) => eventsByDate.set(date, { published: [], settlement: [] }))

        accounts.forEach((account) => {
            account.periodPublishedVideos.forEach((video) => {
                const bucket = eventsByDate.get(video.publishedDate)
                if (bucket) bucket.published.push(video)
            })
            account.periodSettlementVideos.forEach((video) => {
                const bucket = eventsByDate.get(video.settlementDate)
                if (bucket) bucket.settlement.push(video)
            })
        })

        const weekPublishedVideos = accounts
            .flatMap((account) => account.periodPublishedVideos)
            .sort((a, b) => a.publishedDate.localeCompare(b.publishedDate) || a.username.localeCompare(b.username))
        const weekSettlementVideos = accounts
            .flatMap((account) => account.periodSettlementVideos)
            .sort((a, b) => a.settlementDate.localeCompare(b.settlementDate) || b.bonusAmount - a.bonusAmount || a.username.localeCompare(b.username))
        const weekReadySettlements = weekSettlementVideos.filter((video) => video.status !== 'missing')
        const weekMissingSettlements = weekSettlementVideos.filter((video) => video.status === 'missing')
        const totalVideoRows = weekPublishedVideos.length + weekReadySettlements.length + weekMissingSettlements.length
        const activityRows = week.dates.map((date) => {
            const bucket = eventsByDate.get(date) || { published: [], settlement: [] }
            const missing = bucket.settlement.filter((video) => video.status === 'missing').length
            const ready = bucket.settlement.length - missing
            const hasDataAvailable = accounts.some((account) =>
                account.days.some((day) => day.date === date && day.hasDataAvailable)
            )
            return {
                date,
                hasDataAvailable,
                published: bucket.published.length,
                ready,
                missing,
                total: bucket.published.length + ready + missing,
            }
        })

        const renderVideoSection = (
            label: string,
            count: number,
            videos: PublishingBonusVideo[],
            type: 'published' | 'settlement',
            accentClass: string,
        ) => (
            <section className="finance-video-section">
                <div className="finance-video-section-header">
                    <div className={`finance-label ${accentClass}`}>{label}</div>
                    <div className="finance-chip">{count}</div>
                </div>
                {videos.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-slate-500">None</div>
                ) : (
                    <div>{videos.map((video) => videoListItem(video, type))}</div>
                )}
            </section>
        )

        return (
            <div className="finance-detail-panel space-y-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="finance-label">Account Post Statistics</div>
                        <div className="mt-1 text-base font-bold text-slate-950">{title}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <span className="finance-chip border-emerald-200 bg-emerald-50 text-emerald-800">{weekPublishedVideos.length} new</span>
                        <span className="finance-chip border-blue-200 bg-blue-50 text-blue-800">{weekReadySettlements.length} settle</span>
                        <span className="finance-chip border-amber-200 bg-amber-50 text-amber-800">{weekMissingSettlements.length} missing</span>
                    </div>
                </div>

                <div className="finance-calendar">
                    {week.dates.map((date) => (
                        <div key={`${date}:weekday`} className="finance-calendar-head">
                            {weekdayLabel(date)}
                        </div>
                    ))}
                    {activityRows.map((row) => {
                        const showTodayDataAvailable = today === row.date && row.hasDataAvailable

                        return (
                            <div
                                key={row.date}
                                className={`finance-calendar-day ${row.total === 0 ? 'finance-calendar-day-empty' : ''} ${showTodayDataAvailable ? 'finance-calendar-day-today' : ''}`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="finance-number text-2xl font-bold text-slate-950">{Number(row.date.slice(-2))}</div>
                                        <div className="finance-muted text-xs">{row.date}</div>
                                    </div>
                                    {showTodayDataAvailable && <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />}
                                </div>
                                {row.total > 0 && (
                                    <div className="mt-3 flex flex-col gap-1.5">
                                        {row.published > 0 && <span className="finance-chip w-fit border-emerald-200 bg-emerald-50 text-emerald-800">{row.published} new</span>}
                                        {row.ready > 0 && <span className="finance-chip w-fit border-blue-200 bg-blue-50 text-blue-800">{row.ready} settle</span>}
                                        {row.missing > 0 && <span className="finance-chip w-fit border-amber-200 bg-amber-50 text-amber-800">{row.missing} missing</span>}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <div className="finance-label">Post List</div>
                            <div className="mt-1 text-base font-bold text-slate-950">New posts first, settlement posts after</div>
                        </div>
                        <div className="flex gap-2">
                            <span className="finance-chip border-emerald-200 bg-emerald-50 text-emerald-800">{weekPublishedVideos.length} new</span>
                            <span className="finance-chip border-blue-200 bg-blue-50 text-blue-800">{weekReadySettlements.length} settle</span>
                            <span className="finance-chip border-amber-200 bg-amber-50 text-amber-800">{weekMissingSettlements.length} missing</span>
                        </div>
                    </div>
                    {totalVideoRows === 0 ? (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-5 text-sm text-slate-500">No videos in this week.</div>
                    ) : (
                        <div className="space-y-3">
                            {renderVideoSection('New Published', weekPublishedVideos.length, weekPublishedVideos, 'published', 'text-emerald-700')}
                            {renderVideoSection('Settlement Eligible', weekReadySettlements.length, weekReadySettlements, 'settlement', 'text-blue-700')}
                            {renderVideoSection('Missing Day-7 Data', weekMissingSettlements.length, weekMissingSettlements, 'settlement', 'text-amber-700')}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    if (!stats) {
        return (
            <div className={`finance-card flex items-center justify-center overflow-hidden text-sm text-slate-500 ${className}`}>
                {loading ? 'Loading publishing and bonus data...' : 'No publishing data available'}
            </div>
        )
    }

    return (
        <div className={`flex flex-col gap-4 ${className}`}>
            {weeks.map((week) => {
                const accountRows = stats.accountRows.map((row) => buildAccountPeriodRow(row, week))
                const totalPublished = accountRows.reduce((sum, row) => sum + row.periodPublishedCount, 0)
                const totalSettlements = accountRows.reduce((sum, row) => sum + row.periodSettlementCount, 0)
                const totalMissing = accountRows.reduce((sum, row) => sum + row.periodMissingCount, 0)
                const totalBonus = accountRows.reduce((sum, row) => sum + row.periodBonus, 0)
                const expanded = expandedWeeks.includes(week.id)

                const periodRows = stats.managerRows
                    .map((row) => buildGroupPeriodRow(row, getAccountsForGroup(row, accountRows)))
                    .filter((row) =>
                        row.groupType !== 'unassigned'
                        || row.periodPublishedCount > 0
                        || row.periodSettlementCount > 0
                        || row.periodAccounts.length > 0
                    )

                const rowById = new Map(periodRows.filter((row) => row.groupId).map((row) => [row.groupId, row]))
                const childrenByParent = new Map<string | null, GroupPeriodRow[]>()
                periodRows.forEach((row) => {
                    if (row.groupType === 'unassigned') return
                    const key = row.parentId || null
                    const next = childrenByParent.get(key) || []
                    next.push(row)
                    childrenByParent.set(key, next)
                })
                childrenByParent.forEach((rows) => rows.sort((a, b) => {
                    if (a.groupType !== b.groupType) return a.groupType === 'folder' ? -1 : 1
                    return a.name.localeCompare(b.name)
                }))

                const unassignedRow = periodRows.find((row) => row.groupType === 'unassigned')

                const renderGroupRow = (group: GroupPeriodRow, depth = 0): ReactNode => {
                    const groupKey = `${week.id}:${group.groupType}:${group.groupId || 'unassigned'}`
                    const groupExpanded = expandedGroups.includes(groupKey)
                    const childRows = group.groupId ? (childrenByParent.get(group.groupId) || []) : []
                    const directAccounts = group.groupType === 'manager' || group.groupType === 'unassigned'
                        ? group.periodAccounts
                        : []
                    const rowTone = group.groupType === 'folder'
                        ? 'finance-row-folder'
                        : group.groupType === 'manager'
                            ? 'finance-row-manager'
                            : 'finance-row-account'
                    const typeLabel = group.groupType === 'folder'
                        ? `${group.managerCount} managers / ${group.accountCount} accounts`
                        : group.groupType === 'manager'
                            ? `${group.accountCount} accounts`
                            : `${group.accountCount} accounts`
                    const toggleGroup = () => {
                        setExpandedGroups((prev) => prev.includes(groupKey) ? prev.filter((id) => id !== groupKey) : [...prev, groupKey])
                    }

                    return (
                        <Fragment key={groupKey}>
                            <tr
                                role="button"
                                tabIndex={0}
                                onClick={toggleGroup}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault()
                                        toggleGroup()
                                    }
                                }}
                                className={`finance-row ${rowTone} ${groupExpanded ? 'finance-row-open' : ''}`}
                            >
                                <td className="p-3">
                                    <div
                                        className={`finance-tree-cell finance-tree-level-${Math.min(depth, 3)}`}
                                        style={{ marginLeft: depth * 28 }}
                                    >
                                        <span className="finance-expander">
                                            {groupExpanded ? '-' : '+'}
                                        </span>
                                        <span
                                            className={`h-3 w-3 shrink-0 ${group.groupType === 'folder' ? 'rounded-sm' : 'rounded-full'}`}
                                            style={{ backgroundColor: group.color }}
                                        />
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-bold text-slate-950">{group.name}</span>
                                            <span className="block truncate text-xs text-slate-500">{group.note || typeLabel}</span>
                                        </span>
                                    </div>
                                </td>
                                <td className="p-3">
                                    <span className={`finance-chip ${group.groupType === 'folder' ? 'finance-chip-folder' : group.groupType === 'manager' ? 'finance-chip-manager' : 'finance-chip-account'}`}>
                                        {group.groupType}
                                    </span>
                                </td>
                                <td className="finance-number p-3 text-right text-sm text-slate-700">{group.groupType === 'manager' ? '-' : group.managerCount}</td>
                                <td className="finance-number p-3 text-right text-sm text-slate-700">{group.accountCount}</td>
                                <td className="finance-number p-3 text-right text-sm font-bold text-emerald-700">{group.periodPublishedCount}</td>
                                <td className="finance-number p-3 text-right text-sm font-bold text-blue-700">{group.periodSettlementCount}</td>
                                <td className="finance-number p-3 text-right text-sm font-bold text-amber-700">{group.periodMissingCount}</td>
                                <td className="finance-number p-3 text-right text-base font-bold text-slate-950">{formatMoney(group.periodBonus)}</td>
                                <td className="p-3">
                                    <span className="finance-chip finance-chip-account">
                                        {groupExpanded ? 'Hide' : 'Open'}
                                    </span>
                                </td>
                            </tr>

                            {groupExpanded && childRows.map((child) => renderGroupRow(child, depth + 1))}

                            {groupExpanded && directAccounts
                                .filter((account) => account.periodPublishedCount > 0 || account.periodSettlementCount > 0 || group.groupType === 'manager')
                                .sort((a, b) => b.periodBonus - a.periodBonus || b.periodSettlementCount - a.periodSettlementCount || b.periodPublishedCount - a.periodPublishedCount || a.username.localeCompare(b.username))
                                .map((account) => {
                                    const accountKey = `${week.id}:${account.platform}:${account.accountId}:${group.groupId || 'unassigned'}`
                                    const accountExpanded = expandedAccounts.includes(accountKey)
                                    const toggleAccount = () => {
                                        setExpandedAccounts((prev) => prev.includes(accountKey) ? prev.filter((id) => id !== accountKey) : [...prev, accountKey])
                                    }
                                    return (
                                        <Fragment key={accountKey}>
                                            <tr
                                                role="button"
                                                tabIndex={0}
                                                onClick={toggleAccount}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault()
                                                        toggleAccount()
                                                    }
                                                }}
                                                className={`finance-row finance-row-account ${accountExpanded ? 'finance-row-open' : ''}`}
                                            >
                                                <td className="p-3">
                                                    <div
                                                        className={`finance-tree-cell finance-tree-level-${Math.min(depth + 1, 3)}`}
                                                        style={{ marginLeft: (depth + 1) * 28 }}
                                                    >
                                                        <span className="finance-expander">
                                                            {accountExpanded ? '-' : '+'}
                                                        </span>
                                                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: account.managerColor || '#64748b' }} />
                                                        <div className="min-w-0">
                                                            <a
                                                                href={account.accountUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={(event) => event.stopPropagation()}
                                                                className="block truncate text-sm font-bold text-slate-950 hover:text-blue-700"
                                                            >
                                                                @{account.username}
                                                            </a>
                                                            <div className="truncate text-xs text-slate-500">{account.displayName}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <span className="finance-chip finance-chip-account">
                                                        {account.platform}
                                                    </span>
                                                </td>
                                                <td className="finance-number p-3 text-right text-sm text-slate-400">-</td>
                                                <td className="finance-number p-3 text-right text-sm text-slate-600">1</td>
                                                <td className="finance-number p-3 text-right text-sm font-bold text-emerald-700">{account.periodPublishedCount}</td>
                                                <td className="finance-number p-3 text-right text-sm font-bold text-blue-700">{account.periodSettlementCount}</td>
                                                <td className="finance-number p-3 text-right text-sm font-bold text-amber-700">{account.periodMissingCount}</td>
                                                <td className="finance-number p-3 text-right text-base font-bold text-slate-950">{formatMoney(account.periodBonus)}</td>
                                                <td className="p-3">
                                                    <span className="finance-chip finance-chip-account">
                                                        {accountExpanded ? 'Close' : 'Posts'}
                                                    </span>
                                                </td>
                                            </tr>
                                            {accountExpanded && (
                                                <tr className="finance-detail-row">
                                                    <td colSpan={9}>
                                                        {renderAccountActivity(week, [account], `@${account.username} post statistics`)}
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    )
                                })}
                        </Fragment>
                    )
                }

                const rootRows = (childrenByParent.get(null) || []).filter((row) => rowById.has(row.groupId))

                return (
                    <section key={week.id} className="finance-card overflow-hidden">
                        <button
                            onClick={() => setExpandedWeeks((prev) => prev.includes(week.id) ? prev.filter((id) => id !== week.id) : [...prev, week.id])}
                            className="flex w-full flex-col gap-3 border-b border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50 lg:flex-row lg:items-center lg:justify-between"
                        >
                            <div>
                                <div className="flex items-center gap-3">
                                    <span className="finance-expander h-8 w-8">
                                        {expanded ? '-' : '+'}
                                    </span>
                                    <div>
                                        <h3 className="text-base font-bold text-slate-950">
                                            Week {week.startDate} to {week.endDate}
                                        </h3>
                                        <p className="finance-muted mt-1 text-sm">
                                            Folder / manager payout tree
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid min-w-full grid-cols-4 gap-2 lg:min-w-[680px]">
                                <div className="rounded-lg border border-slate-200 bg-emerald-50 p-3">
                                    <div className="finance-label text-emerald-700">Published</div>
                                    <div className="finance-number mt-1 text-lg font-bold text-emerald-800">{formatNumber(totalPublished)}</div>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-blue-50 p-3">
                                    <div className="finance-label text-blue-700">Settlement</div>
                                    <div className="finance-number mt-1 text-lg font-bold text-blue-800">{formatNumber(totalSettlements)}</div>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-amber-50 p-3">
                                    <div className="finance-label text-amber-700">Missing</div>
                                    <div className="finance-number mt-1 text-lg font-bold text-amber-800">{formatNumber(totalMissing)}</div>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                                    <div className="finance-label">Bonus Due</div>
                                    <div className="finance-number mt-1 text-xl font-bold text-slate-950">{formatMoney(totalBonus)}</div>
                                </div>
                            </div>
                        </button>

                        {expanded && (
                            <div className="finance-table-wrap">
                                <table className="finance-table">
                                    <thead>
                                        <tr>
                                            <th>Folder / Manager / Account</th>
                                            <th>Type</th>
                                            <th className="text-right">Managers</th>
                                            <th className="text-right">Accounts</th>
                                            <th className="text-right">Published</th>
                                            <th className="text-right">Settlement</th>
                                            <th className="text-right">Missing</th>
                                            <th className="text-right">Bonus Due</th>
                                            <th>Detail</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rootRows.map((row) => renderGroupRow(row))}
                                        {unassignedRow && renderGroupRow(unassignedRow)}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )
            })}
        </div>
    )
}
