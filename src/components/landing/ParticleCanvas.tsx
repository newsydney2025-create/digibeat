'use client'

import { useEffect, useRef } from 'react'

interface Particle {
    x: number
    y: number
    vx: number
    vy: number
    size: number
    color: string
}

export default function ParticleCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const particlesRef = useRef<Particle[]>([])
    const animationRef = useRef<number>()

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const initParticles = () => {
            const width = (canvas.width = window.innerWidth)
            const height = (canvas.height = window.innerHeight)

            particlesRef.current = Array.from({ length: 60 }, () => ({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                size: Math.random() * 2,
                color: Math.random() > 0.5 ? 'rgba(0, 243, 255,' : 'rgba(188, 19, 254,',
            }))
        }

        const animate = () => {
            const width = canvas.width
            const height = canvas.height

            ctx.clearRect(0, 0, width, height)

            particlesRef.current.forEach((p, i) => {
                p.x += p.vx
                p.y += p.vy

                if (p.x < 0 || p.x > width) p.vx *= -1
                if (p.y < 0 || p.y > height) p.vy *= -1

                ctx.beginPath()
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
                ctx.fillStyle = p.color + '0.5)'
                ctx.fill()

                for (let j = i; j < particlesRef.current.length; j++) {
                    const other = particlesRef.current[j]
                    const d = Math.hypot(p.x - other.x, p.y - other.y)
                    if (d < 120) {
                        ctx.beginPath()
                        ctx.strokeStyle = `rgba(255, 255, 255, ${0.05 - d / 2400})`
                        ctx.moveTo(p.x, p.y)
                        ctx.lineTo(other.x, other.y)
                        ctx.stroke()
                    }
                }
            })

            animationRef.current = requestAnimationFrame(animate)
        }

        const handleResize = () => {
            initParticles()
        }

        initParticles()
        animate()

        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current)
            }
        }
    }, [])

    return (
        <canvas
            ref={canvasRef}
            className="fixed top-0 left-0 w-full h-full -z-10"
        />
    )
}
