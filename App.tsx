import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppProviders } from './contexts/AppProviders';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import MainLayout from './layouts/MainLayout';
import { Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { currentUser, isInitializing } = useAuth();
  const [authPage, setAuthPage] = useState<'login' | 'signup'>('login');

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen bg-ivory dark:bg-warm-gray-900">
        <Loader2 className="animate-spin text-primary-500" size={48} />
      </div>
    );
  }
  
  if (currentUser) {
      return <MainLayout />;
  }

  if (authPage === 'login') {
    return <LoginPage onNavigateToSignUp={() => setAuthPage('signup')} />;
  }

  return <SignUpPage onNavigate={() => setAuthPage('login')} />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppProviders>
        <AppContent />
      </AppProviders>
    </AuthProvider>
  );
}