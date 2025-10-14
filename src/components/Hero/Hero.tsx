import React, { useMemo, useRef, useState, useEffect } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import modelUrl from '../../assets/Untitled.glb'
import easterGif from '../../assets/200w.gif'
import explosionSfx from '../../assets/explosion-42132.mp3'

type ModelProps = {
  mouse: { x: number; y: number }
  spinRef: React.MutableRefObject<{ x: number; y: number }>
  draggingRef: React.MutableRefObject<boolean>
  // Increments whenever a click bounce should trigger
  bounceTick: number
  // Increments when tab becomes visible again to reset state/reframe
  resumeTick: number
}

const SCALE_MULTIPLIER = 2 // tweak this for size

function Model({ mouse, spinRef, draggingRef, bounceTick, resumeTick }: ModelProps) {
  const gltf = useLoader(GLTFLoader, modelUrl)
  const group = useRef<THREE.Group>(null!)
  const { camera } = useThree()

  // Compute bounding box center + scale
  const { center, scaleFactor } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(gltf.scene)
    const size = new THREE.Vector3()
    const c = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(c)
    const target = 2.5
    const s = Math.max(size.x, size.y, size.z)
    const scale = s > 0 ? target / s : 1
    return { center: c, scaleFactor: scale }
  }, [gltf.scene])

  // Rotation / movement state
  const baseRot = useRef({ x: 0, y: 0 })
  const spinOffset = useRef({ x: 0, y: 0 })
  const lastActiveRef = useRef<number>(performance.now())
  const resettingRef = useRef(false)
  const targetPos = useRef({ x: 0, y: 0 })
  // Bounce physics state
  const bounce = useRef({ y: 0, v: 0 })
  const didMountRef = useRef(false)

  // Apply an impulse when bounceTick changes (ignore first mount)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    // Impulse for a satisfying bounce
    bounce.current.v += 5
  }, [bounceTick])

  // Mouse controls rotation target
  useEffect(() => {
    baseRot.current.y = THREE.MathUtils.degToRad(20) * mouse.x
    baseRot.current.x = THREE.MathUtils.degToRad(10) * mouse.y
    targetPos.current.x = 0.1 * mouse.x
    targetPos.current.y = 0.05 * mouse.y
  }, [mouse.x, mouse.y])

  // Animate rotation, spin, and reset
  useFrame((_state, delta) => {
    // Clamp delta to avoid giant steps after tab switch/background
    const dt = Math.min(delta, 0.05)
    if (!group.current) return
    const g = group.current
    const frictionBase = 0.92
    const friction = Math.pow(frictionBase, 60 * dt)
    spinOffset.current.x += spinRef.current.x
    spinOffset.current.y += spinRef.current.y
    spinRef.current.x *= friction
    spinRef.current.y *= friction

    const speed = Math.hypot(spinRef.current.x, spinRef.current.y)
    const active = draggingRef.current || speed > 0.0002
    const now = performance.now()

    if (active) {
      resettingRef.current = false
      lastActiveRef.current = now
    } else if (now - lastActiveRef.current > 1000) {
      resettingRef.current = true
    }

    if (resettingRef.current) {
      const resetEase = 1 - Math.pow(0.01, 60 * dt)
      spinOffset.current.x = THREE.MathUtils.lerp(spinOffset.current.x, 0, resetEase)
      spinOffset.current.y = THREE.MathUtils.lerp(spinOffset.current.y, 0, resetEase)
      if (Math.abs(spinOffset.current.x) < 1e-4 && Math.abs(spinOffset.current.y) < 1e-4) {
        spinOffset.current.x = 0
        spinOffset.current.y = 0
        resettingRef.current = false
      }
    }

    const desiredY = baseRot.current.y + spinOffset.current.y
    const desiredX = baseRot.current.x + spinOffset.current.x
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, desiredY, 1 - Math.pow(0.0001, dt))
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, desiredX, 1 - Math.pow(0.0001, dt))
    g.position.x = THREE.MathUtils.lerp(g.position.x, targetPos.current.x, 1 - Math.pow(0.0001, dt))
    g.position.y = THREE.MathUtils.lerp(g.position.y, targetPos.current.y, 1 - Math.pow(0.0001, dt))

    // Update bounce spring (simple damped oscillator)
    const k = 40 // stiffness
    const c = 6 // damping
    const b = bounce.current
    const a = -k * b.y - c * b.v
    b.v += a * dt
    b.y += b.v * dt

    // Apply bounce to scale (uniform) and a slight additional Y offset
    const baseScale = scaleFactor * SCALE_MULTIPLIER
    const scaleBoost = 1 + Math.max(0, b.y) * 0.22
    g.scale.set(baseScale * scaleBoost, baseScale * scaleBoost, baseScale * scaleBoost)
    g.position.y += b.y * 0.05
  })

  const cloned = useMemo(() => gltf.scene.clone(true), [gltf.scene])

  // ✅ Correct camera framing logic
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(gltf.scene)
    const sphere = new THREE.Sphere()
    box.getBoundingSphere(sphere)

    const scaledRadius = sphere.radius * scaleFactor * SCALE_MULTIPLIER
    const persp = camera as THREE.PerspectiveCamera
    const fovRad = THREE.MathUtils.degToRad(persp.fov)
    const distance = scaledRadius / Math.sin(fovRad / 2)

    persp.position.set(0, 0, distance * 0.9)
    persp.near = distance / 100
    persp.far = distance * 10
    persp.updateProjectionMatrix()
  }, [camera, gltf.scene, scaleFactor, resumeTick])

  // Reset physics on resume to avoid NaNs or extreme values after tab switch
  useEffect(() => {
    bounce.current = { y: 0, v: 0 }
    spinOffset.current = { x: 0, y: 0 }
    resettingRef.current = false
    lastActiveRef.current = performance.now()
  }, [resumeTick])

  // ✅ Center pivot properly
  return (
    <group
      ref={group}
      scale={[
        scaleFactor * SCALE_MULTIPLIER,
        scaleFactor * SCALE_MULTIPLIER,
        scaleFactor * SCALE_MULTIPLIER
      ]}
    >
      <group position={[-center.x, -center.y, -center.z]}>
        <primitive object={cloned} />
      </group>
    </group>
  )
}

const Lights: React.FC = () => {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[2, 3, 4]} intensity={0.9} castShadow />
      <directionalLight position={[-3, -2, -4]} intensity={0.3} />
    </>
  )
}

const Hero: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const spinRef = useRef({ x: 0, y: 0 })
  const draggingRef = useRef(false)
  const lastRef = useRef({ x: 0, y: 0 })
  const [showEaster, setShowEaster] = useState(false)
  const clickTimesRef = useRef<number[]>([])
  const [bounceTick, setBounceTick] = useState(0)
  const [resumeTick, setResumeTick] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Prepare the explosion sound
  useEffect(() => {
    if (typeof window === 'undefined') return
    const audio = new Audio(explosionSfx)
    audio.preload = 'auto'
    audioRef.current = audio
  }, [])

  // Play sound whenever the GIF becomes visible
  useEffect(() => {
    if (!showEaster) return
    const a = audioRef.current
    if (a) {
      try {
        a.currentTime = 0
        a.volume = 0.9
        void a.play()
      } catch {
        // ignore play errors (e.g., autoplay policies)
      }
    }
  }, [showEaster])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1
      const y = (e.clientY / window.innerHeight) * 2 - 1
      setMouse({ x, y })
    }
    const handleLeave = () => setMouse({ x: 0, y: 0 })
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseleave', handleLeave)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseleave', handleLeave)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return
      const dx = e.clientX - lastRef.current.x
      const dy = e.clientY - lastRef.current.y
      lastRef.current = { x: e.clientX, y: e.clientY }
      const sensitivity = 0.005
      spinRef.current.y += dx * sensitivity
      spinRef.current.x += dy * sensitivity
    }
    const endDrag = () => {
      draggingRef.current = false
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
    }
  }, [])

  // When returning to the tab, reframe and reset internal physics state
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        setResumeTick((t) => t + 1)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  return (
    <section className="w-full bg-white">
      <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-tight">
              Hi, I'm
            </h1>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-tight">
              Justine Carl Gasque
            </h2>
          </div>

          <div
            ref={containerRef}
            onPointerDown={(e) => {
              draggingRef.current = true
              lastRef.current = { x: e.clientX, y: e.clientY }
            }}
            className="relative h-[420px] sm:h-[480px] md:h-[560px] lg:h-[640px] select-none"
          >
            <Canvas
              camera={{ position: [0, 0, 4], fov: 45, near: 0.1, far: 100 }}
              dpr={[1, 2]}
              onCreated={({ gl }) => {
                // Prevent default so WebGL context can be restored automatically
                gl.domElement.addEventListener('webglcontextlost', (e) => {
                  e.preventDefault()
                })
              }}
            >
              <Lights />
              <Model
                mouse={mouse}
                spinRef={spinRef}
                draggingRef={draggingRef}
                bounceTick={bounceTick}
                resumeTick={resumeTick}
              />
            </Canvas>
            {/* Easter egg overlay */}
            {showEaster && (
              <img
                src={easterGif}
                alt="Easter"
                className="pointer-events-none absolute inset-0 m-auto h-100 w-100 object-contain drop-shadow-lg"
              />
            )}
            {/* Click catcher for triple-press detection */}
            <button
              type="button"
              aria-label="hidden-trigger"
              onClick={() => {
                // Trigger a bounce on single click
                setBounceTick((n) => n + 1)
                const now = performance.now()
                // Keep only clicks in the last 800ms
                clickTimesRef.current = clickTimesRef.current.filter((t) => now - t < 800)
                clickTimesRef.current.push(now)
                if (clickTimesRef.current.length >= 3) {
                  setShowEaster(true)
                  clickTimesRef.current = []
                  window.setTimeout(() => setShowEaster(false), 1500)
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer"
            >
              toggle
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero
