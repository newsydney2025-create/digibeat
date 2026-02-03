'use client'

import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { TikTokVideo, MetricKey } from '@/types/database'
import { formatNumber, getAccountColor } from '@/lib/utils/format'

interface TopContentChartProps {
    videos: TikTokVideo[]
    accounts: { id: string; username: string }[]
    currentMetric: MetricKey
    onVideoClick: (url: string) => void
}

export default function TopContentChart({
    videos,
    accounts,
    currentMetric,
    onVideoClick,
}: TopContentChartProps) {
    const chartRef = useRef<HTMLDivElement>(null)
    const chartInstance = useRef<echarts.ECharts | null>(null)

    useEffect(() => {
        if (!chartRef.current) return

        chartInstance.current = echarts.init(chartRef.current, 'dark')

        chartInstance.current.on('click', (params: { name: string }) => {
            const video = videos.find((v) =>
                v.description?.includes(params.name.replace('...', ''))
            )
            if (video?.web_video_url) {
                onVideoClick(video.web_video_url)
            }
        })

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
        if (!chartInstance.current || videos.length === 0) return

        const metricMap: Record<MetricKey, keyof TikTokVideo> = {
            playCount: 'play_count',
            diggCount: 'digg_count',
            commentCount: 'comment_count',
            shareCount: 'share_count',
            collectCount: 'collect_count'
        }

        const top5 = [...videos]
            .sort((a, b) => {
                const valB = b[metricMap[currentMetric]] as number || 0
                const valA = a[metricMap[currentMetric]] as number || 0
                return valB - valA
            })
            .slice(0, 5)

        const getVideoColor = (video: TikTokVideo) => {
            const accountIndex = accounts.findIndex((a) => a.id === video.account_id)
            return getAccountColor(accountIndex >= 0 ? accountIndex : 0)
        }

        chartInstance.current.setOption({
            backgroundColor: 'transparent',
            grid: {
                left: '0%',
                right: '15%',
                bottom: '0%',
                top: '0%',
                containLabel: true,
            },
            xAxis: { show: false },
            yAxis: {
                type: 'category',
                data: top5.map((v) =>
                    v.description ? v.description.substring(0, 12) + '...' : 'Video'
                ),
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: { color: '#aaa', fontSize: 10 },
            },
            series: [
                {
                    type: 'bar',
                    data: top5.map((v) => ({
                        value: v[metricMap[currentMetric]] as number || 0,
                        itemStyle: { color: getVideoColor(v) },
                    })),
                    itemStyle: { borderRadius: [0, 3, 3, 0] },
                    label: {
                        show: true,
                        position: 'right',
                        color: '#fff',
                        formatter: (p: { value: number }) => formatNumber(p.value),
                    },
                },
            ],
        }, true)
    }, [videos, accounts, currentMetric])

    return <div ref={chartRef} className="w-full flex-1" />
}
