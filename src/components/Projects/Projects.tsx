import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react'
import { Canvas, useLoader, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

type ProjectsProps = {
  isDark?: boolean
}

// Simple, non-auto-scrolling chips carousel
function ChipsCarousel({ items, isDark = false, onSelect }: { items: string[]; isDark?: boolean; onSelect?: (index: number, label: string) => void }) {
  // Start with no selection by default
  const [index, setIndex] = useState<number>(-1)
  const trackRef = useRef<HTMLDivElement | null>(null)

  const scrollIntoView = (i: number) => {
    const root = trackRef.current
    if (!root) return
    const chips = root.querySelectorAll<HTMLButtonElement>('[data-chip="true"]')
    const chip = chips[i]
    if (!chip) return
    const start = root.scrollLeft
    const end = chip.offsetLeft - 16 // small leading padding
    const chipEnd = chip.offsetLeft + chip.offsetWidth
    const viewEnd = root.scrollLeft + root.clientWidth
    // Only adjust if outside the viewport for a calm UX
    let target = start
    if (chip.offsetLeft < start) target = end
    else if (chipEnd > viewEnd) target = chipEnd - root.clientWidth + 16
    if (target !== start) {
      root.scrollTo({ left: target, behavior: 'smooth' })
    }
    setIndex(i)
  }

  const chipBase = isDark
    ? 'bg-white/5 text-white border-white/10 hover:bg-white/10'
    : 'bg-black/5 text-black border-black/10 hover:bg-black/10'
  const chipActive = isDark ? 'bg-white/20' : 'bg-black/10'

  return (
    <div className="w-full">
      <div className="flex items-center gap-3">
        <div
          ref={trackRef}
          className="flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none]"
          style={{ scrollbarWidth: 'none' }}
        >
          {/* Hide WebKit scrollbars */}
          <style>{`.hide-scrollbar::-webkit-scrollbar{display:none}`}</style>
          <div className="flex gap-3 pr-2 hide-scrollbar justify-center w-max mx-auto">
            {items.map((label, i) => (
              <button
                key={label}
                data-chip="true"
                onClick={() => {
                  scrollIntoView(i)
                  onSelect?.(i, label)
                }}
                className={`whitespace-nowrap px-4 py-2 rounded-full border transition-colors ${chipBase} ${i === index ? chipActive : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function DarknessModel({ onLoaded }: { onLoaded?: () => void }) {
  // Eagerly load and map all files in the darkness folder so production build includes them
  const files = useMemo(
    () => (import.meta.glob('../../assets/darkness/**/*', { as: 'url', eager: true }) as Record<string, string>),
    []
  )

  // Base path key prefix used in the glob map
  const baseKey = '../../assets/darkness/'

  // Resolve the emitted URL for a given relative path inside the darkness folder
  const toUrl = (rel: string) => files[baseKey + rel] ?? rel

  // Configure GLTFLoader to rewrite dependent URLs (scene.bin, textures/*.png) to their emitted URLs
  const gltf = useLoader(GLTFLoader, toUrl('scene.gltf'), (loader) => {
    loader.manager.setURLModifier((url) => {
      // If it's already absolute (http/https/data), leave it; otherwise map relative to our folder
      try {
        new URL(url)
        return url
      } catch {
        return toUrl(url)
      }
    })
  })

  // Improve texture clarity at oblique angles (e.g., ground/grass) with anisotropic filtering
  const { gl } = useThree()
  const isTexture = (v: unknown): v is THREE.Texture => v instanceof THREE.Texture
  useEffect(() => {
    if (!gltf?.scene || !gl) return
    const maxAniso = gl.capabilities.getMaxAnisotropy()
    const targetAniso = Math.min(8, maxAniso) // 8 is a good quality/perf balance; increase to maxAniso if desired
    gltf.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh
        const baseMat = mesh.material
        if (!baseMat) return
        const materials: THREE.Material[] = Array.isArray(baseMat) ? baseMat : [baseMat]
        type TextureCarrier = THREE.Material & Partial<Record<'map' | 'aoMap' | 'emissiveMap' | 'metalnessMap' | 'roughnessMap' | 'normalMap' | 'specularMap', THREE.Texture>>
        const keys: Array<keyof TextureCarrier> = ['map', 'aoMap', 'emissiveMap', 'metalnessMap', 'roughnessMap', 'normalMap', 'specularMap']
        materials.forEach((m) => {
          // Ensure visibility from both sides as requested
          m.side = THREE.FrontSide
          ;(m as THREE.Material & { needsUpdate?: boolean }).needsUpdate = true
          // Make grass cards visible from all angles and stable with cutout alpha
          const isGrassMat = !!(m.name && m.name.toLowerCase().includes('grass'))
          if (isGrassMat) {
            m.side = THREE.DoubleSide
            // Use cutout to avoid sorting artifacts and halos
            const ms = m as THREE.MeshStandardMaterial & { alphaToCoverage?: boolean }
            ms.alphaTest = Math.max(0.0, Math.min(0.5, ms.alphaTest || 0.45))
            ms.transparent = false
            ms.depthWrite = true
            // Reduce jaggies on masked edges when MSAA is available
            ms.alphaToCoverage = true
            m.needsUpdate = true
          }
          const mc = m as TextureCarrier
          keys.forEach((key) => {
            const tex = mc[key]
            if (isTexture(tex) && tex.anisotropy !== targetAniso) {
              // Ensure correct color space for base color textures
              if (key === 'map') {
                tex.colorSpace = THREE.SRGBColorSpace
              }

              // General improvements
              tex.anisotropy = targetAniso

              // Wrapping: prefer repeat for tiled surfaces, clamp for alpha-cutout cards
              if (isGrassMat) {
                tex.wrapS = THREE.ClampToEdgeWrapping
                tex.wrapT = THREE.ClampToEdgeWrapping
                // Avoid mipmap bleeding on masked textures
                tex.generateMipmaps = false
                tex.minFilter = THREE.LinearFilter
                tex.magFilter = THREE.LinearFilter
                // Premultiply helps remove dark/bright fringes around alpha
                tex.premultiplyAlpha = true
              } else {
                tex.wrapS = THREE.RepeatWrapping
                tex.wrapT = THREE.RepeatWrapping
              }
              tex.needsUpdate = true
            }
          })
        })
      }
    })
    // Signal that model and textures are processed and ready to show
    onLoaded?.()
  }, [gltf.scene, gl, onLoaded])

  // Auto-center and scale to a reasonable size
  const groupRef = React.useRef<THREE.Group>(null!)
  const { center, scale } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(gltf.scene)
    const size = new THREE.Vector3()
    const c = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(c)
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const target = 3 // target size in world units
    return { center: c, scale: target / maxDim }
  }, [gltf.scene])

  const cloned = useMemo(() => gltf.scene.clone(true), [gltf.scene])

  // Fix a pleasant static orientation
  useEffect(() => {
    if (!groupRef.current) return
    // Keep only a gentle yaw; remove pitch/roll so it's not slanted
    groupRef.current.rotation.set(0, 0.9, 0)
  }, [])

  return (
    <group ref={groupRef} scale={[scale, scale, scale]}>
      <group position={[-center.x, -center.y, -center.z]}>
        <primitive object={cloned} />
      </group>
    </group>
  )
}

type CameraUpdate = {
  pos: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  fov: number
}

function CameraControls({ enabled, onUpdate }: { enabled: boolean; onUpdate: (c: CameraUpdate) => void }) {
  const { camera } = useThree()
  const controlsRef = useRef<ThreeOrbitControls | null>(null)

  useEffect(() => {
    if (!enabled) return
    const el = document.body as HTMLElement
  const controls = new ThreeOrbitControls(camera, el)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.rotateSpeed = 0.6
  controls.zoomSpeed = 0.8
  // Make panning quick as requested
  controls.panSpeed = 2.6
  // Align target with desired look-at
  controls.target.set(-0.07, -0.07, 0)
    controls.addEventListener('change', () => {
      const persp = camera as THREE.PerspectiveCamera
      onUpdate({
        pos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
        fov: persp.fov
      })
    })
    controlsRef.current = controls
    return () => {
      controls.dispose()
      controlsRef.current = null
    }
  }, [enabled, camera, onUpdate])

  useFrame(() => {
    controlsRef.current?.update()
  })

  return null
}

type Vec3 = { x: number; y: number; z: number }

function CameraIntroMove({ from, to, target, duration = 1.6 }: { from: Vec3; to: Vec3; target: Vec3; duration?: number }) {
  const { camera } = useThree()
  useEffect(() => {
    const start = new THREE.Vector3(from.x, from.y, from.z)
    const end = new THREE.Vector3(to.x, to.y, to.z)
    // Initialize at the starting position
    camera.position.set(start.x, start.y, start.z)
    camera.lookAt(target.x, target.y, target.z)
    camera.updateProjectionMatrix()

    const startTime = performance.now()
    let raf = 0 as number | undefined
    const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / (duration * 1000))
      const k = easeInOutCubic(t)
      camera.position.lerpVectors(start, end, k)
      camera.lookAt(target.x, target.y, target.z)
      camera.updateProjectionMatrix()
      if (t < 1) {
        raf = requestAnimationFrame(step)
      }
    }
    raf = requestAnimationFrame(step)
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [from.x, from.y, from.z, to.x, to.y, to.z, target.x, target.y, target.z, duration, camera])
  return null
}

function CameraMoveTo({ to, target, fov = 50, duration = 1.2, trigger = 0, onUpdate }: { to: Vec3; target: Vec3; fov?: number; duration?: number; trigger?: number; onUpdate?: (c: CameraUpdate) => void }) {
  const { camera } = useThree()
  useEffect(() => {
    // Capture starting state
    const startPos = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z)
    const endPos = new THREE.Vector3(to.x, to.y, to.z)
    const persp = camera as THREE.PerspectiveCamera
    const startFov = persp.fov
    const endFov = fov

    // Approximate current look-at by projecting forward to the distance of the final target
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    const finalTarget = new THREE.Vector3(target.x, target.y, target.z)
    const startTarget = startPos.clone().add(dir.multiplyScalar(startPos.distanceTo(finalTarget)))

    const startTime = performance.now()
    let raf: number | undefined
    const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / (duration * 1000))
      const k = easeInOutCubic(t)
      // Position
      camera.position.lerpVectors(startPos, endPos, k)
      // Target
      const curTarget = new THREE.Vector3().lerpVectors(startTarget, finalTarget, k)
      camera.lookAt(curTarget.x, curTarget.y, curTarget.z)
      // FOV
      persp.fov = THREE.MathUtils.lerp(startFov, endFov, k)
      camera.updateProjectionMatrix()

      onUpdate?.({
        pos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        target: { x: curTarget.x, y: curTarget.y, z: curTarget.z },
        fov: persp.fov
      })

      if (t < 1) {
        raf = requestAnimationFrame(step)
      }
    }
    raf = requestAnimationFrame(step)
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [to.x, to.y, to.z, target.x, target.y, target.z, duration, fov, trigger, camera, onUpdate])
  return null
}

const Projects: React.FC<ProjectsProps> = ({ isDark = false }) => {
  // Responsive: detect mobile viewport (<= 640px)
  const getIsMobile = () => (typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false)
  const [isMobile, setIsMobile] = useState<boolean>(getIsMobile())
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(max-width: 640px)')
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile('matches' in e ? e.matches : (e as MediaQueryList).matches)
    // Initial sync in case something changed before effect
    setIsMobile(mql.matches)
    // Add listener (support older browsers)
    if ('addEventListener' in mql) {
      mql.addEventListener('change', handler as (e: MediaQueryListEvent) => void)
    } else {
      // @ts-expect-error - older Safari
      mql.addListener(handler)
    }
    return () => {
      if ('removeEventListener' in mql) {
        mql.removeEventListener('change', handler as (e: MediaQueryListEvent) => void)
      } else {
        // @ts-expect-error - older Safari
        mql.removeListener(handler)
      }
    }
  }, [])

  // Camera presets
  const START_POS = useMemo(() => ({ x: -2.9, y: 1.01, z: 3.5 }), [])
  const TARGET = useMemo(() => ({ x: -0.07, y: -0.07, z: 0 }), [])
  const END_DESKTOP = useMemo(() => ({ x: -0.90, y: 0.35, z: 1.01 }), [])
  const END_MOBILE = useMemo(() => ({ x: -1.46, y: 0.63, z: 1.69 }), [])
  const endPos = isMobile ? END_MOBILE : END_DESKTOP

  const [controlsEnabled] = useState(false)
  const [isModelReady, setIsModelReady] = useState(false)
  // Removed debug coordinates state to avoid unused vars after removing overlay UI

  // Desktop-only: trigger camera move when selecting Project 1
  const [moveTrigger, setMoveTrigger] = useState(0)
  const [pendingMove, setPendingMove] = useState<{ to: Vec3; target: Vec3; fov: number } | null>(null)

  // Inactivity: return camera to default end pose after a period without clicks
  const resetTimerRef = useRef<number | undefined>(undefined)
  const scheduleReset = useCallback(() => {
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current)
    resetTimerRef.current = window.setTimeout(() => {
      // Use current viewport to decide the end pose at the time of reset
      const mobileNow = getIsMobile()
      const to = mobileNow ? END_MOBILE : END_DESKTOP
      setPendingMove({ to, target: TARGET, fov: 50 })
      setMoveTrigger((n) => n + 1)
    }, 6000) // 6s of inactivity
  }, [END_DESKTOP, END_MOBILE, TARGET])

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current)
    }
  }, [])

  const PROJECT_LABELS = useMemo(
    () => [
      'Project 1',
      'Project 2',
      'Project 3',
      'Project 4',
      'Project 5',
      'Project 6',
      'Project 7',
      'Project 8'
    ],
    []
  )

  // Mobile-specific camera presets provided
  const MOBILE_PRESETS: Array<{ to: Vec3; target: Vec3; fov: number }> = useMemo(
    () => [
      // Project 1
      { to: { x: -0.22, y: 0.10, z: 0.51 }, target: { x: -0.45, y: 0.02, z: 0.32 }, fov: 50 },
      // Project 2
      { to: { x: 0.01, y: 0.10, z: 0.24 }, target: { x: -0.22, y: 0.02, z: 0.05 }, fov: 50 },
      // Project 3
      { to: { x: 0.23, y: 0.10, z: -0.04 }, target: { x: 0.01, y: 0.02, z: -0.22 }, fov: 50 },
      // Project 4
      { to: { x: 0.46, y: 0.10, z: -0.33 }, target: { x: 0.24, y: 0.02, z: -0.50 }, fov: 50 },
      // Project 5
      { to: { x: 0.74, y: 0.10, z: -0.69 }, target: { x: 0.52, y: 0.03, z: -0.86 }, fov: 50 },
      // Project 6
      { to: { x: 0.96, y: 0.10, z: -0.97 }, target: { x: 0.74, y: 0.03, z: -1.14 }, fov: 50 },
      // Project 7
      { to: { x: 1.18, y: 0.10, z: -1.25 }, target: { x: 0.96, y: 0.03, z: -1.42 }, fov: 50 },
      // Project 8
      { to: { x: 1.40, y: 0.10, z: -1.54 }, target: { x: 1.18, y: 0.03, z: -1.71 }, fov: 50 }
    ],
    []
  )

  const handleSelect = useCallback(
    (i: number) => {
      // Animate camera to specific viewpoints per project
      if (isMobile) {
        const p = MOBILE_PRESETS[i]
        if (p) {
          setPendingMove({ to: p.to, target: p.target, fov: p.fov })
          setMoveTrigger((n) => n + 1)
        }
        scheduleReset()
        return
      }
      if (i === 0) {
        setPendingMove({
          to: { x: -0.21, y: 0.12, z: 0.51 },
          target: { x: -0.41, y: 0.05, z: 0.35 },
          fov: 50
        })
        setMoveTrigger((n) => n + 1)
      } else if (i === 1) {
        setPendingMove({
          to: { x: -0.02, y: 0.12, z: 0.22 },
          target: { x: -0.24, y: 0.04, z: 0.04 },
          fov: 50
        })
        setMoveTrigger((n) => n + 1)
      } else if (i === 2) {
        setPendingMove({
          to: { x: 0.22, y: 0.12, z: -0.06 },
          target: { x: -0.00, y: 0.04, z: -0.24 },
          fov: 50
        })
        setMoveTrigger((n) => n + 1)
      } else if (i === 3) {
        setPendingMove({
          to: { x: 0.44, y: 0.12, z: -0.33 },
          target: { x: 0.22, y: 0.04, z: -0.51 },
          fov: 50
        })
        setMoveTrigger((n) => n + 1)
      } else if (i === 4) {
        setPendingMove({
          to: { x: 0.71, y: 0.11, z: -0.70 },
          target: { x: 0.63, y: 0.08, z: -0.77 },
          fov: 50
        })
        setMoveTrigger((n) => n + 1)
      } else if (i === 5) {
        setPendingMove({
          to: { x: 0.96, y: 0.12, z: -0.97 },
          target: { x: 0.74, y: 0.03, z: -1.15 },
          fov: 50
        })
        setMoveTrigger((n) => n + 1)
      } else if (i === 6) {
        setPendingMove({
          to: { x: 1.19, y: 0.12, z: -1.25 },
          target: { x: 0.97, y: 0.03, z: -1.43 },
          fov: 50
        })
        setMoveTrigger((n) => n + 1)
      } else if (i === 7) {
        setPendingMove({
          to: { x: 1.41, y: 0.12, z: -1.53 },
          target: { x: 1.20, y: 0.03, z: -1.71 },
          fov: 50
        })
        setMoveTrigger((n) => n + 1)
      }
      scheduleReset()
    },
    [MOBILE_PRESETS, isMobile, scheduleReset]
  )

  // Local P5 button component to randomize slant on hover
  const P5Button: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => {
    const [styleVars, setStyleVars] = useState<Record<string, string | number>>({})

  const onEnter = () => {
      // Randomize deltas for a playful Persona 5 feel
      const randSign = () => (Math.random() < 0.5 ? -1 : 1)
      const rotDelta = (Math.random() * 6 + 3) * randSign() // 3..9 deg
      const skewDelta = (Math.random() * 6 + 4) * randSign() // 4..10 deg
  const scale = 1.20 + Math.random() * 0.04 // 1.12..1.16 emphasize more
      const tx = `${(Math.random() < 0.5 ? -1 : 1) * 4}px`

      const newVars: Record<string, string | number> = {
        ['--p5-rot-delta']: `${rotDelta}deg`,
        ['--p5-skew-delta']: `${skewDelta}deg`,
        ['--p5-scale']: scale,
        ['--p5-tx']: tx,
        ['--p5-ty']: '0px',
        // Cancel both base and delta on the label to keep text readable
        ['--p5-label-rot']: `${2 - rotDelta}deg`,
        ['--p5-label-skew']: `${12 - skewDelta}deg`,
      }
      setStyleVars(newVars)
    }

    const onLeave = () => setStyleVars({})

    return (
      <button
        type="button"
        className="p5-button"
        aria-label={`Open ${label}`}
  style={styleVars as React.CSSProperties}
        onMouseEnter={onEnter}
        onFocus={onEnter}
        onMouseLeave={onLeave}
        onBlur={onLeave}
        onClick={onClick}
      >
        {/* Neon accent rectangles that animate on hover */}
        <span className="p5-accent p5-accent--red" aria-hidden />
        <span className="p5-accent p5-accent--blue" aria-hidden />
        <span className="p5-button__label">{label}</span>
      </button>
    )
  }

  // (No-op) Previously kept debug coords in sync with responsive end position

  // Coordinates string (was shown in debug panel); kept logic but not rendered to avoid vignette overlay


  return (
    <section
      id="projects"
  className={`relative w-full overflow-hidden min-h-[100dvh] ${isDark ? 'bg-black text-white' : 'bg-white text-black'}`}
    >
      {/* Background 3D Canvas */}
      <div className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-1000 ${isModelReady ? 'opacity-100' : 'opacity-0'}`}>
        <Canvas
          camera={{ position: [-2.9, 1.01, 3.5], fov: 50, near: 0.01, far: 100 }}
          dpr={[1, 2]}
          gl={{ antialias: true }}
        >
          {/* Match canvas background to theme to avoid black in light mode */}
          <color attach="background" args={[isDark ? '#000000' : '#ffffff']} />
          {/* Softer lighting for background */}
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 4, 5]} intensity={0.9} />
          <directionalLight position={[-3, -2, -4]} intensity={0.25} />
          <React.Suspense fallback={null}>
            <DarknessModel onLoaded={() => setIsModelReady(true)} />
            {/* Second copy behind the original, nudged forward to close the seam */}
            <group position={[0.95, 0, -1.2]}>
              <DarknessModel />
            </group>
          </React.Suspense>
          {/* Intro camera move from start to end while looking at the requested target */}
          <CameraIntroMove
            key={isMobile ? 'mobile' : 'desktop'}
            from={{ x: START_POS.x, y: START_POS.y, z: START_POS.z }}
            to={{ x: endPos.x, y: endPos.y, z: endPos.z }}
            target={{ x: TARGET.x, y: TARGET.y, z: TARGET.z }}
            duration={1.6}
          />
          <CameraControls enabled={controlsEnabled} onUpdate={() => {}} />
          {pendingMove && (
            <CameraMoveTo
              to={pendingMove.to}
              target={pendingMove.target}
              fov={pendingMove.fov}
              duration={1.2}
              trigger={moveTrigger}
            />
          )}
        </Canvas>
      </div>

      {/* Desktop: left-side Persona 5 style menu */}
      {!isMobile && (
        <aside className="absolute left-0 top-0 h-full z-20 flex items-center pointer-events-auto">
          <div className="ml-6 md:ml-10 space-y-5 select-none">
            <div className="p5-slide-in">
              <div className="p5-badge" aria-hidden>
                <span className="p5-unskew">Projects</span>
              </div>
            </div>
            <nav aria-label="Projects menu" className="flex flex-col gap-3">
              {PROJECT_LABELS.map((label, i) => (
                <div key={label} className="p5-slide-in" style={{ animationDelay: `${0.08 + i * 0.06}s` }}>
                  <P5Button label={label} onClick={() => handleSelect(i)} />
                </div>
              ))}
            </nav>
          </div>
        </aside>
      )}
      {!isMobile && <h2 className="sr-only">Projects</h2>}

      {/* Mobile: keep existing heading and chips */}
      {isMobile && (
        <div className="relative z-20 max-w-6xl mx-auto px-6 py-20 md:py-28">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-6">Projects</h2>
          <div className="mt-8">
            <ChipsCarousel
              isDark={isDark}
              items={PROJECT_LABELS}
              onSelect={handleSelect}
            />
          </div>
        </div>
      )}

      {/* Controls toggle and coordinates */}
      {/*<div className="absolute right-4 top-4 z-30 text-xs sm:text-sm">
        <div className="backdrop-blur-md bg-black/50 text-white rounded-md shadow-lg p-3 w-[280px]">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Camera Controls</span>
            <button
              type="button"
              className={`px-2 py-1 rounded ${controlsEnabled ? 'bg-emerald-500/80 hover:bg-emerald-500' : 'bg-white/10 hover:bg-white/20'}`}
              onClick={() => setControlsEnabled((v) => !v)}
            >
              {controlsEnabled ? 'On' : 'Off'}
            </button>
          </div>
          <p className="opacity-90 mb-2">
            Hold Left: rotate • Right/Ctrl: pan • Wheel: zoom
          </p>
          <div className="font-mono text-[10px] break-words opacity-90 select-all">
            {coordText}
          </div>
        </div>
      </div> */}
    </section>
  )
}

export default Projects
