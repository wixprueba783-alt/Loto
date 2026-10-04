import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Para cargar los datos iniciales en Firestore (servicios, galería, etc.),
// descomenta la siguiente línea, corre "pnpm dev" una vez, espera a ver
// "Seed completo ✅" en la consola del navegador, y vuelve a comentarla.
// import './seed';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
