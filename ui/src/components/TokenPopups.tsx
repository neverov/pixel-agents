import { useState, useEffect, useCallback } from 'react'
import type { OfficeState } from '../office/engine/officeState.js'
import { TILE_SIZE, CharacterState } from '../office/types.js'

interface TokenPopup {
  id: number
  agentId: number
  input: number
  output: number
  createdAt: number
}

const POPUP_DURATION_MS = 1500

let nextPopupId = 0

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

interface TokenPopupsProps {
  officeState: OfficeState
  containerRef: React.RefObject<HTMLDivElement | null>
  zoom: number
  panRef: React.RefObject<{ x: number; y: number }>
  onPopup: React.RefObject<((agentId: number, input: number, output: number) => void) | null>
}

export function TokenPopups({ officeState, containerRef, zoom, panRef, onPopup }: TokenPopupsProps) {
  const [popups, setPopups] = useState<TokenPopup[]>([])
  const [, setTick] = useState(0)

  // Expose the trigger function to parent
  const addPopup = useCallback((agentId: number, input: number, output: number) => {
    const popup: TokenPopup = {
      id: nextPopupId++,
      agentId,
      input,
      output,
      createdAt: Date.now(),
    }
    setPopups((prev) => [...prev, popup])
  }, [])

  useEffect(() => {
    onPopup.current = addPopup
    return () => { onPopup.current = null }
  }, [addPopup, onPopup])

  // Cleanup expired popups + drive animation
  useEffect(() => {
    let rafId = 0
    const tick = () => {
      const now = Date.now()
      setPopups((prev) => {
        const filtered = prev.filter((p) => now - p.createdAt < POPUP_DURATION_MS)
        return filtered.length === prev.length ? prev : filtered
      })
      setTick((n) => n + 1)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  const el = containerRef.current
  if (!el || popups.length === 0) return null

  const rect = el.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const canvasW = Math.round(rect.width * dpr)
  const canvasH = Math.round(rect.height * dpr)
  const layout = officeState.getLayout()
  const mapW = layout.cols * TILE_SIZE * zoom
  const mapH = layout.rows * TILE_SIZE * zoom
  const deviceOffsetX = Math.floor((canvasW - mapW) / 2) + Math.round(panRef.current.x)
  const deviceOffsetY = Math.floor((canvasH - mapH) / 2) + Math.round(panRef.current.y)

  const now = Date.now()

  return (
    <>
      {popups.map((popup) => {
        const ch = officeState.characters.get(popup.agentId)
        if (!ch) return null

        const elapsed = now - popup.createdAt
        const progress = Math.min(elapsed / POPUP_DURATION_MS, 1)

        const sittingOffset = ch.state === CharacterState.TYPE ? 6 : 0
        const screenX = (deviceOffsetX + ch.x * zoom) / dpr
        const baseY = (deviceOffsetY + (ch.y + sittingOffset - 24) * zoom) / dpr
        const floatY = baseY - 30 - progress * 30
        const opacity = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3

        const total = popup.input + popup.output

        return (
          <div
            key={popup.id}
            style={{
              position: 'absolute',
              left: screenX,
              top: floatY,
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              zIndex: 41,
              opacity,
              fontSize: '18px',
              color: '#89dceb',
              background: 'rgba(30,30,46,0.8)',
              padding: '1px 6px',
              borderRadius: 0,
              border: '1px solid rgba(137,220,235,0.4)',
              whiteSpace: 'nowrap',
            }}
          >
            +{formatTokens(total)}
          </div>
        )
      })}
    </>
  )
}
