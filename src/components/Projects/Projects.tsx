import React from 'react'

type ProjectsProps = {
  isDark?: boolean
}

const Projects: React.FC<ProjectsProps> = ({ isDark = false }) => {
  return (
    <section id="projects" className={`w-full ${isDark ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-6">Projects</h2>
        <p className={`${isDark ? 'text-slate-200' : 'text-slate-700'} leading-relaxed`}>
          PLACEHOLDER
        </p>
      </div>
    </section>
  )
}

export default Projects
