import React, { useEffect, useRef, useState } from 'react'
import { RxHamburgerMenu } from 'react-icons/rx'

const Header: React.FC = () => {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  // Close on outside click / Escape
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!open) return
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <header className="bg-white text-slate-900 w-full">
      <div ref={wrapRef} className="px-6 py-4 flex items-center justify-between relative">
        <h1 className="text-lg font-semibold tracking-tight">
          <a href="#/" className="hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded">
            Justine25-debug
          </a>
        </h1>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center space-x-6" aria-label="Main navigation">
          <a className="text-slate-600 hover:text-slate-900 transition-colors" href="#about">About</a>
          <a className="text-slate-600 hover:text-slate-900 transition-colors" href="#projects">Projects</a>
          <a className="text-slate-600 hover:text-slate-900 transition-colors" href="#/contact">Contact</a>
        </nav>

        {/* Mobile hamburger */}
        <div className="md:hidden">
          <button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center justify-center rounded-md p-2 text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <RxHamburgerMenu className="h-6 w-6" />
          </button>
        </div>

        {/* Mobile dropdown */}
        {open && (
          <div
            id="mobile-menu"
            role="menu"
            aria-label="Mobile navigation"
            className="absolute right-6 top-full mt-2 w-48 rounded-lg border border-slate-200 bg-white shadow-lg z-50 overflow-hidden"
          >
            <a
              href="#about"
              role="menuitem"
              className="block px-4 py-2 text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              About
            </a>
            <a
              href="#projects"
              role="menuitem"
              className="block px-4 py-2 text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              Projects
            </a>
            <a
              href="#/contact"
              role="menuitem"
              className="block px-4 py-2 text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              Contact
            </a>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header
