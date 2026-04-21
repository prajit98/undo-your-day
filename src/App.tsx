import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import NotFound from "./pages/NotFound.tsx";
import { OnboardingGate } from "./components/OnboardingGate";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <UndoProvider>
        <BrowserRouter>
          <OnboardingGate />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/landing" element={<Landing />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/add" element={<AddItem />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </UndoProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
