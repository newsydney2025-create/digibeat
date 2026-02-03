'use client'

import { DashboardMetrics, MetricKey } from '@/types/database'
import { formatNumber, METRICS_CONFIG } from '@/lib/utils/format'

interface MetricCardsProps {
    totals: DashboardMetrics
    currentMetric: MetricKey
    onSelectMetric: (metric: MetricKey) => void
}

const ICONS: Record<string, React.ReactNode> = {
    eye: (
        <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
        </svg>
    ),
    heart: (
        <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
    ),
    chat: (
        <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 6h-2V3H3v15h4v4l4-4h5l5-5V6zm-7 8H7v-2h7v2zm3-4H7V8h10v2z" />
        </svg>
    ),
    share: (
        <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
        </svg>
    ),
}

export default function MetricCards({
    totals,
    currentMetric,
    onSelectMetric,
}: MetricCardsProps) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 shrink-0">
            {METRICS_CONFIG.map((metric) => {
                const isActive = currentMetric === metric.key
                const value = totals[metric.key]

                return (
                    <button
                        key={metric.key}
                        onClick={() => onSelectMetric(metric.key)}
                        className={`metric-card h-40 p-5 rounded-2xl flex flex-col justify-between cursor-pointer bg-black/20 group text-left ${isActive ? 'active' : ''
                            }`}
                        style={
                            {
                                '--card-color': metric.color,
                                '--card-glow': metric.color + '40',
                            } as React.CSSProperties
                        }
                    >
                        {/* Background icon */}
                        <div
                            className="icon-bg w-32 h-32"
                            style={{ color: metric.color }}
                        >
                            {ICONS[metric.icon]}
                        </div>

                        {/* Header */}
                        <div className="flex justify-between items-start z-10">
                            <span className="text-xs font-mono font-bold tracking-widest text-gray-400 uppercase group-hover:text-white transition-colors">
                                {metric.label}
                            </span>
                            <div className="p-2 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                                <div
                                    className={`w-6 h-6 transition-colors ${isActive ? '' : 'text-gray-500'
                                        }`}
                                    style={{ color: isActive ? metric.color : undefined }}
                                >
                                    {ICONS[metric.icon]}
                                </div>
                            </div>
                        </div>

                        {/* Value */}
                        <div className="text-5xl font-bold text-white font-mono tracking-tight z-10 drop-shadow-md">
                            {formatNumber(value)}
                        </div>
                    </button>
                )
            })}
        </div>
    )
}
