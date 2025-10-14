import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'

try {
  const stored = window.localStorage.getItem('theme:isDark')
  const isDark = stored === 'true'
  document.body.classList.toggle('bg-black', !!isDark)
  document.body.classList.toggle('bg-white', !isDark)
  document.body.classList.toggle('text-white', !!isDark)
  document.body.classList.toggle('text-black', !isDark)
} catch {
  // ignore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
