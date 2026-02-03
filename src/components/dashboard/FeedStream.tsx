'use client'

import { TikTokVideo } from '@/types/database'
import { formatNumber, formatDateSimple, getAccountColor } from '@/lib/utils/format'

interface FeedStreamProps {
    videos: TikTokVideo[]
    accounts: { id: string; username: string }[]
    sortBy: 'time' | 'traffic'
    onSortChange: (sort: 'time' | 'traffic') => void
}

export default function FeedStream({
    videos,
    accounts,
    sortBy,
    onSortChange,
}: FeedStreamProps) {
    const getAccountIndex = (accountId: string | null) => {
        return accounts.findIndex((a) => a.id === accountId)
    }

    const getUsername = (accountId: string | null) => {
        const account = accounts.find((a) => a.id === accountId)
        return account?.username || 'unknown'
    }

    const sortedVideos = [...videos].sort((a, b) => {
        if (sortBy === 'time') {
            const timeA = a.create_time ? new Date(a.create_time).getTime() : 0
            const timeB = b.create_time ? new Date(b.create_time).getTime() : 0
            return timeB - timeA
        }
        return b.play_count - a.play_count
    })

    const openVideo = (url: string | null) => {
        if (url) window.open(url, '_blank')
    }

    return (
        <div className="glass-panel rounded-xl flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="p-3 border-b border-white/5 bg-white/5 flex justify-between items-center shrink-0">
                <span className="text-[10px] font-bold text-gray-300 tracking-wider">FEED STREAM</span>
                <div className="flex bg-black/40 rounded p-0.5">
                    <button
                        onClick={() => onSortChange('time')}
                        className={`px-2 py-0.5 text-[9px] rounded transition-all font-mono ${sortBy === 'time' ? 'bg-gray-700 text-white' : 'text-gray-500'
                            }`}
                    >
                        LATEST
                    </button>
                    <button
                        onClick={() => onSortChange('traffic')}
                        className={`px-2 py-0.5 text-[9px] rounded transition-all font-mono ${sortBy === 'traffic' ? 'bg-gray-700 text-white' : 'text-gray-500'
                            }`}
                    >
                        VIRAL
                    </button>
                </div>
            </div>
            <div className="overflow-y-auto p-2 space-y-2 custom-scroll flex-1">
                {sortedVideos.slice(0, 20).map((video) => {
                    const accountIndex = getAccountIndex(video.account_id)
                    const color = getAccountColor(accountIndex >= 0 ? accountIndex : 0)

                    return (
                        <div
                            key={video.id}
                            onClick={() => openVideo(video.web_video_url)}
                            className="bg-white/5 border border-white/5 rounded p-3 hover:bg-white/10 hover:border-cyan-500/30 transition-all group cursor-pointer relative"
                        >
                            <div className="flex justify-between items-start mb-1.5">
                                <span className="text-[10px] font-bold" style={{ color }}>
                                    @{getUsername(video.account_id)}
                                </span>
                                <span className="text-[9px] font-mono text-gray-600">
                                    {video.create_time ? formatDateSimple(video.create_time) : '--'}
                                </span>
                            </div>
                            <p className="text-[11px] text-gray-400 line-clamp-2 mb-2 group-hover:text-gray-200 transition-colors leading-tight">
                                {video.description || 'No description available.'}
                            </p>
                            <div className="flex gap-3 text-[10px] font-mono border-t border-white/5 pt-2">
                                <span className="flex items-center gap-1 text-cyan-500/80">
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                    {formatNumber(video.play_count)}
                                </span>
                                <span className="flex items-center gap-1 text-pink-500/80">
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                    </svg>
                                    {formatNumber(video.digg_count)}
                                </span>
                                <span className="flex items-center gap-1 text-yellow-500/80">
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
                                    </svg>
                                    {formatNumber(video.share_count)}
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
