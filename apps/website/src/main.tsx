import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { checkRemote } from './lib/store.ts'
import './styles/global.css'

const root = document.getElementById('app')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
checkRemote()
