/*
  Projects section
  - Renders a Three.js scene (GLTF "darkness" model) inside a React Three Fiber Canvas
  - Provides intro and preset camera moves (desktop/mobile)
  - Shows a responsive project menu with playful hover effects
  Notes: Comments are intentionally brief and non-invasive; no runtime behavior changes.
*/
import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react'
import { Canvas, useLoader, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

type ProjectsProps = {
  isDark?: boolean
}

// Loads the GLTF scene and remaps internal resource URLs to Vite-emitted asset URLs
// so textures/bin files referenced by the GLTF resolve correctly in production.
function DarknessModel({ onLoaded }: { onLoaded?: () => void }) {
  // Eagerly import all assets under assets/darkness as URLs
  const files = useMemo(
    () => (import.meta.glob('../../assets/darkness/**/*', { as: 'url', eager: true }) as Record<string, string>),
    []
  )

  const baseKey = '../../assets/darkness/'

  // Helper to map a relative path used by the GLTF to its final URL from Vite
  const toUrl = (rel: string) => files[baseKey + rel] ?? rel

  // Load GLTF and intercept URL requests for dependent resources (bin/textures)
  const gltf = useLoader(GLTFLoader, toUrl('scene.gltf'), (loader) => {
    const mapDependentUrl = (raw: string) => {
      try {
        const u = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
        const path = u.pathname.replace(/\\/g, '/')
        const m = path.match(/(?:^|\/)(scene\.bin|textures\/[^/]+)$/i)
        if (m && m[1]) {
          const mapped = toUrl(m[1])
          if (mapped) return mapped
        }
      } catch {
        const rel = raw.replace(/^\.?\//, '')
        const mapped = toUrl(rel)
        if (mapped) return mapped
      }
      return raw
    }

    loader.manager.setURLModifier((url) => mapDependentUrl(url))
  })

  const { gl } = useThree()
  const isTexture = (v: unknown): v is THREE.Texture => v instanceof THREE.Texture
  // Post-process materials/textures for quality and correctness (anisotropy, color space, grass tweaks)
  useEffect(() => {
    if (!gltf?.scene || !gl) return
    const maxAniso = gl.capabilities.getMaxAnisotropy()
    const targetAniso = Math.min(8, maxAniso)
    gltf.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh
        const baseMat = mesh.material
        if (!baseMat) return
        const materials: THREE.Material[] = Array.isArray(baseMat) ? baseMat : [baseMat]
        type TextureCarrier = THREE.Material & Partial<Record<'map' | 'aoMap' | 'emissiveMap' | 'metalnessMap' | 'roughnessMap' | 'normalMap' | 'specularMap', THREE.Texture>>
        const keys: Array<keyof TextureCarrier> = ['map', 'aoMap', 'emissiveMap', 'metalnessMap', 'roughnessMap', 'normalMap', 'specularMap']
        materials.forEach((m) => {
          m.side = THREE.FrontSide
          ;(m as THREE.Material & { needsUpdate?: boolean }).needsUpdate = true
          const isGrassMat = !!(m.name && m.name.toLowerCase().includes('grass'))
          if (isGrassMat) {
            // Two-sided with alpha-correct settings for cutout-like grass
            m.side = THREE.DoubleSide
            const ms = m as THREE.MeshStandardMaterial & { alphaToCoverage?: boolean }
            ms.alphaTest = Math.max(0.0, Math.min(0.5, ms.alphaTest || 0.45))
            ms.transparent = false
            ms.depthWrite = true
            ms.alphaToCoverage = true
            m.needsUpdate = true
          }
          const mc = m as TextureCarrier
          keys.forEach((key) => {
            const tex = mc[key]
            if (isTexture(tex) && tex.anisotropy !== targetAniso) {
              if (key === 'map') {
                tex.colorSpace = THREE.SRGBColorSpace
              }
              tex.anisotropy = targetAniso
              if (isGrassMat) {
                tex.wrapS = THREE.ClampToEdgeWrapping
                tex.wrapT = THREE.ClampToEdgeWrapping
                tex.generateMipmaps = false
                tex.minFilter = THREE.LinearFilter
                tex.magFilter = THREE.LinearFilter
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
    onLoaded?.()
  }, [gltf.scene, gl, onLoaded])

  const groupRef = React.useRef<THREE.Group>(null!)
  // Fit the model to a target size (compute bounding box and scale/center)
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

  useEffect(() => {
    if (!groupRef.current) return
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
    // Attach OrbitControls to the document body for full-screen interaction
    const el = document.body as HTMLElement
  const controls = new ThreeOrbitControls(camera, el)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.rotateSpeed = 0.6
  controls.zoomSpeed = 0.8
  controls.panSpeed = 2.6
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

// One-off intro camera animation from a start to an end position
function CameraIntroMove({ from, to, target, duration = 1.6 }: { from: Vec3; to: Vec3; target: Vec3; duration?: number }) {
  const { camera } = useThree()
  useEffect(() => {
    const start = new THREE.Vector3(from.x, from.y, from.z)
    const end = new THREE.Vector3(to.x, to.y, to.z)
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

// Generic tweened camera move (re-runs when "trigger" changes)
function CameraMoveTo({ to, target, fov = 50, duration = 1.2, trigger = 0, onUpdate }: { to: Vec3; target: Vec3; fov?: number; duration?: number; trigger?: number; onUpdate?: (c: CameraUpdate) => void }) {
  const { camera } = useThree()
  useEffect(() => {
    const startPos = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z)
    const endPos = new THREE.Vector3(to.x, to.y, to.z)
    const persp = camera as THREE.PerspectiveCamera
    const startFov = persp.fov
    const endFov = fov

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
      camera.position.lerpVectors(startPos, endPos, k)
      const curTarget = new THREE.Vector3().lerpVectors(startTarget, finalTarget, k)
      camera.lookAt(curTarget.x, curTarget.y, curTarget.z)
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
  // Track responsive layout (mobile breakpoint ~640px)
  const getIsMobile = () => (typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false)
  const [isMobile, setIsMobile] = useState<boolean>(getIsMobile())
  // Mobile menu UI state
  // Start closed on mobile (visible on desktop where this state is unused)
  const [mobileExpanded, setMobileExpanded] = useState<boolean>(!getIsMobile())
  const [mobileMenuVisible, setMobileMenuVisible] = useState<boolean>(!getIsMobile())
  const [mobileClosing, setMobileClosing] = useState<boolean>(false)
  const closeTimerRef = useRef<number | undefined>(undefined)
  const openTimerRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(max-width: 640px)')
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile('matches' in e ? e.matches : (e as MediaQueryList).matches)
    setIsMobile(mql.matches)
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

  // Ensure the mobile menu starts closed and auto-opens after 3s when on mobile
  useEffect(() => {
    // Clear any pending timers
    if (openTimerRef.current) {
      window.clearTimeout(openTimerRef.current)
      openTimerRef.current = undefined
    }
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = undefined
    }

    if (isMobile) {
      // Immediately set to closed state (no list rendered)
      setMobileExpanded(false)
      setMobileMenuVisible(false)
      setMobileClosing(false)

      // Auto-open after 3 seconds with slide-in animation
      openTimerRef.current = window.setTimeout(() => {
        setMobileMenuVisible(true)
        setMobileClosing(false)
        setMobileExpanded(true)
        openTimerRef.current = undefined
      }, 3000)
    }

    return () => {
      if (openTimerRef.current) {
        window.clearTimeout(openTimerRef.current)
        openTimerRef.current = undefined
      }
    }
  }, [isMobile])

  // Default camera positions and target
  const START_POS = useMemo(() => ({ x: -2.9, y: 1.01, z: 3.5 }), [])
  const TARGET = useMemo(() => ({ x: -0.07, y: -0.07, z: 0 }), [])
  const END_DESKTOP = useMemo(() => ({ x: -0.90, y: 0.35, z: 1.01 }), [])
  const END_MOBILE = useMemo(() => ({ x: -1.46, y: 0.63, z: 1.69 }), [])
  const endPos = isMobile ? END_MOBILE : END_DESKTOP

  const [controlsEnabled] = useState(false)
  const [isModelReady, setIsModelReady] = useState(false)

  const [moveTrigger, setMoveTrigger] = useState(0)
  const [pendingMove, setPendingMove] = useState<{ to: Vec3; target: Vec3; fov: number } | null>(null)

  const resetTimerRef = useRef<number | undefined>(undefined)
  // After a selection, schedule a gentle return to the default framing
  const scheduleReset = useCallback(() => {
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current)
    resetTimerRef.current = window.setTimeout(() => {
      const mobileNow = getIsMobile()
      const to = mobileNow ? END_MOBILE : END_DESKTOP
      setPendingMove({ to, target: TARGET, fov: 50 })
      setMoveTrigger((n) => n + 1)
    }, 15000) 
  }, [END_DESKTOP, END_MOBILE, TARGET])

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current)
    }
  }, [])

  // Menu items (labels only; wiring to real projects can be added later)
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

  // Toggle mobile menu with staggered slide-in/out animation
  const handleToggleMobileMenu = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = undefined
    }
    if (openTimerRef.current) {
      window.clearTimeout(openTimerRef.current)
      openTimerRef.current = undefined
    }

    if (mobileExpanded) {
      setMobileExpanded(false)
      setMobileClosing(true)
      setMobileMenuVisible(true)
      const count = PROJECT_LABELS.length
      const animMs = 520 
      const baseDelayMs = 60 
      const stepDelayMs = 50 
      const maxDelay = baseDelayMs + (count > 0 ? (count - 1) * stepDelayMs : 0)
      const totalMs = animMs + maxDelay + 40 
      closeTimerRef.current = window.setTimeout(() => {
        setMobileMenuVisible(false)
        setMobileClosing(false)
        closeTimerRef.current = undefined
      }, totalMs)
    } else {
      setMobileMenuVisible(true)
      setMobileClosing(false)
      setMobileExpanded(true)
    }
  }, [mobileExpanded, PROJECT_LABELS.length])

  // Camera presets for mobile (tighter framing, same target)
  const MOBILE_PRESETS: Array<{ to: Vec3; target: Vec3; fov: number }> = useMemo(
    () => [
      { to: { x: -0.22, y: 0.10, z: 0.51 }, target: { x: -0.45, y: 0.02, z: 0.32 }, fov: 50 },
      { to: { x: 0.01, y: 0.10, z: 0.24 }, target: { x: -0.22, y: 0.02, z: 0.05 }, fov: 50 },
      { to: { x: 0.23, y: 0.10, z: -0.04 }, target: { x: 0.01, y: 0.02, z: -0.22 }, fov: 50 },
      { to: { x: 0.46, y: 0.10, z: -0.33 }, target: { x: 0.24, y: 0.02, z: -0.50 }, fov: 50 },
      { to: { x: 0.74, y: 0.10, z: -0.69 }, target: { x: 0.52, y: 0.03, z: -0.86 }, fov: 50 },
      { to: { x: 0.96, y: 0.10, z: -0.97 }, target: { x: 0.74, y: 0.03, z: -1.14 }, fov: 50 },
      { to: { x: 1.18, y: 0.10, z: -1.25 }, target: { x: 0.96, y: 0.03, z: -1.42 }, fov: 50 },
      { to: { x: 1.40, y: 0.10, z: -1.54 }, target: { x: 1.18, y: 0.03, z: -1.71 }, fov: 50 }
    ],
    []
  )

  // Handle project selection -> move camera to preset; auto-reset after a delay
  const handleSelect = useCallback(
    (i: number) => {
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

  // Project button with lighthearted neon hover transforms controlled via CSS variables
  const P5Button: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => {
    const [styleVars, setStyleVars] = useState<Record<string, string | number>>({})

  const onEnter = () => {
      const randSign = () => (Math.random() < 0.5 ? -1 : 1)
      const rotDelta = (Math.random() * 6 + 3) * randSign() // 3..9 deg
      const skewDelta = (Math.random() * 6 + 4) * randSign() // 4..10 deg
  const scale = 1.20 + Math.random() * 0.04
      const tx = `${(Math.random() < 0.5 ? -1 : 1) * 4}px`

      const newVars: Record<string, string | number> = {
        ['--p5-rot-delta']: `${rotDelta}deg`,
        ['--p5-skew-delta']: `${skewDelta}deg`,
        ['--p5-scale']: scale,
        ['--p5-tx']: tx,
        ['--p5-ty']: '0px',
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


  return (
    <section
      id="projects"
  className={`relative w-full overflow-hidden min-h-[100dvh] ${isDark ? 'bg-black text-white' : 'bg-white text-black'}`}
    >
      {/* 3D scene background (fades in when model is ready) */}
      <div className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-1000 ${isModelReady ? 'opacity-100' : 'opacity-0'}`}>
        <Canvas
          camera={{ position: [-2.9, 1.01, 3.5], fov: 50, near: 0.01, far: 100 }}
          dpr={[1, 2]}
          gl={{ antialias: true }}
        >
          <color attach="background" args={[isDark ? '#000000' : '#ffffff']} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 4, 5]} intensity={0.9} />
          <directionalLight position={[-3, -2, -4]} intensity={0.25} />
          <React.Suspense fallback={null}>
            <DarknessModel onLoaded={() => setIsModelReady(true)} />
            {/* A second instance of the model for depth/parallax composition */}
            <group position={[0.95, 0, -1.2]}>
              <DarknessModel />
            </group>
          </React.Suspense>
          {/* Intro and preset camera motion */}
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

      {/* Desktop sidebar menu */}
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

      {/* Mobile bottom-left menu with collapsible list */}
      {isMobile && (
        <aside className="absolute left-0 bottom-20 z-20 pointer-events-auto">
          <div className="ml-4 mb-6 space-y-3 select-none">
            {mobileMenuVisible && (
              <nav
                id="mobile-projects-nav"
                aria-label="Projects menu (mobile)"
                className="flex flex-col gap-3"
              >
                {PROJECT_LABELS.slice().reverse().map((label, idx) => {
                  const i = PROJECT_LABELS.length - 1 - idx
                  const total = PROJECT_LABELS.length
                  const delay = mobileClosing
                    ? 0.06 + (total - 1 - idx) * 0.05
                    : 0.06 + idx * 0.05
                  const cls = mobileClosing ? 'p5-slide-out' : 'p5-slide-in'
                  return (
                    <div key={label} className={cls} style={{ animationDelay: `${delay}s` }}>
                      <P5Button label={label} onClick={() => handleSelect(i)} />
                    </div>
                  )
                })}
              </nav>
            )}
            <div className="p5-slide-in" style={{ animationDelay: `${0.06 + PROJECT_LABELS.length * 0.05}s` }}>
              <button
                type="button"
                className="p5-badge"
                aria-controls="mobile-projects-nav"
                aria-expanded={mobileExpanded}
                onClick={handleToggleMobileMenu}
              >
                <span className="p5-unskew">Projects</span>
              </button>
            </div>
          </div>
        </aside>
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
