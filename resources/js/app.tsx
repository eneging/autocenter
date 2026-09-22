import './bootstrap';
import '../css/app.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth';
import { LoadingScreen, ToastProvider } from './components/ui';
import { WelcomeView } from './Welcome';
import { ServiceDetailView } from './ServiceDetail';
import { QuotePortalView } from './Portal';
import { ComplaintBookView } from './ComplaintBook';
import { ClientPortalView } from './ClientPortal';
const AdminApp = React.lazy(() => import('./admin/AdminShell').then((module) => ({ default: module.AdminApp })));

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<WelcomeView />} />
            <Route path="/servicios/:slug" element={<ServiceDetailView />} />
            <Route path="/portal" element={<QuotePortalView />} />
            <Route path="/libro-de-reclamaciones" element={<ComplaintBookView />} />
            <Route path="/seguimiento/:token" element={<ClientPortalView />} />
            <Route path="/tracking/:token" element={<ClientPortalView />} />
            <Route
              path="/app/*"
              element={
                <AuthProvider>
                  <React.Suspense fallback={<LoadingScreen />}>
                    <AdminApp />
                  </React.Suspense>
                </AuthProvider>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
