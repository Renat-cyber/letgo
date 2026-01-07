import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AccountPage from './pages/AccountPage';
import PatternsPage from './pages/PatternsPage';
import SettingsPage from './pages/SettingsPage';
import Sidebar from './components/Sidebar';
import { useAuthStore } from './stores/authStore';

function App() {
  const { token, checkAuth, isLoading } = useAuthStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      await checkAuth();
      setInitialized(true);
    };
    init();
  }, [checkAuth]);

  if (!initialized || isLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-2 border-neon-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neon-blue font-mono">ИНИЦИАЛИЗАЦИЯ...</p>
        </motion.div>
      </div>
    );
  }

  if (!token) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-dark-900 grid-bg flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-6">
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/accounts/:id" element={<AccountPage />} />
            <Route path="/patterns" element={<PatternsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
