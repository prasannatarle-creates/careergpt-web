'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Brain, Loader2 } from 'lucide-react';
import api from '@/lib/api-client';

import AuthPage from '@/app/components/features/AuthPage';
import Sidebar from '@/app/components/features/Sidebar';

const Dashboard = dynamic(() => import('@/app/components/features/Dashboard'), { ssr: false, loading: () => <PageLoader /> });
const Chat = dynamic(() => import('@/app/components/features/Chat'), { ssr: false, loading: () => <PageLoader /> });
const ResumeAnalyzer = dynamic(() => import('@/app/components/features/ResumeAnalyzer'), { ssr: false, loading: () => <PageLoader /> });
const CareerPath = dynamic(() => import('@/app/components/features/CareerPath'), { ssr: false, loading: () => <PageLoader /> });
const MockInterview = dynamic(() => import('@/app/components/features/MockInterview'), { ssr: false, loading: () => <PageLoader /> });
const Jobs = dynamic(() => import('@/app/components/features/Jobs'), { ssr: false, loading: () => <PageLoader /> });
const SavedJobs = dynamic(() => import('@/app/components/features/SavedJobs'), { ssr: false, loading: () => <PageLoader /> });
const LearningCenter = dynamic(() => import('@/app/components/features/LearningCenter'), { ssr: false, loading: () => <PageLoader /> });
const Analytics = dynamic(() => import('@/app/components/features/Analytics'), { ssr: false, loading: () => <PageLoader /> });
const UserProfile = dynamic(() => import('@/app/components/features/UserProfile'), { ssr: false, loading: () => <PageLoader /> });

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
    </div>
  );
}

function App() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(undefined); // undefined = loading, null = guest
  const [page, setPage] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  // Handle hydration - only run client-side logic after mount
 useEffect(() => {
  setMounted(true);

  const token = api.getToken();
  const guest = localStorage.getItem('cgpt_guest');

  if (token) {
    api.get('/profile')
      .then(d => {
        if (d.user) setUser(d.user);
        else {
          api.setToken(null);
          setUser(null);
        }
      })
      .catch(() => {
        api.setToken(null);
        setUser(null);
      });
  } 
  else if (guest === 'true') {
    setUser({ name: 'Guest', role: 'guest' });
  } 
  else {
    setUser(null);
  }

}, []);

  // Show loading during SSR and initial hydration
  if (!mounted || user === undefined) return (
    <div className="h-screen bg-animated-mesh flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 animate-slide-up">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-400 to-teal-400 flex items-center justify-center shadow-lg shadow-cyan-500/25 animate-float">
          <Brain className="w-7 h-7 text-white" />
        </div>
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
          <span className="text-sm text-slate-400">Loading...</span>
        </div>
      </div>
    </div>
  );
  if (user === null) return <AuthPage onAuth={(u) => { setUser(u || { name: 'Guest', role: 'guest' }); }} />;

  const logout = () => {
  api.setToken(null);
  localStorage.removeItem('cgpt_guest');
  setUser(null);
};

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard user={user} onNavigate={setPage} />;
      case 'profile': return <UserProfile user={user} onUpdate={(u) => setUser(u)} />;
      case 'chat': return <Chat />;
      case 'resume': return <ResumeAnalyzer />;
      case 'career': return <CareerPath onNavigate={setPage} user={user} />;
      case 'interview': return <MockInterview />;
      case 'jobs': return <Jobs />;
      case 'savedjobs': return <SavedJobs />;
      case 'learning': return <LearningCenter />;
      case 'analytics': return <Analytics />;
      default: return <Dashboard user={user} onNavigate={setPage} />;
    }
  };

  return (
    <div className="h-screen flex" style={{ background: 'linear-gradient(135deg, #050a18 0%, #0a1628 50%, #0c0f1a 100%)' }}>
      <Sidebar currentPage={page} onNavigate={setPage} user={user.role !== 'guest' ? user : null} onLogout={logout} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="flex-1 overflow-auto custom-scrollbar relative">
        <div className="absolute inset-0 bg-grid-pattern pointer-events-none opacity-40" />
        <div className="relative z-10">{renderPage()}</div>
      </div>
    </div>
  );
}

export default App;
