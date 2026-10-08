import React from 'react'
import ReactDOM from 'react-dom/client'
import { DesignLab } from './DesignLab'
import { AuthPreview } from './AuthPreview'
import '../index.css'

// Dev-only: served at /lab.html by the Vite dev server. It is not part of the
// production build (only index.html is), so nothing here ever ships.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {location.hash === '#auth' ? <AuthPreview /> : <DesignLab />}
  </React.StrictMode>,
)
