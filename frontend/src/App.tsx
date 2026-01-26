import { AuthProvider } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { useAuth } from "@/hooks/useAuth";
import Admin from "@/pages/Admin";
import Home from "@/pages/Home";
import Layout from "@/pages/Layout";
import Login from "@/pages/Login";
import Manage from "@/pages/Manage";
import Settings from "@/pages/Setting";
import { Toaster } from "react-hot-toast";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Admin Route Component
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.is_superuser) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <Toaster position="top-center" reverseOrder={false} />
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
                <Route index element={<Home />} />
                <Route path="manage" element={<Manage />} />
                <Route path="settings" element={<Settings />} />
                <Route path="admin" element={
                  <AdminRoute>
                    <Admin />
                  </AdminRoute>
                } />
            </Route>
          </Routes>
        </Router>
      </SettingsProvider>
    </AuthProvider>
  );
}
