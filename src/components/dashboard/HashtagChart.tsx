'use client'

import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { TikTokVideo } from '@/types/database'
import { formatNumber } from '@/lib/utils/format'

interface HashtagChartProps {
    videos: TikTokVideo[]
}

export default function HashtagChart({ videos }: HashtagChartProps) {
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

        // Aggregate hashtags by play count
        const tagCounts: Record<string, number> = {}
        videos.forEach((video) => {
            ; (video.hashtags || []).forEach((tag) => {
                tagCounts[tag] = (tagCounts[tag] || 0) + video.play_count
            })
        })

        const sortedTags = Object.entries(tagCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5)

        chartInstance.current.setOption({
            backgroundColor: 'transparent',
            grid: {
                left: '5%',
                right: '15%',
                bottom: '5%',
                top: '5%',
                containLabel: true,
            },
            xAxis: { type: 'value', show: false },
            yAxis: {
                type: 'category',
                data: sortedTags.map((t) => '#' + t.name),
                axisLine: { show: false },
                axisTick: { show: false },
                inverse: true,
                axisLabel: { color: '#666', fontSize: 10 },
            },
            series: [
                {
                    type: 'bar',
                    data: sortedTags.map((t) => t.value),
                    barWidth: 8,
                    itemStyle: {
                        borderRadius: 5,
                        color: '#00f3ff',
                    },
                    label: {
                        show: true,
                        position: 'right',
                        color: '#00f3ff',
                        fontSize: 10,
                        formatter: (p: { value: number }) => formatNumber(p.value),
                    },
                },
            ],
        }, true)
    }, [videos])

    return <div ref={chartRef} className="w-full flex-1" />
}
