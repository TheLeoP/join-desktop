import './assets/main.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import { PopUp } from './components'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <PopUp />
  </React.StrictMode>,
)
