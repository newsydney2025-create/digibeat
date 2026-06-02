'use client'

import { useEffect, useMemo, useState } from 'react'
import {
    AccountGroup,
    AccountGroupMember,
    AccountNote,
    DailySnapshot,
    MetricKey,
    Platform,
    TikTokAccount,
} from '@/types/database'
import { formatNumber, getAccountColor } from '@/lib/utils/format'
import { createManagedAccount, deleteManagedAccount } from '@/app/actions/accounts'

type SortMode = 'manual' | 'traffic'
type TimeRange = '3D' | '7D' | '30D' | '90D'
type AccountStat = { account_id?: string | null; [key: string]: string | number | null | undefined }
type DragPayload =
    | { type: 'account'; platform: Platform; accountId: string }
    | { type: 'group'; groupId: string }

interface AccountSidebarProps {
    platform: Platform
    accounts: TikTokAccount[]
    stats: AccountStat[]
    snapshots: DailySnapshot[]
    groups: AccountGroup[]
    members: AccountGroupMember[]
    notes: AccountNote[]
    selectedAccounts: string[]
    currentMetric: MetricKey
    timeRange: TimeRange
    viewMode: 'total' | 'daily'
    onToggleAccount: (accountId: string) => void
    onToggleAll: () => void
    hoveredAccount?: string | null
    onAccountHover?: (accountId: string | null) => void
    onOpenGroupManager?: () => void
    onSelectAccounts?: (accountIds: string[]) => void
    onAssignAccount?: (accountId: string, groupId: string | null) => void
    onMoveGroup?: (groupId: string, parentId: string | null) => void
    onAccountsChanged?: () => Promise<void>
}

const metricToSnapshotKey: Record<MetricKey, keyof DailySnapshot | null> = {
    playCount: 'gain_views',
    diggCount: 'gain_likes',
    commentCount: 'gain_comments',
    shareCount: 'gain_shares',
    collectCount: null,
}

const metricToStatKey: Record<MetricKey, string> = {
    playCount: 'play_count',
    diggCount: 'digg_count',
    commentCount: 'comment_count',
    shareCount: 'share_count',
    collectCount: 'collect_count',
}

function parseDragPayload(raw: string): DragPayload | null {
    try {
        const payload = JSON.parse(raw)
        if (payload?.type === 'account' || payload?.type === 'group') return payload
    } catch {
        return null
    }
    return null
}

export default function AccountSidebar({
    platform,
    accounts,
    stats,
    snapshots,
    groups,
    members,
    notes,
    selectedAccounts,
    currentMetric,
    timeRange,
    viewMode,
    onToggleAccount,
    onToggleAll,
    hoveredAccount = null,
    onAccountHover,
    onOpenGroupManager,
    onSelectAccounts,
    onAssignAccount,
    onMoveGroup,
    onAccountsChanged,
}: AccountSidebarProps) {
    const [expandedGroups, setExpandedGroups] = useState<string[]>([])
    const [hasAutoExpanded, setHasAutoExpanded] = useState(false)
    const [sortMode, setSortMode] = useState<SortMode>('manual')
    const [dragPayload, setDragPayload] = useState<DragPayload | null>(null)
    const [dragOverTarget, setDragOverTarget] = useState<string | null>(null)
    const [addPanelOpen, setAddPanelOpen] = useState(false)
    const [newAccount, setNewAccount] = useState('')
    const [newDisplayName, setNewDisplayName] = useState('')
    const [formMessage, setFormMessage] = useState<string | null>(null)
    const [savingAccount, setSavingAccount] = useState(false)
    const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null)

    const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts])
    const notesByAccount = useMemo(() => new Map(notes.map((note) => [`${note.platform}:${note.account_id}`, note.note])), [notes])
    const membersByAccount = useMemo(
        () => new Map(members.map((member) => [`${member.platform}:${member.account_id}`, member])),
        [members]
    )
    const membersByGroup = useMemo(() => {
        const result = new Map<string, AccountGroupMember[]>()
        members.forEach((member) => {
            const next = result.get(member.group_id) || []
            next.push(member)
            result.set(member.group_id, next)
        })
        result.forEach((value) => value.sort((a, b) => a.sort_order - b.sort_order))
        return result
    }, [members])

    const groupsByParent = useMemo(() => {
        const result = new Map<string | null, AccountGroup[]>()
        groups.forEach((group) => {
            const key = group.parent_id || null
            const next = result.get(key) || []
            next.push(group)
            result.set(key, next)
        })
        result.forEach((value) => value.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)))
        return result
    }, [groups])

    useEffect(() => {
        if (!hasAutoExpanded && groups.length > 0) {
            setExpandedGroups(groups.map((group) => group.id))
            setHasAutoExpanded(true)
        }
    }, [groups, hasAutoExpanded])

    useEffect(() => {
        setNewAccount('')
        setNewDisplayName('')
        setFormMessage(null)
    }, [platform])

    const visibleDates = useMemo(() => {
        const days = Number.parseInt(timeRange, 10)
        const allDates = Array.from(new Set(snapshots.map((snapshot) => snapshot.date))).sort()
        return new Set(allDates.slice(Math.max(0, allDates.length - days)))
    }, [snapshots, timeRange])

    const getAccountScore = (accountId: string) => {
        if (viewMode === 'total') {
            const statKey = metricToStatKey[currentMetric]
            return stats
                .filter((stat) => stat.account_id === accountId)
                .reduce((sum, stat: any) => sum + (stat[statKey] || 0), 0)
        }

        const snapshotKey = metricToSnapshotKey[currentMetric]
        if (!snapshotKey) return 0

        return snapshots
            .filter((snapshot) => snapshot.account_id === accountId && visibleDates.has(snapshot.date))
            .reduce((sum, snapshot) => sum + Number(snapshot[snapshotKey] || 0), 0)
    }

    const sortAccounts = (items: TikTokAccount[]) => {
        if (sortMode === 'traffic') {
            return [...items].sort((a, b) => getAccountScore(b.id) - getAccountScore(a.id))
        }

        return [...items].sort((a, b) => {
            const memberA = membersByAccount.get(`${platform}:${a.id}`)
            const memberB = membersByAccount.get(`${platform}:${b.id}`)
            return (memberA?.sort_order || 0) - (memberB?.sort_order || 0) || a.username.localeCompare(b.username)
        })
    }

    const toggleGroupExpand = (groupId: string) => {
        setExpandedGroups((prev) =>
            prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
        )
    }

    const getDescendantManagerIds = (groupId: string): string[] => {
        const children = groupsByParent.get(groupId) || []
        return children.flatMap((child) => [
            ...(child.group_type === 'manager' ? [child.id] : []),
            ...getDescendantManagerIds(child.id),
        ])
    }

    const isDescendantGroup = (candidateId: string, parentId: string): boolean => {
        const children = groupsByParent.get(parentId) || []
        return children.some((child) => child.id === candidateId || isDescendantGroup(candidateId, child.id))
    }

    const getCurrentPlatformAccountsForGroup = (group: AccountGroup) => {
        const managerIds = group.group_type === 'manager' ? [group.id] : getDescendantManagerIds(group.id)
        const accountIds = managerIds.flatMap((id) =>
            (membersByGroup.get(id) || [])
                .filter((member) => member.platform === platform)
                .map((member) => member.account_id)
        )

        return accountIds
            .map((accountId) => accountById.get(accountId))
            .filter(Boolean) as TikTokAccount[]
    }

    const canDropPayload = (
        payload: DragPayload | null,
        target: AccountGroup | null,
        targetMode: 'group-parent' | 'account-assignment'
    ) => {
        if (!payload) return false

        if (payload.type === 'account') {
            if (payload.platform !== platform || targetMode !== 'account-assignment') return false
            return !target || target.group_type === 'manager'
        }

        if (targetMode !== 'group-parent') return false
        if (!target) return true
        if (target.group_type !== 'folder') return false
        if (target.id === payload.groupId) return false
        return !isDescendantGroup(target.id, payload.groupId)
    }

    const getDropTargetClass = (targetKey: string, canDrop: boolean) => {
        if (!dragPayload) return ''
        if (dragOverTarget === targetKey && canDrop) return 'border-cyan-400/70 bg-cyan-500/15 text-cyan-200'
        if (canDrop) return 'border-cyan-500/30 bg-cyan-500/5'
        return 'opacity-40'
    }

    const handleDragOver = (
        event: React.DragEvent,
        targetKey: string,
        target: AccountGroup | null,
        targetMode: 'group-parent' | 'account-assignment'
    ) => {
        const payload = dragPayload || parseDragPayload(event.dataTransfer.getData('application/json'))
        const canDrop = canDropPayload(payload, target, targetMode)
        if (!canDrop) {
            event.dataTransfer.dropEffect = 'none'
            return
        }

        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setDragOverTarget(targetKey)
    }

    const handleDrop = (
        event: React.DragEvent,
        group: AccountGroup | null,
        targetMode: 'group-parent' | 'account-assignment'
    ) => {
        event.preventDefault()
        const payload = dragPayload || parseDragPayload(event.dataTransfer.getData('application/json'))
        setDragOverTarget(null)
        setDragPayload(null)
        if (!canDropPayload(payload, group, targetMode)) return

        if (payload?.type === 'account') {
            onAssignAccount?.(payload.accountId, group?.id || null)
            return
        }

        if (payload?.type === 'group') {
            onMoveGroup?.(payload.groupId, group?.id || null)
        }
    }

    const handleCreateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (savingAccount) return

        setSavingAccount(true)
        setFormMessage(null)

        const result = await createManagedAccount({
            platform,
            account: newAccount,
            displayName: newDisplayName,
        })

        setFormMessage(result.message)
        if (result.success) {
            setNewAccount('')
            setNewDisplayName('')
            await onAccountsChanged?.()
        }
        setSavingAccount(false)
    }

    const handleDeleteAccount = async (account: TikTokAccount) => {
        const confirmed = window.confirm(`Remove @${account.username} from active ${platform} accounts? Historical data will be kept.`)
        if (!confirmed) return

        setDeletingAccountId(account.id)
        setFormMessage(null)
        const result = await deleteManagedAccount({ platform, accountId: account.id })
        setFormMessage(result.message)
        if (result.success) {
            await onAccountsChanged?.()
        }
        setDeletingAccountId(null)
    }

    const renderAccount = (account: TikTokAccount, index: number) => {
        const isSelected = selectedAccounts.includes(account.id)
        const isHovered = hoveredAccount === account.id
        const color = getAccountColor(index)
        const score = getAccountScore(account.id)
        const note = notesByAccount.get(`${platform}:${account.id}`) || ''

        return (
            <div
                key={account.id}
                draggable
                onDragStart={(event) => {
                    const payload: DragPayload = { type: 'account', platform, accountId: account.id }
                    setDragPayload(payload)
                    event.dataTransfer.setData('application/json', JSON.stringify(payload))
                    event.dataTransfer.effectAllowed = 'move'
                }}
                onDragEnd={() => {
                    setDragPayload(null)
                    setDragOverTarget(null)
                }}
                onClick={() => onToggleAccount(account.id)}
                onMouseEnter={() => onAccountHover?.(account.id)}
                onMouseLeave={() => onAccountHover?.(null)}
                className={`p-2 rounded-lg border transition-all cursor-pointer group relative overflow-hidden ${isHovered
                    ? 'bg-cyan-500/20 border-cyan-500/50 scale-[1.02]'
                    : isSelected
                        ? 'bg-white/5 border-white/10'
                        : 'bg-transparent border-transparent opacity-50'
                    }`}
                title={note || `@${account.username}`}
            >
                <div
                    className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full transition-all"
                    style={{
                        backgroundColor: isSelected ? color : 'transparent',
                        boxShadow: isHovered ? `0 0 8px ${color}` : 'none',
                    }}
                />
                <div className="flex items-center gap-2 pl-2">
                    <div className="text-[9px] font-mono text-gray-500 w-4 text-right shrink-0">
                        {(index + 1).toString().padStart(2, '0')}
                    </div>
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
                        <div className="flex items-center gap-2">
                            <div className="text-[8px] text-gray-600 font-mono">
                                {formatNumber(score)}
                            </div>
                            {note && <div className="text-[8px] text-amber-400">note</div>}
                            {account.website && (
                                <a
                                    href={account.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[8px] text-cyan-500 hover:text-cyan-300 hover:underline truncate max-w-[70px]"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    Link
                                </a>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation()
                            handleDeleteAccount(account)
                        }}
                        disabled={deletingAccountId === account.id}
                        className="h-6 w-6 shrink-0 rounded border border-white/10 bg-black/20 text-gray-500 opacity-0 transition-all hover:border-rose-400/50 hover:bg-rose-500/15 hover:text-rose-200 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-rose-300/50 disabled:cursor-wait disabled:opacity-60"
                        title={`Remove @${account.username}`}
                        aria-label={`Remove @${account.username}`}
                    >
                        <svg className="mx-auto h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V5h6v2" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6M8 7l1 13h6l1-13" />
                        </svg>
                    </button>
                </div>
            </div>
        )
    }

    const renderGroup = (group: AccountGroup, depth = 0) => {
        const isExpanded = expandedGroups.includes(group.id)
        const groupAccounts = sortAccounts(getCurrentPlatformAccountsForGroup(group))
        const selectedInGroup = groupAccounts.filter((account) => selectedAccounts.includes(account.id)).length
        const children = groupsByParent.get(group.id) || []
        const targetMode = group.group_type === 'folder' ? 'group-parent' : 'account-assignment'
        const targetKey = `${targetMode}:${group.id}`
        const canDrop = canDropPayload(dragPayload, group, targetMode)
        const hasNestedContent = children.length > 0 || groupAccounts.length > 0 || group.group_type === 'manager'
        const typeLabel = group.group_type === 'folder' ? 'Folder' : 'Manager'

        return (
            <div key={group.id} className="space-y-1" style={{ marginLeft: depth * 8 }}>
                <div
                    draggable
                    onDragStart={(event) => {
                        const payload: DragPayload = { type: 'group', groupId: group.id }
                        setDragPayload(payload)
                        event.dataTransfer.setData('application/json', JSON.stringify(payload))
                        event.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragEnd={() => {
                        setDragPayload(null)
                        setDragOverTarget(null)
                    }}
                    onDragOver={(event) => handleDragOver(event, targetKey, group, targetMode)}
                    onDragLeave={() => setDragOverTarget((current) => current === targetKey ? null : current)}
                    onDrop={(event) => handleDrop(event, group, targetMode)}
                    className={`rounded-lg border border-white/10 bg-white/[0.045] p-2 cursor-pointer hover:bg-white/10 transition-colors ${getDropTargetClass(targetKey, canDrop)}`}
                    onClick={() => toggleGroupExpand(group.id)}
                    title={group.note || group.name}
                >
                    <div className="flex items-center gap-2">
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border border-white/10 bg-black/25 text-[10px] text-gray-400 ${isExpanded ? 'text-cyan-300' : ''}`}>
                            {hasNestedContent ? (isExpanded ? '-' : '+') : '-'}
                        </span>
                        <div
                            className={`h-3 w-3 shrink-0 ${group.group_type === 'folder' ? 'rounded-sm' : 'rounded-full'}`}
                            style={{ backgroundColor: group.color }}
                        />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                                <span className="truncate text-[10px] font-bold text-white">
                                    {group.name}
                                </span>
                                <span className="rounded bg-white/10 px-1 py-0.5 text-[7px] uppercase tracking-wider text-gray-500">
                                    {typeLabel}
                                </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-[8px] font-mono text-gray-600">
                                <span>{selectedInGroup}/{groupAccounts.length} selected</span>
                                {children.length > 0 && <span>{children.length} nested</span>}
                            </div>
                        </div>
                        <button
                            onClick={(event) => {
                                event.stopPropagation()
                                onSelectAccounts?.(groupAccounts.map((account) => account.id))
                            }}
                            className="rounded bg-white/10 px-1.5 py-0.5 text-[8px] text-gray-400 hover:text-white"
                        >
                            SEL
                        </button>
                    </div>
                </div>

                {isExpanded && (
                    <div className={`space-y-1 ${depth === 0 ? 'pl-1' : ''}`}>
                        {children.map((child) => renderGroup(child, depth + 1))}
                        {group.group_type === 'manager' && groupAccounts.map((account, index) => renderAccount(account, index))}
                        {group.group_type === 'manager' && groupAccounts.length === 0 && (
                            <div
                                onDragOver={(event) => handleDragOver(event, targetKey, group, 'account-assignment')}
                                onDragLeave={() => setDragOverTarget((current) => current === targetKey ? null : current)}
                                onDrop={(event) => handleDrop(event, group, 'account-assignment')}
                                className={`ml-3 rounded-lg border border-dashed border-white/10 px-2 py-2 text-[9px] text-gray-600 transition-colors ${getDropTargetClass(targetKey, canDropPayload(dragPayload, group, 'account-assignment'))}`}
                            >
                                Drop {platform === 'instagram' ? 'Instagram' : 'TikTok'} accounts here
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    const assignedAccountIds = new Set(
        members
            .filter((member) => member.platform === platform)
            .map((member) => member.account_id)
    )
    const unassignedAccounts = sortAccounts(accounts.filter((account) => !assignedAccountIds.has(account.id)))
    const allSelected = selectedAccounts.length === accounts.length

    return (
        <div className="glass-panel rounded-xl flex flex-col overflow-hidden w-64 shrink-0">
            <div className="p-3 border-b border-white/5 bg-white/5 flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-300 tracking-wider">
                    {platform === 'instagram' ? 'INSTAGRAM' : 'TIKTOK'} ACCOUNTS
                </span>
                <div className="flex items-center gap-1.5">
                    {onOpenGroupManager && (
                        <button
                            onClick={onOpenGroupManager}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-black/30 text-slate-300 transition-colors hover:border-blue-300/70 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-300/40"
                            title="Settings"
                            aria-label="Open settings"
                        >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.05.05a2.2 2.2 0 1 1-3.11 3.11l-.05-.05a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.65V21.5a2.2 2.2 0 1 1-4.4 0v-.08a1.8 1.8 0 0 0-1.1-1.65 1.8 1.8 0 0 0-1.98.36l-.05.05a2.2 2.2 0 1 1-3.11-3.11l.05-.05A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-1.65-1.1H2.9a2.2 2.2 0 1 1 0-4.4h.08A1.8 1.8 0 0 0 4.6 8a1.8 1.8 0 0 0-.36-1.98l-.05-.05a2.2 2.2 0 1 1 3.11-3.11l.05.05A1.8 1.8 0 0 0 9.33 3.3a1.8 1.8 0 0 0 1.1-1.65V1.6a2.2 2.2 0 1 1 4.4 0v.08a1.8 1.8 0 0 0 1.1 1.65 1.8 1.8 0 0 0 1.98-.36l.05-.05a2.2 2.2 0 1 1 3.11 3.11l-.05.05A1.8 1.8 0 0 0 19.4 8c.27.66.92 1.1 1.64 1.1h.06a2.2 2.2 0 1 1 0 4.4h-.06A1.8 1.8 0 0 0 19.4 15Z" />
                            </svg>
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

            <div className="p-2 border-b border-white/5 flex gap-1">
                {(['manual', 'traffic'] as SortMode[]).map((mode) => (
                    <button
                        key={mode}
                        onClick={() => setSortMode(mode)}
                        className={`flex-1 rounded px-2 py-1 text-[9px] font-mono uppercase transition-colors ${sortMode === mode
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : 'bg-black/20 text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        {mode}
                    </button>
                ))}
            </div>

            {addPanelOpen && (
                <form onSubmit={handleCreateAccount} className="border-b border-white/5 bg-black/20 p-2 space-y-2">
                    <label className="block">
                        <span className="mb-1 block text-[8px] uppercase tracking-wider text-gray-500">
                            {platform === 'instagram' ? 'Instagram URL or username' : 'TikTok username or URL'}
                        </span>
                        <input
                            value={newAccount}
                            onChange={(event) => setNewAccount(event.target.value)}
                            placeholder={platform === 'instagram' ? 'instagram.com/name' : '@username'}
                            className="h-8 w-full rounded-md border border-white/10 bg-black/40 px-2 text-[11px] text-gray-100 outline-none transition-colors placeholder:text-gray-700 focus:border-cyan-400/60"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-[8px] uppercase tracking-wider text-gray-500">
                            Display name optional
                        </span>
                        <input
                            value={newDisplayName}
                            onChange={(event) => setNewDisplayName(event.target.value)}
                            placeholder="Owner or nickname"
                            className="h-8 w-full rounded-md border border-white/10 bg-black/40 px-2 text-[11px] text-gray-100 outline-none transition-colors placeholder:text-gray-700 focus:border-cyan-400/60"
                        />
                    </label>
                    {formMessage && (
                        <div className="rounded border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[9px] text-gray-400">
                            {formMessage}
                        </div>
                    )}
                    <div className="flex gap-1.5">
                        <button
                            type="submit"
                            disabled={savingAccount}
                            className="flex-1 rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200 transition-colors hover:bg-emerald-500/25 disabled:cursor-wait disabled:opacity-50"
                        >
                            {savingAccount ? 'Saving' : 'Add'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setAddPanelOpen(false)
                                setFormMessage(null)
                            }}
                            className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-[9px] uppercase tracking-wider text-gray-500 transition-colors hover:text-gray-200"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            <div className="overflow-y-auto p-1.5 space-y-2 custom-scroll flex-1">
                <div
                    onDragOver={(event) => handleDragOver(event, 'root:groups', null, 'group-parent')}
                    onDragLeave={() => setDragOverTarget((current) => current === 'root:groups' ? null : current)}
                    onDrop={(event) => handleDrop(event, null, 'group-parent')}
                    className={`rounded-lg border border-dashed border-white/10 px-2 py-1 text-[8px] text-gray-600 uppercase tracking-wider transition-colors ${getDropTargetClass('root:groups', canDropPayload(dragPayload, null, 'group-parent'))}`}
                    title="Drop a folder or manager here to remove its parent folder"
                >
                    Drop group here for root level
                </div>

                {(groupsByParent.get(null) || []).map((group) => renderGroup(group))}

                <div
                    onDragOver={(event) => handleDragOver(event, 'root:accounts', null, 'account-assignment')}
                    onDragLeave={() => setDragOverTarget((current) => current === 'root:accounts' ? null : current)}
                    onDrop={(event) => handleDrop(event, null, 'account-assignment')}
                    className={`space-y-1 rounded-lg transition-colors ${getDropTargetClass('root:accounts', canDropPayload(dragPayload, null, 'account-assignment'))}`}
                >
                    <div className="text-[8px] text-gray-600 uppercase tracking-wider px-2 py-1">
                        Unassigned ({unassignedAccounts.length})
                    </div>
                    {unassignedAccounts.map((account, index) => renderAccount(account, index))}
                </div>
            </div>
        </div>
    )
}
