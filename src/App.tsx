import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { UndoProvider } from "@/context/UndoContext";
import { PremiumProvider } from "@/context/PremiumContext";
import { UpgradeSheet } from "@/components/UpgradeSheet";
import Index from "./pages/Index.tsx";
import AddItem from "./pages/AddItem.tsx";
import Categories from "./pages/Categories.tsx";
import Timeline from "./pages/Timeline.tsx";
import Settings from "./pages/Settings.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import Landing from "./pages/Landing.tsx";
import EarlyAccessConfirmed from "./pages/EarlyAccessConfirmed.tsx";
import Auth from "./pages/Auth.tsx";
import NotFound from "./pages/NotFound.tsx";
import { OnboardingGate } from "./components/OnboardingGate";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <AuthProvider>
        <UndoProvider>
          <PremiumProvider>
            <BrowserRouter>
              <OnboardingGate />
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/landing" element={<Navigate to="/" replace />} />
                <Route path="/early-access-confirmed" element={<EarlyAccessConfirmed />} />
                <Route path="/app" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/add" element={<AddItem />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/timeline" element={<Timeline />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <UpgradeSheet />
            </BrowserRouter>
          </PremiumProvider>
        </UndoProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
