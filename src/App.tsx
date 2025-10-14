import { useEffect, useState } from 'react'
import './App.css'
import Header from './components/Header/Header'
import Hero from './components/Hero/Hero'
import Loader from './components/Loader/Loader'
import Contact from './components/Contact/Contact'
import icongif from './assets/icon.gif'
import { Routes, Route } from 'react-router-dom'
import Projects from './components/Projects/Projects.tsx'
import Footer from './components/Footer/Footer'

function App() {
  const [showLoader, setShowLoader] = useState(true)
  const [isFadingOut, setIsFadingOut] = useState(false)
  const [isHeaderVisible, setIsHeaderVisible] = useState(false)
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const stored = window.localStorage.getItem('theme:isDark')
      return stored === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const MINIMUM_LOADER_DURATION = 2000
    const FADE_DURATION = 500
    const startTime = performance.now()
    let hideTimeoutId: number | undefined
    let fadeTimeoutId: number | undefined

    const finalize = () => {
      const elapsed = performance.now() - startTime
      const remaining = Math.max(MINIMUM_LOADER_DURATION - elapsed, 0)
      hideTimeoutId = window.setTimeout(() => {
        setIsFadingOut(true)
        fadeTimeoutId = window.setTimeout(() => {
          setShowLoader(false)
        }, FADE_DURATION)
      }, remaining)
    }

    if (document.readyState === 'complete') {
      finalize()
    } else {
      window.addEventListener('load', finalize, { once: true })
    }

    return () => {
      if (hideTimeoutId !== undefined) {
        window.clearTimeout(hideTimeoutId)
      }
      if (fadeTimeoutId !== undefined) {
        window.clearTimeout(fadeTimeoutId)
      }
      window.removeEventListener('load', finalize)
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const existing = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
    if (existing) {
      existing.type = 'image/gif'
      existing.href = icongif
    } else {
      const link = document.createElement('link')
      link.rel = 'icon'
      link.type = 'image/gif'
      link.href = icongif
      document.head.appendChild(link)
    }
  }, [])

  useEffect(() => {
    if (!showLoader) {
      const timer = window.setTimeout(() => setIsHeaderVisible(true), 10)
      return () => window.clearTimeout(timer)
    }
    setIsHeaderVisible(false)
    return undefined
  }, [showLoader])

  // Prevent page scroll while loader is visible
  useEffect(() => {
    if (typeof document === 'undefined') return
    const body = document.body
    if (showLoader) {
      body.classList.add('overflow-hidden')
    } else {
      body.classList.remove('overflow-hidden')
    }
    return () => {
      body.classList.remove('overflow-hidden')
    }
  }, [showLoader])

  // persist theme
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem('theme:isDark', String(isDark))
    } catch {
      // ignore persistence errors (e.g., privacy mode)
    }
  }, [isDark])


  return (
    <>
      {showLoader && <Loader isFadingOut={isFadingOut} isDark={isDark} />}
      <div className={`min-h-screen ${isDark ? 'bg-black text-white' : 'bg-white text-black'}`}>
        <div
          className={`transition-[opacity,transform] duration-700 ease-out transform ${
            isHeaderVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <Header isDark={isDark} />
          <Routes>
            <Route path="/" element={<Hero isDark={isDark} />} />
            <Route path="/projects" element={<Projects isDark={isDark} />} />
            <Route path="/contact" element={<Contact isDark={isDark} />} />
            <Route path="*" element={<Hero isDark={isDark} />} />
          </Routes>
        </div>
      </div>
      <Footer isDark={isDark} onToggle={() => setIsDark((v) => !v)} />
    </>
  )
}

export default App
