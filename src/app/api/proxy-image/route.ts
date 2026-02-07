
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const url = searchParams.get('url')

    if (!url) {
        return new NextResponse('Missing URL', { status: 400 })
    }

    try {
        const response = await fetch(url)

        if (!response.ok) {
            return new NextResponse('Failed to fetch image', { status: response.status })
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream'
        const buffer = await response.arrayBuffer()

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Access-Control-Allow-Origin': '*',
                'Cross-Origin-Resource-Policy': 'cross-origin'
            }
        })
    } catch (error) {
        console.error('Proxy error:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
