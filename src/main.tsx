import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import 'mapbox-gl/dist/mapbox-gl.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        {console.log("Corn Intel Build: v1.0.1 - Fixes Applied")}
        <App />
    </React.StrictMode>,
)
