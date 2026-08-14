import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Cards from "./pages/Cards";
import Conversation from "./pages/Conversation";
import Diagnostic from "./pages/Diagnostic";
import Grammar from "./pages/Grammar";
import Home from "./pages/Home";
import Listening from "./pages/Listening";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><DashboardLayout><Switch><Route path="/" component={Home} /><Route path="/diagnostic" component={Diagnostic} /><Route path="/grammar" component={Grammar} /><Route path="/conversation" component={Conversation} /><Route path="/listening" component={Listening} /><Route path="/cards" component={Cards} /><Route path="/reports" component={Reports} /><Route path="/settings" component={Settings} /><Route component={Home} /></Switch></DashboardLayout><Toaster richColors position="top-center" /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

export default App;
