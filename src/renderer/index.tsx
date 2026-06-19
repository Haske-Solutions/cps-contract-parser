import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { AppErrorBoundary } from './components/layout/AppErrorBoundary'
import './index.css'
import './lib/dataGrid/data-grid.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
)
