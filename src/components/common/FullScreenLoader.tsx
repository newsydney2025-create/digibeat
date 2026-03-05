'use client'

import React from 'react'


interface FullScreenLoaderProps {
    message?: string
}

export default function FullScreenLoader({ message = 'Accessing Data Core...' }: FullScreenLoaderProps) {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050505]/80 backdrop-blur-md">
            {/* Background elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/20 rounded-full blur-[100px] pointer-events-none animate-pulse duration-[3000ms]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/20 rounded-full blur-[80px] pointer-events-none animate-pulse duration-[4000ms] delay-500" />

            <div className="relative z-10 flex flex-col items-center">
                {/* Logo with pulsing effect */}
                <div className="mb-8 animate-bounce w-20 h-20 rounded bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]">
                    <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                    </svg>
                </div>

                {/* Loading spinner ring */}
                <div className="relative w-16 h-16 mb-6">
                    <div className="absolute inset-0 border-2 border-white/10 rounded-full"></div>
                    <div className="absolute inset-0 border-2 border-cyan-400 rounded-full border-t-transparent animate-spin"></div>
                </div>

                {/* Loading Text */}
                <p className="text-cyan-400 font-mono text-sm tracking-[0.2em] uppercase animate-pulse">
                    {message}
                </p>
                <div className="mt-2 text-xs text-gray-500 font-mono flex items-center gap-1">
                    <span>Establishing secure connection</span>
                    <span className="flex gap-0.5">
                        <span className="w-1 h-1 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-1 h-1 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-1 h-1 bg-gray-500 rounded-full animate-bounce"></span>
                    </span>
                </div>
            </div>
        </div>
    )
}
