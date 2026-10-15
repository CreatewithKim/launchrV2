import { Toaster } from "@/components/ui/sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { LaunchrProvider } from "@/contexts/LaunchrContext";
import { AnalyticsPage, CampaignsPage, CustomerImportPage, CustomersPage, DashboardPage, LeadsPage, OffersPage, ProfilePage, SettingsPage } from "@/pages/LaunchrPages";
import { ConversationsPage } from "@/pages/ConversationsPage";
import { AuthPage } from "@/pages/AuthPage";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function RoutedWorkspace() {
  return (
    <Switch>
      <Route path="/login" component={AuthPage} />
      <Route path="/signup" component={AuthPage} />
      <Route>
        <DashboardLayout>
          <Switch>
            <Route path="/" component={DashboardPage} />
            <Route path="/customers" component={CustomersPage} />
            <Route path="/customers/imports/:id" component={CustomerImportPage} />
            <Route path="/offers" component={OffersPage} />
            <Route path="/campaigns" component={CampaignsPage} />
            <Route path="/conversations" component={ConversationsPage} />
            <Route path="/leads" component={LeadsPage} />
            <Route path="/analytics" component={AnalyticsPage} />
            <Route path="/profile" component={ProfilePage} />
            <Route path="/settings" component={SettingsPage} />
            <Route component={DashboardPage} />
          </Switch>
        </DashboardLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><LaunchrProvider><RoutedWorkspace /><Toaster theme="dark" richColors position="bottom-right" /></LaunchrProvider></ThemeProvider></ErrorBoundary>;
}

export default App;
