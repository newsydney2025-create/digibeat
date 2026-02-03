'use client'

import { useState } from 'react'
import { TikTokAccount, TikTokVideo, AccountGroup } from '@/types/database'
import { formatNumber, getAccountColor } from '@/lib/utils/format'

interface AccountSidebarProps {
    accounts: TikTokAccount[]
    videos: TikTokVideo[]
    selectedAccounts: string[]
    onToggleAccount: (accountId: string) => void
    onToggleAll: () => void
    hoveredAccount?: string | null
    onAccountHover?: (accountId: string | null) => void
    groups?: AccountGroup[]
    onOpenGroupManager?: () => void
    onSelectGroup?: (groupId: string) => void
}

export default function AccountSidebar({
    accounts,
    videos,
    selectedAccounts,
    onToggleAccount,
    onToggleAll,
    hoveredAccount = null,
    onAccountHover,
    groups = [],
    onOpenGroupManager,
    onSelectGroup,
}: AccountSidebarProps) {
    const [expandedGroups, setExpandedGroups] = useState<string[]>([])

    const getAccountTotal = (accountId: string) => {
        return videos
            .filter((v) => v.account_id === accountId)
            .reduce((sum, v) => sum + v.play_count, 0)
    }

    const toggleGroupExpand = (groupId: string) => {
        setExpandedGroups(prev =>
            prev.includes(groupId)
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
        )
    }

    const allSelected = selectedAccounts.length === accounts.length

    // Get accounts that are in groups
    const groupedAccountIds = new Set(groups.flatMap(g => g.members || []))

    // Get accounts not in any group
    const ungroupedAccounts = accounts.filter(a => !groupedAccountIds.has(a.id))

    const renderAccount = (account: TikTokAccount, index: number) => {
        const isSelected = selectedAccounts.includes(account.id)
        const isHovered = hoveredAccount === account.id
        const color = getAccountColor(index)

        return (
            <div
                key={account.id}
                onClick={() => onToggleAccount(account.id)}
                onMouseEnter={() => onAccountHover?.(account.id)}
                onMouseLeave={() => onAccountHover?.(null)}
                className={`p-2 rounded-lg border transition-all cursor-pointer group relative overflow-hidden ${isHovered
                        ? 'bg-cyan-500/20 border-cyan-500/50 scale-[1.02]'
                        : isSelected
                            ? 'bg-white/5 border-white/10'
                            : 'bg-transparent border-transparent opacity-50'
                    }`}
            >
                <div
                    className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full transition-all"
                    style={{
                        backgroundColor: isSelected ? color : 'transparent',
                        boxShadow: isHovered ? `0 0 8px ${color}` : 'none'
                    }}
                ></div>
                <div className="flex items-center gap-2 pl-2">
                    <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold border transition-all ${isHovered
                                ? 'bg-cyan-500/30 border-cyan-400 text-cyan-300'
                                : 'bg-gray-800 border-white/10 text-gray-400'
                            }`}
                    >
                        {account.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="overflow-hidden flex-1 min-w-0">
                        <div className={`text-[10px] font-bold truncate transition-colors ${isHovered ? 'text-cyan-300' : 'text-gray-200 group-hover:text-cyan-300'
                            }`}>
                            @{account.username}
                        </div>
                        <div className="text-[8px] text-gray-600 font-mono">
                            {formatNumber(getAccountTotal(account.id))}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="glass-panel rounded-xl flex flex-col overflow-hidden w-48 shrink-0">
            {/* Header */}
            <div className="p-3 border-b border-white/5 bg-white/5 flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-300 tracking-wider">ACCOUNTS</span>
                <div className="flex gap-1">
                    {onOpenGroupManager && (
                        <button
                            onClick={onOpenGroupManager}
                            className="text-[10px] text-purple-400 hover:text-white transition-colors px-1"
                            title="Manage Groups"
                        >
                            ⊞
                        </button>
                    )}
                    <button
                        onClick={onToggleAll}
                        className="text-[10px] text-cyan-400 hover:text-white transition-colors"
                    >
                        {allSelected ? 'HIDE' : 'ALL'}
                    </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto p-1.5 space-y-1 custom-scroll flex-1">
                {/* Groups */}
                {groups.map(group => {
                    const groupAccounts = accounts.filter(a => (group.members || []).includes(a.id))
                    const isExpanded = expandedGroups.includes(group.id)
                    const allGroupSelected = groupAccounts.every(a => selectedAccounts.includes(a.id))

                    return (
                        <div key={group.id} className="mb-2">
                            {/* Group Header */}
                            <div
                                className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                                onClick={() => toggleGroupExpand(group.id)}
                            >
                                <div
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: group.color }}
                                />
                                <span className="text-[10px] font-bold text-white flex-1 truncate">
                                    {group.name}
                                </span>
                                <span className="text-[8px] text-gray-500">
                                    {groupAccounts.length}
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onSelectGroup?.(group.id)
                                    }}
                                    className={`text-[8px] px-1.5 py-0.5 rounded transition-colors ${allGroupSelected
                                            ? 'bg-cyan-500/30 text-cyan-300'
                                            : 'bg-white/10 text-gray-400 hover:text-white'
                                        }`}
                                >
                                    {allGroupSelected ? '✓' : 'SEL'}
                                </button>
                                <span className={`text-[10px] text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                    ▼
                                </span>
                            </div>

                            {/* Group Members (collapsible) */}
                            {isExpanded && (
                                <div className="pl-3 mt-1 space-y-1 animate-in slide-in-from-top-2 duration-200">
                                    {groupAccounts.map((account, idx) => renderAccount(account, idx))}
                                </div>
                            )}
                        </div>
                    )
                })}

                {/* Ungrouped Accounts */}
                {ungroupedAccounts.length > 0 && groups.length > 0 && (
                    <div className="mb-2">
                        <div className="text-[8px] text-gray-600 uppercase tracking-wider px-2 py-1">
                            Ungrouped
                        </div>
                    </div>
                )}

                {ungroupedAccounts.map((account, index) => renderAccount(account, index + groups.length * 10))}
            </div>
        </div>
    )
}
