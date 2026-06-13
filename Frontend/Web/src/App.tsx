import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HospitalDataProvider } from "./contexts/HospitalDataContext";
import { AuthProvider } from "./hooks/useAuth";
import { AuthGate } from "./auth/AuthGate";
import { LoadingSpinner } from "./components/ui/LoadingSpinner";

// Lazy load all pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const ManagementPortal = lazy(() => import("./pages/ManagementPortal"));
const AdminPortal = lazy(() => import("./pages/AdminPortal"));
const PatientMobileOnly = lazy(() => import("./pages/PatientMobileOnly"));
const DoctorApp = lazy(() => import("./pages/DoctorApp"));
const CheckInKiosk = lazy(() => import("./pages/CheckInKiosk"));
const VideoCallRoom = lazy(() => import("./pages/VideoCallRoom"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <HospitalDataProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/video-call" element={<VideoCallRoom />} />
                <Route path="*" element={
                  <AuthGate>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/management" element={<ManagementPortal />} />
                      <Route path="/admin" element={<AdminPortal />} />
                      <Route path="/patient" element={<PatientMobileOnly />} />
                      <Route path="/patient-mobile" element={<PatientMobileOnly />} />
                      <Route path="/doctor" element={<DoctorApp />} />
                      <Route path="/check-in" element={<CheckInKiosk />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AuthGate>
                } />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </HospitalDataProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
