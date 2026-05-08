import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './auth/AuthContext'
import Login from './pages/Login'
import Atribuidor from './pages/Atribuidor'
import ProtectedRoute from './auth/ProtectedRoute'

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: 1 } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<ProtectedRoute><Atribuidor /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
)
