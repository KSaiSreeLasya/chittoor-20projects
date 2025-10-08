import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ProjectForm from "./pages/projects/ProjectForm";
import ProjectDetails from "./pages/projects/ProjectDetails";

const queryClient = new QueryClient();

const Layout = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen flex flex-col">
    <nav className="sticky top-0 z-30 border-b border-emerald-200/70 bg-white/80 backdrop-blur">
      <div className="container flex items-center justify-between py-4">
        <Link to="/" className="flex items-center gap-2">
          <img
            src="https://cdn.builder.io/api/v1/image/assets%2F9cb17e967f804ce2b909c6bc3232a9f0%2F10e852ea23b74053b675e8212f372889?format=webp&width=160"
            alt="AXISO Green Energy"
            className="h-8 w-auto"
          />
          <span className="text-lg font-extrabold tracking-tight text-emerald-900">
            Chittoor Projects
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="rounded-md px-3 py-1.5 text-emerald-800 hover:bg-emerald-50"
          >
            Dashboard
          </Link>
          <Link
            to="/projects/new"
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700"
          >
            New Project
          </Link>
        </div>
      </div>
    </nav>
    <main className="flex-1">{children}</main>
    <footer className="border-t border-emerald-200/70 bg-white/70">
      <div className="container py-4 text-sm text-emerald-800/80">
        © AxisOGreen — Chittoor Projects
      </div>
    </footer>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/projects/new" element={<ProjectForm />} />
            <Route path="/projects/:id" element={<ProjectDetails />} />
            <Route path="/projects/:id/edit" element={<ProjectForm />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

const container = document.getElementById("root")!;
const w = window as unknown as { __app_root?: ReturnType<typeof createRoot> };
if (!w.__app_root) {
  w.__app_root = createRoot(container);
}
w.__app_root.render(<App />);
