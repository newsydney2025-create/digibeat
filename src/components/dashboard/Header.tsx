'use client'

interface HeaderProps {
    sessionId: string
    onLogout: () => void
}

export default function Header({ sessionId, onLogout }: HeaderProps) {
    return (
        <header className="glass-panel p-4 rounded-xl flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white leading-none tracking-wide">
                        DIGIPARK <span className="text-cyan-400 font-light">ANALYTICS</span>
                    </h1>
                    <div className="text-[10px] font-mono text-gray-500 mt-1 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        LIVE DATA STREAM
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="hidden md:block text-right mr-4">
                    <div className="text-[10px] text-gray-500">SESSION ID</div>
                    <div className="text-xs font-mono text-cyan-300">#{sessionId}</div>
                </div>
                <button
                    onClick={onLogout}
                    className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 hover:text-white transition-colors"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18.36 6.64A9 9 0 1 1 5.64 6.64" />
                        <line x1="12" y1="2" x2="12" y2="12" />
                    </svg>
                </button>
            </div>
        </header>
    )
}
