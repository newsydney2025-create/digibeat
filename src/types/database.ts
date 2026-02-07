export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            attribution_records: {
                Row: {
                    created_at: string | null
                    id: string
                    note: string | null
                    recorded_by: string | null
                    source_id: string | null
                }
                Insert: {
                    created_at?: string | null
                    id?: string
                    note?: string | null
                    recorded_by?: string | null
                    source_id?: string | null
                }
                Update: {
                    created_at?: string | null
                    id?: string
                    note?: string | null
                    recorded_by?: string | null
                    source_id?: string | null
                }
                Relationships: []
            }
            attribution_sources: {
                Row: {
                    code: string
                    created_at: string | null
                    icon: string | null
                    id: string
                    is_active: boolean | null
                    name_en: string
                    name_zh: string
                    sort_order: number | null
                }
                Insert: {
                    code: string
                    created_at?: string | null
                    icon?: string | null
                    id?: string
                    is_active?: boolean | null
                    name_en: string
                    name_zh: string
                    sort_order?: number | null
                }
                Update: {
                    code?: string
                    created_at?: string | null
                    icon?: string | null
                    id?: string
                    is_active?: boolean | null
                    name_en?: string
                    name_zh?: string
                    sort_order?: number | null
                }
                Relationships: []
            }
            daily_snapshots: {
                Row: {
                    account_id: string
                    created_at: string | null
                    date: string
                    id: string
                    total_comments: number | null
                    total_likes: number | null
                    total_shares: number | null
                    total_views: number | null
                    video_count: number | null
                }
                Insert: {
                    account_id: string
                    created_at?: string | null
                    date: string
                    id?: string
                    total_comments?: number | null
                    total_likes?: number | null
                    total_shares?: number | null
                    total_views?: number | null
                    video_count?: number | null
                }
                Update: {
                    account_id?: string
                    created_at?: string | null
                    date?: string
                    id?: string
                    total_comments?: number | null
                    total_likes?: number | null
                    total_shares?: number | null
                    total_views?: number | null
                    video_count?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "daily_snapshots_account_id_fkey"
                        columns: ["account_id"]
                        isOneToOne: false
                        referencedRelation: "tiktok_accounts"
                        referencedColumns: ["id"]
                    }
                ]
            }
            sync_logs: {
                Row: {
                    completed_at: string | null
                    error_message: string | null
                    id: string
                    started_at: string | null
                    status: string
                    sync_type: string
                    videos_synced: number | null
                }
                Insert: {
                    completed_at?: string | null
                    error_message?: string | null
                    id?: string
                    started_at?: string | null
                    status?: string
                    sync_type?: string
                    videos_synced?: number | null
                }
                Update: {
                    completed_at?: string | null
                    error_message?: string | null
                    id?: string
                    started_at?: string | null
                    status?: string
                    sync_type?: string
                    videos_synced?: number | null
                }
                Relationships: []
            }
            tiktok_accounts: {
                Row: {
                    avatar_url: string | null
                    created_at: string
                    follower_count: number
                    following_count: number
                    heart_count: number
                    id: string
                    is_active: boolean
                    last_synced_at: string | null
                    nickname: string | null
                    signature: string | null
                    username: string
                    video_count: number
                    website: string | null
                }
                Insert: {
                    avatar_url?: string | null
                    created_at?: string
                    follower_count?: number
                    following_count?: number
                    heart_count?: number
                    id?: string
                    is_active?: boolean
                    last_synced_at?: string | null
                    nickname?: string | null
                    signature?: string | null
                    username: string
                    video_count?: number
                    website?: string | null
                }
                Update: {
                    avatar_url?: string | null
                    created_at?: string
                    follower_count?: number
                    following_count?: number
                    heart_count?: number
                    id?: string
                    is_active?: boolean
                    last_synced_at?: string | null
                    nickname?: string | null
                    signature?: string | null
                    username?: string
                    video_count?: number
                    website?: string | null
                }
                Relationships: []
            }
            tiktok_videos: {
                Row: {
                    account_id: string | null
                    collect_count: number
                    comment_count: number
                    cover_url: string | null
                    create_time: string | null
                    created_at: string
                    description: string | null
                    digg_count: number
                    duration: number
                    hashtags: string[]
                    id: string
                    is_ad: boolean
                    is_pinned: boolean
                    music_author: string | null
                    music_name: string | null
                    play_count: number
                    share_count: number
                    updated_at: string
                    video_id: string
                    video_url: string | null
                    web_video_url: string | null
                }
                Insert: {
                    account_id?: string | null
                    collect_count?: number
                    comment_count?: number
                    cover_url?: string | null
                    create_time?: string | null
                    created_at?: string
                    description?: string | null
                    digg_count?: number
                    duration?: number
                    hashtags?: string[]
                    id?: string
                    is_ad?: boolean
                    is_pinned?: boolean
                    music_author?: string | null
                    music_name?: string | null
                    play_count?: number
                    share_count?: number
                    updated_at?: string
                    video_id: string
                    video_url?: string | null
                    web_video_url?: string | null
                }
                Update: {
                    account_id?: string | null
                    collect_count?: number
                    comment_count?: number
                    cover_url?: string | null
                    create_time?: string | null
                    created_at?: string
                    description?: string | null
                    digg_count?: number
                    duration?: number
                    hashtags?: string[]
                    id?: string
                    is_ad?: boolean
                    is_pinned?: boolean
                    music_author?: string | null
                    music_name?: string | null
                    play_count?: number
                    share_count?: number
                    updated_at?: string
                    video_id?: string
                    video_url?: string | null
                    web_video_url?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "tiktok_videos_account_id_fkey"
                        columns: ["account_id"]
                        isOneToOne: false
                        referencedRelation: "tiktok_accounts"
                        referencedColumns: ["id"]
                    }
                ]
            }
            instagram_accounts: {
                Row: {
                    id: string
                    instagram_id: string
                    username: string
                    full_name: string | null
                    avatar_url: string | null
                    is_active: boolean
                    last_synced_at: string | null
                    created_at: string
                    updated_at: string
                    website: string | null
                }
                Insert: {
                    id?: string
                    instagram_id: string
                    username: string
                    full_name?: string | null
                    avatar_url?: string | null
                    is_active?: boolean
                    last_synced_at?: string | null
                    created_at?: string
                    updated_at?: string
                    website?: string | null
                }
                Update: {
                    id?: string
                    instagram_id?: string
                    username?: string
                    full_name?: string | null
                    avatar_url?: string | null
                    is_active?: boolean
                    last_synced_at?: string | null
                    created_at?: string
                    updated_at?: string
                    website?: string | null
                }
                Relationships: []
            }
            instagram_reels: {
                Row: {
                    id: string
                    account_id: string | null
                    short_code: string
                    caption: string | null
                    video_play_count: number
                    likes_count: number
                    comments_count: number
                    thumbnail_url: string | null
                    timestamp: string | null
                    created_at: string
                    hashtags: string[] | null
                }
                Insert: {
                    id?: string
                    account_id?: string | null
                    short_code: string
                    caption?: string | null
                    video_play_count?: number
                    likes_count?: number
                    comments_count?: number
                    thumbnail_url?: string | null
                    timestamp?: string | null
                    created_at?: string
                    hashtags?: string[] | null
                }
                Update: {
                    id?: string
                    account_id?: string | null
                    short_code?: string
                    caption?: string | null
                    video_play_count?: number
                    likes_count?: number
                    comments_count?: number
                    thumbnail_url?: string | null
                    timestamp?: string | null
                    created_at?: string
                    hashtags?: string[] | null
                }
                Relationships: []
            }
            tiktok_video_history: {
                Row: {
                    id: string
                    video_id: string
                    account_id: string
                    date: string
                    play_count: number
                    digg_count: number
                    comment_count: number
                    share_count: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    video_id: string
                    account_id: string
                    date: string
                    play_count?: number
                    digg_count?: number
                    comment_count?: number
                    share_count?: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    video_id?: string
                    account_id?: string
                    date?: string
                    play_count?: number
                    digg_count?: number
                    comment_count?: number
                    share_count?: number
                    created_at?: string
                }
                Relationships: []
            }
            instagram_reel_history: {
                Row: {
                    id: string
                    reel_id: string
                    account_id: string
                    date: string
                    video_play_count: number
                    likes_count: number
                    comments_count: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    reel_id: string
                    account_id: string
                    date: string
                    video_play_count?: number
                    likes_count?: number
                    comments_count?: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    reel_id?: string
                    account_id?: string
                    date?: string
                    video_play_count?: number
                    likes_count?: number
                    comments_count?: number
                    created_at?: string
                }
                Relationships: []
            }
        }
        Views: {}
        Functions: {}
        Enums: {}
        CompositeTypes: {}
    }
}

// Convenience types
export interface DailySnapshot {
    id: string
    account_id: string
    date: string
    total_views: number
    total_likes: number
    total_comments: number
    total_shares: number
    video_count: number
    created_at: string
}

export type TableRow<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TikTokAccount = TableRow<'tiktok_accounts'>
export type TikTokVideo = TableRow<'tiktok_videos'>
export type SyncLog = TableRow<'sync_logs'>

// Extended types for dashboard
export interface TikTokVideoWithAccount extends TikTokVideo {
    account?: TikTokAccount
}

export interface DashboardMetrics {
    playCount: number
    diggCount: number
    commentCount: number
    shareCount: number
    collectCount: number
}

export type MetricKey = keyof DashboardMetrics

// Account Groups
export interface AccountGroup {
    id: string
    name: string
    color: string
    created_at: string
    members?: string[] // account IDs
}

export interface AccountGroupMember {
    id: string
    group_id: string
    account_id: string
    created_at: string
}

// Instagram types
export interface InstagramAccount {
    id: string
    instagram_id: string
    username: string
    full_name: string | null
    avatar_url: string | null
    website: string | null
    is_active: boolean
    last_synced_at: string | null
    created_at: string
    updated_at: string
}

export interface InstagramReel {
    id: string
    reel_id: string
    short_code: string
    account_id: string | null
    caption: string | null
    hashtags: string[]
    mentions: string[]
    url: string | null
    likes_count: number
    comments_count: number
    video_play_count: number
    video_duration: number | null
    thumbnail_url: string | null
    video_url: string | null
    is_pinned: boolean
    is_paid_partnership: boolean
    timestamp: string | null
    created_at: string
    updated_at: string
}

// Platform type for switching
export type Platform = 'tiktok' | 'instagram'
