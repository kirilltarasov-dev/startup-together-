import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary label="App" fallback={<div style={{ color: '#fff', padding: 40, fontFamily: 'monospace' }}>RUNWAY crashed — see console.</div>}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
