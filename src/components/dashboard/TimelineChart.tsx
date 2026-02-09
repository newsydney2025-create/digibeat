'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import * as echarts from 'echarts'
import { TikTokAccount, DailySnapshot, MetricKey } from '@/types/database'
import { formatDateSimple, formatNumber } from '@/lib/utils/format'

interface TimelineChartProps {
    snapshots: DailySnapshot[]
    accounts: TikTokAccount[]
    selectedAccounts: string[]
    currentMetric: MetricKey
    timeRange: '3D' | '7D' | '30D' | '90D'
    onDataClick?: (username: string, date: string) => void
    viewMode: 'total' | 'daily'
    showAverage?: boolean // New: show average line with ghost lines
    hoveredAccount?: string | null // New: account being hovered (from sidebar)
    onAccountHover?: (accountId: string | null) => void // New: callback when hovering chart line
}

export default function TimelineChart({
    snapshots,
    accounts,
    selectedAccounts,
    currentMetric,
    timeRange,
    onDataClick,
    viewMode,
    showAverage = false,
    hoveredAccount = null,
    onAccountHover,
}: TimelineChartProps) {
    const chartRef = useRef<HTMLDivElement>(null)
    const chartInstance = useRef<echarts.ECharts | null>(null)
    const lockedDataIndex = useRef<number | null>(null) // For axis lock when hovering tooltip
    const displayToOriginalDateMap = useRef<Record<string, string>>({}) // Map M/D display format to YYYY-MM-DD

    // Handle Resize
    useEffect(() => {
        const handleResize = () => {
            chartInstance.current?.resize()
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // Helper: Get metric value from snapshot (handles Total vs Daily logic)
    const getMetricValue = useCallback((s: DailySnapshot): number => {
        if (viewMode === 'daily') {
            switch (currentMetric) {
                case 'playCount': return s.gain_views
                case 'diggCount': return s.gain_likes
                case 'commentCount': return s.gain_comments
                case 'shareCount': return s.gain_shares
                case 'collectCount': return 0
                default: return 0
            }
        }
        // Total mode
        switch (currentMetric) {
            case 'playCount': return s.total_views
            case 'diggCount': return s.total_likes
            case 'commentCount': return s.total_comments
            case 'shareCount': return s.total_shares
            case 'collectCount': return 0
            default: return 0
        }
    }, [currentMetric, viewMode])

    // Initialize & Update Chart
    useEffect(() => {
        if (!chartRef.current) return

        if (!chartInstance.current) {
            chartInstance.current = echarts.init(chartRef.current)

            // Add mouse events for hover highlight
            chartInstance.current.on('mouseover', 'series', (params: any) => {
                if (onAccountHover && params.seriesName && params.seriesName !== 'Average') {
                    const account = accounts.find(a => a.username === params.seriesName)
                    if (account) onAccountHover(account.id)
                }
            })
            chartInstance.current.on('mouseout', 'series', () => {
                if (onAccountHover) onAccountHover(null)
            })

            // Add click event for drill-down
            chartInstance.current.on('click', (params: any) => {
                if (onDataClick && params.seriesName && params.seriesName !== 'Average' && params.name) {
                    // Convert display date (M/D) back to original format (YYYY-MM-DD)
                    const originalDate = displayToOriginalDateMap.current[params.name] || params.name
                    onDataClick(params.seriesName, originalDate)
                }
            })

            // Axis lock: when tooltip is hovered, force tooltip to stay at locked index
            // Use isDispatching flag to prevent infinite loop
            let isDispatching = false;
            chartInstance.current.on('updateAxisPointer', (event: any) => {
                // Suppress default axis highlight (thickening all lines)
                if (chartInstance.current) {
                    chartInstance.current.dispatchAction({
                        type: 'downplay',
                    });
                }

                if (lockedDataIndex.current !== null && chartInstance.current && !isDispatching) {
                    isDispatching = true;
                    chartInstance.current.dispatchAction({
                        type: 'showTip',
                        seriesIndex: 0,
                        dataIndex: lockedDataIndex.current,
                    });
                    // Reset flag after a longer delay to ensure stability
                    setTimeout(() => { isDispatching = false; }, 100);
                }
            });
        }

        // Bind window functions for tooltip axis locking
        (window as any).lockTooltipAxis = (idx: number) => {
            lockedDataIndex.current = idx;
        };
        (window as any).unlockTooltipAxis = () => {
            lockedDataIndex.current = null;
        };

        // Bind window function for highlighting series (uses ECharts action, not React state)
        (window as any).chartHighlightSeries = (seriesName: string | null) => {
            if (!chartInstance.current) return;
            if (seriesName) {
                // Reset all highlights first to prevent "highlight all" glitch
                chartInstance.current.dispatchAction({
                    type: 'downplay',
                });
                chartInstance.current.dispatchAction({
                    type: 'highlight',
                    seriesName: seriesName,
                });
            } else {
                chartInstance.current.dispatchAction({
                    type: 'downplay',
                });
            }
        };

        // 1. Filter Snapshots by Selected Accounts
        const filteredSnapshots = snapshots.filter((s) =>
            selectedAccounts.includes(s.account_id)
        )

        // 2. Get Unique Dates and Sort
        const uniqueDates = Array.from(new Set(filteredSnapshots.map((s) => s.date))).sort(
            (a, b) => new Date(a).getTime() - new Date(b).getTime()
        )

        // Build mapping from display format to original format
        const displayDateMap: Record<string, string> = {}
        uniqueDates.forEach(d => {
            displayDateMap[formatDateSimple(d)] = d
        })
        displayToOriginalDateMap.current = displayDateMap

        // 3. Build date->value maps for each account
        const accountDataMaps: Record<string, Record<string, number>> = {}
        selectedAccounts.forEach(accountId => {
            const dateValueMap: Record<string, number> = {}
            filteredSnapshots
                .filter((s) => s.account_id === accountId)
                .forEach((s) => {
                    dateValueMap[s.date] = getMetricValue(s)
                })
            accountDataMaps[accountId] = dateValueMap
        })

        // 4. Compute data arrays (Using precomputed values for both Total and Daily)
        const computeDataArray = (dateValueMap: Record<string, number>): number[] => {
            return uniqueDates.map((dateStr) => {
                // Since getMetricValue now returns the correct value (total or gain)
                // we just return it directly. No diff calculation needed here.
                return dateValueMap[dateStr] || 0
            })
        }

        // 5. Compute average data
        const averageData: number[] = uniqueDates.map((dateStr) => {
            let sum = 0
            let count = 0
            selectedAccounts.forEach(accountId => {
                const map = accountDataMaps[accountId]
                if (map[dateStr] !== undefined) {
                    sum += map[dateStr]
                    count++
                }
            })
            return count > 0 ? Math.round(sum / count) : 0
        })

        // 6. Compute anomaly markers (spikes/drops)
        const computeAnomalies = (data: number[]): { xAxis: number; yAxis: number; type: 'spike' | 'drop' }[] => {
            const anomalies: { xAxis: number; yAxis: number; type: 'spike' | 'drop' }[] = []
            if (data.length < 7) return anomalies

            for (let i = 7; i < data.length; i++) {
                // Rolling 7-day average (excluding current)
                const window = data.slice(i - 7, i)
                const avg = window.reduce((a, b) => a + b, 0) / 7
                const current = data[i]

                if (avg > 0) {
                    if (current > avg * 2.5) {
                        anomalies.push({ xAxis: i, yAxis: current, type: 'spike' })
                    } else if (current < avg * 0.3 && current > 0) {
                        anomalies.push({ xAxis: i, yAxis: current, type: 'drop' })
                    }
                }
            }
            return anomalies
        }

        // 7. Prepare Series Data
        const series: any[] = []

        // Individual account lines (ghost or normal)
        selectedAccounts.forEach((accountId) => {
            const account = accounts.find((a) => a.id === accountId)
            if (!account) return

            const colorHash = accountId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
            const hue = colorHash % 360
            const normalColor = `hsl(${hue}, 70%, 60%)`
            const ghostColor = '#333'

            const dataArray = computeDataArray(accountDataMaps[accountId])
            const isHovered = hoveredAccount === accountId
            const isGhosted = showAverage && !isHovered && hoveredAccount === null
            const isFaded = hoveredAccount !== null && !isHovered

            series.push({
                name: account.username,
                type: 'line',
                smooth: true,
                showSymbol: !showAverage || isHovered || uniqueDates.length === 1, // FORCE symbol if only 1 point
                symbolSize: isHovered ? 8 : (uniqueDates.length === 1 ? 6 : 4),
                lineStyle: {
                    width: isHovered ? 4 : (showAverage ? 1.5 : 3),
                    color: isGhosted ? ghostColor : (isFaded ? `hsla(${hue}, 30%, 50%, 0.2)` : normalColor),
                },
                itemStyle: {
                    color: isGhosted ? ghostColor : normalColor,
                },
                areaStyle: showAverage && !isHovered ? undefined : {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: `hsla(${hue}, 70%, 60%, ${isHovered ? 0.4 : 0.15})` },
                        { offset: 1, color: 'transparent' },
                    ]),
                },
                emphasis: {
                    disabled: false,
                    focus: 'series', // Only highlight the active series, fade others
                    lineStyle: {
                        width: 5,
                        color: normalColor, // Always use series color for highlight, ignore ghost state
                    },
                    itemStyle: {
                        color: normalColor,
                        borderWidth: 2,
                        borderColor: '#fff',
                    },
                },
                z: isHovered ? 10 : (showAverage ? 1 : 5),
                data: dataArray,
                // Mark anomalies on individual lines (only when hovered or not in average mode)
                markPoint: (!showAverage || isHovered) ? {
                    symbol: 'circle',
                    symbolSize: 12,
                    data: computeAnomalies(dataArray).map(a => ({
                        coord: [a.xAxis, a.yAxis],
                        itemStyle: { color: a.type === 'spike' ? '#22c55e' : '#ef4444' },
                        label: { show: false }
                    }))
                } : undefined,
            })
        })

        // Average line (if enabled)
        if (showAverage && selectedAccounts.length > 1) {
            const avgAnomalies = computeAnomalies(averageData)
            series.push({
                name: 'Average',
                type: 'line',
                smooth: true,
                showSymbol: true,
                symbolSize: 6,
                lineStyle: {
                    width: 4,
                    color: '#22d3ee',
                },
                itemStyle: {
                    color: '#22d3ee',
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(34, 211, 238, 0.3)' },
                        { offset: 1, color: 'transparent' },
                    ]),
                },
                emphasis: {
                    focus: 'series',
                    lineStyle: { width: 5, color: '#22d3ee' },
                    itemStyle: { color: '#22d3ee', borderWidth: 2, borderColor: '#fff' }
                },
                z: 20,
                data: averageData,
                markPoint: {
                    symbol: 'circle',
                    symbolSize: 14,
                    data: avgAnomalies.map(a => ({
                        coord: [a.xAxis, a.yAxis],
                        itemStyle: {
                            color: a.type === 'spike' ? '#22c55e' : '#ef4444', // <--- Fixed line
                            borderColor: '#fff',
                            borderWidth: 2
                        },
                        label: { show: false }
                    }))
                },
            })
        }

        // Bind global function for tooltip clicking
        ; (window as any).chartDrillDown = (username: string, displayDate: string) => {
            if (onDataClick) {
                // Convert display date (M/D) back to original format (YYYY-MM-DD)
                const originalDate = displayToOriginalDateMap.current[displayDate] || displayDate
                onDataClick(username, originalDate)
            }
        }

            // Bind global function for tooltip hover highlighting
            ; (window as any).chartHighlight = (accountId: string | null) => {
                if (onAccountHover) {
                    onAccountHover(accountId)
                }
            }

        // Calculate zoom range
        const daysMap: Record<string, number> = { '3D': 3, '7D': 7, '30D': 30, '90D': 90 }
        const targetDays = daysMap[timeRange] || 30
        const startPercent = uniqueDates.length <= targetDays
            ? 0
            : 100 - (targetDays / uniqueDates.length * 100)

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                enterable: true,
                backgroundColor: 'rgba(10,10,10,0.95)',
                borderColor: 'rgba(34,211,238,0.3)',
                borderWidth: 1,
                padding: 0, // We'll handle padding in formatter
                textStyle: { color: '#fff', fontSize: 12 },

                // Lock tooltip to the snapped axis position (not following mouse)
                position: function (point: number[], params: any, dom: HTMLElement, rect: any, size: any) {
                    // Fallback if chart instance isn't ready
                    if (!params || !params[0] || !chartInstance.current) {
                        return [point[0] + 10, 40];
                    }

                    const dataIndex = params[0].dataIndex;

                    // Get exact pixel coordinate of the axis point
                    // Note: convertToPixel returns X coordinate for xAxis finder
                    const snappedX = chartInstance.current.convertToPixel({ xAxisIndex: 0 }, dataIndex);

                    const x = snappedX + 10; // 10px right of the axis line
                    const y = 40; // Fixed top position

                    // Check if tooltip overflows right edge
                    const contentW = size.contentSize[0];
                    const viewW = size.viewSize[0];

                    if (x + contentW > viewW) {
                        // If overflowing right, flip to left side of axis
                        return [snappedX - contentW - 10, y];
                    }

                    return [x, y];
                },

                axisPointer: {
                    type: 'line',
                    snap: true,
                    lineStyle: { color: 'rgba(34,211,238,0.6)', width: 2 }
                },

                formatter: (params: any) => {
                    if (!Array.isArray(params) || params.length === 0) return ''

                    const date = params[0].axisValue

                    // Sort: Average first, then by value descending
                    const sorted = [...params].sort((a, b) => {
                        if (a.seriesName === 'Average') return -1
                        if (b.seriesName === 'Average') return 1
                        return (b.value || 0) - (a.value || 0)
                    })

                    // Find account IDs for highlighting
                    const accountIdMap: Record<string, string> = {}
                    accounts.forEach(a => { accountIdMap[a.username] = a.id })

                    // Build scrollable HTML with axis lock on hover
                    const dataIdx = params[0].dataIndex;
                    let html = `
                        <div 
                            style="padding: 12px 8px 8px 12px;"
                            onmouseenter="window.lockTooltipAxis && window.lockTooltipAxis(${dataIdx})"
                            onmouseleave="window.unlockTooltipAxis && window.unlockTooltipAxis()"
                        >
                            <div style="font-weight:bold; color:#22d3ee; margin-bottom:10px; font-size:14px; padding-right:8px;">${date}</div>
                            <div style="max-height: 280px; overflow-y: auto; padding-right: 8px;">
                    `

                    sorted.forEach((item: any) => {
                        const value = formatNumber(Number(item.value))
                        const isAverage = item.seriesName === 'Average'
                        const accountId = accountIdMap[item.seriesName] || ''

                        // Highlight on hover (use ECharts action, not React state), drill-down on click
                        const hoverIn = isAverage ? '' : `onmouseover="window.chartHighlightSeries && window.chartHighlightSeries('${item.seriesName}'); this.style.background='rgba(34,211,238,0.15)';"`
                        const hoverOut = isAverage ? '' : `onmouseout="window.chartHighlightSeries && window.chartHighlightSeries(null); this.style.background='transparent';"`
                        const clickAttr = isAverage ? '' : `onclick="window.chartDrillDown && window.chartDrillDown('${item.seriesName}', '${date}')"`
                        const cursorStyle = isAverage ? 'default' : 'pointer'

                        html += `
                            <div 
                                style="display:flex; align-items:center; justify-content:space-between; padding:6px 8px; gap:20px; border-radius:4px; cursor:${cursorStyle}; transition: background 0.15s; margin-bottom:2px;"
                                ${hoverIn}
                                ${hoverOut}
                                ${clickAttr}
                            >
                                <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                                    <span style="width:8px; height:8px; border-radius:50%; background:${item.color}; flex-shrink:0;"></span>
                                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; ${isAverage ? 'font-weight:600; color:#22d3ee;' : 'color:#ccc;'}">${item.seriesName}</span>
                                </div>
                                <span style="font-family:monospace; font-weight:600; color:#fff; flex-shrink:0;">${value}</span>
                            </div>
                        `
                    })

                    html += `
                            </div>
                            <div style="color:#555; font-size:9px; text-align:center; margin-top:8px; padding-top:6px; border-top:1px solid #333;">
                                点击账号查看视频详情
                            </div>
                        </div>
                    `

                    return html
                },
            },
            legend: {
                show: false,
            },
            grid: {
                left: '2%',
                right: '2%',
                bottom: '10%',
                top: '5%',
                containLabel: true,
            },
            xAxis: {
                type: 'category',
                boundaryGap: uniqueDates.length === 1 ? ['20%', '20%'] : false, // Fix: Ensure single point is centered
                data: uniqueDates.map(d => formatDateSimple(d)),
                axisLine: { lineStyle: { color: '#333' } },
                axisLabel: { color: '#666', fontSize: 10 },
            },
            yAxis: {
                type: 'value',
                splitLine: { lineStyle: { color: '#222' } },
                axisLabel: { color: '#666', fontSize: 10, formatter: (val: number) => formatNumber(val) },
                minInterval: 1 // Ensure at least 0-1 range even if value is 0
            },
            dataZoom: [
                {
                    type: 'inside',
                    xAxisIndex: 0,
                    start: startPercent,
                    end: 100,
                },
                {
                    type: 'slider',
                    xAxisIndex: 0,
                    start: startPercent,
                    end: 100,
                    height: 20,
                    bottom: 0,
                    borderColor: 'transparent',
                    backgroundColor: '#111',
                    fillerColor: 'rgba(34, 211, 238, 0.2)',
                    handleStyle: {
                        color: '#22d3ee',
                        borderColor: '#22d3ee'
                    },
                    textStyle: { color: '#666' }
                }
            ],
            series,
        }

        chartInstance.current.setOption(option, true) // true = replace all

        return () => {
            delete (window as any).chartDrillDown
        }
    }, [snapshots, accounts, selectedAccounts, currentMetric, timeRange, viewMode, onDataClick, showAverage, hoveredAccount, onAccountHover, getMetricValue])

    // Effect for highlight/downplay based on hoveredAccount
    useEffect(() => {
        if (!chartInstance.current) return

        if (hoveredAccount) {
            const account = accounts.find(a => a.id === hoveredAccount)
            if (account) {
                chartInstance.current.dispatchAction({
                    type: 'highlight',
                    seriesName: account.username
                })
            }
        } else {
            chartInstance.current.dispatchAction({
                type: 'downplay'
            })
        }
    }, [hoveredAccount, accounts])

    return <div ref={chartRef} className="w-full h-full min-h-[250px]" />
}
