import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'DIGIPARK | Quantum Analytics V8.2',
    description: 'TikTok Analytics Dashboard with real-time data visualization',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;500;800&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Rajdhani:wght@400;600;700&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body className="text-gray-300">{children}</body>
        </html>
    )
}
