import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'
import 'react-toastify/dist/ReactToastify.css'
import '../styles/globals.css'
import { EventsProvider } from './contexts/events-context'
import { SearchContextProvider } from './contexts/search-context'
import { TaskStatusProvider } from './contexts/taskstatus-context'
import AppRouter from './router'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <EventsProvider>
        <TaskStatusProvider>
          <SearchContextProvider>
            <AppRouter />
          </SearchContextProvider>
        </TaskStatusProvider>
      </EventsProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
