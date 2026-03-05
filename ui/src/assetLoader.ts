/**
 * Browser-side asset loader — replaces server-side pngjs pipeline.
 *
 * Fetches PNGs via HTTP, draws to offscreen canvas, reads ImageData,
 * and converts to SpriteData (string[][] hex arrays).
 */

import { setCharacterTemplates } from './office/sprites/spriteData.js'
import { setFloorSprites } from './office/floorTiles.js'
import { setWallSprites } from './office/wallTiles.js'
import { buildDynamicCatalog } from './office/layout/furnitureCatalog.js'

// Asset parsing constants (mirrored from src/constants.ts)
const PNG_ALPHA_THRESHOLD = 128
const WALL_PIECE_WIDTH = 16
const WALL_PIECE_HEIGHT = 32
const WALL_GRID_COLS = 4
const WALL_BITMASK_COUNT = 16
const FLOOR_PATTERN_COUNT = 7
const FLOOR_TILE_SIZE = 16
const CHAR_FRAME_W = 16
const CHAR_FRAME_H = 32
const CHAR_FRAMES_PER_ROW = 7
const CHAR_COUNT = 6

type SpriteData = string[][]

interface FurnitureCatalogAsset {
  id: string
  name: string
  label: string
  category: string
  file: string
  width: number
  height: number
  footprintW: number
  footprintH: number
  isDesk: boolean
  canPlaceOnWalls: boolean
  groupId?: string
  orientation?: string
  state?: string
  canPlaceOnSurfaces?: boolean
  backgroundTiles?: number
}

/** Load an image and return its RGBA pixel data */
async function loadImageData(url: string): Promise<ImageData> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error(`Failed to load image: ${url}`))
    el.src = url
  })
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(0, 0, img.width, img.height)
}

/** Convert a rectangular region of ImageData to SpriteData */
function regionToSprite(
  imageData: ImageData,
  ox: number,
  oy: number,
  w: number,
  h: number,
): SpriteData {
  const { data, width: imgW } = imageData
  const sprite: SpriteData = []
  for (let y = 0; y < h; y++) {
    const row: string[] = []
    for (let x = 0; x < w; x++) {
      const idx = ((oy + y) * imgW + (ox + x)) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      const a = data[idx + 3]
      if (a < PNG_ALPHA_THRESHOLD) {
        row.push('')
      } else {
        row.push(
          `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase(),
        )
      }
    }
    sprite.push(row)
  }
  return sprite
}

/** Load 6 character sprite PNGs and register them */
async function loadCharacters(): Promise<void> {
  const characters: Array<{ down: SpriteData[]; up: SpriteData[]; right: SpriteData[] }> = []
  const directions = ['down', 'up', 'right'] as const

  for (let ci = 0; ci < CHAR_COUNT; ci++) {
    const imageData = await loadImageData(`/assets/characters/char_${ci}.png`)
    const charData: { down: SpriteData[]; up: SpriteData[]; right: SpriteData[] } = { down: [], up: [], right: [] }

    for (let dirIdx = 0; dirIdx < directions.length; dirIdx++) {
      const dir = directions[dirIdx]
      const rowOffsetY = dirIdx * CHAR_FRAME_H
      const frames: SpriteData[] = []
      for (let f = 0; f < CHAR_FRAMES_PER_ROW; f++) {
        frames.push(regionToSprite(imageData, f * CHAR_FRAME_W, rowOffsetY, CHAR_FRAME_W, CHAR_FRAME_H))
      }
      charData[dir] = frames
    }
    characters.push(charData)
  }

  console.log(`[assetLoader] Loaded ${characters.length} character sprites`)
  setCharacterTemplates(characters)
}

/** Load floors.png and register floor sprites */
async function loadFloors(): Promise<void> {
  const imageData = await loadImageData('/assets/floors.png')
  const sprites: SpriteData[] = []
  for (let t = 0; t < FLOOR_PATTERN_COUNT; t++) {
    sprites.push(regionToSprite(imageData, t * FLOOR_TILE_SIZE, 0, FLOOR_TILE_SIZE, FLOOR_TILE_SIZE))
  }
  console.log(`[assetLoader] Loaded ${sprites.length} floor tile patterns`)
  setFloorSprites(sprites)
}

/** Load walls.png and register wall sprites */
async function loadWalls(): Promise<void> {
  const imageData = await loadImageData('/assets/walls.png')
  const sprites: SpriteData[] = []
  for (let mask = 0; mask < WALL_BITMASK_COUNT; mask++) {
    const ox = (mask % WALL_GRID_COLS) * WALL_PIECE_WIDTH
    const oy = Math.floor(mask / WALL_GRID_COLS) * WALL_PIECE_HEIGHT
    sprites.push(regionToSprite(imageData, ox, oy, WALL_PIECE_WIDTH, WALL_PIECE_HEIGHT))
  }
  console.log(`[assetLoader] Loaded ${sprites.length} wall tile sprites`)
  setWallSprites(sprites)
}

/** Load furniture catalog and all furniture PNGs, then register */
async function loadFurniture(): Promise<void> {
  const res = await fetch('/assets/furniture/furniture-catalog.json')
  const catalogData = (await res.json()) as { assets: FurnitureCatalogAsset[] }
  const catalog = catalogData.assets || []

  const sprites: Record<string, SpriteData> = {}

  await Promise.all(
    catalog.map(async (asset) => {
      try {
        let filePath = asset.file
        if (!filePath.startsWith('assets/')) {
          filePath = `assets/${filePath}`
        }
        const imageData = await loadImageData(`/${filePath}`)
        sprites[asset.id] = regionToSprite(imageData, 0, 0, asset.width, asset.height)
      } catch (err) {
        console.warn(`[assetLoader] Failed to load furniture ${asset.id}:`, err)
      }
    }),
  )

  console.log(`[assetLoader] Loaded ${Object.keys(sprites).length}/${catalog.length} furniture assets`)
  buildDynamicCatalog({ catalog, sprites })
}

/**
 * Load all assets in the correct order and register them.
 * Call this once on app startup before signaling ready.
 */
export async function initAssets(): Promise<void> {
  // Characters first, then floors, walls, furniture (matching original load order)
  // Each step is wrapped in try/catch so missing assets don't block the app
  try { await loadCharacters() } catch (e) { console.warn('[assetLoader] Characters failed:', e) }
  try { await loadFloors() } catch (e) { console.warn('[assetLoader] Floors failed (using fallback):', e) }
  try { await loadWalls() } catch (e) { console.warn('[assetLoader] Walls failed (using fallback):', e) }
  try { await loadFurniture() } catch (e) { console.warn('[assetLoader] Furniture failed:', e) }
  console.log('[assetLoader] Asset loading complete')
}
