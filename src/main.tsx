import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { XnoStore } from './XnoStore'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <XnoStore />
  </StrictMode>,
)
