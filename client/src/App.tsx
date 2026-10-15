import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Suspense, lazy } from "react";
import { Route, Router, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
const Cards = lazy(() => import("./pages/Cards"));
const Conversation = lazy(() => import("./pages/Conversation"));
const Diagnostic = lazy(() => import("./pages/Diagnostic"));
const Grammar = lazy(() => import("./pages/Grammar"));
const Home = lazy(() => import("./pages/Home"));
const Listening = lazy(() => import("./pages/Listening"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const Writing = lazy(() => import("./pages/Writing"));

function App() {
  const base = import.meta.env.BASE_URL === "/" ? "" : import.meta.env.BASE_URL.replace(/\/$/, "");
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Router base={base}><DashboardLayout><Suspense fallback={null}><Switch><Route path="/" component={Home} /><Route path="/diagnostic" component={Diagnostic} /><Route path="/grammar" component={Grammar} /><Route path="/conversation" component={Conversation} /><Route path="/listening" component={Listening} /><Route path="/writing" component={Writing} /><Route path="/cards" component={Cards} /><Route path="/reports" component={Reports} /><Route path="/settings" component={Settings} /><Route component={Home} /></Switch></Suspense></DashboardLayout></Router><Toaster richColors position="top-center" /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

export default App;
