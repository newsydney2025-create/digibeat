'use server'

import { unstable_noStore as noStore } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import {
    AccountGroup,
    AccountGroupMember,
    AccountNote,
    GroupType,
    Platform,
    PublishingBonusAccountRow,
    PublishingBonusDay,
    PublishingBonusManagerRow,
    PublishingBonusStats,
    PublishingBonusVideo,
} from '@/types/database'

const SYDNEY_TIME_ZONE = 'Australia/Sydney'
const SETTLEMENT_WINDOW_DAYS = 7

type ManagementState = {
    groups: AccountGroup[]
    members: AccountGroupMember[]
    notes: AccountNote[]
}

type GroupInput = {
    name: string
    group_type: GroupType
    parent_id?: string | null
    color?: string
    note?: string | null
    sort_order?: number
}

type GroupUpdateInput = {
    id: string
    name?: string
    color?: string
    group_type?: GroupType
    parent_id?: string | null
    note?: string | null
    sort_order?: number
    is_active?: boolean
}

type PositionInput = {
    id: string
    parent_id: string | null
    sort_order: number
}

type AssignmentInput = {
    platform: Platform
    account_id: string
    group_id: string | null
    sort_order?: number
}

type NoteInput = {
    platform: Platform
    account_id: string
    note: string
}

type AccountManagerHistory = {
    id?: string
    platform: Platform
    account_id: string
    group_id: string | null
    effective_from: string
    effective_to: string | null
}

function normalizeGroup(group: any): AccountGroup {
    return {
        id: group.id,
        name: group.name,
        color: group.color || '#22d3ee',
        group_type: group.group_type === 'folder' ? 'folder' : 'manager',
        parent_id: group.parent_id || null,
        note: group.note || null,
        sort_order: group.sort_order || 0,
        is_active: group.is_active ?? true,
        created_at: group.created_at,
        updated_at: group.updated_at,
        members: [],
        children: [],
    }
}

function normalizeMember(member: any): AccountGroupMember {
    return {
        id: member.id,
        group_id: member.group_id,
        platform: member.platform === 'instagram' ? 'instagram' : 'tiktok',
        account_id: member.account_id,
        sort_order: member.sort_order || 0,
        created_at: member.created_at,
    }
}

function normalizeNote(note: any): AccountNote {
    return {
        id: note.id,
        platform: note.platform === 'instagram' ? 'instagram' : 'tiktok',
        account_id: note.account_id,
        note: note.note || '',
        created_at: note.created_at,
        updated_at: note.updated_at,
    }
}

function attachMembers(groups: AccountGroup[], members: AccountGroupMember[]) {
    const byGroup = new Map<string, AccountGroupMember[]>()
    members.forEach((member) => {
        const next = byGroup.get(member.group_id) || []
        next.push(member)
        byGroup.set(member.group_id, next)
    })

    return groups.map((group) => ({
        ...group,
        members: (byGroup.get(group.id) || []).sort((a, b) => a.sort_order - b.sort_order),
    }))
}

async function fetchAll<T>(queryFactory: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>) {
    const pageSize = 1000
    let page = 0
    let rows: T[] = []

    while (true) {
        const from = page * pageSize
        const to = from + pageSize - 1
        const { data, error } = await queryFactory(from, to)

        if (error) {
            throw error
        }

        if (!data || data.length === 0) {
            break
        }

        rows = rows.concat(data)

        if (data.length < pageSize) {
            break
        }

        page += 1
    }

    return rows
}

function sydneyDateKey(value: string | number | Date | null | undefined) {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null

    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: SYDNEY_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date)

    const year = parts.find((part) => part.type === 'year')?.value
    const month = parts.find((part) => part.type === 'month')?.value
    const day = parts.find((part) => part.type === 'day')?.value

    return year && month && day ? `${year}-${month}-${day}` : null
}

function addDays(dateStr: string, amount: number) {
    const date = new Date(`${dateStr}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + amount)
    return date.toISOString().slice(0, 10)
}

function todaySydney() {
    return sydneyDateKey(new Date()) || new Date().toISOString().slice(0, 10)
}

function calculateBonusAmount(views: number) {
    const cappedViews = Math.min(Math.max(0, Math.floor(views || 0)), 1_000_000)
    const firstTierViews = Math.min(cappedViews, 10_000)
    let amount = Math.floor(firstTierViews / 1_000) * 10

    if (cappedViews > 10_000) {
        amount += Math.floor((cappedViews - 10_000) / 10_000) * 10
    }

    return amount
}

function tiktokAccountUrl(username: string) {
    return `https://www.tiktok.com/@${username}`
}

function instagramAccountUrl(username: string) {
    return `https://www.instagram.com/${username}/`
}

function datesBetween(startDate: string, endDate: string) {
    const dates: string[] = []
    let cursor = startDate

    while (cursor <= endDate) {
        dates.push(cursor)
        cursor = addDays(cursor, 1)
    }

    return dates
}

function emptyDay(date: string): PublishingBonusDay {
    return {
        date,
        hasDataAvailable: false,
        publishCount: 0,
        settlementCount: 0,
        missingSettlementCount: 0,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
    }
}

function sumDays(dates: string[], rows: PublishingBonusAccountRow[]): PublishingBonusDay[] {
    return dates.map((date) =>
        rows.reduce((day, row) => {
            const source = row.days.find((item) => item.date === date)
            if (source) {
                day.hasDataAvailable = day.hasDataAvailable || source.hasDataAvailable
                day.publishCount += source.publishCount
                day.settlementCount += source.settlementCount
                day.missingSettlementCount += source.missingSettlementCount
                day.views += source.views
                day.likes += source.likes
                day.comments += source.comments
                day.shares += source.shares
            }
            return day
        }, emptyDay(date))
    )
}

function summarizeAccount(row: PublishingBonusAccountRow) {
    row.weekPublishCount = row.days.reduce((sum, day) => sum + day.publishCount, 0)
    row.weekViews = row.days.reduce((sum, day) => sum + day.views, 0)
    row.weekLikes = row.days.reduce((sum, day) => sum + day.likes, 0)
    row.weekComments = row.days.reduce((sum, day) => sum + day.comments, 0)
    row.weekShares = row.days.reduce((sum, day) => sum + day.shares, 0)
    row.avgViewsPerPost = row.weekPublishCount > 0 ? Math.round(row.weekViews / row.weekPublishCount) : 0
    row.settlementCount = row.bonusVideos.length
    row.missingSettlementCount = row.bonusVideos.filter((video) => video.status === 'missing').length
    row.bonusAmount = row.bonusVideos.reduce((sum, video) => sum + video.bonusAmount, 0)
    return row
}

function summarizeGroup(
    group: AccountGroup | null,
    rows: PublishingBonusAccountRow[],
    dates: string[],
    groupType: GroupType | 'unassigned',
    name: string,
): PublishingBonusManagerRow {
    const days = sumDays(dates, rows)
    const weekPublishCount = days.reduce((sum, day) => sum + day.publishCount, 0)
    const weekViews = days.reduce((sum, day) => sum + day.views, 0)
    const weekLikes = days.reduce((sum, day) => sum + day.likes, 0)
    const weekComments = days.reduce((sum, day) => sum + day.comments, 0)
    const weekShares = days.reduce((sum, day) => sum + day.shares, 0)
    const platforms = Array.from(new Set(rows.map((row) => row.platform)))
    const bonusAmount = rows.reduce((sum, row) => sum + row.bonusAmount, 0)
    const settlementCount = rows.reduce((sum, row) => sum + row.settlementCount, 0)
    const missingSettlementCount = rows.reduce((sum, row) => sum + row.missingSettlementCount, 0)
    const managerIds = new Set(rows.map((row) => row.managerGroupId).filter(Boolean))
    const accountIds = new Set(rows.map((row) => `${row.platform}:${row.accountId}`))

    return {
        groupId: group?.id || null,
        groupType,
        parentId: group?.parent_id || null,
        name,
        color: group?.color || '#64748b',
        note: group?.note || '',
        managerCount: groupType === 'manager' ? 1 : managerIds.size,
        accountCount: accountIds.size,
        platforms,
        days,
        weekPublishCount,
        weekViews,
        weekLikes,
        weekComments,
        weekShares,
        avgViewsPerPost: weekPublishCount > 0 ? Math.round(weekViews / weekPublishCount) : 0,
        settlementCount,
        missingSettlementCount,
        bonusAmount,
    }
}

export async function fetchAccountManagementState(): Promise<ManagementState> {
    noStore()
    const supabase = createAdminClient()

    let groups: AccountGroup[] = []
    let members: AccountGroupMember[] = []
    let notes: AccountNote[] = []

    let { data: groupData, error: groupError } = await supabase
        .from('account_groups')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

    if (groupError?.code === '42703') {
        const fallback = await supabase
            .from('account_groups')
            .select('*')
            .order('created_at', { ascending: true })
        groupData = fallback.data
        groupError = fallback.error
    }

    if (groupError) {
        if (groupError.code !== 'PGRST205') {
            console.error('Error fetching account groups:', groupError)
        }
    } else {
        groups = (groupData || []).map(normalizeGroup)
    }

    let { data: memberData, error: memberError } = await supabase
        .from('account_group_members')
        .select('*')
        .order('sort_order', { ascending: true })

    if (memberError?.code === '42703') {
        const fallback = await supabase
            .from('account_group_members')
            .select('*')
        memberData = fallback.data
        memberError = fallback.error
    }

    if (memberError) {
        if (memberError.code !== 'PGRST205') {
            console.error('Error fetching account group members:', memberError)
        }
    } else {
        members = (memberData || []).map(normalizeMember)
    }

    const { data: noteData, error: noteError } = await supabase
        .from('account_notes')
        .select('*')

    if (noteError) {
        if (noteError.code !== 'PGRST205') {
            console.error('Error fetching account notes:', noteError)
        }
    } else {
        notes = (noteData || []).map(normalizeNote)
    }

    return {
        groups: attachMembers(groups, members),
        members,
        notes,
    }
}

export async function createAccountGroup(input: GroupInput): Promise<AccountGroup | null> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('account_groups')
        .insert({
            name: input.name.trim(),
            color: input.color || '#22d3ee',
            group_type: input.group_type,
            parent_id: input.group_type === 'manager' ? input.parent_id || null : input.parent_id || null,
            note: input.note || null,
            sort_order: input.sort_order || 0,
            is_active: true,
        })
        .select('*')
        .single()

    if (error || !data) {
        console.error('Error creating account group:', error)
        return null
    }

    return normalizeGroup(data)
}

export async function updateAccountGroup(input: GroupUpdateInput): Promise<AccountGroup | null> {
    const supabase = createAdminClient()
    const { id, ...updates } = input

    const { data, error } = await supabase
        .from('account_groups')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single()

    if (error || !data) {
        console.error('Error updating account group:', error)
        return null
    }

    return normalizeGroup(data)
}

export async function deleteAccountGroup(groupId: string): Promise<boolean> {
    const supabase = createAdminClient()
    const { error } = await supabase
        .from('account_groups')
        .delete()
        .eq('id', groupId)

    if (error) {
        console.error('Error deleting account group:', error)
        return false
    }

    return true
}

export async function saveGroupPositions(positions: PositionInput[]): Promise<boolean> {
    const supabase = createAdminClient()

    for (const position of positions) {
        const { error } = await supabase
            .from('account_groups')
            .update({
                parent_id: position.parent_id,
                sort_order: position.sort_order,
            })
            .eq('id', position.id)

        if (error) {
            console.error('Error saving group position:', error)
            return false
        }
    }

    return true
}

async function recordManagerHistory(input: AssignmentInput) {
    const supabase = createAdminClient()
    const effectiveFrom = todaySydney()
    const previousDay = addDays(effectiveFrom, -1)

    const { error: closeError } = await (supabase
        .from('account_manager_history' as any)
        .update({ effective_to: previousDay })
        .eq('platform', input.platform)
        .eq('account_id', input.account_id)
        .is('effective_to', null)
        .lt('effective_from', effectiveFrom) as any)

    if (closeError) {
        if (closeError.code !== 'PGRST205' && closeError.code !== '42P01') {
            console.error('Error closing manager history:', closeError)
        }
        return
    }

    const { error: deleteTodayError } = await (supabase
        .from('account_manager_history' as any)
        .delete()
        .eq('platform', input.platform)
        .eq('account_id', input.account_id)
        .gte('effective_from', effectiveFrom) as any)

    if (deleteTodayError) {
        console.error('Error replacing same-day manager history:', deleteTodayError)
        return
    }

    const { error: insertError } = await (supabase
        .from('account_manager_history' as any)
        .insert({
            platform: input.platform,
            account_id: input.account_id,
            group_id: input.group_id,
            effective_from: effectiveFrom,
            effective_to: null,
        }) as any)

    if (insertError) {
        console.error('Error recording manager history:', insertError)
    }
}

export async function assignAccountToManager(input: AssignmentInput): Promise<boolean> {
    const supabase = createAdminClient()

    if (input.group_id) {
        const { data: group, error: groupError } = await supabase
            .from('account_groups')
            .select('id, group_type')
            .eq('id', input.group_id)
            .single()

        if (groupError || !group || group.group_type !== 'manager') {
            console.error('Invalid manager group:', groupError)
            return false
        }
    }

    const { error: deleteError } = await supabase
        .from('account_group_members')
        .delete()
        .eq('platform', input.platform)
        .eq('account_id', input.account_id)

    if (deleteError) {
        console.error('Error clearing account manager:', deleteError)
        return false
    }

    if (!input.group_id) {
        await recordManagerHistory(input)
        return true
    }

    const { error: insertError } = await supabase
        .from('account_group_members')
        .insert({
            group_id: input.group_id,
            platform: input.platform,
            account_id: input.account_id,
            sort_order: input.sort_order || 0,
        })

    if (insertError) {
        console.error('Error assigning account manager:', insertError)
        return false
    }

    await recordManagerHistory(input)
    return true
}

export async function saveAccountNote(input: NoteInput): Promise<AccountNote | null> {
    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('account_notes')
        .upsert({
            platform: input.platform,
            account_id: input.account_id,
            note: input.note,
        }, {
            onConflict: 'platform,account_id',
        })
        .select('*')
        .single()

    if (error || !data) {
        console.error('Error saving account note:', error)
        return null
    }

    return normalizeNote(data)
}

export async function fetchPublishingBonusStats(
    startDate?: string,
    endDate?: string,
): Promise<PublishingBonusStats> {
    noStore()
    const supabase = createAdminClient()

    let resolvedStart = startDate
    let resolvedEnd = endDate

    if (!resolvedStart || !resolvedEnd) {
        const { data: latestSnapshot } = await supabase
            .from('daily_snapshots')
            .select('date')
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle()

        const latestDate = latestSnapshot?.date || sydneyDateKey(new Date()) || new Date().toISOString().slice(0, 10)
        const latest = new Date(`${latestDate}T00:00:00Z`)
        const day = latest.getUTCDay()
        const mondayOffset = day === 0 ? -6 : 1 - day
        resolvedStart = addDays(latestDate, mondayOffset)
        resolvedEnd = addDays(resolvedStart, 6)
    }

    const dates = datesBetween(resolvedStart, resolvedEnd)
    const bonusPublishStart = addDays(resolvedStart, -SETTLEMENT_WINDOW_DAYS)
    const bonusPublishEnd = addDays(resolvedEnd, -SETTLEMENT_WINDOW_DAYS)
    const management = await fetchAccountManagementState()
    const groupsById = new Map(management.groups.map((group) => [group.id, group]))
    const membersByAccount = new Map(
        management.members.map((member) => [`${member.platform}:${member.account_id}`, member])
    )
    const notesByAccount = new Map(
        management.notes.map((note) => [`${note.platform}:${note.account_id}`, note.note])
    )
    let managerHistory: AccountManagerHistory[] = []
    const historyWindowStart = addDays(resolvedStart, -SETTLEMENT_WINDOW_DAYS)

    const { data: managerHistoryData, error: managerHistoryError } = await (supabase
        .from('account_manager_history' as any)
        .select('id, platform, account_id, group_id, effective_from, effective_to')
        .lte('effective_from', resolvedEnd!)
        .or(`effective_to.is.null,effective_to.gte.${historyWindowStart}`) as any)

    if (managerHistoryError) {
        if (managerHistoryError.code !== 'PGRST205' && managerHistoryError.code !== '42P01') {
            console.error('Error fetching account manager history:', managerHistoryError)
        }
    } else {
        managerHistory = (managerHistoryData || []).map((row: any) => ({
            id: row.id,
            platform: row.platform === 'instagram' ? 'instagram' : 'tiktok',
            account_id: row.account_id,
            group_id: row.group_id || null,
            effective_from: row.effective_from,
            effective_to: row.effective_to || null,
        }))
    }

    const resolveOwnerGroupId = (platform: Platform, accountId: string | null, publishedDate: string | null) => {
        if (!accountId || !publishedDate) return null

        const matchingHistory = managerHistory
            .filter((history) =>
                history.platform === platform
                && history.account_id === accountId
                && history.effective_from <= publishedDate
                && (!history.effective_to || history.effective_to >= publishedDate)
            )
            .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0]

        if (matchingHistory) return matchingHistory.group_id

        return membersByAccount.get(`${platform}:${accountId}`)?.group_id || null
    }

    const describeOwner = (groupId: string | null) => {
        const group = groupId ? groupsById.get(groupId) : null
        return {
            managerGroupId: group?.id || null,
            managerName: group?.name || 'Unassigned',
            managerColor: group?.color || null,
        }
    }

    const [tiktokAccounts, instagramAccounts, tiktokVideos, instagramReels, snapshots] = await Promise.all([
        fetchAll<any>((from, to) => supabase
            .from('tiktok_accounts')
            .select('id, username, nickname, follower_count, website, is_active')
            .eq('is_active', true)
            .range(from, to) as any),
        fetchAll<any>((from, to) => supabase
            .from('instagram_accounts')
            .select('id, username, full_name, website, is_active')
            .eq('is_active', true)
            .range(from, to) as any),
        fetchAll<any>((from, to) => supabase
            .from('tiktok_videos')
            .select('id, account_id, video_id, description, play_count, digg_count, comment_count, share_count, create_time, web_video_url')
            .range(from, to) as any),
        fetchAll<any>((from, to) => supabase
            .from('instagram_reels')
            .select('id, account_id, reel_id, short_code, caption, video_play_count, likes_count, comments_count, timestamp, created_at, url, video_url')
            .range(from, to) as any),
        fetchAll<any>((from, to) => supabase
            .from('daily_snapshots')
            .select('account_id, date, gain_views, gain_likes, gain_comments, gain_shares')
            .gte('date', resolvedStart!)
            .lte('date', resolvedEnd!)
            .range(from, to) as any),
    ])

    const tiktokAccountById = new Map(tiktokAccounts.map((account) => [account.id, account]))
    const instagramAccountById = new Map(instagramAccounts.map((account) => [account.id, account]))

    const publishedVideosByAccount = new Map<string, PublishingBonusVideo[]>()

    const addPublishedVideo = (video: PublishingBonusVideo) => {
        const next = publishedVideosByAccount.get(`${video.platform}:${video.accountId}`) || []
        next.push(video)
        publishedVideosByAccount.set(`${video.platform}:${video.accountId}`, next)
    }

    tiktokVideos.forEach((video) => {
        const publishedDate = sydneyDateKey(video.create_time)
        if (!video.account_id || !video.video_id || !publishedDate || publishedDate < resolvedStart! || publishedDate > resolvedEnd!) return
        const account = tiktokAccountById.get(video.account_id)
        const username = account?.username || ''
        const owner = describeOwner(resolveOwnerGroupId('tiktok', video.account_id, publishedDate))
        addPublishedVideo({
            platform: 'tiktok',
            accountId: video.account_id,
            username,
            videoId: video.video_id,
            title: video.description || '',
            url: video.web_video_url || (username ? `${tiktokAccountUrl(username)}/video/${video.video_id}` : ''),
            publishedDate,
            settlementDate: addDays(publishedDate, SETTLEMENT_WINDOW_DAYS),
            currentViews: video.play_count || 0,
            settledViews: null,
            bonusAmount: 0,
            isEstimated: false,
            status: 'published',
            ...owner,
        })
    })

    instagramReels.forEach((reel) => {
        const publishedDate = sydneyDateKey(reel.timestamp || reel.created_at)
        if (!reel.account_id || !reel.reel_id || !publishedDate || publishedDate < resolvedStart! || publishedDate > resolvedEnd!) return
        const account = instagramAccountById.get(reel.account_id)
        const username = account?.username || ''
        const owner = describeOwner(resolveOwnerGroupId('instagram', reel.account_id, publishedDate))
        addPublishedVideo({
            platform: 'instagram',
            accountId: reel.account_id,
            username,
            videoId: reel.reel_id,
            title: reel.caption || '',
            url: reel.url || (reel.short_code ? `https://www.instagram.com/reel/${reel.short_code}/` : reel.video_url || ''),
            publishedDate,
            settlementDate: addDays(publishedDate, SETTLEMENT_WINDOW_DAYS),
            currentViews: reel.video_play_count || 0,
            settledViews: null,
            bonusAmount: 0,
            isEstimated: false,
            status: 'published',
            ...owner,
        })
    })

    const tiktokBonusCandidates = tiktokVideos
        .map((video) => {
            const publishedDate = sydneyDateKey(video.create_time)
            if (!publishedDate || publishedDate < bonusPublishStart || publishedDate > bonusPublishEnd) return null
            const settlementDate = addDays(publishedDate, SETTLEMENT_WINDOW_DAYS)
            if (settlementDate < resolvedStart! || settlementDate > resolvedEnd!) return null
            return { ...video, publishedDate, settlementDate }
        })
        .filter(Boolean) as any[]

    const instagramBonusCandidates = instagramReels
        .map((reel) => {
            const publishedDate = sydneyDateKey(reel.timestamp || reel.created_at)
            if (!publishedDate || publishedDate < bonusPublishStart || publishedDate > bonusPublishEnd) return null
            const settlementDate = addDays(publishedDate, SETTLEMENT_WINDOW_DAYS)
            if (settlementDate < resolvedStart! || settlementDate > resolvedEnd!) return null
            return { ...reel, publishedDate, settlementDate }
        })
        .filter(Boolean) as any[]

    const tiktokBonusIds = Array.from(new Set(tiktokBonusCandidates.map((video) => video.video_id).filter(Boolean)))
    const instagramBonusIds = Array.from(new Set(instagramBonusCandidates.map((reel) => reel.reel_id).filter(Boolean)))

    const fetchTiktokHistories = async () => {
        const rows: any[] = []
        const chunkSize = 75
        for (let index = 0; index < tiktokBonusIds.length; index += chunkSize) {
            const chunk = tiktokBonusIds.slice(index, index + chunkSize)
            rows.push(...await fetchAll<any>((from, to) => supabase
                .from('tiktok_video_history')
                .select('video_id, date, play_count')
                .in('video_id', chunk)
                .lte('date', resolvedEnd!)
                .range(from, to) as any))
        }
        return rows
    }

    const fetchInstagramHistories = async () => {
        const rows: any[] = []
        const chunkSize = 75
        for (let index = 0; index < instagramBonusIds.length; index += chunkSize) {
            const chunk = instagramBonusIds.slice(index, index + chunkSize)
            rows.push(...await fetchAll<any>((from, to) => supabase
                .from('instagram_reel_history')
                .select('reel_id, date, video_play_count')
                .in('reel_id', chunk)
                .lte('date', resolvedEnd!)
                .range(from, to) as any))
        }
        return rows
    }

    const [tiktokHistories, instagramHistories] = await Promise.all([
        tiktokBonusIds.length > 0 ? fetchTiktokHistories() : Promise.resolve([]),
        instagramBonusIds.length > 0 ? fetchInstagramHistories() : Promise.resolve([]),
    ])

    const tiktokHistoryByVideo = new Map<string, any[]>()
    tiktokHistories.forEach((history) => {
        const next = tiktokHistoryByVideo.get(history.video_id) || []
        next.push(history)
        tiktokHistoryByVideo.set(history.video_id, next)
    })
    tiktokHistoryByVideo.forEach((rows) => rows.sort((a, b) => a.date.localeCompare(b.date)))

    const instagramHistoryByReel = new Map<string, any[]>()
    instagramHistories.forEach((history) => {
        const next = instagramHistoryByReel.get(history.reel_id) || []
        next.push(history)
        instagramHistoryByReel.set(history.reel_id, next)
    })
    instagramHistoryByReel.forEach((rows) => rows.sort((a, b) => a.date.localeCompare(b.date)))

    const resolveSettlementViews = (
        rows: any[] | undefined,
        settlementDate: string,
        viewField: string,
    ) => {
        const settledHistory = (rows || []).find((history) => history.date === settlementDate)
        return {
            views: settledHistory ? Number(settledHistory[viewField] || 0) : null,
            isMissing: !settledHistory,
        }
    }

    const bonusVideosByAccount = new Map<string, PublishingBonusVideo[]>()
    const addBonusVideo = (video: PublishingBonusVideo) => {
        const key = `${video.platform}:${video.accountId}`
        const next = bonusVideosByAccount.get(key) || []
        next.push(video)
        bonusVideosByAccount.set(key, next)
    }

    tiktokBonusCandidates.forEach((video) => {
        if (!video.account_id || !video.video_id) return
        const account = tiktokAccountById.get(video.account_id)
        const username = account?.username || ''
        const settled = resolveSettlementViews(
            tiktokHistoryByVideo.get(video.video_id),
            video.settlementDate,
            'play_count',
        )
        const owner = describeOwner(resolveOwnerGroupId('tiktok', video.account_id, video.publishedDate))
        const status = settled.isMissing ? 'missing' : 'ready'
        addBonusVideo({
            platform: 'tiktok',
            accountId: video.account_id,
            username,
            videoId: video.video_id,
            title: video.description || '',
            url: video.web_video_url || (username ? `${tiktokAccountUrl(username)}/video/${video.video_id}` : ''),
            publishedDate: video.publishedDate,
            settlementDate: video.settlementDate,
            currentViews: video.play_count || 0,
            settledViews: settled.views,
            bonusAmount: settled.views === null ? 0 : calculateBonusAmount(settled.views),
            isEstimated: false,
            status,
            ...owner,
        })
    })

    instagramBonusCandidates.forEach((reel) => {
        if (!reel.account_id || !reel.reel_id) return
        const account = instagramAccountById.get(reel.account_id)
        const username = account?.username || ''
        const settled = resolveSettlementViews(
            instagramHistoryByReel.get(reel.reel_id),
            reel.settlementDate,
            'video_play_count',
        )
        const owner = describeOwner(resolveOwnerGroupId('instagram', reel.account_id, reel.publishedDate))
        const status = settled.isMissing ? 'missing' : 'ready'
        addBonusVideo({
            platform: 'instagram',
            accountId: reel.account_id,
            username,
            videoId: reel.reel_id,
            title: reel.caption || '',
            url: reel.url || (reel.short_code ? `https://www.instagram.com/reel/${reel.short_code}/` : reel.video_url || ''),
            publishedDate: reel.publishedDate,
            settlementDate: reel.settlementDate,
            currentViews: reel.video_play_count || 0,
            settledViews: settled.views,
            bonusAmount: settled.views === null ? 0 : calculateBonusAmount(settled.views),
            isEstimated: false,
            status,
            ...owner,
        })
    })

    const trafficByAccount = new Map<string, Map<string, PublishingBonusDay>>()
    snapshots.forEach((snapshot) => {
        const dayMap = trafficByAccount.get(snapshot.account_id) || new Map<string, PublishingBonusDay>()
        dayMap.set(snapshot.date, {
            date: snapshot.date,
            hasDataAvailable: true,
            publishCount: 0,
            settlementCount: 0,
            missingSettlementCount: 0,
            views: snapshot.gain_views || 0,
            likes: snapshot.gain_likes || 0,
            comments: snapshot.gain_comments || 0,
            shares: snapshot.gain_shares || 0,
        })
        trafficByAccount.set(snapshot.account_id, dayMap)
    })

    const buildAccountRows = (
        platform: Platform,
        account: any,
        displayName: string,
    ): PublishingBonusAccountRow[] => {
        const accountKey = `${platform}:${account.id}`
        const member = membersByAccount.get(accountKey)
        const trafficDays = trafficByAccount.get(account.id) || new Map<string, PublishingBonusDay>()
        const accountBonusVideos = (bonusVideosByAccount.get(accountKey) || [])
            .sort((a, b) => a.settlementDate.localeCompare(b.settlementDate) || (b.settledViews || 0) - (a.settledViews || 0))
        const accountPublishedVideos = (publishedVideosByAccount.get(accountKey) || [])
            .sort((a, b) => a.publishedDate.localeCompare(b.publishedDate) || b.currentViews - a.currentViews)
        const accountUrl = platform === 'instagram'
            ? account.website || instagramAccountUrl(account.username)
            : account.website || tiktokAccountUrl(account.username)
        const managerBucketIds = new Set<string>()
        const bucketKey = (groupId: string | null) => groupId || 'unassigned'

        dates.forEach((date) => {
            managerBucketIds.add(bucketKey(resolveOwnerGroupId(platform, account.id, date)))
        })

        accountPublishedVideos.forEach((video) => {
            managerBucketIds.add(bucketKey(video.managerGroupId))
        })

        accountBonusVideos.forEach((video) => {
            managerBucketIds.add(bucketKey(video.managerGroupId))
        })

        if (managerBucketIds.size === 0 && member) {
            managerBucketIds.add(bucketKey(member.group_id))
        }

        return Array.from(managerBucketIds).map((managerBucketId) => {
            const managerGroupId = managerBucketId === 'unassigned' ? null : managerBucketId
            const manager = managerGroupId ? groupsById.get(managerGroupId) : null
            const publishedVideos = accountPublishedVideos.filter((video) => video.managerGroupId === managerGroupId)
            const bonusVideos = accountBonusVideos.filter((video) => video.managerGroupId === managerGroupId)
            const days = dates.map((date) => {
                const traffic = trafficDays.get(date)
                const dateOwnerGroupId = resolveOwnerGroupId(platform, account.id, date)
                const publishedVideosForDay = publishedVideos.filter((video) => video.publishedDate === date)
                const settlementVideosForDay = bonusVideos.filter((video) => video.settlementDate === date)
                const includeTraffic = dateOwnerGroupId === managerGroupId

                return {
                    date,
                    hasDataAvailable: includeTraffic ? Boolean(traffic?.hasDataAvailable) : false,
                    publishCount: publishedVideosForDay.length,
                    settlementCount: settlementVideosForDay.length,
                    missingSettlementCount: settlementVideosForDay.filter((video) => video.status === 'missing').length,
                    views: includeTraffic ? traffic?.views || 0 : 0,
                    likes: includeTraffic ? traffic?.likes || 0 : 0,
                    comments: includeTraffic ? traffic?.comments || 0 : 0,
                    shares: includeTraffic && platform !== 'instagram' ? traffic?.shares || 0 : 0,
                }
            })

            return summarizeAccount({
                platform,
                accountId: account.id,
                username: account.username,
                displayName,
                accountUrl,
                managerGroupId,
                managerName: manager?.name || 'Unassigned',
                managerColor: manager?.color || null,
                accountNote: notesByAccount.get(accountKey) || '',
                days,
                weekPublishCount: 0,
                weekViews: 0,
                weekLikes: 0,
                weekComments: 0,
                weekShares: 0,
                avgViewsPerPost: 0,
                settlementCount: 0,
                missingSettlementCount: 0,
                bonusAmount: bonusVideos.reduce((sum, video) => sum + video.bonusAmount, 0),
                publishedVideos,
                bonusVideos,
            })
        })
    }

    const accountRows = [
        ...tiktokAccounts.flatMap((account) => buildAccountRows('tiktok', account, account.nickname || account.username)),
        ...instagramAccounts.flatMap((account) => buildAccountRows('instagram', account, account.full_name || account.username)),
    ].sort((a, b) => {
        if (a.managerName !== b.managerName) return a.managerName.localeCompare(b.managerName)
        if (a.platform !== b.platform) return a.platform.localeCompare(b.platform)
        return a.username.localeCompare(b.username)
    })

    const directRowsForManager = (groupId: string) => accountRows.filter((row) => row.managerGroupId === groupId)
    const childrenByParent = new Map<string | null, AccountGroup[]>()
    management.groups.forEach((group) => {
        const key = group.parent_id || null
        const next = childrenByParent.get(key) || []
        next.push(group)
        childrenByParent.set(key, next)
    })

    const descendantManagerIds = (groupId: string): string[] => {
        const children = childrenByParent.get(groupId) || []
        return children.flatMap((child) => [
            ...(child.group_type === 'manager' ? [child.id] : []),
            ...descendantManagerIds(child.id),
        ])
    }

    const managerRows: PublishingBonusManagerRow[] = management.groups
        .filter((group) => group.group_type === 'manager')
        .map((group) => summarizeGroup(group, directRowsForManager(group.id), dates, 'manager', group.name))

    const folderRows: PublishingBonusManagerRow[] = management.groups
        .filter((group) => group.group_type === 'folder')
        .map((group) => {
            const managerIds = descendantManagerIds(group.id)
            const rows = accountRows.filter((row) => row.managerGroupId && managerIds.includes(row.managerGroupId))
            return summarizeGroup(group, rows, dates, 'folder', group.name)
        })

    const unassignedRows = accountRows.filter((row) => !row.managerGroupId)
    const unassignedSummary = unassignedRows.length > 0
        ? [summarizeGroup(null, unassignedRows, dates, 'unassigned', 'Unassigned')]
        : []

    return {
        startDate: resolvedStart,
        endDate: resolvedEnd,
        dates,
        accountRows,
        managerRows: [...folderRows, ...managerRows, ...unassignedSummary]
            .sort((a, b) => {
                if (a.groupType !== b.groupType) return a.groupType.localeCompare(b.groupType)
                return a.name.localeCompare(b.name)
            }),
    }
}
