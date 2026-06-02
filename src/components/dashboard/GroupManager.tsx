'use client'

import { useMemo, useState } from 'react'
import {
    AccountGroup,
    AccountGroupMember,
    AccountNote,
    GroupType,
    InstagramAccount,
    Platform,
    TikTokAccount,
} from '@/types/database'
import {
    assignAccountToManager,
    createAccountGroup,
    deleteAccountGroup,
    saveAccountNote,
    updateAccountGroup,
} from '@/app/actions/account-management'

interface GroupManagerProps {
    tiktokAccounts: TikTokAccount[]
    instagramAccounts: InstagramAccount[]
    groups: AccountGroup[]
    members: AccountGroupMember[]
    notes: AccountNote[]
    isOpen: boolean
    onClose: () => void
    onRefresh: () => Promise<void>
}

const GROUP_COLORS = [
    '#22d3ee',
    '#a855f7',
    '#f97316',
    '#22c55e',
    '#ec4899',
    '#eab308',
    '#3b82f6',
    '#ef4444',
]

type AccountRow = {
    platform: Platform
    id: string
    username: string
    displayName: string
    managerGroupId: string | null
    note: string
}

export default function GroupManager({
    tiktokAccounts,
    instagramAccounts,
    groups,
    members,
    notes,
    isOpen,
    onClose,
    onRefresh,
}: GroupManagerProps) {
    const [saving, setSaving] = useState(false)
    const [newGroupName, setNewGroupName] = useState('')
    const [newGroupType, setNewGroupType] = useState<GroupType>('manager')
    const [newGroupParent, setNewGroupParent] = useState<string | null>(null)
    const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0])
    const [search, setSearch] = useState('')
    const [platformFilter, setPlatformFilter] = useState<'all' | Platform>('all')
    const [editingGroups, setEditingGroups] = useState<Record<string, Partial<AccountGroup>>>({})
    const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
    const [createSectionOpen, setCreateSectionOpen] = useState(true)
    const [editSectionOpen, setEditSectionOpen] = useState(true)

    const managers = useMemo(
        () => groups.filter((group) => group.group_type === 'manager').sort((a, b) => a.name.localeCompare(b.name)),
        [groups]
    )
    const folders = useMemo(
        () => groups.filter((group) => group.group_type === 'folder').sort((a, b) => a.name.localeCompare(b.name)),
        [groups]
    )
    const memberByAccount = useMemo(
        () => new Map(members.map((member) => [`${member.platform}:${member.account_id}`, member])),
        [members]
    )
    const noteByAccount = useMemo(
        () => new Map(notes.map((note) => [`${note.platform}:${note.account_id}`, note.note])),
        [notes]
    )

    const accountRows = useMemo<AccountRow[]>(() => {
        const tk = tiktokAccounts.map((account) => {
            const key = `tiktok:${account.id}`
            return {
                platform: 'tiktok' as Platform,
                id: account.id,
                username: account.username,
                displayName: account.nickname || account.username,
                managerGroupId: memberByAccount.get(key)?.group_id || null,
                note: noteByAccount.get(key) || '',
            }
        })
        const ig = instagramAccounts.map((account) => {
            const key = `instagram:${account.id}`
            return {
                platform: 'instagram' as Platform,
                id: account.id,
                username: account.username,
                displayName: account.full_name || account.username,
                managerGroupId: memberByAccount.get(key)?.group_id || null,
                note: noteByAccount.get(key) || '',
            }
        })

        return [...tk, ...ig]
            .filter((account) => platformFilter === 'all' || account.platform === platformFilter)
            .filter((account) => {
                const term = search.trim().toLowerCase()
                if (!term) return true
                return account.username.toLowerCase().includes(term) || account.displayName.toLowerCase().includes(term)
            })
            .sort((a, b) => a.platform.localeCompare(b.platform) || a.username.localeCompare(b.username))
    }, [instagramAccounts, memberByAccount, noteByAccount, platformFilter, search, tiktokAccounts])

    const groupsByParent = useMemo(() => {
        const result = new Map<string | null, AccountGroup[]>()
        groups.forEach((group) => {
            const key = group.parent_id || null
            const next = result.get(key) || []
            next.push(group)
            result.set(key, next)
        })
        result.forEach((items) => items.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)))
        return result
    }, [groups])

    const selectedGroup = useMemo(
        () => groups.find((group) => group.id === selectedGroupId) || null,
        [groups, selectedGroupId]
    )

    const isDescendantGroup = (candidateId: string, parentId: string): boolean => {
        const children = groupsByParent.get(parentId) || []
        return children.some((child) => child.id === candidateId || isDescendantGroup(candidateId, child.id))
    }

    const getAssignableParentFolders = (group?: AccountGroup | null) => {
        if (!group) return folders
        return folders.filter((folder) => folder.id !== group.id && !isDescendantGroup(folder.id, group.id))
    }

    const renderGroupTree = (group: AccountGroup, depth = 0) => {
        const children = groupsByParent.get(group.id) || []
        const isSelected = selectedGroupId === group.id

        return (
            <div key={group.id} className="space-y-1">
                <button
                    onClick={() => setSelectedGroupId(group.id)}
                    className={`w-full flex items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors ${isSelected
                        ? 'bg-cyan-500/10 border-cyan-500/40'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                    style={{ marginLeft: depth * 12 }}
                >
                    <span
                        className={`w-2.5 h-2.5 shrink-0 ${group.group_type === 'folder' ? 'rounded-sm' : 'rounded-full'}`}
                        style={{ backgroundColor: group.color }}
                    />
                    <span className="flex-1 min-w-0">
                        <span className="block truncate text-xs font-bold text-white">{group.name}</span>
                        <span className="block text-[9px] uppercase text-gray-500">
                            {group.group_type}{children.length ? ` · ${children.length} child${children.length === 1 ? '' : 'ren'}` : ''}
                        </span>
                    </span>
                    <span className="text-[10px] text-cyan-300">Edit</span>
                </button>
                {children.map((child) => renderGroupTree(child, depth + 1))}
            </div>
        )
    }

    const refreshAfter = async (work: () => Promise<unknown>) => {
        setSaving(true)
        setStatusMessage(null)
        try {
            const result = await work()
            if (result === null || result === false) {
                setStatusMessage('Save failed. Please check the database migration and server logs.')
                return false
            }
            await onRefresh()
            setStatusMessage('Saved')
            return true
        } catch (error) {
            console.error(error)
            setStatusMessage('Save failed. Please check the database migration and server logs.')
            return false
        } finally {
            setSaving(false)
        }
    }

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return
        const success = await refreshAfter(async () => {
            return createAccountGroup({
                name: newGroupName.trim(),
                group_type: newGroupType,
                parent_id: newGroupParent,
                color: newGroupColor,
            })
        })
        if (!success) return
        setNewGroupName('')
        setNewGroupParent(null)
        setNewGroupColor(GROUP_COLORS[(groups.length + 1) % GROUP_COLORS.length])
    }

    const handleUpdateGroup = async (group: AccountGroup) => {
        const draft = editingGroups[group.id] || {}
        const success = await refreshAfter(async () => {
            return updateAccountGroup({
                id: group.id,
                name: draft.name ?? group.name,
                color: draft.color ?? group.color,
                parent_id: draft.parent_id === undefined ? group.parent_id : draft.parent_id,
                note: draft.note === undefined ? group.note : draft.note,
            })
        })
        if (!success) return
        setSelectedGroupId(group.id)
        setEditingGroups((prev) => {
            const next = { ...prev }
            delete next[group.id]
            return next
        })
    }

    const handleSaveNote = async (account: AccountRow) => {
        const key = `${account.platform}:${account.id}`
        await refreshAfter(async () => {
            return saveAccountNote({
                platform: account.platform,
                account_id: account.id,
                note: noteDrafts[key] ?? account.note,
            })
        })
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#0A0A0A] border border-white/10 rounded-xl w-full max-w-6xl max-h-[88vh] overflow-hidden flex flex-col">
                <div className="p-4 border-b border-white/5 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="w-1 h-6 bg-purple-500 rounded-full" />
                        Account Management
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors p-1"
                        title="Close"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>

                {statusMessage && (
                    <div className={`px-4 py-2 text-xs border-b border-white/5 ${statusMessage === 'Saved'
                        ? 'bg-green-500/10 text-green-300'
                        : 'bg-amber-500/10 text-amber-300'
                        }`}>
                        {statusMessage}
                    </div>
                )}

                <div className="grid grid-cols-12 min-h-0 flex-1">
                    <div className="col-span-4 border-r border-white/5 p-4 overflow-y-auto custom-scrollbar space-y-4">
                        <div className="bg-white/5 rounded-lg border border-dashed border-white/20 p-4">
                            <button
                                onClick={() => setCreateSectionOpen((open) => !open)}
                                className="w-full flex items-center justify-between text-left"
                            >
                                <span>
                                    <span className="block text-sm font-bold text-gray-400">Create Folder / Manager</span>
                                    <span className="block text-[10px] text-gray-600">
                                        Parent folder is optional. Leave it as root to create a top-level item.
                                    </span>
                                </span>
                                <span className={`text-xs text-gray-500 transition-transform ${createSectionOpen ? 'rotate-180' : ''}`}>
                                    v
                                </span>
                            </button>

                            {createSectionOpen && (
                                <div className="pt-3">
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <button
                                            onClick={() => setNewGroupType('manager')}
                                            className={`py-2 rounded text-xs font-mono ${newGroupType === 'manager' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-black/40 text-gray-500'}`}
                                        >
                                            Manager
                                        </button>
                                        <button
                                            onClick={() => setNewGroupType('folder')}
                                            className={`py-2 rounded text-xs font-mono ${newGroupType === 'folder' ? 'bg-purple-500/20 text-purple-300' : 'bg-black/40 text-gray-500'}`}
                                        >
                                            Folder
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        value={newGroupName}
                                        onChange={(event) => setNewGroupName(event.target.value)}
                                        placeholder={newGroupType === 'manager' ? 'Manager name...' : 'Folder name...'}
                                        className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 mb-3"
                                    />
                                    <select
                                        value={newGroupParent || ''}
                                        onChange={(event) => setNewGroupParent(event.target.value || null)}
                                        className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 mb-3"
                                    >
                                        <option value="">No parent / root level</option>
                                        {folders.map((folder) => (
                                            <option key={folder.id} value={folder.id}>{folder.name}</option>
                                        ))}
                                    </select>
                                    <div className="flex gap-1 mb-3">
                                        {GROUP_COLORS.map((color) => (
                                            <button
                                                key={color}
                                                onClick={() => setNewGroupColor(color)}
                                                className={`w-7 h-7 rounded border-2 transition-all ${newGroupColor === color ? 'border-white scale-110' : 'border-transparent'}`}
                                                style={{ backgroundColor: color }}
                                                title={color}
                                            />
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleCreateGroup}
                                        disabled={!newGroupName.trim() || saving}
                                        className="w-full py-2 bg-purple-500/20 border border-purple-500/50 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-colors disabled:opacity-50 text-sm font-bold"
                                    >
                                        Create
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <button
                                onClick={() => setEditSectionOpen((open) => !open)}
                                className="w-full px-1 flex items-center justify-between text-left"
                            >
                                <span>
                                    <span className="block text-sm font-bold text-gray-400">Edit Existing Groups</span>
                                    <span className="block text-[10px] text-gray-600">
                                        Groups are shown by hierarchy. Select one to edit details.
                                    </span>
                                </span>
                                <span className={`text-xs text-gray-500 transition-transform ${editSectionOpen ? 'rotate-180' : ''}`}>
                                    v
                                </span>
                            </button>

                            {editSectionOpen && (
                                <>
                                    <div className="space-y-1">
                                        {(groupsByParent.get(null) || []).map((group) => renderGroupTree(group))}
                                        {groups.length === 0 && (
                                            <div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-xs text-gray-600">
                                                No groups yet.
                                            </div>
                                        )}
                                    </div>

                                    {selectedGroup ? (() => {
                                        const group = selectedGroup
                                        const draft = editingGroups[group.id] || {}
                                        return (
                                            <div className="bg-white/5 rounded-lg border border-cyan-500/20 p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={`w-3 h-3 ${group.group_type === 'folder' ? 'rounded-sm' : 'rounded-full'}`} style={{ backgroundColor: draft.color || group.color }} />
                                            <span className="text-[10px] uppercase text-gray-500">{group.group_type}</span>
                                            <button
                                                onClick={async () => {
                                                    const success = await refreshAfter(() => deleteAccountGroup(group.id))
                                                    if (success) setSelectedGroupId(null)
                                                }}
                                                className="ml-auto text-[10px] text-red-400 hover:text-red-300"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                        <input
                                            value={draft.name ?? group.name}
                                            onChange={(event) => setEditingGroups((prev) => ({ ...prev, [group.id]: { ...prev[group.id], name: event.target.value } }))}
                                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white mb-2"
                                        />
                                        <select
                                            value={draft.parent_id === undefined ? group.parent_id || '' : draft.parent_id || ''}
                                            onChange={(event) => setEditingGroups((prev) => ({ ...prev, [group.id]: { ...prev[group.id], parent_id: event.target.value || null } }))}
                                            className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white mb-2"
                                        >
                                            <option value="">No parent / root level</option>
                                            {getAssignableParentFolders(group).map((folder) => (
                                                <option key={folder.id} value={folder.id}>{folder.name}</option>
                                            ))}
                                        </select>
                                        <div className="flex gap-1 mb-2">
                                            {GROUP_COLORS.map((color) => {
                                                const selectedColor = draft.color || group.color
                                                return (
                                                    <button
                                                        key={color}
                                                        onClick={() => setEditingGroups((prev) => ({ ...prev, [group.id]: { ...prev[group.id], color } }))}
                                                        className={`w-6 h-6 rounded border-2 transition-all ${selectedColor === color ? 'border-white scale-110' : 'border-transparent'}`}
                                                        style={{ backgroundColor: color }}
                                                        title={`Set color ${color}`}
                                                    />
                                                )
                                            })}
                                        </div>
                                        <textarea
                                            value={draft.note === undefined ? group.note || '' : draft.note || ''}
                                            onChange={(event) => setEditingGroups((prev) => ({ ...prev, [group.id]: { ...prev[group.id], note: event.target.value } }))}
                                            placeholder="Manager/folder note..."
                                            className="w-full min-h-16 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-gray-600 mb-2"
                                        />
                                        <button
                                            onClick={() => handleUpdateGroup(group)}
                                            disabled={saving}
                                            className="w-full py-1.5 rounded bg-cyan-500/20 text-cyan-300 text-xs hover:bg-cyan-500/30 disabled:opacity-50"
                                        >
                                            Save Group
                                        </button>
                                            </div>
                                        )
                                    })() : groups.length > 0 && (
                                        <div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-xs text-gray-600">
                                            Select a folder or manager above to edit it.
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    <div className="col-span-8 p-4 overflow-hidden flex flex-col">
                        <div className="flex gap-2 mb-3">
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search accounts..."
                                className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                            />
                            {(['all', 'tiktok', 'instagram'] as const).map((value) => (
                                <button
                                    key={value}
                                    onClick={() => setPlatformFilter(value)}
                                    className={`px-3 rounded text-xs font-mono uppercase ${platformFilter === value ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-gray-500'}`}
                                >
                                    {value}
                                </button>
                            ))}
                        </div>

                        <div className="overflow-auto custom-scrollbar flex-1 rounded-lg border border-white/10">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-black/40 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3 text-xs text-gray-500 uppercase">Platform</th>
                                        <th className="p-3 text-xs text-gray-500 uppercase">Account</th>
                                        <th className="p-3 text-xs text-gray-500 uppercase">Manager</th>
                                        <th className="p-3 text-xs text-gray-500 uppercase">Account Note</th>
                                        <th className="p-3 text-xs text-gray-500 uppercase text-right">Save</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {accountRows.map((account) => {
                                        const key = `${account.platform}:${account.id}`
                                        return (
                                            <tr key={key} className="hover:bg-white/5">
                                                <td className="p-3 text-xs text-gray-400 uppercase">{account.platform}</td>
                                                <td className="p-3">
                                                    <div className="text-xs text-white">@{account.username}</div>
                                                    <div className="text-[10px] text-gray-500">{account.displayName}</div>
                                                </td>
                                                <td className="p-3">
                                                    <select
                                                        value={account.managerGroupId || ''}
                                                        onChange={(event) => {
                                                            const groupId = event.target.value || null
                                                            refreshAfter(() => assignAccountToManager({
                                                                platform: account.platform,
                                                                account_id: account.id,
                                                                group_id: groupId,
                                                            }))
                                                        }}
                                                        className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white"
                                                    >
                                                        <option value="">Unassigned</option>
                                                        {managers.map((manager) => (
                                                            <option key={manager.id} value={manager.id}>{manager.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="p-3">
                                                    <input
                                                        value={noteDrafts[key] ?? account.note}
                                                        onChange={(event) => setNoteDrafts((prev) => ({ ...prev, [key]: event.target.value }))}
                                                        placeholder="Account note..."
                                                        className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-gray-600"
                                                    />
                                                </td>
                                                <td className="p-3 text-right">
                                                    <button
                                                        onClick={() => handleSaveNote(account)}
                                                        disabled={saving}
                                                        className="px-2 py-1 rounded bg-green-500/20 text-green-300 text-xs hover:bg-green-500/30 disabled:opacity-50"
                                                    >
                                                        Save
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
