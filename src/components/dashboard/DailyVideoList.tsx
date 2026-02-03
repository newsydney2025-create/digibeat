'use client'

import React from 'react'
import { formatNumber } from '@/lib/utils/format'

interface DailyVideoListProps {
    date: string
    username: string
    videos: any[]
    onBack: () => void
}

export default function DailyVideoList({ date, username, videos, onBack }: DailyVideoListProps) {
    return (
        <div className="w-full flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Header / Navigation */}
            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="group flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        <div className="bg-white/5 p-1.5 rounded-full group-hover:bg-white/10 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        </div>
                        Back to Trend
                    </button>
                    <div className="h-4 w-px bg-white/10" />
                    <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            {date} Analysis
                            <span className="text-[10px] font-normal text-cyan-400 bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-500/20">
                                @{username}
                            </span>
                        </h3>
                    </div>
                </div>
            </div>

            {/* Video List Table */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#0A0A0A]/95 backdrop-blur-sm z-10">
                        <tr className="border-b border-white/5 text-gray-500 uppercase font-mono tracking-wider">
                            <th className="py-2 pl-2">Video</th>
                            <th className="py-2">Posted</th>
                            <th className="py-2 text-right">Views</th>
                            <th className="py-2 text-right">Likes</th>
                            <th className="py-2 text-right">Comments</th>
                            <th className="py-2 text-right pr-2">Shares</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {videos.map((item) => (
                            <tr key={item.video_id} className="group hover:bg-white/5 transition-colors">
                                <td className="py-3 pl-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-10 bg-gray-800 rounded overflow-hidden shrink-0 border border-white/10 group-hover:border-cyan-500/50 transition-colors relative">
                                            {item.cover ? (
                                                <img src={item.cover} alt="Cover" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-600">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <a
                                                href={item.web_video_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-white font-medium truncate max-w-[180px] hover:text-cyan-400 transition-colors"
                                            >
                                                {item.title || `Video ${item.video_id}`}
                                            </a>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-3 text-gray-400 whitespace-nowrap">
                                    {new Date(item.created_at).toLocaleDateString()}
                                </td>
                                <td className="py-3 text-right font-mono text-cyan-400">
                                    +{formatNumber(item.stats.views)}
                                </td>
                                <td className="py-3 text-right font-mono text-gray-300">
                                    +{formatNumber(item.stats.likes)}
                                </td>
                                <td className="py-3 text-right font-mono text-gray-300">
                                    +{formatNumber(item.stats.comments)}
                                </td>
                                <td className="py-3 text-right font-mono text-gray-300 pr-2">
                                    +{formatNumber(item.stats.shares)}
                                </td>
                            </tr>
                        ))}
                        {videos.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-8 text-center text-gray-500 italic">
                                    No active videos found for this date.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
