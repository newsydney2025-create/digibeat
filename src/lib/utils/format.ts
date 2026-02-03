/**
 * Format a number with compact notation (K, M, B)
 */
export function formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        compactDisplay: 'short',
    }).format(num)
}

/**
 * Format a timestamp to simple date string (M/D)
 */
export function formatDateSimple(timestamp: string | number): string {
    const date = typeof timestamp === 'number'
        ? new Date(timestamp * 1000)
        : new Date(timestamp)
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
}

/**
 * Format a date to full format
 */
export function formatDateFull(timestamp: string | number): string {
    const date = typeof timestamp === 'number'
        ? new Date(timestamp * 1000)
        : new Date(timestamp)
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    })
}

/**
 * Generate a random session ID
 */
export function generateSessionId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
}

/**
 * Account color palette for charts
 */
export const ACCOUNT_COLORS = [
    '#00f3ff', // cyan
    '#bc13fe', // pink
    '#fdd835', // yellow
    '#0aff60', // green
    '#ff5e00', // orange
    '#ff0055', // red
]

/**
 * Get color for account by index
 */
export function getAccountColor(index: number): string {
    return ACCOUNT_COLORS[index % ACCOUNT_COLORS.length]
}

/**
 * Metric configuration
 */
export const METRICS_CONFIG = [
    { key: 'playCount' as const, label: 'Views', icon: 'eye', color: '#00f3ff' },
    { key: 'diggCount' as const, label: 'Likes', icon: 'heart', color: '#bc13fe' },
    { key: 'commentCount' as const, label: 'Comments', icon: 'chat', color: '#0aff60' },
    { key: 'shareCount' as const, label: 'Shares', icon: 'share', color: '#fdd835' },
]
