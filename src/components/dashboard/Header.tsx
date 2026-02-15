'use client'

import { useState } from 'react'
import { getLatestSyncStatus } from '@/app/actions/sync'
import ExcelDownloadButton from '@/components/common/ExcelDownloadButton'
import { DailySnapshot, TikTokAccount, InstagramAccount } from '@/types/database'

interface HeaderProps {
    sessionId: string
    onLogout: () => void
    snapshots: DailySnapshot[]
    accounts: TikTokAccount[]
    instagramAccounts: InstagramAccount[]
}

export default function Header({ sessionId, onLogout, snapshots, accounts, instagramAccounts }: HeaderProps) {
    const [statusMessage, setStatusMessage] = useState('SYNC DATA')
    const [isSyncing, setIsSyncing] = useState(false)

    const handleSync = async () => {
        if (isSyncing) return

        setIsSyncing(true)
        setStatusMessage('STARTING...')

        try {
            // 1. Trigger the Sync
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform: 'all', is_daily: true })
            })

            if (!res.ok) throw new Error('Failed to trigger sync')

            setStatusMessage('SYNCING...')

            // 2. Poll for Completion
            // Check status every 5 seconds for up to 5 minutes
            const startTime = Date.now()
            const timeout = 5 * 60 * 1000 // 5 minutes waiting time

            const pollInterval = setInterval(async () => {
                const elapsed = Date.now() - startTime
                // No timeout limit requested by user
                /* 
                if (elapsed > timeout) { ... } 
                */

                try {
                    const status = await getLatestSyncStatus()

                    if (status?.status === 'completed' || status?.status === 'success') {
                        clearInterval(pollInterval)
                        setIsSyncing(false)
                        setStatusMessage('DONE')
                        alert('Data sync completed successfully!')
                        window.location.reload()
                    } else if (status?.status === 'error') {
                        clearInterval(pollInterval)
                        setIsSyncing(false)
                        setStatusMessage('FAILED')
                        alert('Sync failed. Check system logs.')
                    }
                    // If 'triggered' or 'processing', keep waiting...
                } catch (err) {
                    console.error('Polling error:', err)
                }
            }, 5000)

        } catch (error) {
            console.error('Sync trigger error:', error)
            setIsSyncing(false)
            setStatusMessage('ERROR')
            alert('Failed to start sync.')
        }
    }

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
                <ExcelDownloadButton
                    snapshots={snapshots}
                    accounts={accounts}
                    instagramAccounts={instagramAccounts}
                />

                <div className="w-px h-8 bg-white/10 mx-2"></div>

                <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className={`px-3 py-1.5 text-xs font-mono rounded border flex items-center gap-2 transition-all ${isSyncing
                        ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50 cursor-wait'
                        : 'bg-black/40 border-white/10 text-cyan-400 hover:bg-cyan-900/20 hover:border-cyan-500/50'
                        }`}
                >
                    {isSyncing ? (
                        <>
                            <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {statusMessage}
                        </>
                    ) : (
                        <>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            SYNC DATA
                        </>
                    )}
                </button>

                <div className="hidden md:block text-right mr-4">
                    <div className="text-[10px] text-gray-500">SESSION ID</div>
                    <div className="text-xs font-mono text-cyan-300">#{sessionId}</div>
                </div>
                <button
                    onClick={onLogout}
                    title="Logout"
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
