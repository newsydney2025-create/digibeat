import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvFile(path) {
    if (!existsSync(path)) return {}

    return Object.fromEntries(
        readFileSync(path, 'utf8')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#') && line.includes('='))
            .map((line) => {
                const index = line.indexOf('=')
                const key = line.slice(0, index).trim()
                const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
                return [key, value]
            })
    )
}

const env = {
    ...loadEnvFile(resolve('.env.local')),
    ...process.env,
}

if (!env.SUPABASE_DB_URL) {
    console.error('Missing SUPABASE_DB_URL in .env.local')
    process.exit(1)
}

const child = spawn('npx', ['supabase', 'db', 'push', '--db-url', env.SUPABASE_DB_URL], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
})

child.on('exit', (code) => {
    process.exit(code ?? 1)
})
