// 3D device mockups. One offscreen WebGL renderer draws the phone model with a
// transparent background; the result is composited into the 2D canvas.

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Model3D, Screen } from '../model/types'
import { announceResourceReady } from '../storage/assets'
import type { Render3DArgs } from './canvas'
import { MODEL_COLOR_PRESETS } from './three-presets'

interface DeviceConfig {
  modelPath: string
  aspectRatio: number
  screenHeightFactor: number
  screenOffset: { x: number; y: number; z: number }
  cornerRadiusFactor: number
}

const CONFIGS: Record<Model3D, DeviceConfig> = {
  iphone: {
    modelPath: '/models/iphone-15-pro-max.glb',
    aspectRatio: 1290 / 2796,
    screenHeightFactor: 0.826,
    screenOffset: { x: 0.027, y: 0.745, z: 0.098 },
    cornerRadiusFactor: 0.16,
  },
  samsung: {
    modelPath: '/models/samsung-galaxy-s25-ultra.glb',
    aspectRatio: 1440 / 3120,
    screenHeightFactor: 0.66,
    screenOffset: { x: 0, y: 0, z: 0.08 },
    cornerRadiusFactor: 0.04,
  },
}

interface LoadedModel {
  pivot: THREE.Group
  model: THREE.Object3D
  screenPlane: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
}

const FOV = 35
const CAMERA_Z = 6
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
const models = new Map<Model3D, LoadedModel>()
const loading = new Map<Model3D, Promise<LoadedModel>>()
const textures = new WeakMap<object, { key: string; texture: THREE.Texture }>()

function ensureRenderer(): boolean {
  if (renderer) return true
  if (typeof document === 'undefined') return false
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  } catch (e) {
    console.warn('[3d] WebGL unavailable', e)
    return false
  }
  renderer.setPixelRatio(1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping
  renderer.setClearColor(0x000000, 0)
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 1000)
  camera.position.set(0, 0, CAMERA_Z)
  // Physically-based light units: legacy intensities × π keep the original look.
  scene.add(new THREE.AmbientLight(0xffffff, 0.5 * Math.PI))
  const key = new THREE.DirectionalLight(0xffffff, 0.8 * Math.PI)
  key.position.set(2, 3, 4)
  const fill = new THREE.DirectionalLight(0xffffff, 0.4 * Math.PI)
  fill.position.set(-2, 1, 2)
  const rim = new THREE.DirectionalLight(0xffffff, 0.3 * Math.PI)
  rim.position.set(0, -2, -3)
  scene.add(key, fill, rim)
  return true
}

export function isModelReady(type: Model3D): boolean {
  return models.has(type)
}

export function loadModel(type: Model3D): Promise<LoadedModel> {
  const ready = models.get(type)
  if (ready) return Promise.resolve(ready)
  let p = loading.get(type)
  if (!p) {
    const config = CONFIGS[type]
    p = new GLTFLoader().loadAsync(config.modelPath).then(gltf => {
      const model = gltf.scene
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      const baseScale = 3.75 / Math.max(size.x, size.y, size.z)
      model.scale.setScalar(baseScale)
      // Offset so the screen center sits at the pivot origin.
      model.position.set(-config.screenOffset.x * baseScale, -config.screenOffset.y * baseScale, -config.screenOffset.z * baseScale)
      model.traverse(child => {
        const mesh = child as THREE.Mesh
        if (mesh.isMesh && mesh.material && !Array.isArray(mesh.material)) mesh.material = mesh.material.clone()
      })
      const planeHeight = 4.3 * config.screenHeightFactor
      const screenPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(planeHeight * config.aspectRatio, planeHeight),
        new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide }),
      )
      screenPlane.position.set(config.screenOffset.x, config.screenOffset.y, config.screenOffset.z)
      model.add(screenPlane)
      const pivot = new THREE.Group()
      pivot.add(model)
      const loaded = { pivot, model, screenPlane }
      models.set(type, loaded)
      loading.delete(type)
      announceResourceReady()
      return loaded
    })
    p.catch(err => {
      loading.delete(type)
      console.error(`[3d] failed to load ${type}`, err)
    })
    loading.set(type, p)
  }
  return p
}

export async function prepare3D(screen: Screen): Promise<void> {
  if (!screen.device.use3D) return
  if (!ensureRenderer()) throw new Error('3D rendering needs WebGL, which is unavailable in this browser')
  await loadModel(screen.device.model3D)
}

function roundedScreenTexture(image: CanvasImageSource & { width: number; height: number }, radiusFactor: number): THREE.Texture {
  const key = `${radiusFactor}`
  const cached = textures.get(image as object)
  if (cached && cached.key === key) return cached.texture
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')!
  ctx.beginPath()
  ctx.roundRect(0, 0, canvas.width, canvas.height, Math.round(image.width * radiusFactor))
  ctx.clip()
  ctx.drawImage(image, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  cached?.texture.dispose()
  textures.set(image as object, { key, texture })
  return texture
}

function applyColor(model: THREE.Object3D, type: Model3D, presetId: string) {
  const preset = MODEL_COLOR_PRESETS[type].find(p => p.id === presetId)
  if (!preset) return
  model.traverse(child => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh || Array.isArray(mesh.material)) return
    const mat = mesh.material as THREE.MeshStandardMaterial
    const c = preset.materials[(mat.name || '').toLowerCase()]
    if (c && mat.color) mat.color.set(c)
  })
}

/** Composites the 3D device into ctx (which is already scaled to output pixels). */
export function render3D({ ctx, screen, image, width, height, scale }: Render3DArgs): boolean {
  const d = screen.device
  const loaded = models.get(d.model3D)
  if (!loaded) {
    void loadModel(d.model3D).catch(() => {})
    return false
  }
  if (!ensureRenderer() || !renderer || !scene || !camera) return false
  const config = CONFIGS[d.model3D]
  const { pivot, model, screenPlane } = loaded
  if (image) {
    const tex = roundedScreenTexture(image, config.cornerRadiusFactor)
    if (screenPlane.material.map !== tex) {
      screenPlane.material.dispose()
      screenPlane.material = new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    }
  }
  applyColor(model, d.model3D, d.modelColor)

  const aspect = width / height
  const visibleH = 2 * CAMERA_Z * Math.tan(((FOV / 2) * Math.PI) / 180)
  const visibleW = visibleH * aspect
  const s = d.scale / 100
  const devH = 3.75 * s
  const devW = devH * config.aspectRatio
  const moveX = Math.max(visibleW - devW, visibleW * 0.15)
  const moveY = Math.max(visibleH - devH, visibleH * 0.15)
  pivot.scale.setScalar(s)
  pivot.position.set((d.x / 100 - 0.5) * moveX, -(d.y / 100 - 0.5) * moveY, 0)
  const r = d.rotation3D
  pivot.rotation.set((r.x * Math.PI) / 180, (r.y * Math.PI) / 180, ((r.z + d.rotation) * Math.PI) / 180)

  const pw = Math.max(1, Math.round(width * scale))
  const ph = Math.max(1, Math.round(height * scale))
  renderer.setSize(pw, ph, false)
  camera.aspect = aspect
  camera.updateProjectionMatrix()
  scene.add(pivot)
  renderer.clear()
  renderer.render(scene, camera)
  scene.remove(pivot)
  ctx.save()
  if (d.shadow.enabled) {
    // Drop shadow follows the model's silhouette (alpha of the WebGL frame).
    const n = parseInt(d.shadow.color.slice(1), 16) || 0
    ctx.shadowColor = `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${d.shadow.opacity / 100})`
    ctx.shadowBlur = d.shadow.blur * scale
    ctx.shadowOffsetX = d.shadow.x * scale
    ctx.shadowOffsetY = d.shadow.y * scale
  }
  ctx.drawImage(renderer.domElement, 0, 0, width, height)
  ctx.restore()
  return true
}
