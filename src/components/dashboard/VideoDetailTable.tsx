'use client'

import { TikTokVideo, TikTokAccount } from '@/types/database'
import { formatNumber, formatDateFull } from '@/lib/utils/format'

interface VideoDetailTableProps {
    videos: TikTokVideo[]
    accounts: TikTokAccount[]
}

export default function VideoDetailTable({ videos, accounts }: VideoDetailTableProps) {
    // Sort by create_time desc
    const sortedVideos = [...videos].sort((a, b) =>
        new Date(b.create_time || '1970-01-01').getTime() - new Date(a.create_time || '1970-01-01').getTime()
    ).slice(0, 50) // Limit to 50 for performance

    const getAccountName = (accountId: string | null) => {
        return accounts.find(a => a.id === accountId)?.username || 'Unknown'
    }

    const openVideo = (url: string | null) => {
        if (url) window.open(url, '_blank')
    }

    return (
        <div className="glass-panel rounded-xl overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    Latest Video Details
                </h3>
                <span className="text-xs text-gray-600 font-mono">{videos.length} videos loaded</span>
            </div>

            <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-black/20 sticky top-0 z-10 backdrop-blur-sm">
                        <tr>
                            <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Video</th>
                            <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                            <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Views</th>
                            <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Likes</th>
                            <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Comments</th>
                            <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Shares</th>
                            <th className="p-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {sortedVideos.map((video) => (
                            <tr
                                key={video.id}
                                onClick={() => openVideo(video.web_video_url)}
                                className="hover:bg-white/5 cursor-pointer transition-colors group"
                            >
                                <td className="p-3 max-w-[200px]">
                                    <div className="flex items-center gap-3">
                                        {video.cover_url && (
                                            <img
                                                src={video.cover_url}
                                                alt="cover"
                                                className="w-8 h-10 object-cover rounded bg-gray-800"
                                            />
                                        )}
                                        <p className="text-xs text-gray-300 truncate font-mono">
                                            {video.description || 'No description'}
                                        </p>
                                    </div>
                                </td>
                                <td className="p-3 text-xs text-cyan-400 font-medium">
                                    @{getAccountName(video.account_id)}
                                </td>
                                <td className="p-3 text-xs text-gray-300 text-right font-mono">
                                    {formatNumber(video.play_count)}
                                </td>
                                <td className="p-3 text-xs text-gray-300 text-right font-mono">
                                    {formatNumber(video.digg_count)}
                                </td>
                                <td className="p-3 text-xs text-gray-300 text-right font-mono">
                                    {formatNumber(video.comment_count)}
                                </td>
                                <td className="p-3 text-xs text-gray-300 text-right font-mono">
                                    {formatNumber(video.share_count)}
                                </td>
                                <td className="p-3 text-xs text-gray-500 text-right">
                                    {video.create_time ? formatDateFull(video.create_time) : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
