'use client'

import { useState } from 'react'
import ParticleCanvas from './ParticleCanvas'

interface LandingPageProps {
    sessionId: string
    onStart: () => void
}

export default function LandingPage({ sessionId, onStart }: LandingPageProps) {
    const [loading, setLoading] = useState(false)

    const handleStart = async () => {
        setLoading(true)
        // Simulate loading delay for effect
        await new Promise((resolve) => setTimeout(resolve, 1500))
        onStart()
    }

    if (loading) {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50 font-mono">
                <div className="w-full max-w-md p-8">
                    <div className="flex justify-between text-cyan-400 text-xs mb-2">
                        <span>ESTABLISHING UPLINK</span>
                        <span className="animate-pulse">CONNECTED</span>
                    </div>
                    <div className="loader-bar mb-4">
                        <div className="loader-fill"></div>
                    </div>
                    <div className="text-xs text-gray-500 space-y-1 h-24 overflow-hidden flex flex-col justify-end">
                        <div className="text-green-500">&gt; Handshaking with analytics_api_v1...</div>
                        <div className="text-gray-400">&gt; Retrieving dataset (ID: #{sessionId})</div>
                        <div className="text-gray-400">&gt; Parsing JSON stream...</div>
                        <div className="text-cyan-500">&gt; DECRYPTING ANALYTICS...</div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <>
            <ParticleCanvas />
            <div className="absolute inset-0 flex items-center justify-center font-[Outfit] p-4">
                <div className="text-center group w-full max-w-4xl relative">
                    {/* Spinning rings */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-white/5 rounded-full animate-spin-slow pointer-events-none"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] border border-cyan-500/10 rounded-full animate-reverse-spin pointer-events-none"></div>

                    {/* Version badge */}
                    <div className="inline-flex items-center gap-3 mb-6 px-4 py-1.5 rounded-full border border-white/10 bg-black/40 backdrop-blur-md hover:border-cyan-500/50 transition-colors cursor-default">
                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                        <div className="text-sm font-mono text-cyan-400 tracking-[0.2em]">DASHBOARD_V8.2</div>
                    </div>

                    {/* Main title with glitch effect */}
                    <h1
                        className="text-8xl md:text-[10rem] font-extrabold text-white tracking-tighter mb-6 glitch-text leading-none select-none"
                        data-text="DIGIPARK"
                    >
                        DIGIPARK
                    </h1>

                    {/* Subtitle */}
                    <p className="text-gray-400 font-mono text-sm md:text-lg mb-12 tracking-wide opacity-80 max-w-xl mx-auto">
                        QUANTUM ANALYTICS MODULE <br />
                        <span className="text-gray-600">DATA UPLINK: {sessionId}</span>
                    </p>

                    {/* Start button */}
                    <button
                        onClick={handleStart}
                        className="neon-btn relative inline-flex items-center justify-center px-16 py-6 bg-white/5 hover:bg-white/10 border border-white/20 hover:border-cyan-400 text-white text-xl font-bold tracking-widest uppercase transition-all duration-300 group"
                    >
                        <span className="relative z-10 group-hover:text-cyan-300 transition-colors">
                            INITIALIZE SYSTEM
                        </span>
                        <div className="absolute inset-0 bg-cyan-500/10 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
                    </button>
                </div>
            </div>
        </>
    )
}
