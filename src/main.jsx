import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { SimulationProvider } from './context/SimulationContext' // Importe o contexto

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SimulationProvider> {/* Envolva o App aqui */}
      <App />
    </SimulationProvider>
  </React.StrictMode>,
)