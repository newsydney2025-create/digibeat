'use client'

import { useState, useEffect } from 'react'
import { TikTokAccount, AccountGroup } from '@/types/database'
import { fetchAccountGroups, createAccountGroup, updateGroupMembers, deleteAccountGroup } from '@/app/actions/tiktok'

interface GroupManagerProps {
    accounts: TikTokAccount[]
    isOpen: boolean
    onClose: () => void
    onGroupsChange: (groups: AccountGroup[]) => void
}

const GROUP_COLORS = [
    '#22d3ee', // cyan
    '#a855f7', // purple
    '#f97316', // orange
    '#22c55e', // green
    '#ec4899', // pink
    '#eab308', // yellow
    '#3b82f6', // blue
    '#ef4444', // red
]

export default function GroupManager({ accounts, isOpen, onClose, onGroupsChange }: GroupManagerProps) {
    const [groups, setGroups] = useState<AccountGroup[]>([])
    const [loading, setLoading] = useState(false)
    const [newGroupName, setNewGroupName] = useState('')
    const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0])
    const [editingGroup, setEditingGroup] = useState<string | null>(null)
    const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])

    // Load groups on mount
    useEffect(() => {
        if (isOpen) {
            loadGroups()
        }
    }, [isOpen])

    const loadGroups = async () => {
        setLoading(true)
        const data = await fetchAccountGroups()
        setGroups(data)
        onGroupsChange(data)
        setLoading(false)
    }

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return

        const group = await createAccountGroup(newGroupName.trim(), newGroupColor, selectedAccounts)
        if (group) {
            setGroups(prev => [...prev, group])
            onGroupsChange([...groups, group])
            setNewGroupName('')
            setSelectedAccounts([])
            setNewGroupColor(GROUP_COLORS[(groups.length + 1) % GROUP_COLORS.length])
        }
    }

    const handleDeleteGroup = async (groupId: string) => {
        const success = await deleteAccountGroup(groupId)
        if (success) {
            const updated = groups.filter(g => g.id !== groupId)
            setGroups(updated)
            onGroupsChange(updated)
        }
    }

    const handleUpdateMembers = async (groupId: string) => {
        const success = await updateGroupMembers(groupId, selectedAccounts)
        if (success) {
            const updated = groups.map(g =>
                g.id === groupId ? { ...g, members: selectedAccounts } : g
            )
            setGroups(updated)
            onGroupsChange(updated)
            setEditingGroup(null)
            setSelectedAccounts([])
        }
    }

    const startEditing = (group: AccountGroup) => {
        setEditingGroup(group.id)
        setSelectedAccounts(group.members || [])
    }

    const toggleAccountSelection = (accountId: string) => {
        setSelectedAccounts(prev =>
            prev.includes(accountId)
                ? prev.filter(id => id !== accountId)
                : [...prev, accountId]
        )
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#0A0A0A] border border-white/10 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="w-1 h-6 bg-purple-500 rounded-full"></span>
                        Account Groups
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors p-1"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loading ? (
                        <div className="text-center text-gray-500 py-8">Loading...</div>
                    ) : (
                        <>
                            {/* Existing Groups */}
                            {groups.map(group => (
                                <div
                                    key={group.id}
                                    className="bg-white/5 rounded-lg border border-white/10 p-3"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: group.color }}
                                            />
                                            <span className="font-bold text-white">{group.name}</span>
                                            <span className="text-xs text-gray-500">
                                                ({group.members?.length || 0} accounts)
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            {editingGroup === group.id ? (
                                                <>
                                                    <button
                                                        onClick={() => handleUpdateMembers(group.id)}
                                                        className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => { setEditingGroup(null); setSelectedAccounts([]) }}
                                                        className="text-xs px-2 py-1 bg-gray-500/20 text-gray-400 rounded hover:bg-gray-500/30"
                                                    >
                                                        Cancel
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => startEditing(group)}
                                                        className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteGroup(group.id)}
                                                        className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                                                    >
                                                        Delete
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Members display or edit */}
                                    {editingGroup === group.id ? (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {accounts.map(acc => (
                                                <button
                                                    key={acc.id}
                                                    onClick={() => toggleAccountSelection(acc.id)}
                                                    className={`text-[10px] px-2 py-1 rounded border transition-all ${selectedAccounts.includes(acc.id)
                                                            ? 'bg-cyan-500/30 border-cyan-500/50 text-cyan-300'
                                                            : 'bg-black/40 border-white/10 text-gray-500 hover:text-white'
                                                        }`}
                                                >
                                                    @{acc.username}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-1">
                                            {(group.members || []).map(memberId => {
                                                const acc = accounts.find(a => a.id === memberId)
                                                return acc ? (
                                                    <span
                                                        key={memberId}
                                                        className="text-[10px] px-2 py-0.5 bg-white/5 rounded text-gray-400"
                                                    >
                                                        @{acc.username}
                                                    </span>
                                                ) : null
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Create New Group */}
                            <div className="bg-white/5 rounded-lg border border-dashed border-white/20 p-4">
                                <h3 className="text-sm font-bold text-gray-400 mb-3">Create New Group</h3>

                                <div className="flex gap-2 mb-3">
                                    <input
                                        type="text"
                                        value={newGroupName}
                                        onChange={e => setNewGroupName(e.target.value)}
                                        placeholder="Group name..."
                                        className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                                    />
                                    <div className="flex gap-1">
                                        {GROUP_COLORS.map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setNewGroupColor(color)}
                                                className={`w-8 h-8 rounded border-2 transition-all ${newGroupColor === color ? 'border-white scale-110' : 'border-transparent'
                                                    }`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Account selection for new group */}
                                {!editingGroup && (
                                    <div className="mb-3">
                                        <p className="text-xs text-gray-500 mb-2">Select accounts to add:</p>
                                        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                                            {accounts.map(acc => (
                                                <button
                                                    key={acc.id}
                                                    onClick={() => toggleAccountSelection(acc.id)}
                                                    className={`text-[10px] px-2 py-1 rounded border transition-all ${selectedAccounts.includes(acc.id)
                                                            ? 'bg-cyan-500/30 border-cyan-500/50 text-cyan-300'
                                                            : 'bg-black/40 border-white/10 text-gray-500 hover:text-white'
                                                        }`}
                                                >
                                                    @{acc.username}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={handleCreateGroup}
                                    disabled={!newGroupName.trim()}
                                    className="w-full py-2 bg-purple-500/20 border border-purple-500/50 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold"
                                >
                                    + Create Group
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
