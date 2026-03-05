/**
 * Generate default assets: floors.png + furniture PNGs + furniture-catalog.json
 *
 * Run: bun scripts/generate-assets.ts
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { PNG } from 'pngjs'

type SpriteData = string[][]
const _ = '' // transparent

// ── Floor patterns (7 grayscale 16x16 tiles) ────────────────────

function generateFloorPatterns(): SpriteData[] {
  const patterns: SpriteData[] = []

  // Pattern 1: Solid
  patterns.push(solid(16, 16, '#808080'))

  // Pattern 2: Checkerboard
  patterns.push(checkerboard('#888888', '#777777'))

  // Pattern 3: Brick
  patterns.push(brick('#808080', '#707070'))

  // Pattern 4: Diagonal lines
  patterns.push(diagonal('#858585', '#757575'))

  // Pattern 5: Small tiles
  patterns.push(smallTiles('#828282', '#727272'))

  // Pattern 6: Planks (horizontal)
  patterns.push(planks('#848484', '#747474'))

  // Pattern 7: Stone
  patterns.push(stone('#808080', '#6A6A6A'))

  return patterns
}

function solid(w: number, h: number, color: string): SpriteData {
  return Array.from({ length: h }, () => Array(w).fill(color))
}

function checkerboard(c1: string, c2: string): SpriteData {
  return Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => ((x + y) % 2 === 0 ? c1 : c2))
  )
}

function brick(c1: string, c2: string): SpriteData {
  return Array.from({ length: 16 }, (_, y) => {
    const row = Math.floor(y / 4)
    const isGrout = y % 4 === 3
    if (isGrout) return Array(16).fill(c2)
    return Array.from({ length: 16 }, (_, x) => {
      const offset = row % 2 === 0 ? 0 : 8
      return (x + offset) % 8 === 7 ? c2 : c1
    })
  })
}

function diagonal(c1: string, c2: string): SpriteData {
  return Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => ((x + y) % 4 < 2 ? c1 : c2))
  )
}

function smallTiles(c1: string, c2: string): SpriteData {
  return Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => {
      const isEdge = x % 4 === 3 || y % 4 === 3
      return isEdge ? c2 : c1
    })
  )
}

function planks(c1: string, c2: string): SpriteData {
  return Array.from({ length: 16 }, (_, y) => {
    const isGroove = y % 4 === 0
    if (isGroove) return Array(16).fill(c2)
    return Array.from({ length: 16 }, (_, x) => {
      const plankGroup = Math.floor(y / 4)
      const offset = plankGroup % 2 === 0 ? 0 : 5
      return (x + offset) % 10 === 0 ? c2 : c1
    })
  })
}

function stone(c1: string, c2: string): SpriteData {
  return Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => {
      const hash = (x * 7 + y * 13) % 16
      return hash < 3 ? c2 : c1
    })
  )
}

// ── Furniture sprites ────────────────────────────────────────────

const DESK_SPRITE: SpriteData = (() => {
  const W = '#8B6914', L = '#A07828', S = '#B8922E', D = '#6B4E0A'
  const rows: string[][] = []
  rows.push(new Array(32).fill(_))
  rows.push([_, ...new Array(30).fill(W), _])
  for (let r = 0; r < 4; r++)
    rows.push([_, W, ...new Array(28).fill(r < 1 ? L : S), W, _])
  rows.push([_, D, ...new Array(28).fill(W), D, _])
  for (let r = 0; r < 6; r++)
    rows.push([_, W, ...new Array(28).fill(S), W, _])
  rows.push([_, W, ...new Array(28).fill(L), W, _])
  for (let r = 0; r < 6; r++)
    rows.push([_, W, ...new Array(28).fill(S), W, _])
  rows.push([_, D, ...new Array(28).fill(W), D, _])
  for (let r = 0; r < 4; r++)
    rows.push([_, W, ...new Array(28).fill(r > 2 ? L : S), W, _])
  rows.push([_, ...new Array(30).fill(W), _])
  for (let r = 0; r < 4; r++) {
    const row = new Array(32).fill(_) as string[]
    row[1] = D; row[2] = D; row[29] = D; row[30] = D
    rows.push(row)
  }
  rows.push(new Array(32).fill(_))
  rows.push(new Array(32).fill(_))
  return rows
})()

const PLANT_SPRITE: SpriteData = (() => {
  const G = '#3D8B37', D = '#2D6B27', T = '#6B4E0A', P = '#B85C3A', R = '#8B4422'
  return [
    [_,_,_,_,_,_,G,G,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,G,G,G,G,_,_,_,_,_,_,_],
    [_,_,_,_,G,G,D,G,G,G,_,_,_,_,_,_],
    [_,_,_,G,G,D,G,G,D,G,G,_,_,_,_,_],
    [_,_,G,G,G,G,G,G,G,G,G,G,_,_,_,_],
    [_,G,G,D,G,G,G,G,G,G,D,G,G,_,_,_],
    [_,G,G,G,G,D,G,G,D,G,G,G,G,_,_,_],
    [_,_,G,G,G,G,G,G,G,G,G,G,_,_,_,_],
    [_,_,_,G,G,G,D,G,G,G,G,_,_,_,_,_],
    [_,_,_,_,G,G,G,G,G,G,_,_,_,_,_,_],
    [_,_,_,_,_,G,G,G,G,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,T,T,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,T,T,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,T,T,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,R,R,R,R,R,_,_,_,_,_,_],
    [_,_,_,_,R,P,P,P,P,P,R,_,_,_,_,_],
    [_,_,_,_,R,P,P,P,P,P,R,_,_,_,_,_],
    [_,_,_,_,R,P,P,P,P,P,R,_,_,_,_,_],
    [_,_,_,_,R,P,P,P,P,P,R,_,_,_,_,_],
    [_,_,_,_,R,P,P,P,P,P,R,_,_,_,_,_],
    [_,_,_,_,R,P,P,P,P,P,R,_,_,_,_,_],
    [_,_,_,_,_,R,P,P,P,R,_,_,_,_,_,_],
    [_,_,_,_,_,_,R,R,R,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  ]
})()

const BOOKSHELF_SPRITE: SpriteData = (() => {
  const W = '#8B6914', D = '#6B4E0A'
  const R = '#CC4444', B = '#4477AA', G = '#44AA66', Y = '#CCAA33', P = '#9955AA'
  return [
    [_,W,W,W,W,W,W,W,W,W,W,W,W,W,W,_],
    [W,D,D,D,D,D,D,D,D,D,D,D,D,D,D,W],
    [W,D,R,R,B,B,G,G,Y,Y,R,R,B,B,D,W],
    [W,D,R,R,B,B,G,G,Y,Y,R,R,B,B,D,W],
    [W,D,R,R,B,B,G,G,Y,Y,R,R,B,B,D,W],
    [W,D,R,R,B,B,G,G,Y,Y,R,R,B,B,D,W],
    [W,D,R,R,B,B,G,G,Y,Y,R,R,B,B,D,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,D,D,D,D,D,D,D,D,D,D,D,D,D,D,W],
    [W,D,P,P,Y,Y,B,B,G,G,P,P,R,R,D,W],
    [W,D,P,P,Y,Y,B,B,G,G,P,P,R,R,D,W],
    [W,D,P,P,Y,Y,B,B,G,G,P,P,R,R,D,W],
    [W,D,P,P,Y,Y,B,B,G,G,P,P,R,R,D,W],
    [W,D,P,P,Y,Y,B,B,G,G,P,P,R,R,D,W],
    [W,D,P,P,Y,Y,B,B,G,G,P,P,R,R,D,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,D,D,D,D,D,D,D,D,D,D,D,D,D,D,W],
    [W,D,G,G,R,R,P,P,B,B,Y,Y,G,G,D,W],
    [W,D,G,G,R,R,P,P,B,B,Y,Y,G,G,D,W],
    [W,D,G,G,R,R,P,P,B,B,Y,Y,G,G,D,W],
    [W,D,G,G,R,R,P,P,B,B,Y,Y,G,G,D,W],
    [W,D,G,G,R,R,P,P,B,B,Y,Y,G,G,D,W],
    [W,D,G,G,R,R,P,P,B,B,Y,Y,G,G,D,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,D,D,D,D,D,D,D,D,D,D,D,D,D,D,W],
    [W,D,D,D,D,D,D,D,D,D,D,D,D,D,D,W],
    [W,D,D,D,D,D,D,D,D,D,D,D,D,D,D,W],
    [W,D,D,D,D,D,D,D,D,D,D,D,D,D,D,W],
    [W,D,D,D,D,D,D,D,D,D,D,D,D,D,D,W],
    [W,D,D,D,D,D,D,D,D,D,D,D,D,D,D,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [_,W,W,W,W,W,W,W,W,W,W,W,W,W,W,_],
  ]
})()

const CHAIR_SPRITE: SpriteData = (() => {
  const W = '#8B6914', D = '#6B4E0A', B = '#5C3D0A', S = '#A07828'
  return [
    [_,_,_,_,_,D,D,D,D,D,D,_,_,_,_,_],
    [_,_,_,_,D,B,B,B,B,B,B,D,_,_,_,_],
    [_,_,_,_,D,B,S,S,S,S,B,D,_,_,_,_],
    [_,_,_,_,D,B,S,S,S,S,B,D,_,_,_,_],
    [_,_,_,_,D,B,S,S,S,S,B,D,_,_,_,_],
    [_,_,_,_,D,B,S,S,S,S,B,D,_,_,_,_],
    [_,_,_,_,D,B,S,S,S,S,B,D,_,_,_,_],
    [_,_,_,_,D,B,S,S,S,S,B,D,_,_,_,_],
    [_,_,_,_,D,B,S,S,S,S,B,D,_,_,_,_],
    [_,_,_,_,D,B,B,B,B,B,B,D,_,_,_,_],
    [_,_,_,_,_,D,D,D,D,D,D,_,_,_,_,_],
    [_,_,_,_,_,_,D,W,W,D,_,_,_,_,_,_],
    [_,_,_,_,_,_,D,W,W,D,_,_,_,_,_,_],
    [_,_,_,_,_,D,D,D,D,D,D,_,_,_,_,_],
    [_,_,_,_,_,D,_,_,_,_,D,_,_,_,_,_],
    [_,_,_,_,_,D,_,_,_,_,D,_,_,_,_,_],
  ]
})()

const PC_SPRITE: SpriteData = (() => {
  const F = '#555555', S = '#3A3A5C', B = '#6688CC', D = '#444444'
  return [
    [_,_,_,F,F,F,F,F,F,F,F,F,F,_,_,_],
    [_,_,_,F,S,S,S,S,S,S,S,S,F,_,_,_],
    [_,_,_,F,S,B,B,B,B,B,B,S,F,_,_,_],
    [_,_,_,F,S,B,B,B,B,B,B,S,F,_,_,_],
    [_,_,_,F,S,B,B,B,B,B,B,S,F,_,_,_],
    [_,_,_,F,S,B,B,B,B,B,B,S,F,_,_,_],
    [_,_,_,F,S,B,B,B,B,B,B,S,F,_,_,_],
    [_,_,_,F,S,B,B,B,B,B,B,S,F,_,_,_],
    [_,_,_,F,S,S,S,S,S,S,S,S,F,_,_,_],
    [_,_,_,F,F,F,F,F,F,F,F,F,F,_,_,_],
    [_,_,_,_,_,_,_,D,D,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,D,D,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,D,D,D,D,_,_,_,_,_,_],
    [_,_,_,_,_,D,D,D,D,D,D,_,_,_,_,_],
    [_,_,_,_,_,D,D,D,D,D,D,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  ]
})()

const LAMP_SPRITE: SpriteData = (() => {
  const Y = '#FFDD55', L = '#FFEE88', D = '#888888', B = '#555555', G = '#FFFFCC'
  return [
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,G,G,G,G,_,_,_,_,_,_],
    [_,_,_,_,_,G,Y,Y,Y,Y,G,_,_,_,_,_],
    [_,_,_,_,G,Y,Y,L,L,Y,Y,G,_,_,_,_],
    [_,_,_,_,Y,Y,L,L,L,L,Y,Y,_,_,_,_],
    [_,_,_,_,Y,Y,L,L,L,L,Y,Y,_,_,_,_],
    [_,_,_,_,_,Y,Y,Y,Y,Y,Y,_,_,_,_,_],
    [_,_,_,_,_,_,D,D,D,D,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,D,D,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,D,D,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,D,D,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,D,D,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,D,D,D,D,_,_,_,_,_,_],
    [_,_,_,_,_,B,B,B,B,B,B,_,_,_,_,_],
    [_,_,_,_,_,B,B,B,B,B,B,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  ]
})()

const COOLER_SPRITE: SpriteData = (() => {
  const W = '#CCDDEE', L = '#88BBDD', D = '#999999', B = '#666666'
  return [
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,D,D,D,D,D,D,_,_,_,_,_],
    [_,_,_,_,D,L,L,L,L,L,L,D,_,_,_,_],
    [_,_,_,_,D,L,L,L,L,L,L,D,_,_,_,_],
    [_,_,_,_,D,L,L,L,L,L,L,D,_,_,_,_],
    [_,_,_,_,D,L,L,L,L,L,L,D,_,_,_,_],
    [_,_,_,_,D,L,L,L,L,L,L,D,_,_,_,_],
    [_,_,_,_,_,D,D,D,D,D,D,_,_,_,_,_],
    [_,_,_,_,_,D,W,W,W,W,D,_,_,_,_,_],
    [_,_,_,_,_,D,W,W,W,W,D,_,_,_,_,_],
    [_,_,_,_,_,D,W,W,W,W,D,_,_,_,_,_],
    [_,_,_,_,_,D,W,W,W,W,D,_,_,_,_,_],
    [_,_,_,_,_,D,W,W,W,W,D,_,_,_,_,_],
    [_,_,_,_,D,D,W,W,W,W,D,D,_,_,_,_],
    [_,_,_,_,D,W,W,W,W,W,W,D,_,_,_,_],
    [_,_,_,_,D,W,W,W,W,W,W,D,_,_,_,_],
    [_,_,_,_,D,D,D,D,D,D,D,D,_,_,_,_],
    [_,_,_,_,_,D,B,B,B,B,D,_,_,_,_,_],
    [_,_,_,_,_,D,B,B,B,B,D,_,_,_,_,_],
    [_,_,_,_,_,D,B,B,B,B,D,_,_,_,_,_],
    [_,_,_,_,D,D,B,B,B,B,D,D,_,_,_,_],
    [_,_,_,_,D,B,B,B,B,B,B,D,_,_,_,_],
    [_,_,_,_,D,D,D,D,D,D,D,D,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  ]
})()

const WHITEBOARD_SPRITE: SpriteData = (() => {
  const F = '#AAAAAA', W = '#EEEEFF', M = '#CC4444', B = '#4477AA'
  return [
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,_],
    [_,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,_],
    [_,F,W,W,M,M,M,W,W,W,W,W,B,B,B,B,W,W,W,W,W,W,W,M,W,W,W,W,W,W,F,_],
    [_,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,B,B,W,W,M,W,W,W,W,W,W,F,_],
    [_,F,W,W,W,W,M,M,M,M,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,B,B,W,W,F,_],
    [_,F,W,W,W,W,W,W,W,W,W,W,W,B,B,B,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,_],
    [_,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,M,M,M,W,W,W,W,W,W,W,F,_],
    [_,F,W,M,M,W,W,W,W,W,W,W,W,W,W,W,B,B,W,W,W,W,W,W,W,W,W,W,W,W,F,_],
    [_,F,W,W,W,W,W,W,B,B,B,W,W,W,W,W,W,W,W,W,W,W,W,W,M,M,M,M,W,W,F,_],
    [_,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,_],
    [_,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,_],
    [_,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  ]
})()

// ── Furniture catalog ────────────────────────────────────────────

interface FurnitureItem {
  id: string
  name: string
  label: string
  category: string
  footprintW: number
  footprintH: number
  isDesk: boolean
  canPlaceOnWalls: boolean
  sprite: SpriteData
  canPlaceOnSurfaces?: boolean
}

const FURNITURE: FurnitureItem[] = [
  { id: 'desk', name: 'DEFAULT_DESK', label: 'Desk', category: 'desks', footprintW: 2, footprintH: 2, isDesk: true, canPlaceOnWalls: false, sprite: DESK_SPRITE },
  { id: 'bookshelf', name: 'DEFAULT_BOOKSHELF', label: 'Bookshelf', category: 'storage', footprintW: 1, footprintH: 2, isDesk: false, canPlaceOnWalls: false, sprite: BOOKSHELF_SPRITE },
  { id: 'plant', name: 'DEFAULT_PLANT', label: 'Plant', category: 'decor', footprintW: 1, footprintH: 1, isDesk: false, canPlaceOnWalls: false, sprite: PLANT_SPRITE },
  { id: 'cooler', name: 'DEFAULT_COOLER', label: 'Cooler', category: 'misc', footprintW: 1, footprintH: 1, isDesk: false, canPlaceOnWalls: false, sprite: COOLER_SPRITE },
  { id: 'whiteboard', name: 'DEFAULT_WHITEBOARD', label: 'Whiteboard', category: 'wall', footprintW: 2, footprintH: 1, isDesk: false, canPlaceOnWalls: true, sprite: WHITEBOARD_SPRITE },
  { id: 'chair', name: 'DEFAULT_CHAIR', label: 'Chair', category: 'chairs', footprintW: 1, footprintH: 1, isDesk: false, canPlaceOnWalls: false, sprite: CHAIR_SPRITE },
  { id: 'pc', name: 'DEFAULT_PC', label: 'Monitor', category: 'electronics', footprintW: 1, footprintH: 1, isDesk: false, canPlaceOnWalls: false, canPlaceOnSurfaces: true, sprite: PC_SPRITE },
  { id: 'lamp', name: 'DEFAULT_LAMP', label: 'Lamp', category: 'decor', footprintW: 1, footprintH: 1, isDesk: false, canPlaceOnWalls: false, canPlaceOnSurfaces: true, sprite: LAMP_SPRITE },
]

// ── PNG helpers ──────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function spriteToPng(sprite: SpriteData): Buffer {
  const h = sprite.length
  const w = sprite[0].length
  const png = new PNG({ width: w, height: h })
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      const color = sprite[y][x]
      if (!color) {
        png.data[idx] = png.data[idx+1] = png.data[idx+2] = png.data[idx+3] = 0
      } else {
        const [r, g, b] = hexToRgb(color)
        png.data[idx] = r; png.data[idx+1] = g; png.data[idx+2] = b; png.data[idx+3] = 255
      }
    }
  }
  return PNG.sync.write(png)
}

function stripToPng(sprites: SpriteData[]): Buffer {
  const tileH = sprites[0].length
  const tileW = sprites[0][0].length
  const totalW = tileW * sprites.length
  const png = new PNG({ width: totalW, height: tileH })
  for (let i = 0; i < sprites.length; i++) {
    const sprite = sprites[i]
    for (let y = 0; y < tileH; y++) {
      for (let x = 0; x < tileW; x++) {
        const idx = (y * totalW + (i * tileW + x)) * 4
        const color = sprite[y][x]
        if (!color) {
          png.data[idx] = png.data[idx+1] = png.data[idx+2] = png.data[idx+3] = 0
        } else {
          const [r, g, b] = hexToRgb(color)
          png.data[idx] = r; png.data[idx+1] = g; png.data[idx+2] = b; png.data[idx+3] = 255
        }
      }
    }
  }
  return PNG.sync.write(png)
}

// ── Main ─────────────────────────────────────────────────────────

const ASSETS_DIR = join(import.meta.dirname, '..', 'webview-ui', 'public', 'assets')
const FURNITURE_DIR = join(ASSETS_DIR, 'furniture')

// 1. Generate floors.png
console.log('Generating floors.png...')
const floorPatterns = generateFloorPatterns()
const floorsBuffer = stripToPng(floorPatterns)
writeFileSync(join(ASSETS_DIR, 'floors.png'), floorsBuffer)
console.log(`  floors.png (${floorPatterns.length} patterns, ${16 * floorPatterns.length}x16)`)

// 2. Generate furniture PNGs
console.log('Generating furniture PNGs...')
const catalogAssets: object[] = []

for (const item of FURNITURE) {
  const dir = join(FURNITURE_DIR, item.category)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const pngPath = join(dir, `${item.name}.png`)
  writeFileSync(pngPath, spriteToPng(item.sprite))

  const w = item.sprite[0].length
  const h = item.sprite.length
  console.log(`  ${item.name}.png (${w}x${h})`)

  catalogAssets.push({
    id: item.id,
    name: item.name,
    label: item.label,
    category: item.category,
    file: `furniture/${item.category}/${item.name}.png`,
    width: w,
    height: h,
    footprintW: item.footprintW,
    footprintH: item.footprintH,
    isDesk: item.isDesk,
    canPlaceOnWalls: item.canPlaceOnWalls,
    ...(item.canPlaceOnSurfaces ? { canPlaceOnSurfaces: true } : {}),
  })
}

// 3. Write furniture-catalog.json
const catalog = { totalAssets: catalogAssets.length, assets: catalogAssets }
writeFileSync(join(FURNITURE_DIR, 'furniture-catalog.json'), JSON.stringify(catalog, null, 2) + '\n')
console.log(`\nfurniture-catalog.json (${catalogAssets.length} items)`)
console.log('Done!')
