import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Reports from "@/pages/Reports";
import AIScripts from "@/pages/AIScripts";
import Unified from "@/pages/Unified";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/unified" component={Unified} />
      <Route path="/reports" component={Reports} />
      <Route path="/ai-scripts" component={AIScripts} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
