'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
    saveGroupPositions,
    updateAccountGroup,
} from '@/app/actions/account-management'
import { createManagedAccount, deleteManagedAccount, updateManagedAccount } from '@/app/actions/accounts'

interface GroupManagerProps {
    tiktokAccounts: TikTokAccount[]
    instagramAccounts: InstagramAccount[]
    groups: AccountGroup[]
    members: AccountGroupMember[]
    notes: AccountNote[]
    isOpen: boolean
    onClose: () => void
    onRefresh: () => Promise<void>
    onAccountsChanged?: () => Promise<void>
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
    profileUrl: string
    managerGroupId: string | null
    note: string
}

type SaveState = 'saving' | 'success' | 'error'
type AccountDraft = {
    username: string
    displayName: string
}
type SaveTimer = number
type GroupDropTarget = {
    id: string
    placement: 'before' | 'after'
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
    onAccountsChanged,
}: GroupManagerProps) {
    const [saving, setSaving] = useState(false)
    const [newGroupName, setNewGroupName] = useState('')
    const [newGroupType, setNewGroupType] = useState<GroupType>('manager')
    const [newGroupParent, setNewGroupParent] = useState<string | null>(null)
    const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0])
    const [newAccountPlatform, setNewAccountPlatform] = useState<Platform>('tiktok')
    const [newAccountUsername, setNewAccountUsername] = useState('')
    const [newAccountDisplayName, setNewAccountDisplayName] = useState('')
    const [addingAccount, setAddingAccount] = useState(false)
    const [search, setSearch] = useState('')
    const [platformFilter, setPlatformFilter] = useState<'all' | Platform>('all')
    const [editingGroups, setEditingGroups] = useState<Record<string, Partial<AccountGroup>>>({})
    const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({})
    const [activeNoteKey, setActiveNoteKey] = useState<string | null>(null)
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
    const [createSectionOpen, setCreateSectionOpen] = useState(true)
    const [editSectionOpen, setEditSectionOpen] = useState(true)
    const [editingAccountKey, setEditingAccountKey] = useState<string | null>(null)
    const [accountDrafts, setAccountDrafts] = useState<Record<string, AccountDraft>>({})
    const [memberOverrides, setMemberOverrides] = useState<Record<string, string | null>>({})
    const [noteOverrides, setNoteOverrides] = useState<Record<string, string>>({})
    const [accountOverrides, setAccountOverrides] = useState<Record<string, AccountDraft>>({})
    const [groupPositionOverrides, setGroupPositionOverrides] = useState<Record<string, { parent_id: string | null; sort_order: number }>>({})
    const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null)
    const [groupDropTarget, setGroupDropTarget] = useState<GroupDropTarget | null>(null)
    const noteSaveTimers = useRef<Record<string, SaveTimer>>({})
    const accountSaveTimers = useRef<Record<string, SaveTimer>>({})
    const groupSaveTimers = useRef<Record<string, SaveTimer>>({})

    const managedGroups = useMemo(
        () => groups.map((group) => ({
            ...group,
            ...(groupPositionOverrides[group.id] || {}),
            ...(editingGroups[group.id] || {}),
        })),
        [editingGroups, groupPositionOverrides, groups]
    )

    const managers = useMemo(
        () => managedGroups.filter((group) => group.group_type === 'manager').sort((a, b) => a.name.localeCompare(b.name)),
        [managedGroups]
    )
    const folders = useMemo(
        () => managedGroups.filter((group) => group.group_type === 'folder').sort((a, b) => a.name.localeCompare(b.name)),
        [managedGroups]
    )
    const managerById = useMemo(
        () => new Map(managers.map((manager) => [manager.id, manager])),
        [managers]
    )
    const memberByAccount = useMemo(
        () => new Map(members.map((member) => [`${member.platform}:${member.account_id}`, member])),
        [members]
    )
    const noteByAccount = useMemo(
        () => new Map(notes.map((note) => [`${note.platform}:${note.account_id}`, note.note])),
        [notes]
    )

    useEffect(() => {
        const noteTimers = noteSaveTimers.current
        const accountTimers = accountSaveTimers.current
        const groupTimers = groupSaveTimers.current

        return () => {
            Object.values(noteTimers).forEach((timer) => window.clearTimeout(timer))
            Object.values(accountTimers).forEach((timer) => window.clearTimeout(timer))
            Object.values(groupTimers).forEach((timer) => window.clearTimeout(timer))
        }
    }, [])

    const accountRows = useMemo<AccountRow[]>(() => {
        const tk = tiktokAccounts.map((account) => {
            const key = `tiktok:${account.id}`
            const accountOverride = accountOverrides[key]
            return {
                platform: 'tiktok' as Platform,
                id: account.id,
                username: accountOverride?.username || account.username,
                displayName: accountOverride?.displayName || account.nickname || account.username,
                profileUrl: `https://www.tiktok.com/@${accountOverride?.username || account.username}`,
                managerGroupId: key in memberOverrides ? memberOverrides[key] : memberByAccount.get(key)?.group_id || null,
                note: key in noteOverrides ? noteOverrides[key] : noteByAccount.get(key) || '',
            }
        })
        const ig = instagramAccounts.map((account) => {
            const key = `instagram:${account.id}`
            const accountOverride = accountOverrides[key]
            return {
                platform: 'instagram' as Platform,
                id: account.id,
                username: accountOverride?.username || account.username,
                displayName: accountOverride?.displayName || account.full_name || account.username,
                profileUrl: `https://www.instagram.com/${accountOverride?.username || account.username}`,
                managerGroupId: key in memberOverrides ? memberOverrides[key] : memberByAccount.get(key)?.group_id || null,
                note: key in noteOverrides ? noteOverrides[key] : noteByAccount.get(key) || '',
            }
        })

        return [...tk, ...ig]
            .filter((account) => platformFilter === 'all' || account.platform === platformFilter)
            .filter((account) => {
                const term = search.trim().toLowerCase()
                if (!term) return true

                const accountKey = `${account.platform}:${account.id}`
                const managerName = account.managerGroupId
                    ? managerById.get(account.managerGroupId)?.name || ''
                    : 'unassigned'
                const note = noteDrafts[accountKey] ?? account.note

                return [
                    account.username,
                    account.displayName,
                    account.platform,
                    managerName,
                    note,
                ].some((value) => value.toLowerCase().includes(term))
            })
            .sort((a, b) => a.platform.localeCompare(b.platform) || a.username.localeCompare(b.username))
    }, [accountOverrides, instagramAccounts, managerById, memberByAccount, memberOverrides, noteByAccount, noteDrafts, noteOverrides, platformFilter, search, tiktokAccounts])

    const groupsByParent = useMemo(() => {
        const result = new Map<string | null, AccountGroup[]>()
        managedGroups.forEach((group) => {
            const key = group.parent_id || null
            const next = result.get(key) || []
            next.push(group)
            result.set(key, next)
        })
        result.forEach((items) => items.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)))
        return result
    }, [managedGroups])

    const selectedGroup = useMemo(
        () => managedGroups.find((group) => group.id === selectedGroupId) || null,
        [managedGroups, selectedGroupId]
    )

    const isDescendantGroup = (candidateId: string, parentId: string): boolean => {
        const children = groupsByParent.get(parentId) || []
        return children.some((child) => child.id === candidateId || isDescendantGroup(candidateId, child.id))
    }

    const getAssignableParentFolders = (group?: AccountGroup | null) => {
        if (!group) return folders
        return folders.filter((folder) => folder.id !== group.id && !isDescendantGroup(folder.id, group.id))
    }

    const getGroupDropPlacement = (event: React.DragEvent<HTMLElement>) => {
        const rect = event.currentTarget.getBoundingClientRect()
        return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    }

    const canDropGroupNear = (draggedId: string | null, target: AccountGroup) => {
        if (!draggedId || draggedId === target.id) return false
        const targetParentId = target.parent_id || null
        return !targetParentId || (targetParentId !== draggedId && !isDescendantGroup(targetParentId, draggedId))
    }

    const handleGroupDragOver = (event: React.DragEvent<HTMLElement>, target: AccountGroup) => {
        if (!canDropGroupNear(draggingGroupId, target)) return

        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setGroupDropTarget({
            id: target.id,
            placement: getGroupDropPlacement(event),
        })
    }

    const handleGroupDrop = (event: React.DragEvent<HTMLElement>, target: AccountGroup) => {
        event.preventDefault()
        const draggedId = draggingGroupId
        const placement = groupDropTarget?.id === target.id ? groupDropTarget.placement : getGroupDropPlacement(event)
        setDraggingGroupId(null)
        setGroupDropTarget(null)
        if (!draggedId || !canDropGroupNear(draggedId, target)) return

        const parentId = target.parent_id || null
        const siblings = (groupsByParent.get(parentId) || []).filter((group) => group.id !== draggedId)
        const targetIndex = siblings.findIndex((group) => group.id === target.id)
        if (targetIndex < 0) return

        const insertIndex = placement === 'after' ? targetIndex + 1 : targetIndex
        const nextSiblings = [...siblings]
        const draggedGroup = managedGroups.find((group) => group.id === draggedId)
        if (!draggedGroup) return

        nextSiblings.splice(insertIndex, 0, {
            ...draggedGroup,
            parent_id: parentId,
        })

        const positions = nextSiblings.map((group, index) => ({
            id: group.id,
            parent_id: parentId,
            sort_order: index,
        }))

        setGroupPositionOverrides((prev) => {
            const next = { ...prev }
            positions.forEach((position) => {
                next[position.id] = {
                    parent_id: position.parent_id,
                    sort_order: position.sort_order,
                }
            })
            return next
        })
        setSelectedGroupId(draggedId)

        void runBackgroundSave(() => saveGroupPositions(positions), 'group-positions', {
            refresh: true,
            onFailure: () => setGroupPositionOverrides((prev) => {
                const next = { ...prev }
                positions.forEach((position) => {
                    delete next[position.id]
                })
                return next
            }),
        })
    }

    const renderGroupTree = (group: AccountGroup, depth = 0) => {
        const children = groupsByParent.get(group.id) || []
        const isSelected = selectedGroupId === group.id
        const draft = editingGroups[group.id] || {}
        const displayName = draft.name ?? group.name
        const displayColor = draft.color ?? group.color
        const dropPlacement = groupDropTarget?.id === group.id ? groupDropTarget.placement : null

        return (
            <div key={group.id} className="space-y-1">
                <button
                    draggable
                    onDragStart={(event) => {
                        setDraggingGroupId(group.id)
                        event.dataTransfer.setData('text/plain', group.id)
                        event.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragEnd={() => {
                        setDraggingGroupId(null)
                        setGroupDropTarget(null)
                    }}
                    onDragOver={(event) => handleGroupDragOver(event, group)}
                    onDragLeave={() => setGroupDropTarget((current) => current?.id === group.id ? null : current)}
                    onDrop={(event) => handleGroupDrop(event, group)}
                    onClick={() => setSelectedGroupId(group.id)}
                    className={`relative w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${draggingGroupId === group.id
                        ? 'cursor-grabbing border-blue-300 bg-blue-50 opacity-60'
                        : isSelected
                            ? 'cursor-grab border-blue-300 bg-blue-50 shadow-sm'
                            : 'cursor-grab border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                        }`}
                    style={{ marginLeft: depth * 12 }}
                >
                    {dropPlacement && (
                        <span className={`absolute left-2 right-2 h-0.5 rounded-full bg-blue-600 ${dropPlacement === 'before' ? 'top-0' : 'bottom-0'}`} />
                    )}
                    <span className="text-slate-300" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="9" cy="6" r="1.5" />
                            <circle cx="15" cy="6" r="1.5" />
                            <circle cx="9" cy="12" r="1.5" />
                            <circle cx="15" cy="12" r="1.5" />
                            <circle cx="9" cy="18" r="1.5" />
                            <circle cx="15" cy="18" r="1.5" />
                        </svg>
                    </span>
                    <span
                        className={`h-3 w-3 shrink-0 ${group.group_type === 'folder' ? 'rounded-sm' : 'rounded-full'}`}
                        style={{ backgroundColor: displayColor }}
                    />
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-950">{displayName}</span>
                        <span className="block text-[11px] uppercase text-slate-500">
                            {group.group_type}{children.length ? ` - ${children.length} child${children.length === 1 ? '' : 'ren'}` : ''}
                        </span>
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Edit</span>
                </button>
                {children.map((child) => renderGroupTree(child, depth + 1))}
            </div>
        )
    }

    const setTemporarySaveState = (key: string, state: SaveState) => {
        setSaveStates((prev) => ({ ...prev, [key]: state }))
        if (state !== 'saving') {
            window.setTimeout(() => {
                setSaveStates((prev) => {
                    if (prev[key] !== state) return prev
                    const next = { ...prev }
                    delete next[key]
                    return next
                })
            }, 3000)
        }
    }

    const getNoteRows = (key: string, value: string) => {
        if (activeNoteKey !== key) return 1
        return Math.min(8, Math.max(3, value.split('\n').length))
    }

    const getSaveLabel = (key: string, fallback = 'Save') => {
        const state = saveStates[key]
        if (state === 'saving') return 'Saving...'
        if (state === 'success') return 'Saved'
        if (state === 'error') return 'Failed'
        return fallback
    }

    const getSaveButtonClass = (key: string, primary = false) => {
        const state = saveStates[key]
        if (state === 'success') return 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
        if (state === 'error') return 'border-red-600 bg-red-600 text-white hover:bg-red-700'
        return primary ? 'finance-button-primary' : ''
    }

    const setTransientStatus = (message: string) => {
        setStatusMessage(message)
        if (message === 'Saved') {
            window.setTimeout(() => {
                setStatusMessage((current) => current === 'Saved' ? null : current)
            }, 3000)
        }
    }

    const runBackgroundSave = async (
        work: () => Promise<unknown>,
        saveKey: string,
        options: { refresh?: boolean; onFailure?: () => void } = {}
    ) => {
        setTemporarySaveState(saveKey, 'saving')
        try {
            const result = await work()
            if (result === null || result === false) {
                options.onFailure?.()
                setStatusMessage('Save failed. Please check the database migration and server logs.')
                setTemporarySaveState(saveKey, 'error')
                return false
            }
            setTemporarySaveState(saveKey, 'success')
            if (options.refresh) {
                void onRefresh()
            }
            return true
        } catch (error) {
            console.error(error)
            options.onFailure?.()
            setStatusMessage('Save failed. Please check the database migration and server logs.')
            setTemporarySaveState(saveKey, 'error')
            return false
        }
    }

    const refreshAfter = async (
        work: () => Promise<unknown>,
        saveKey = 'global',
        options: { refresh?: boolean } = {}
    ) => {
        const shouldRefresh = options.refresh !== false
        setSaving(true)
        setStatusMessage('Saving...')
        setTemporarySaveState(saveKey, 'saving')
        try {
            const result = await work()
            if (result === null || result === false) {
                setStatusMessage('Save failed. Please check the database migration and server logs.')
                setTemporarySaveState(saveKey, 'error')
                return false
            }
            if (shouldRefresh) {
                await onRefresh()
            }
            setTransientStatus('Saved')
            setTemporarySaveState(saveKey, 'success')
            return true
        } catch (error) {
            console.error(error)
            setStatusMessage('Save failed. Please check the database migration and server logs.')
            setTemporarySaveState(saveKey, 'error')
            return false
        } finally {
            setSaving(false)
        }
    }

    const handleCreateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!newAccountUsername.trim() || addingAccount) return

        setAddingAccount(true)
        setStatusMessage('Saving...')
        setTemporarySaveState('create-account', 'saving')

        try {
            const result = await createManagedAccount({
                platform: newAccountPlatform,
                account: newAccountUsername,
                displayName: newAccountDisplayName,
            })

            if (!result.success) {
                setStatusMessage(result.message)
                setTemporarySaveState('create-account', 'error')
                return
            }

            setNewAccountUsername('')
            setNewAccountDisplayName('')
            setPlatformFilter(newAccountPlatform)
            setTransientStatus(result.message)
            setTemporarySaveState('create-account', 'success')
            await onAccountsChanged?.()
        } catch (error) {
            console.error(error)
            setStatusMessage('Save failed. Please check the database migration and server logs.')
            setTemporarySaveState('create-account', 'error')
        } finally {
            setAddingAccount(false)
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
        }, 'create-group')
        if (!success) return
        setNewGroupName('')
        setNewGroupParent(null)
        setNewGroupColor(GROUP_COLORS[(managedGroups.length + 1) % GROUP_COLORS.length])
    }

    const saveGroupDraft = (group: AccountGroup, draft: Partial<AccountGroup>) => {
        const name = draft.name ?? group.name
        if (!name.trim()) return

        void runBackgroundSave(() => updateAccountGroup({
            id: group.id,
            name,
            color: draft.color ?? group.color,
            parent_id: draft.parent_id === undefined ? group.parent_id : draft.parent_id,
            note: draft.note === undefined ? group.note : draft.note,
        }), `group:${group.id}`, { refresh: true })
    }

    const scheduleGroupSave = (group: AccountGroup, draft: Partial<AccountGroup>, delay = 700) => {
        setEditingGroups((prev) => ({ ...prev, [group.id]: draft }))

        if (groupSaveTimers.current[group.id]) {
            window.clearTimeout(groupSaveTimers.current[group.id])
        }

        groupSaveTimers.current[group.id] = window.setTimeout(() => {
            saveGroupDraft(group, draft)
            delete groupSaveTimers.current[group.id]
        }, delay)
    }

    const flushGroupSave = (group: AccountGroup) => {
        if (groupSaveTimers.current[group.id]) {
            window.clearTimeout(groupSaveTimers.current[group.id])
            delete groupSaveTimers.current[group.id]
        }
        saveGroupDraft(group, editingGroups[group.id] || {})
    }

    const handleAssignManager = (account: AccountRow, groupId: string | null) => {
        const key = `${account.platform}:${account.id}`
        const previousGroupId = account.managerGroupId

        setMemberOverrides((prev) => ({ ...prev, [key]: groupId }))
        void runBackgroundSave(() => assignAccountToManager({
            platform: account.platform,
            account_id: account.id,
            group_id: groupId,
        }), `assign:${key}`, {
            refresh: true,
            onFailure: () => setMemberOverrides((prev) => ({ ...prev, [key]: previousGroupId })),
        })
    }

    const saveNote = (account: AccountRow, nextNote: string) => {
        const key = `${account.platform}:${account.id}`
        const saveKey = `note:${key}`
        const savedNote = key in noteOverrides ? noteOverrides[key] : account.note

        if (nextNote === savedNote) {
            setTemporarySaveState(saveKey, 'success')
            return
        }

        void runBackgroundSave(() => saveAccountNote({
            platform: account.platform,
            account_id: account.id,
            note: nextNote,
        }), saveKey, {
            onFailure: () => {
                setNoteDrafts((prev) => ({ ...prev, [key]: savedNote }))
                setNoteOverrides((prev) => ({ ...prev, [key]: savedNote }))
            },
        }).then((success) => {
            if (success) {
                setNoteOverrides((prev) => ({ ...prev, [key]: nextNote }))
            }
        })
    }

    const scheduleNoteSave = (account: AccountRow, nextNote: string) => {
        const key = `${account.platform}:${account.id}`
        setNoteDrafts((prev) => ({ ...prev, [key]: nextNote }))

        if (noteSaveTimers.current[key]) {
            window.clearTimeout(noteSaveTimers.current[key])
        }

        noteSaveTimers.current[key] = window.setTimeout(() => {
            saveNote(account, nextNote)
            delete noteSaveTimers.current[key]
        }, 700)
    }

    const flushNoteSave = (account: AccountRow) => {
        const key = `${account.platform}:${account.id}`
        if (noteSaveTimers.current[key]) {
            window.clearTimeout(noteSaveTimers.current[key])
            delete noteSaveTimers.current[key]
        }
        saveNote(account, noteDrafts[key] ?? account.note)
    }

    const startEditingAccount = (account: AccountRow) => {
        const key = `${account.platform}:${account.id}`
        setEditingAccountKey(key)
        setAccountDrafts((prev) => ({
            ...prev,
            [key]: prev[key] || {
                username: account.username,
                displayName: account.displayName === account.username ? '' : account.displayName,
            },
        }))
    }

    const saveAccountDraft = (account: AccountRow, draft: AccountDraft) => {
        const key = `${account.platform}:${account.id}`
        if (!draft?.username.trim()) return

        const previousDraft = {
            username: account.username,
            displayName: account.displayName === account.username ? '' : account.displayName,
        }
        const normalizedDraft = {
            username: draft.username.trim(),
            displayName: draft.displayName.trim(),
        }

        if (
            normalizedDraft.username === previousDraft.username
            && normalizedDraft.displayName === previousDraft.displayName
        ) {
            setTemporarySaveState(`account:${key}`, 'success')
            return
        }

        setAccountOverrides((prev) => ({ ...prev, [key]: normalizedDraft }))
        void runBackgroundSave(async () => {
            const result = await updateManagedAccount({
                platform: account.platform,
                accountId: account.id,
                account: normalizedDraft.username,
                displayName: normalizedDraft.displayName,
            })
            if (!result.success) {
                setStatusMessage(result.message)
            }
            return result.success
        }, `account:${key}`, {
            onFailure: () => setAccountOverrides((prev) => ({ ...prev, [key]: previousDraft })),
        }).then((success) => {
            if (success) {
                void onAccountsChanged?.()
            }
        })
    }

    const scheduleAccountSave = (account: AccountRow, draft: AccountDraft) => {
        const key = `${account.platform}:${account.id}`
        setAccountDrafts((prev) => ({ ...prev, [key]: draft }))

        if (accountSaveTimers.current[key]) {
            window.clearTimeout(accountSaveTimers.current[key])
        }

        accountSaveTimers.current[key] = window.setTimeout(() => {
            saveAccountDraft(account, draft)
            delete accountSaveTimers.current[key]
        }, 900)
    }

    const flushAccountSave = (account: AccountRow) => {
        const key = `${account.platform}:${account.id}`
        if (accountSaveTimers.current[key]) {
            window.clearTimeout(accountSaveTimers.current[key])
            delete accountSaveTimers.current[key]
        }
        const draft = accountDrafts[key]
        if (draft) saveAccountDraft(account, draft)
    }

    const handleDeleteAccount = async (account: AccountRow) => {
        const confirmed = window.confirm(`Remove @${account.username} from active ${account.platform} accounts? Historical videos and snapshots will be kept.`)
        if (!confirmed) return

        const key = `${account.platform}:${account.id}`
        const success = await refreshAfter(async () => {
            const result = await deleteManagedAccount({
                platform: account.platform,
                accountId: account.id,
            })
            if (!result.success) {
                setStatusMessage(result.message)
            }
            return result.success
        }, `delete-account:${key}`, { refresh: false })

        if (!success) return
        await onAccountsChanged?.()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4 font-sans backdrop-blur-sm">
            <div className="finance-card flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
                    <div>
                        <div className="finance-label text-blue-700">Configuration</div>
                        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Account Management</h2>
                        <p className="finance-muted mt-1 text-sm">Create folders and managers, assign accounts, and keep notes in one workspace.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="finance-button flex h-10 w-10 items-center justify-center p-0"
                        title="Close"
                        aria-label="Close account management"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>

                {statusMessage && (
                    <div className={`border-b px-5 py-2 text-sm font-semibold ${statusMessage === 'Saved'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : statusMessage === 'Saving...'
                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700'
                        }`}>
                        {statusMessage}
                    </div>
                )}

                <div className="grid min-h-0 flex-1 grid-cols-12 bg-white">
                    <div className="col-span-12 space-y-4 overflow-y-auto border-b border-slate-200 bg-slate-50 p-4 lg:col-span-4 lg:border-b-0 lg:border-r">
                        <form onSubmit={handleCreateAccount} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <span className="finance-label block text-emerald-700">Add Account</span>
                                    <span className="finance-muted mt-1 block text-sm">
                                        Choose a platform, then add a username. Display name is optional.
                                    </span>
                                </div>
                                {saveStates['create-account'] && (
                                    <span className={`text-xs font-bold ${saveStates['create-account'] === 'error'
                                        ? 'text-red-600'
                                        : saveStates['create-account'] === 'success'
                                            ? 'text-emerald-700'
                                            : 'text-blue-700'
                                        }`}>
                                        {getSaveLabel('create-account', 'Saving...')}
                                    </span>
                                )}
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2">
                                {(['tiktok', 'instagram'] as Platform[]).map((value) => (
                                    <button
                                        type="button"
                                        key={value}
                                        onClick={() => setNewAccountPlatform(value)}
                                        className={`finance-button uppercase ${newAccountPlatform === value ? 'finance-button-primary' : ''}`}
                                    >
                                        {value}
                                    </button>
                                ))}
                            </div>

                            <label className="mt-3 block">
                                <span className="finance-label mb-1 block">Username or URL</span>
                                <input
                                    value={newAccountUsername}
                                    onChange={(event) => setNewAccountUsername(event.target.value)}
                                    placeholder={newAccountPlatform === 'instagram' ? 'instagram.com/name' : '@username'}
                                    className="finance-input w-full"
                                />
                            </label>

                            <label className="mt-3 block">
                                <span className="finance-label mb-1 block">Display name optional</span>
                                <input
                                    value={newAccountDisplayName}
                                    onChange={(event) => setNewAccountDisplayName(event.target.value)}
                                    placeholder="Owner, creator, or nickname"
                                    className="finance-input w-full"
                                />
                            </label>

                            <div className="mt-4 flex gap-2">
                                <button
                                    type="submit"
                                    disabled={!newAccountUsername.trim() || addingAccount}
                                    className={`finance-button flex-1 disabled:cursor-wait disabled:opacity-60 ${getSaveButtonClass('create-account', true)}`}
                                >
                                    {addingAccount ? 'Adding...' : 'Add Account'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setNewAccountUsername('')
                                        setNewAccountDisplayName('')
                                    }}
                                    className="finance-button"
                                >
                                    Clear
                                </button>
                            </div>
                        </form>

                        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                            <button
                                onClick={() => setCreateSectionOpen((open) => !open)}
                                className="flex w-full items-center justify-between gap-3 text-left"
                            >
                                <span>
                                    <span className="finance-label block text-blue-700">Create Folder / Manager</span>
                                    <span className="finance-muted mt-1 block text-sm">
                                        Parent folder is optional. Leave it as root to create a top-level item.
                                    </span>
                                </span>
                                <span className="finance-chip">
                                    {createSectionOpen ? 'Hide' : 'Show'}
                                </span>
                            </button>

                            {createSectionOpen && (
                                <div className="pt-4">
                                    <div className="mb-3 grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setNewGroupType('manager')}
                                            className={`finance-button ${newGroupType === 'manager' ? 'finance-button-primary' : ''}`}
                                        >
                                            Manager
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setNewGroupType('folder')}
                                            className={`finance-button ${newGroupType === 'folder' ? 'finance-button-primary' : ''}`}
                                        >
                                            Folder
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        value={newGroupName}
                                        onChange={(event) => setNewGroupName(event.target.value)}
                                        placeholder={newGroupType === 'manager' ? 'Manager name...' : 'Folder name...'}
                                        className="finance-input mb-3 w-full"
                                    />
                                    <select
                                        value={newGroupParent || ''}
                                        onChange={(event) => setNewGroupParent(event.target.value || null)}
                                        className="finance-input mb-3 w-full"
                                    >
                                        <option value="">No parent / root level</option>
                                        {folders.map((folder) => (
                                            <option key={folder.id} value={folder.id}>{folder.name}</option>
                                        ))}
                                    </select>
                                    <div className="mb-3 flex flex-wrap gap-2">
                                        {GROUP_COLORS.map((color) => (
                                            <button
                                                type="button"
                                                key={color}
                                                onClick={() => setNewGroupColor(color)}
                                                className={`h-8 w-8 rounded-md border-2 transition-all ${newGroupColor === color ? 'scale-105 border-slate-950 shadow-sm' : 'border-slate-200'}`}
                                                style={{ backgroundColor: color }}
                                                title={color}
                                                aria-label={`Set color ${color}`}
                                            />
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleCreateGroup}
                                        disabled={!newGroupName.trim() || saving}
                                        className={`finance-button w-full disabled:cursor-not-allowed disabled:opacity-50 ${getSaveButtonClass('create-group', true)}`}
                                    >
                                        {getSaveLabel('create-group', 'Create')}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                            <button
                                onClick={() => setEditSectionOpen((open) => !open)}
                                className="flex w-full items-center justify-between gap-3 text-left"
                            >
                                <span>
                                    <span className="finance-label block text-blue-700">Edit Existing Groups</span>
                                    <span className="finance-muted mt-1 block text-sm">
                                        Groups are shown by hierarchy. Select one to edit details.
                                    </span>
                                </span>
                                <span className="finance-chip">
                                    {editSectionOpen ? 'Hide' : 'Show'}
                                </span>
                            </button>

                            {editSectionOpen && (
                                <>
                                    <div className="mt-4 space-y-2">
                                        {(groupsByParent.get(null) || []).map((group) => renderGroupTree(group))}
                                        {managedGroups.length === 0 && (
                                            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                                                No groups yet.
                                            </div>
                                        )}
                                    </div>

                                    {selectedGroup ? (() => {
                                        const group = selectedGroup
                                        const draft = editingGroups[group.id] || {}
                                        return (
                                            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                                        <div className="mb-3 flex items-center gap-2">
                                            <div className={`h-3 w-3 ${group.group_type === 'folder' ? 'rounded-sm' : 'rounded-full'}`} style={{ backgroundColor: draft.color || group.color }} />
                                            <span className="finance-chip">{group.group_type}</span>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    const success = await refreshAfter(() => deleteAccountGroup(group.id), `delete:${group.id}`)
                                                    if (success) setSelectedGroupId(null)
                                                }}
                                                className="ml-auto text-xs font-bold uppercase tracking-wider text-red-700 hover:text-red-900"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                        <input
                                            value={draft.name ?? group.name}
                                            onChange={(event) => scheduleGroupSave(group, { ...draft, name: event.target.value })}
                                            onBlur={() => flushGroupSave(group)}
                                            className="finance-input mb-2 w-full"
                                        />
                                        <select
                                            value={draft.parent_id === undefined ? group.parent_id || '' : draft.parent_id || ''}
                                            onChange={(event) => scheduleGroupSave(group, { ...draft, parent_id: event.target.value || null }, 0)}
                                            className="finance-input mb-2 w-full"
                                        >
                                            <option value="">No parent / root level</option>
                                            {getAssignableParentFolders(group).map((folder) => (
                                                <option key={folder.id} value={folder.id}>{folder.name}</option>
                                            ))}
                                        </select>
                                        <div className="mb-2 flex flex-wrap gap-2">
                                            {GROUP_COLORS.map((color) => {
                                                const selectedColor = draft.color || group.color
                                                return (
                                                    <button
                                                        type="button"
                                                        key={color}
                                                        onClick={() => scheduleGroupSave(group, { ...draft, color }, 0)}
                                                        className={`h-7 w-7 rounded-md border-2 transition-all ${selectedColor === color ? 'scale-105 border-slate-950 shadow-sm' : 'border-slate-200'}`}
                                                        style={{ backgroundColor: color }}
                                                        title={`Set color ${color}`}
                                                        aria-label={`Set color ${color}`}
                                                    />
                                                )
                                            })}
                                        </div>
                                        <textarea
                                            value={draft.note === undefined ? group.note || '' : draft.note || ''}
                                            onChange={(event) => scheduleGroupSave(group, { ...draft, note: event.target.value })}
                                            onBlur={() => flushGroupSave(group)}
                                            placeholder="Manager/folder note..."
                                            className="mb-2 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-600 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                                        />
                                        {saveStates[`group:${group.id}`] && (
                                            <div className={`text-sm font-semibold ${saveStates[`group:${group.id}`] === 'error'
                                                ? 'text-red-600'
                                                : saveStates[`group:${group.id}`] === 'success'
                                                    ? 'text-emerald-700'
                                                    : 'text-blue-700'
                                                }`}>
                                                {getSaveLabel(`group:${group.id}`)}
                                            </div>
                                        )}
                                            </div>
                                        )
                                    })() : managedGroups.length > 0 && (
                                        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                                            Select a folder or manager above to edit it.
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    <div className="col-span-12 flex min-h-[520px] flex-col overflow-hidden p-4 lg:col-span-8">
                        <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                            <div className="min-w-0 flex-1">
                                <div className="finance-label mb-1 block">Search Accounts</div>
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search accounts, managers, or notes..."
                                    className="finance-input w-full"
                            />
                            </div>
                            <div className="flex gap-2">
                            {(['all', 'tiktok', 'instagram'] as const).map((value) => (
                                <button
                                    type="button"
                                    key={value}
                                    onClick={() => setPlatformFilter(value)}
                                        className={`finance-button min-w-24 uppercase ${platformFilter === value ? 'finance-button-primary' : ''}`}
                                >
                                    {value}
                                </button>
                            ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto rounded-lg border border-slate-200">
                            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                                <colgroup>
                                    <col className="w-24" />
                                    <col className="w-56" />
                                    <col className="w-56" />
                                    <col />
                                </colgroup>
                                <thead className="sticky top-0 z-10 bg-slate-50">
                                    <tr>
                                        <th className="border-b border-r border-slate-200 p-3 text-xs font-bold uppercase text-slate-500">Platform</th>
                                        <th className="border-b border-r border-slate-200 p-3 text-xs font-bold uppercase text-slate-500">Account</th>
                                        <th className="border-b border-r border-slate-200 p-3 text-xs font-bold uppercase text-slate-500">Manager</th>
                                        <th className="border-b border-slate-200 p-3 text-xs font-bold uppercase text-slate-500">Account Note</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {accountRows.map((account) => {
                                        const key = `${account.platform}:${account.id}`
                                        const isEditingAccount = editingAccountKey === key
                                        const accountDraft = accountDrafts[key] || {
                                            username: account.username,
                                            displayName: account.displayName === account.username ? '' : account.displayName,
                                        }
                                        return (
                                            <tr key={key} className="hover:bg-slate-50">
                                                <td className="border-r border-slate-100 p-3 text-xs font-bold uppercase text-slate-500">{account.platform}</td>
                                                <td className="border-r border-slate-100 p-3">
                                                    {isEditingAccount ? (
                                                        <div className="space-y-2">
                                                            <label className="block">
                                                                <span className="finance-label mb-1 block">Username or URL</span>
                                                                <input
                                                                    value={accountDraft.username}
                                                                    onChange={(event) => scheduleAccountSave(account, {
                                                                        ...accountDraft,
                                                                        username: event.target.value,
                                                                    })}
                                                                    onBlur={() => flushAccountSave(account)}
                                                                    onKeyDown={(event) => {
                                                                        if (event.key === 'Enter') event.currentTarget.blur()
                                                                    }}
                                                                    className="finance-input h-9 w-full"
                                                                />
                                                            </label>
                                                            <label className="block">
                                                                <span className="finance-label mb-1 block">Display name</span>
                                                                <input
                                                                    value={accountDraft.displayName}
                                                                    onChange={(event) => scheduleAccountSave(account, {
                                                                        ...accountDraft,
                                                                        displayName: event.target.value,
                                                                    })}
                                                                    onBlur={() => flushAccountSave(account)}
                                                                    onKeyDown={(event) => {
                                                                        if (event.key === 'Enter') event.currentTarget.blur()
                                                                    }}
                                                                    className="finance-input h-9 w-full"
                                                                />
                                                            </label>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <a
                                                                href={account.profileUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="font-bold text-slate-950 underline-offset-2 hover:text-blue-700 hover:underline"
                                                                title={`Open ${account.platform} profile for @${account.username}`}
                                                            >
                                                                @{account.username}
                                                            </a>
                                                            <div className="text-xs text-slate-500">{account.displayName}</div>
                                                        </>
                                                    )}
                                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (isEditingAccount) {
                                                                    flushAccountSave(account)
                                                                    setEditingAccountKey(null)
                                                                    return
                                                                }
                                                                startEditingAccount(account)
                                                            }}
                                                            className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700 hover:border-blue-300 hover:bg-blue-50"
                                                        >
                                                            {isEditingAccount ? 'Done' : 'Edit'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteAccount(account)}
                                                            disabled={saveStates[`delete-account:${key}`] === 'saving'}
                                                            className="rounded-md border border-red-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-red-700 hover:border-red-300 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
                                                        >
                                                            Delete
                                                        </button>
                                                        {saveStates[`account:${key}`] && (
                                                            <span className={`text-[11px] font-semibold ${saveStates[`account:${key}`] === 'error'
                                                                ? 'text-red-600'
                                                                : saveStates[`account:${key}`] === 'success'
                                                                    ? 'text-emerald-700'
                                                                    : 'text-blue-700'
                                                                }`}>
                                                                {getSaveLabel(`account:${key}`)}
                                                            </span>
                                                        )}
                                                        {saveStates[`delete-account:${key}`] && (
                                                            <span className={`text-[11px] font-semibold ${saveStates[`delete-account:${key}`] === 'error' ? 'text-red-600' : 'text-blue-700'}`}>
                                                                {getSaveLabel(`delete-account:${key}`, 'Deleting...')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="border-r border-slate-100 p-3">
                                                    <select
                                                        value={account.managerGroupId || ''}
                                                        onChange={(event) => {
                                                            const groupId = event.target.value || null
                                                            handleAssignManager(account, groupId)
                                                        }}
                                                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-950 outline-none focus:border-blue-600"
                                                    >
                                                        <option value="">Unassigned</option>
                                                        {managers.map((manager) => (
                                                            <option key={manager.id} value={manager.id}>{manager.name}</option>
                                                        ))}
                                                    </select>
                                                    {saveStates[`assign:${key}`] && (
                                                        <div className={`mt-1 text-[11px] font-semibold ${saveStates[`assign:${key}`] === 'error'
                                                            ? 'text-red-600'
                                                            : saveStates[`assign:${key}`] === 'success'
                                                                ? 'text-emerald-700'
                                                                : 'text-blue-700'
                                                            }`}>
                                                            {getSaveLabel(`assign:${key}`)}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    {(() => {
                                                        const noteValue = noteDrafts[key] ?? account.note
                                                        return (
                                                            <>
                                                                <textarea
                                                                    value={noteValue}
                                                                    rows={getNoteRows(key, noteValue)}
                                                                    onFocus={() => setActiveNoteKey(key)}
                                                                    onBlur={() => {
                                                                        setActiveNoteKey((current) => current === key ? null : current)
                                                                        flushNoteSave(account)
                                                                    }}
                                                                    onChange={(event) => scheduleNoteSave(account, event.target.value)}
                                                                    placeholder="Account note..."
                                                                    className="block w-full resize-y rounded-md border border-slate-300 bg-white px-2 py-2 text-sm leading-5 text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
                                                                />
                                                                {saveStates[`note:${key}`] && (
                                                                    <div className={`mt-1 text-[11px] font-semibold ${saveStates[`note:${key}`] === 'error'
                                                                        ? 'text-red-600'
                                                                        : saveStates[`note:${key}`] === 'success'
                                                                            ? 'text-emerald-700'
                                                                            : 'text-blue-700'
                                                                        }`}>
                                                                        {getSaveLabel(`note:${key}`)}
                                                                    </div>
                                                                )}
                                                            </>
                                                        )
                                                    })()}
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
