
const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
    const username = 'gowithjessie5' // The user mentioned this account in screenshot
    // Or 'sydneynia' etc.

    // 1. Get Account ID
    const { data: account } = await supabase
        .from('tiktok_accounts')
        .select('id, video_count, username')
        .ilike('username', username) // case insensitive
        .single()

    if (!account) {
        console.log(`Account ${username} not found. Listing all accounts...`)
        const { data: accounts } = await supabase.from('tiktok_accounts').select('username, video_count')
        console.table(accounts)
        return
    }

    console.log(`Account: ${account.username} (ID: ${account.id})`)
    console.log(`Reported Video Count: ${account.video_count}`)

    // 2. Count History Entries for Today
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
    console.log(`Checking history for date: ${today}`)

    const { count, error } = await supabase
        .from('tiktok_video_history')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', account.id)
        .eq('date', today)

    if (error) {
        console.error('Error counting history:', error)
    } else {
        console.log(`Actual History Entries in DB: ${count}`)
    }
}

check()
