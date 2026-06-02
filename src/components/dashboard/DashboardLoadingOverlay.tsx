'use client'

import { useEffect, useState } from 'react'

interface DashboardLoadingOverlayProps {
    title: string
    detail: string
    progress: number
}

export default function DashboardLoadingOverlay({
    title,
    detail,
    progress,
}: DashboardLoadingOverlayProps) {
    const safeProgress = Math.max(0, Math.min(100, Math.round(progress)))
    const [displayProgress, setDisplayProgress] = useState(safeProgress)

    useEffect(() => {
        setDisplayProgress((current) => Math.max(current, safeProgress))
    }, [safeProgress])

    useEffect(() => {
        if (safeProgress >= 100) {
            setDisplayProgress(100)
            return
        }

        const softCap = safeProgress < 70 ? 68 : 94
        const interval = window.setInterval(() => {
            setDisplayProgress((current) => {
                if (current >= softCap) return current
                return Math.min(softCap, current + (current < 45 ? 3 : 1))
            })
        }, 750)

        return () => window.clearInterval(interval)
    }, [safeProgress])

    return (
        <div className="pointer-events-none fixed right-6 top-6 z-50 w-[min(360px,calc(100vw-2rem))]">
            <div className="glass-panel overflow-hidden rounded-xl border-cyan-500/20 shadow-[0_0_30px_rgba(34,211,238,0.14)]">
                <div className="flex items-center gap-4 p-4">
                    <div className="relative h-11 w-11 shrink-0">
                        <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
                        <div className="absolute inset-1 rounded-full border-2 border-cyan-300 border-t-transparent animate-spin" />
                        <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.9)]" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-xs font-bold uppercase tracking-widest text-cyan-300">
                                {title}
                            </p>
                            <span className="font-mono text-xs text-gray-400">{displayProgress}%</span>
                        </div>
                        <p className="mt-1 truncate text-xs text-gray-500">{detail}</p>
                    </div>
                </div>

                <div className="h-1.5 bg-white/5">
                    <div
                        className="h-full bg-gradient-to-r from-cyan-400 via-blue-400 to-fuchsia-400 transition-[width] duration-300 ease-out"
                        style={{ width: `${displayProgress}%` }}
                    />
                </div>
            </div>
        </div>
    )
}
