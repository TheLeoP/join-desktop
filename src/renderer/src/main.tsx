import './assets/main.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './util'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'
import { DevicesOnLocalNetworkProvider } from './components'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <DevicesOnLocalNetworkProvider>
        <RouterProvider router={router} />
      </DevicesOnLocalNetworkProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
