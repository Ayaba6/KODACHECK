import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App' // 👈 Extension retirée pour laisser Vite résoudre le fichier proprement

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)