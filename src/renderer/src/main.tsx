import './assets/main.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './util'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'
import { JoinProvider } from './components'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <JoinProvider>
        <RouterProvider router={router} />
      </JoinProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
