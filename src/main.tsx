import { StrictMode, useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider, useLocation, useNavigate } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import "./index.css";
import { auth, UNAUTHORIZED_EVENT, ApiError } from "./lib/api";
import { Layout } from "./components/Layout";
import { ConfirmProvider } from "./components/ui";
import { LoginPage } from "./pages/Login";
import { HomePage } from "./pages/Home";
import { ConnectPage } from "./pages/Connect";
import { ClientsPage } from "./pages/Clients";
import { ImportPage } from "./pages/Import";
import { CampaignsPage } from "./pages/Campaigns";
import { CampaignEditorPage } from "./pages/CampaignEditor";
import { CampaignDetailPage } from "./pages/CampaignDetail";
import { InboxPage } from "./pages/Inbox";
import { TemplatesPage } from "./pages/Templates";
import { SettingsPage } from "./pages/Settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err) => !(err instanceof ApiError && [401, 403, 404].includes(err.status)) && count < 2,
      refetchOnWindowFocus: true,
      staleTime: 3000,
    },
  },
});

/** Signed in, or off to the sign-in page — and back here afterwards. */
function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const onLost = () => navigate("/login", { replace: true, state: { from: location.pathname } });
    window.addEventListener(UNAUTHORIZED_EVENT, onLost);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onLost);
  }, [navigate, location.pathname]);
  if (!auth.token) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/whatsapp", element: <ConnectPage /> },
      { path: "/clients", element: <ClientsPage /> },
      { path: "/clients/import", element: <ImportPage /> },
      { path: "/campaigns", element: <CampaignsPage /> },
      { path: "/campaigns/new", element: <CampaignEditorPage /> },
      { path: "/campaigns/:id/edit", element: <CampaignEditorPage /> },
      { path: "/campaigns/:id", element: <CampaignDetailPage /> },
      { path: "/inbox", element: <InboxPage /> },
      { path: "/inbox/:key", element: <InboxPage /> },
      { path: "/templates", element: <TemplatesPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfirmProvider>
        <RouterProvider router={router} />
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ style: { fontFamily: "var(--font-sans)", borderRadius: 12 } }}
          theme={document.documentElement.dataset.theme === "dark" ? "dark" : "light"}
        />
      </ConfirmProvider>
    </QueryClientProvider>
  </StrictMode>,
);
