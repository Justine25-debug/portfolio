import React from 'react'

const Header: React.FC = () => {
  return (
  <header className="bg-white text-slate-900 w-full">
      <div className="px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Justine25-debug</h1>
        <nav className="flex items-center space-x-6" aria-label="Main navigation">
          <a className="text-slate-600 hover:text-slate-900 transition-colors" href="#about">About</a>
          <a className="text-slate-600 hover:text-slate-900 transition-colors" href="#projects">Projects</a>
          <a className="text-slate-600 hover:text-slate-900 transition-colors" href="#contact">Contact</a>
        </nav>
      </div>
    </header>
  )
}

export default Header
