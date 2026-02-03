'use client'

import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { TikTokVideo, TikTokAccount, MetricKey } from '@/types/database'
import { getAccountColor } from '@/lib/utils/format'

interface TrafficShareChartProps {
    videos: TikTokVideo[]
    accounts: TikTokAccount[]
    selectedAccounts: string[]
    currentMetric: MetricKey
}

export default function TrafficShareChart({
    videos,
    accounts,
    selectedAccounts,
    currentMetric,
}: TrafficShareChartProps) {
    const chartRef = useRef<HTMLDivElement>(null)
    const chartInstance = useRef<echarts.ECharts | null>(null)

    useEffect(() => {
        if (!chartRef.current) return

        chartInstance.current = echarts.init(chartRef.current, 'dark')

        const handleResize = () => {
            chartInstance.current?.resize()
        }
        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
            chartInstance.current?.dispose()
        }
    }, [])

    useEffect(() => {
        if (!chartInstance.current) return

        // Aggregate by account
        const shareData: Record<string, number> = {}

        const metricMap: Record<MetricKey, keyof TikTokVideo> = {
            playCount: 'play_count',
            diggCount: 'digg_count',
            commentCount: 'comment_count',
            shareCount: 'share_count',
            collectCount: 'collect_count'
        }

        videos.forEach((video) => {
            const account = accounts.find((a) => a.id === video.account_id)
            if (account && selectedAccounts.includes(account.id)) {
                const val = video[metricMap[currentMetric]] as number
                shareData[account.username] =
                    (shareData[account.username] || 0) + (val || 0)
            }
        })

        const pieData = Object.entries(shareData).map(([username, value]) => {
            const accountIndex = accounts.findIndex((a) => a.username === username)
            return {
                value,
                name: '@' + username,
                itemStyle: { color: getAccountColor(accountIndex >= 0 ? accountIndex : 0) },
            }
        })

        chartInstance.current.setOption({
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'item',
                backgroundColor: 'rgba(0,0,0,0.8)',
            },
            series: [
                {
                    type: 'pie',
                    radius: ['40%', '70%'],
                    center: ['50%', '50%'],
                    itemStyle: {
                        borderRadius: 4,
                        borderColor: '#000',
                        borderWidth: 2,
                    },
                    label: {
                        show: true,
                        color: '#fff',
                        formatter: '{d}%',
                        fontSize: 10,
                    },
                    data: pieData,
                },
            ],
        }, true)
    }, [videos, accounts, selectedAccounts, currentMetric])

    return <div ref={chartRef} className="w-full flex-1" />
}
