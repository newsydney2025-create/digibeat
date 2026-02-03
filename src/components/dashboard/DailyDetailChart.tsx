'use client'

import React, { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { TikTokVideo } from '@/types/database'

interface DailyDetailChartProps {
    date: string
    username: string
    videos: any[]
    onClose: () => void
}

export default function DailyDetailChart({ date, username, videos, onClose }: DailyDetailChartProps) {
    const chartRef = useRef<HTMLDivElement>(null)
    const chartInstance = useRef<echarts.ECharts | null>(null)

    useEffect(() => {
        if (!chartRef.current || videos.length === 0) return

        chartInstance.current = echarts.init(chartRef.current, 'dark')

        const data = videos.map(v => ({
            value: v.score,
            name: v.title ? (v.title.length > 20 ? v.title.substring(0, 20) + '...' : v.title) : `Video ${v.video_id}`,
            video: v.video_id
        }))

        const option = {
            backgroundColor: 'transparent',
            title: {
                text: 'Top Contributing Videos',
                left: 'center',
                textStyle: { color: '#ccc', fontSize: 14 }
            },
            tooltip: {
                trigger: 'item',
                formatter: '{b}: {c}% Contribution'
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'value',
                axisLabel: { color: '#666' },
                splitLine: { lineStyle: { color: '#333' } }
            },
            yAxis: {
                type: 'category',
                data: data.map(d => d.name),
                axisLabel: { color: '#ccc' },
                inverse: true // Top video at top
            },
            series: [
                {
                    name: 'Contribution',
                    type: 'bar',
                    data: data,
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                            { offset: 0, color: '#06b6d4' }, // cyan-500
                            { offset: 1, color: '#a855f7' }  // purple-500
                        ]),
                        borderRadius: [0, 4, 4, 0]
                    },
                    label: {
                        show: true,
                        position: 'right',
                        formatter: '{c}%',
                        color: '#fff'
                    },
                    barWidth: 20
                }
            ]
        }

        chartInstance.current.setOption(option)

        const handleResize = () => {
            chartInstance.current?.resize()
        }
        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
            chartInstance.current?.dispose()
        }
    }, [videos])

    return (
        <div className="glass-panel p-6 rounded-xl flex flex-col relative animate-in fade-in slide-in-from-top-4 duration-300 mb-6 border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors z-10"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>

            <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {username[0]?.toUpperCase()}
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        {date} Traffic Breakdown
                        <span className="text-xs font-normal text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-500/30">Live Analysis</span>
                    </h3>
                    <p className="text-sm text-gray-400">@ {username} • Top performing content for this day</p>
                </div>
            </div>

            <div ref={chartRef} className="w-full h-[300px]" />
        </div>
    )
}
