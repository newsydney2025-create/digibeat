'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { Platform } from '@/types/database'

export type AccountActionResult = {
    success: boolean
    message: string
}

function cleanUsername(value: string, platform: Platform) {
    const trimmed = value.trim()
    if (!trimmed) return ''

    try {
        const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
        const host = url.hostname.replace(/^www\./, '')
        if (platform === 'instagram' && host === 'instagram.com') {
            return (url.pathname.split('/').filter(Boolean)[0] || '').replace(/^@/, '')
        }
        if (platform === 'tiktok' && host === 'tiktok.com') {
            return (url.pathname.split('/').filter(Boolean)[0] || '').replace(/^@/, '')
        }
    } catch {
        // Plain usernames are handled below.
    }

    return trimmed.replace(/^@/, '').replace(/\/+$/, '')
}

function instagramUrl(username: string) {
    return `https://www.instagram.com/${username}/`
}

export async function createManagedAccount(input: {
    platform: Platform
    account: string
    displayName?: string
}): Promise<AccountActionResult> {
    const supabase = await createClient()
    const username = cleanUsername(input.account, input.platform)
    const displayName = input.displayName?.trim() || null

    if (!username) {
        return { success: false, message: 'Please enter a valid account username or URL.' }
    }

    if (input.platform === 'tiktok') {
        const { data: existing, error: lookupError } = await supabase
            .from('tiktok_accounts')
            .select('id')
            .ilike('username', username)
            .limit(1)
            .maybeSingle()

        if (lookupError) {
            console.error('Error checking TikTok account:', lookupError)
            return { success: false, message: lookupError.message }
        }

        const payload: Record<string, string | boolean | null> = {
            username,
            is_active: true,
        }
        if (displayName) payload.nickname = displayName

        const { error } = existing
            ? await (supabase.from('tiktok_accounts') as any).update(payload).eq('id', (existing as any).id)
            : await (supabase.from('tiktok_accounts') as any).insert(payload)

        if (error) {
            console.error('Error saving TikTok account:', error)
            return { success: false, message: error.message }
        }
    } else {
        const { data: existing, error: lookupError } = await supabase
            .from('instagram_accounts')
            .select('id')
            .ilike('username', username)
            .limit(1)
            .maybeSingle()

        if (lookupError) {
            console.error('Error checking Instagram account:', lookupError)
            return { success: false, message: lookupError.message }
        }

        const payload: Record<string, string | boolean | null> = {
            instagram_id: `manual:${username}`,
            username,
            website: instagramUrl(username),
            is_active: true,
            updated_at: new Date().toISOString(),
        }
        if (displayName) payload.full_name = displayName

        const { error } = existing
            ? await (supabase.from('instagram_accounts') as any).update(payload).eq('id', (existing as any).id)
            : await (supabase.from('instagram_accounts') as any).insert(payload)

        if (error) {
            console.error('Error saving Instagram account:', error)
            return { success: false, message: error.message }
        }
    }

    revalidatePath('/')
    revalidatePath('/dashboard')
    return { success: true, message: `@${username} has been added.` }
}

export async function deleteManagedAccount(input: {
    platform: Platform
    accountId: string
}): Promise<AccountActionResult> {
    const supabase = await createClient()

    const table = input.platform === 'instagram' ? 'instagram_accounts' : 'tiktok_accounts'
    const { error } = await (supabase
        .from(table) as any)
        .update({ is_active: false })
        .eq('id', input.accountId)

    if (error) {
        console.error('Error deactivating account:', error)
        return { success: false, message: error.message }
    }

    const { error: memberError } = await (supabase
        .from('account_group_members') as any)
        .delete()
        .eq('platform', input.platform)
        .eq('account_id', input.accountId)

    if (memberError) {
        console.error('Error clearing account group assignment:', memberError)
        return { success: false, message: memberError.message }
    }

    revalidatePath('/')
    revalidatePath('/dashboard')
    return { success: true, message: 'Account removed from the active dashboard.' }
}
