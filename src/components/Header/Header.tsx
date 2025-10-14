import React, { useEffect, useRef, useState } from 'react'
import { RxHamburgerMenu } from 'react-icons/rx'
import { Link, NavLink } from 'react-router-dom'

type HeaderProps = {
  isDark?: boolean
}

const Header: React.FC<HeaderProps> = ({ isDark = false }) => {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

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
    <header className={`${isDark ? 'bg-black text-white' : 'bg-white text-slate-900'} w-full`}>
      <div ref={wrapRef} className="px-6 py-4 flex items-center justify-between relative">
        <h1 className="text-lg font-semibold tracking-tight">
          <Link to="/" className={`hover:opacity-90 focus:outline-none focus-visible:ring-2 ${isDark ? 'focus-visible:ring-slate-600' : 'focus-visible:ring-slate-400'} rounded`}>
            Justine25-debug
          </Link>
        </h1>

        {/* navigation */}
        <nav className="hidden md:flex items-center space-x-6" aria-label="Main navigation">
          <NavLink
            className={({ isActive }) =>
              `${
                isDark
                  ? isActive
                    ? 'text-white'
                    : 'text-slate-300 hover:text-white'
                  : isActive
                    ? 'text-slate-900'
                    : 'text-slate-600 hover:text-slate-900'
              }`
            }
            to="/projects"
          >
            Projects
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              `${
                isDark
                  ? isActive
                    ? 'text-white'
                    : 'text-slate-300 hover:text-white'
                  : isActive
                    ? 'text-slate-900'
                    : 'text-slate-600 hover:text-slate-900'
              }`
            }
            to="/contact"
          >
            Contact
          </NavLink>
        </nav>

        {/* mobile hamburger */}
        <div className="md:hidden">
          <button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
            className={`inline-flex items-center justify-center rounded-md p-2 ${isDark ? 'text-white' : 'text-black'}`}
          >
            <RxHamburgerMenu className="h-6 w-6" />
          </button>
        </div>

        {/* mobile dropdown */}
        {open && (
          <div
            id="mobile-menu"
            role="menu"
            aria-label="Mobile navigation"
            className={`absolute right-6 top-full mt-2 w-48 rounded-lg border ${isDark ? 'border-white bg-black' : 'border-slate-200 bg-white'} shadow-lg z-50 overflow-hidden`}
          >
            <Link to="/projects" role="menuitem" className={`block px-4 py-2 ${isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'}`} onClick={() => setOpen(false)}>
              Projects
            </Link>
            <Link to="/contact" role="menuitem" className={`block px-4 py-2 ${isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'}`} onClick={() => setOpen(false)}>
              Contact
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header
