'use client'

import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { TikTokVideo } from '@/types/database'
import { formatNumber, getAccountColor } from '@/lib/utils/format'

interface ImpactScatterChartProps {
    videos: TikTokVideo[]
    accounts: { id: string; username: string }[]
    onVideoClick: (url: string) => void
}

export default function ImpactScatterChart({
    videos,
    accounts,
    onVideoClick,
}: ImpactScatterChartProps) {
    const chartRef = useRef<HTMLDivElement>(null)
    const chartInstance = useRef<echarts.ECharts | null>(null)

    useEffect(() => {
        if (!chartRef.current) return

        chartInstance.current = echarts.init(chartRef.current, 'dark')

        chartInstance.current.on('click', (params: unknown) => {
            const p = params as { data?: (string | number)[] }
            const videoUrl = p.data?.[5] as string | undefined
            if (videoUrl) {
                onVideoClick(videoUrl)
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

        const getUsername = (accountId: string | null) => {
            return accounts.find((a) => a.id === accountId)?.username || 'unknown'
        }

        const getColor = (accountId: string | null) => {
            const index = accounts.findIndex((a) => a.id === accountId)
            return getAccountColor(index >= 0 ? index : 0)
        }

        const scatterData = videos.map((v) => {
            const totalEng = v.digg_count + v.comment_count + v.share_count
            const rate = v.play_count > 0 ? (totalEng / v.play_count) * 100 : 0
            return [
                v.play_count,
                parseFloat(rate.toFixed(2)),
                totalEng,
                getUsername(v.account_id),
                v.description,
                v.web_video_url,
            ]
        })

        chartInstance.current.setOption({
            backgroundColor: 'transparent',
            tooltip: {
                backgroundColor: 'rgba(0,0,0,0.8)',
                borderColor: '#333',
                formatter: (p: { data: (string | number)[]; color: string }) =>
                    `<b style="color:${p.color}">@${p.data[3]}</b><br>Views: ${formatNumber(
                        p.data[0] as number
                    )}<br>Eng. Rate: ${p.data[1]}%`,
            },
            grid: {
                left: '5%',
                right: '5%',
                bottom: '10%',
                top: '15%',
                containLabel: true,
            },
            dataZoom: [
                {
                    type: 'slider',
                    show: true,
                    yAxisIndex: [0],
                    right: '2%',
                    width: 20,
                    start: 0,
                    end: 100, // Initial view shows full range, but allows zooming
                    handleSize: '80%',
                },
                {
                    type: 'inside',
                    yAxisIndex: [0],
                    zoomOnMouseWheel: true,
                    moveOnMouseWheel: true,
                }
            ],
            xAxis: {
                type: 'log',
                name: 'Views',
                nameLocation: 'middle',
                nameGap: 30,
                splitLine: { show: false },
                axisLabel: { color: '#666' },
                nameTextStyle: {
                    color: '#666',
                    fontSize: 12
                },
            },
            yAxis: {
                type: 'value',
                name: 'Rate %',
                max: (value: { max: number }) => {
                    return value.max > 500 ? value.max : 500;
                },
                splitLine: { lineStyle: { color: '#222' } },
                axisLabel: { color: '#666' },
                nameTextStyle: {
                    color: '#666',
                    align: 'right',
                    padding: [0, 10, 0, 0]
                },
            },
            series: [
                {
                    type: 'scatter',
                    symbolSize: (data: (string | number)[]) =>
                        Math.min(Math.max(Math.log((data[2] as number) + 1) * 5, 5), 30),
                    itemStyle: {
                        opacity: 0.8,
                        color: (p: { data: (string | number)[] }) => {
                            const accountId = videos.find(
                                (v) => accounts.find((a) => a.username === p.data[3])?.id === v.account_id
                            )?.account_id
                            return getColor(accountId || null)
                        },
                    },
                    data: scatterData,
                },
            ],
        }, true)
    }, [videos, accounts])

    return <div ref={chartRef} className="w-full flex-1" />
}
