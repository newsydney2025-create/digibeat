'use client'

import React, { useEffect, useRef, useMemo, useCallback } from 'react'
import * as echarts from 'echarts'
import { TikTokAccount, DailySnapshot, MetricKey } from '@/types/database'
import { formatDateSimple, formatNumber, getAccountColor } from '@/lib/utils/format'

interface SmallMultiplesGridProps {
    snapshots: DailySnapshot[]
    accounts: TikTokAccount[]
    selectedAccounts: string[]
    currentMetric: MetricKey
    timeRange: '3D' | '7D' | '30D' | '90D'
    viewMode: 'total' | 'daily'
    onAccountClick?: (accountId: string) => void
}

export default function SmallMultiplesGrid({
    snapshots,
    accounts,
    selectedAccounts,
    currentMetric,
    timeRange,
    viewMode,
    onAccountClick,
}: SmallMultiplesGridProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const chartInstances = useRef<Map<string, echarts.ECharts>>(new Map())

    // Helper: Get metric value from snapshot
    const getMetricValue = useCallback((s: DailySnapshot): number => {
        switch (currentMetric) {
            case 'playCount': return s.total_views
            case 'diggCount': return s.total_likes
            case 'commentCount': return s.total_comments
            case 'shareCount': return s.total_shares
            case 'collectCount': return 0
            default: return 0
        }
    }, [currentMetric])

    // Get unique dates
    const uniqueDates = useMemo(() => {
        const dates = new Set(snapshots.map(s => s.date))
        return Array.from(dates).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    }, [snapshots])

    // Time range filter
    const daysMap: Record<string, number> = { '3D': 3, '7D': 7, '30D': 30, '90D': 90 }
    const targetDays = daysMap[timeRange] || 30
    const filteredDates = useMemo(() => {
        return uniqueDates.slice(-targetDays)
    }, [uniqueDates, targetDays])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            chartInstances.current.forEach(chart => chart.dispose())
            chartInstances.current.clear()
        }
    }, [])

    // Render mini charts
    useEffect(() => {
        if (!containerRef.current) return

        // Build data for each account
        const accountsToRender = selectedAccounts
            .map(id => accounts.find(a => a.id === id))
            .filter(Boolean) as TikTokAccount[]

        accountsToRender.forEach((account, idx) => {
            const chartId = `mini-chart-${account.id}`
            let container = document.getElementById(chartId)
            if (!container) return

            let chart = chartInstances.current.get(account.id)
            if (!chart) {
                chart = echarts.init(container)
                chartInstances.current.set(account.id, chart)
            }

            // Build data
            const accountSnapshots = snapshots.filter(s => s.account_id === account.id)
            const dateValueMap: Record<string, number> = {}
            accountSnapshots.forEach(s => {
                dateValueMap[s.date] = getMetricValue(s)
            })

            const data = filteredDates.map((date, i) => {
                if (viewMode === 'total') {
                    return dateValueMap[date] || 0
                } else {
                    if (i === 0) return 0
                    const prevDate = filteredDates[i - 1]
                    const curr = dateValueMap[date] || 0
                    const prev = dateValueMap[prevDate] || 0
                    return Math.max(0, curr - prev)
                }
            })

            // Detect anomalies for marking
            const anomalies: number[] = []
            if (data.length >= 7) {
                for (let i = 7; i < data.length; i++) {
                    const window = data.slice(i - 7, i)
                    const avg = window.reduce((a, b) => a + b, 0) / 7
                    if (avg > 0 && data[i] > avg * 2.5) {
                        anomalies.push(i)
                    }
                }
            }

            const color = getAccountColor(idx)

            const option = {
                backgroundColor: 'transparent',
                grid: {
                    left: 5,
                    right: 5,
                    top: 5,
                    bottom: 5,
                    containLabel: false,
                },
                xAxis: {
                    type: 'category',
                    data: filteredDates.map(d => formatDateSimple(d)),
                    show: false,
                },
                yAxis: {
                    type: 'value',
                    show: false,
                },
                series: [{
                    type: 'line',
                    smooth: true,
                    showSymbol: false,
                    lineStyle: { width: 2, color },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: color.replace(')', ', 0.4)').replace('hsl(', 'hsla(').replace('rgb(', 'rgba(') },
                            { offset: 1, color: 'transparent' },
                        ]),
                    },
                    data,
                    markPoint: anomalies.length > 0 ? {
                        symbol: 'circle',
                        symbolSize: 6,
                        data: anomalies.map(i => ({
                            coord: [i, data[i]],
                            itemStyle: { color: '#22c55e' },
                        })),
                    } : undefined,
                }],
            }

            chart.setOption(option, true)
        })

        // Dispose charts for deselected accounts
        chartInstances.current.forEach((chart, id) => {
            if (!selectedAccounts.includes(id)) {
                chart.dispose()
                chartInstances.current.delete(id)
            }
        })
    }, [snapshots, accounts, selectedAccounts, currentMetric, filteredDates, viewMode, getMetricValue])

    // Handle resize
    useEffect(() => {
        const handleResize = () => {
            chartInstances.current.forEach(chart => chart.resize())
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const accountsToRender = selectedAccounts
        .map(id => accounts.find(a => a.id === id))
        .filter(Boolean) as TikTokAccount[]

    return (
        <div ref={containerRef} className="w-full h-full overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-4 gap-3 p-2">
                {accountsToRender.map((account, idx) => {
                    const color = getAccountColor(idx)

                    return (
                        <div
                            key={account.id}
                            onClick={() => onAccountClick?.(account.id)}
                            className="group cursor-pointer bg-white/5 rounded-lg border border-white/10 hover:border-cyan-500/50 hover:bg-white/10 transition-all overflow-hidden"
                        >
                            {/* Header */}
                            <div className="px-2 py-1.5 border-b border-white/5 flex items-center gap-2">
                                <div
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: color }}
                                />
                                <span className="text-[10px] font-bold text-gray-300 truncate">
                                    @{account.username}
                                </span>
                            </div>
                            {/* Mini Chart */}
                            <div
                                id={`mini-chart-${account.id}`}
                                className="w-full h-[80px]"
                            />
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
