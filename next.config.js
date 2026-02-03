/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
        // Warning: This allows production builds to successfully complete even if
        // your project has ESLint errors.
        ignoreDuringBuilds: true,
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**.tiktokcdn.com',
            },
            {
                protocol: 'https',
                hostname: '**.tiktokcdn-us.com',
            },
            {
                protocol: 'https',
                hostname: '**.tiktokcdn-eu.com',
            },
        ],
    },
}

module.exports = nextConfig
