import { useEffect, useState } from 'react'
import './App.css'
import Header from './components/Header/Header'
import Hero from './components/Hero/Hero'
import Loader from './components/Loader/Loader'
import Contact from './components/Contact/Contact'
import faviconGif from './assets/3dgifmaker69336.gif'
import { Routes, Route } from 'react-router-dom'
import About from './components/About.tsx'
import Projects from './components/Projects.tsx'

function App() {
  const [showLoader, setShowLoader] = useState(true)
  const [isFadingOut, setIsFadingOut] = useState(false)
  const [isHeaderVisible, setIsHeaderVisible] = useState(false)

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
      existing.href = faviconGif
    } else {
      const link = document.createElement('link')
      link.rel = 'icon'
      link.type = 'image/gif'
      link.href = faviconGif
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

  // Routing is handled by React Router via BrowserRouter in main.tsx

  return (
    <>
      {showLoader && <Loader isFadingOut={isFadingOut} />}
      <div
        className={`transition-all duration-700 ease-out transform ${
          isHeaderVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <Header />
        <Routes>
          <Route path="/" element={<Hero />} />
          <Route path="/about" element={<About />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/contact" element={<Contact />} />
          {/* Fallback to home for unknown paths */}
          <Route path="*" element={<Hero />} />
        </Routes>
      </div>
    </>
  )
}

export default App
