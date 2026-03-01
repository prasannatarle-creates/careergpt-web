'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Brain, Upload, MessageSquare, Target, Sparkles, Send, Plus,
  Trash2, FileText, Loader2, ChevronRight, Briefcase,
  TrendingUp, Zap, ArrowRight, CheckCircle2,
  BarChart3, Rocket, Menu, X, Bot, User, Mic, Compass,
  LogIn, UserPlus, LogOut, Home, Settings, ChevronDown,
  Award, Star, AlertCircle, Eye, EyeOff, Search,
  MapPin, ExternalLink, Clock, Bell, Bookmark, Globe,
  Filter, Building2, XCircle, MoreVertical, Heart,
  Copy, Check, Share2, Edit2, Link2,
  BookOpen, GraduationCap, Download, RefreshCw
} from 'lucide-react';

// ============ HYDRATION-SAFE DATE FORMATTER ============
// Use consistent date format to avoid server/client mismatch
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    // Use ISO format parts for consistency
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return 'N/A';
  }
}

function formatDateTime(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${mins}`;
  } catch {
    return 'N/A';
  }
}

// ============ API HELPER ============
const api = {
  token: null,
  _initialized: false,
  setToken(t) { 
    this.token = t; 
    if (typeof window !== 'undefined') {
      if (t) localStorage.setItem('cgpt_token', t); 
      else localStorage.removeItem('cgpt_token'); 
    }
  },
  getToken() { 
    // Only access localStorage after component mounts (client-side)
    if (!this._initialized && typeof window !== 'undefined') {
      this.token = localStorage.getItem('cgpt_token');
      this._initialized = true;
    }
    return this.token; 
  },
  async fetch(url, options = {}) {
    const headers = { ...options.headers };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    try {
      const res = await fetch(`/api${url}`, { ...options, headers });
      
      // Handle server errors (5xx)
      if (res.status >= 500) {
        const text = await res.text().catch(() => '');
        console.error(`Server error ${res.status} from:`, url, text.substring(0, 200));
        if (res.status === 520) {
          return { error: 'Connection error. Please try again.' };
        }
        return { error: `Server error (${res.status}). Please try again.` };
      }
      
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text().catch(() => '');
        console.error('Non-JSON response from:', url, text.substring(0, 200));
        return { error: 'Unexpected server response. Please try again.' };
      }
      
      const data = await res.json();
    
      return data;
    } catch (err) {
      console.error('API error for:', url, err);
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        return { error: 'Network error. Please check your connection.' };
      }
      return { error: `Request failed: ${err.message}` };
    }
  },
  get(url) { return this.fetch(url); },
  post(url, body) { return this.fetch(url, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }); },
  put(url, body) { return this.fetch(url, { method: 'PUT', body: JSON.stringify(body) }); },
  del(url) { return this.fetch(url, { method: 'DELETE' }); },
};

// ============ AUTH PAGES ============
function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Handle ?verify=TOKEN in URL (email verification link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get('verify');
    if (verifyToken) {
      setVerifying(true);
      setSuccess('Verifying your email...');
      api.post('/auth/verify-email', { token: verifyToken }).then(data => {
        if (data.error) {
          setError(data.error);
          setSuccess('');
        } else if (data.token && data.user) {
          api.setToken(data.token);
          onAuth(data.user);
        } else {
          setSuccess(data.message || 'Email verified! You can now sign in.');
        }
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
      }).catch(err => {
        setError(err.message);
        setSuccess('');
      }).finally(() => setVerifying(false));
    }
  }, []);

  const handleResendVerification = async () => {
    setResending(true);
    setError('');
    try {
      const data = await api.post('/auth/resend-verification', { email: verificationEmail });
      if (data.error) throw new Error(data.error);
      if (data.token && data.user) {
        // Auto-verified (no email provider)
        api.setToken(data.token);
        onAuth(data.user);
        return;
      }
      setSuccess(data.message || 'Verification email sent!');
      setNeedsVerification(false);
    } catch (err) { setError(err.message); }
    finally { setResending(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setNeedsVerification(false);
    setLoading(true);
    try {
      const data = mode === 'register'
        ? await api.post('/auth/register', { name, email, password })
        : await api.post('/auth/login', { email, password });
      if (data.error) {
        if (data.requiresVerification || data.error.includes('not verified')) {
          setNeedsVerification(true);
          setVerificationEmail(data.email || email);
          setError(data.error);
        } else {
          throw new Error(data.error);
        }
        return;
      }
      if (data.requiresVerification && !data.token) {
        // Email provider is configured, user must check email
        setSuccess(data.message);
        setMode('login');
        return;
      }
      if (data.token && data.user) {
        api.setToken(data.token);
        onAuth(data.user);
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-animated-mesh relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl animate-blob" style={{ animationDelay: '2s' }} />
        <div className="absolute -bottom-40 left-1/3 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-blob" style={{ animationDelay: '4s' }} />
        <div className="bg-grid-pattern absolute inset-0" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-400 to-teal-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-cyan-500/20 animate-float">
            <Brain className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Career<span className="text-gradient-cyan">GPT</span></h1>
          <p className="text-slate-400 mt-2 text-sm">AI-Powered Career Guidance Platform</p>
        </div>

        {/* Auth Card */}
        <div className="glass-card-bright p-1 animate-scale-in" style={{ animationDelay: '0.15s' }}>
          <div className="p-7">
            {/* Tab Buttons */}
            <div className="flex gap-1 mb-7 p-1 rounded-xl bg-slate-800/50">
              <Button onClick={() => setMode('login')} variant="ghost" className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-300 ${mode === 'login' ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20' : 'text-slate-400 hover:text-white'}`}>
                <LogIn className="w-4 h-4 mr-2" /> Sign In
              </Button>
              <Button onClick={() => setMode('register')} variant="ghost" className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-300 ${mode === 'register' ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20' : 'text-slate-400 hover:text-white'}`}>
                <UserPlus className="w-4 h-4 mr-2" /> Register
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'register' && (
                <div className="animate-fade-in">
                  <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Full Name</label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" className="input-glass h-11" required />
                </div>
              )}
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Email</label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="input-glass h-11" required />
              </div>
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" className="input-glass h-11 pr-10" required minLength={6} />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-xl animate-scale-in">
                  <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>
                  {needsVerification && (
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resending}
                      className="mt-2 w-full text-center text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg py-2 px-3 transition-all flex items-center justify-center gap-1.5"
                    >
                      {resending ? <><Loader2 className="w-3 h-3 animate-spin" /> Verifying...</> : <><RefreshCw className="w-3 h-3" /> Click here to verify your account</>}
                    </button>
                  )}
                </div>
              )}
              {success && <div className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 p-3 rounded-xl flex items-center gap-2 animate-scale-in"><CheckCircle2 className="w-4 h-4 flex-shrink-0" />{success}</div>}
              {verifying ? (
                <Button disabled className="w-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white border-0 h-12 rounded-xl text-sm font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Verifying Email...
                </Button>
              ) : (
                <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white border-0 h-12 rounded-xl text-sm font-semibold btn-glow shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {mode === 'register' ? 'Create Account' : 'Sign In'}
                </Button>
              )}
            </form>
          </div>
        </div>

        {/* Guest button */}
        <button
          onClick={() => {
            localStorage.setItem('cgpt_guest', 'true');
            onAuth({ name: 'Guest', role: 'guest' });
          }}
          className="mt-6 text-slate-500 hover:text-cyan-400 text-sm flex items-center justify-center gap-2 w-full transition-colors duration-300 group"
        >
          Continue as Guest <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </button>

        {/* Bottom tagline */}
        <div className="mt-8 text-center">
          <p className="text-[11px] text-slate-600 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3 h-3" /> Powered by 5 AI Models
          </p>
        </div>
      </div>
    </div>
  );
}

// ============ SIDEBAR NAVIGATION ============
function Sidebar({ currentPage, onNavigate, user, onLogout, collapsed, onToggle }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, color: 'from-blue-500 to-blue-600', iconColor: 'text-blue-400' },
    { id: 'profile', label: 'My Profile', icon: Settings, color: 'from-slate-500 to-slate-600', iconColor: 'text-slate-400' },
    { id: 'chat', label: 'AI Career Chat', icon: MessageSquare, color: 'from-cyan-500 to-blue-500', iconColor: 'text-cyan-400' },
    { id: 'resume', label: 'Resume Analyzer', icon: FileText, color: 'from-teal-500 to-cyan-500', iconColor: 'text-teal-400' },
    { id: 'career', label: 'Career Path', icon: Compass, color: 'from-amber-500 to-orange-500', iconColor: 'text-amber-400' },
    { id: 'interview', label: 'Mock Interview', icon: Mic, color: 'from-violet-500 to-purple-500', iconColor: 'text-violet-400' },
    { id: 'jobs', label: 'Jobs', icon: Briefcase, color: 'from-green-500 to-emerald-500', iconColor: 'text-green-400' },
    { id: 'savedjobs', label: 'Saved Jobs', icon: Bookmark, color: 'from-yellow-500 to-amber-500', iconColor: 'text-yellow-400' },
    { id: 'learning', label: 'Learning Center', icon: GraduationCap, color: 'from-indigo-500 to-purple-500', iconColor: 'text-indigo-400' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, color: 'from-pink-500 to-rose-500', iconColor: 'text-pink-400' },
  ];

  return (
    <div className={`${collapsed ? 'w-[72px]' : 'w-[260px]'} transition-all duration-300 ease-in-out flex flex-col h-screen relative`} style={{ background: 'rgba(8, 12, 24, 0.95)', borderRight: '1px solid rgba(148, 163, 184, 0.07)' }}>
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 to-transparent pointer-events-none" />
      
      {/* Logo */}
      <div className="p-4 flex items-center gap-3 relative z-10">
        <div
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-cyan-400 to-teal-400 flex items-center justify-center flex-shrink-0 cursor-pointer shadow-lg shadow-cyan-500/15 hover:shadow-cyan-500/25 transition-all duration-300 hover:scale-105"
          onClick={onToggle}
        >
          <Brain className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold text-white animate-fade-in">
            Career<span className="text-gradient-cyan">GPT</span>
          </span>
        )}
      </div>

      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-3 space-y-1 relative z-10 overflow-y-auto custom-scrollbar">
        {navItems.map((item, idx) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group relative ${
                isActive
                  ? 'text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              {/* Active background */}
              {isActive && (
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-500/10 border border-blue-500/20" />
              )}
              {/* Active indicator bar */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b from-blue-400 to-cyan-400" />
              )}
              <div className={`relative z-10 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                isActive ? `bg-gradient-to-br ${item.color} shadow-md` : 'bg-white/[0.04] group-hover:bg-white/[0.08]'
              }`}>
                <item.icon className={`w-[18px] h-[18px] ${isActive ? 'text-white' : item.iconColor} transition-colors`} />
              </div>
              {!collapsed && <span className="relative z-10 font-medium">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />

      {/* User Section */}
      <div className="p-3 relative z-10">
        {user ? (
          <div className={`flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.04] transition-colors ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/15">
              <span className="text-white text-xs font-bold">{user.name?.[0]?.toUpperCase()}</span>
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0 animate-fade-in">
                <p className="text-sm text-white font-medium truncate">{user.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
              </div>
            )}
            {!collapsed && (
              <button onClick={onLogout} className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all">
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          !collapsed && <p className="text-xs text-slate-600 text-center py-2">Guest Mode</p>
        )}
      </div>
    </div>
  );
}

// ============ DASHBOARD ============
function Dashboard({ user, onNavigate }) {
  const [stats, setStats] = useState(null);
  const [profile, setProfile] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      api.get('/profile').then(d => {
        setStats(d.stats);
        setProfile(d.profile);
        setRecentActivity(d.recentActivity || []);
      }).catch(() => {}).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  // Profile completeness — handle arrays (skills/interests) and strings
  const profileFields = profile ? [
    Array.isArray(profile.skills) ? (profile.skills.length > 0 ? 'filled' : '') : (profile.skills || ''),
    Array.isArray(profile.interests) ? (profile.interests.length > 0 ? 'filled' : '') : (profile.interests || ''),
    profile.education || '',
    profile.experience || '',
    profile.careerGoal || '',
    user?.name || '',
  ] : [];
  const filledFields = profileFields.filter(f => typeof f === 'string' && f.trim().length > 0).length;
  const profileCompleteness = profileFields.length > 0 ? Math.round((filledFields / profileFields.length) * 100) : 0;

  // Activity totals
  const totalActivity = stats ? (stats.chatCount || 0) + (stats.resumeCount || 0) + (stats.interviewCount || 0) + (stats.careerPathCount || 0) + (stats.savedJobsCount || 0) + (stats.jobMatchCount || 0) + (stats.learningPathCount || 0) : 0;

  // Smart suggestions based on usage
  const getSuggestions = () => {
    if (!stats) return [];
    const tips = [];
    if (profileCompleteness < 100) tips.push({ text: 'Complete your profile for better AI recommendations', action: 'profile', icon: User, color: 'text-violet-400' });
    if ((stats.resumeCount || 0) === 0) tips.push({ text: 'Upload your resume for ATS scoring & feedback', action: 'resume', icon: FileText, color: 'text-teal-400' });
    if ((stats.interviewCount || 0) === 0) tips.push({ text: 'Practice with an AI mock interview', action: 'interview', icon: Mic, color: 'text-purple-400' });
    if ((stats.careerPathCount || 0) === 0) tips.push({ text: 'Generate a personalized career roadmap', action: 'career', icon: Compass, color: 'text-amber-400' });
    if ((stats.savedJobsCount || 0) === 0) tips.push({ text: 'Search and save jobs to track applications', action: 'livejobs', icon: Briefcase, color: 'text-green-400' });
    if ((stats.chatCount || 0) === 0) tips.push({ text: 'Ask AI for career guidance and advice', action: 'chat', icon: MessageSquare, color: 'text-cyan-400' });
    if ((stats.jobMatchCount || 0) === 0) tips.push({ text: 'Find jobs that match your skills with AI', action: 'jobs', icon: Target, color: 'text-green-400' });
    if ((stats.learningPathCount || 0) === 0) tips.push({ text: 'Discover skill gaps and learning resources', action: 'learning', icon: GraduationCap, color: 'text-indigo-400' });
    return tips.slice(0, 3);
  };

  const features = [
    { id: 'chat', title: 'AI Career Chat', desc: '5-model AI guidance', icon: MessageSquare, color: 'from-blue-500 to-cyan-500', count: stats?.chatCount },
    { id: 'resume', title: 'Resume Analyzer', desc: 'ATS scoring & feedback', icon: FileText, color: 'from-teal-500 to-cyan-500', count: stats?.resumeCount },
    { id: 'career', title: 'Career Path', desc: 'Structured roadmaps', icon: Compass, color: 'from-amber-500 to-orange-500', count: stats?.careerPathCount },
    { id: 'interview', title: 'Mock Interview', desc: 'AI interview practice', icon: Mic, color: 'from-violet-500 to-purple-500', count: stats?.interviewCount },
    { id: 'jobs', title: 'Job Matching', desc: 'AI skill matching', icon: Briefcase, color: 'from-green-500 to-emerald-500', count: stats?.jobMatchCount },
    { id: 'livejobs', title: 'Job Board', desc: 'Live job openings', icon: Globe, color: 'from-emerald-500 to-teal-500' },
    { id: 'savedjobs', title: 'Saved Jobs', desc: 'Track applications', icon: Bookmark, color: 'from-yellow-500 to-amber-500', count: stats?.savedJobsCount },
    { id: 'learning', title: 'Learning Center', desc: 'Skill gap analysis', icon: GraduationCap, color: 'from-indigo-500 to-purple-500', count: stats?.learningPathCount },
    { id: 'analytics', title: 'Analytics', desc: 'Usage insights', icon: BarChart3, color: 'from-pink-500 to-rose-500' },
  ];

  // Activity type to readable label
  const activityLabel = (type) => {
    const labels = {
      'user_login': 'Logged in',
      'resume_analyzed': 'Analyzed a resume',
      'chat_session': 'Chat session',
      'mock_interview': 'Mock interview',
      'career_path_generated': 'Generated career path',
      'job_search': 'Searched for jobs',
      'job_saved': 'Saved a job',
      'job_match': 'Job matching',
      'learning_path': 'Learning path',
      'profile_updated': 'Updated profile',
      'password_changed': 'Changed password',
    };
    return labels[type] || (type || 'Activity').replace(/_/g, ' ');
  };

  const activityIcon = (type) => {
    const icons = {
      'user_login': User,
      'resume_analyzed': FileText,
      'chat_session': MessageSquare,
      'mock_interview': Mic,
      'career_path_generated': Compass,
      'job_search': Globe,
      'job_saved': Bookmark,
      'job_match': Briefcase,
      'learning_path': GraduationCap,
      'profile_updated': User,
    };
    return icons[type] || Zap;
  };

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-full min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        <p className="text-sm text-slate-500">Loading your dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto page-transition">
      {/* Hero Section */}
      <div className="mb-8 relative">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Welcome back</span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold text-white mb-2 tracking-tight">
              {user ? `Hello, ${user.name}` : 'Welcome'}! <span className="inline-block animate-float" style={{ animationDuration: '3s' }}>👋</span>
            </h1>
            <p className="text-slate-400 text-base">Your AI-powered career guidance hub</p>
          </div>
          {/* Profile Completeness Ring */}
          {stats && (
            <div className="hidden md:flex items-center gap-3 glass-card-static px-4 py-3 rounded-xl">
              <div className="relative w-12 h-12">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                  <circle cx="24" cy="24" r="18" fill="none" stroke={profileCompleteness >= 80 ? '#22c55e' : profileCompleteness >= 50 ? '#eab308' : '#ef4444'} strokeWidth="4"
                    strokeDasharray={`${(profileCompleteness / 100) * 113} 113`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{profileCompleteness}%</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-white font-medium">Profile</p>
                <p className="text-[10px] text-slate-400">{profileCompleteness >= 100 ? 'Complete!' : 'Finish setup'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Smart Suggestions */}
      {getSuggestions().length > 0 && (
        <div className="mb-8 animate-slide-up">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" /> Recommended Next Steps
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {getSuggestions().map((tip, i) => (
              <div key={i} onClick={() => onNavigate(tip.action)} className="glass-card cursor-pointer group p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <tip.icon className={`w-4 h-4 ${tip.color}`} />
                </div>
                <p className="text-xs text-slate-300 leading-snug">{tip.text}</p>
                <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-cyan-400 flex-shrink-0 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {stats && (
        <>
          {/* Total Activity Summary */}
          <div className="glass-card-static p-5 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/15">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Total Activity</p>
                <p className="text-[10px] text-slate-400">All-time interactions across all modules</p>
              </div>
            </div>
            <p className="text-3xl font-extrabold text-gradient">{totalActivity}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-10">
            {[
              { label: 'Chat Sessions', value: stats.chatCount, icon: MessageSquare, bgColor: 'bg-cyan-500/10', textColor: 'text-cyan-400' },
              { label: 'Resumes', value: stats.resumeCount, icon: FileText, bgColor: 'bg-teal-500/10', textColor: 'text-teal-400' },
              { label: 'Interviews', value: stats.interviewCount, icon: Mic, bgColor: 'bg-violet-500/10', textColor: 'text-violet-400' },
              { label: 'Career Paths', value: stats.careerPathCount, icon: Compass, bgColor: 'bg-amber-500/10', textColor: 'text-amber-400' },
              { label: 'Job Matches', value: stats.jobMatchCount, icon: Target, bgColor: 'bg-green-500/10', textColor: 'text-green-400' },
              { label: 'Saved Jobs', value: stats.savedJobsCount, icon: Bookmark, bgColor: 'bg-yellow-500/10', textColor: 'text-yellow-400' },
              { label: 'Learning', value: stats.learningPathCount, icon: GraduationCap, bgColor: 'bg-indigo-500/10', textColor: 'text-indigo-400' },
            ].map((s, i) => (
              <div key={i} className="glass-card p-4 group" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-9 h-9 rounded-xl ${s.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    <s.icon className={`w-4 h-4 ${s.textColor}`} />
                  </div>
                </div>
                <p className="text-xl font-bold text-white">{s.value || 0}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Feature Cards */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" /> Quick Actions
        </h2>
        <p className="text-sm text-slate-500 mb-5">Jump into any tool to supercharge your career</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {features.map((f, i) => (
          <div
            key={f.id}
            onClick={() => onNavigate(f.id)}
            className="glass-card cursor-pointer group overflow-hidden relative"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-[0.06] transition-opacity duration-500`} />
            <div className="p-5 relative z-10">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300`}>
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all duration-300" />
              </div>
              <h3 className="text-white font-semibold text-sm mb-0.5">{f.title}</h3>
              <p className="text-slate-400 text-xs leading-relaxed">{f.desc}</p>
              {f.count !== undefined && f.count > 0 && (
                <div className="mt-3">
                  <span className="badge-primary text-[10px]">
                    <CheckCircle2 className="w-3 h-3" /> {f.count} {f.id === 'savedjobs' ? 'saved' : 'completed'}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div className="glass-card-static mb-10 animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <div className="p-5 pb-0 flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-cyan-400" />
              </div>
              Recent Activity
            </h3>
            <span className="text-[10px] text-slate-500">Last {recentActivity.length} events</span>
          </div>
          <div className="p-5">
            <div className="space-y-2">
              {recentActivity.slice(0, 8).map((event, i) => {
                const IconComp = activityIcon(event.type);
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                      <IconComp className="w-4 h-4 text-cyan-400" />
                    </div>
                    <span className="text-xs text-slate-300 flex-1 capitalize">{activityLabel(event.type)}</span>
                    <span className="text-[10px] text-slate-500">{formatDateTime(event.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* AI Models Status */}
      <div className="glass-card-static p-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
        <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-purple-400" />
          </div>
          AI Models Connected
        </h3>
        <div className="flex flex-wrap gap-3">
            {[
              { name: 'GPT-4.1', color: '#10a37f', status: 'active' },
              { name: 'Claude 4 Sonnet', color: '#d97706', status: 'active' },
              { name: 'Gemini 2.5 Flash', color: '#4285f4', status: 'active' },
              { name: 'Grok 3 Mini', color: '#ef4444', status: 'beta' },
              { name: 'Perplexity Sonar', color: '#22d3ee', status: 'beta' },
            ].map(m => (
              <div key={m.name} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all duration-300 hover:scale-[1.02]" style={{ borderColor: m.color + '25', backgroundColor: m.color + '08' }}>
                <div className={`w-2 h-2 rounded-full ${m.status === 'active' ? 'animate-pulse' : 'opacity-40'}`} style={{ backgroundColor: m.color }} />
                <span className="text-sm font-medium" style={{ color: m.color }}>{m.name}</span>
                {m.status === 'beta' && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium border border-amber-500/20">BETA</span>}
              </div>
            ))}
          </div>
        </div>
    </div>
  );
}

// ============ AI CHAT (enhanced) ============
function AIChat() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const exportRef = useRef(null);

  // Enhanced state
  const [showModels, setShowModels] = useState(false);
  const [activeModels, setActiveModels] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(null);
  const [showIndividual, setShowIndividual] = useState(null);
  const [renamingSession, setRenamingSession] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    api.get('/chat/sessions').then(d => setSessions((d.sessions || []).filter(s => s.type === 'career-chat')));
    api.get('/models').then(d => {
      if (d.models) {
        setAvailableModels(d.models);
        setActiveModels(d.models.map(m => m.name));
      }
    });
  }, []);

  // Close export dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (exportRef.current && !exportRef.current.contains(e.target)) setShowExport(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadSession = async (id) => {
    const d = await api.get(`/chat/sessions/${id}`);
    setActiveSession(id);
    setMessages(d.session?.messages || []);
  };

  const toggleModel = (name) => {
    setActiveModels(prev => {
      if (prev.includes(name)) {
        if (prev.length <= 1) return prev;
        return prev.filter(n => n !== name);
      }
      return [...prev, name];
    });
  };

  const copyMessage = (content, idx) => {
    navigator.clipboard.writeText(content);
    setCopiedMsg(idx);
    setTimeout(() => setCopiedMsg(null), 2000);
  };

  const exportChat = async (format) => {
    if (!activeSession) return;
    try {
      const res = await fetch(`/api/chat/export-${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api.getToken()}` },
        body: JSON.stringify({ sessionId: activeSession })
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `career-chat.${format === 'markdown' ? 'md' : 'html'}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) { console.error('Export failed:', e); }
    setShowExport(false);
  };

  const shareChat = async () => {
    if (!activeSession) return;
    const d = await api.post('/chat/create-share', { sessionId: activeSession });
    if (d.shareCode) {
      navigator.clipboard.writeText(window.location.origin + '/api/shared-chat/' + d.shareCode);
      setCopiedMsg('share');
      setTimeout(() => setCopiedMsg(null), 3000);
    }
    setShowExport(false);
  };

  const renameSession = async (id) => {
    if (!renameValue.trim()) { setRenamingSession(null); return; }
    await api.post('/chat/rename-session', { sessionId: id, title: renameValue.trim() });
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: renameValue.trim() } : s));
    setRenamingSession(null);
    setRenameValue('');
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim(); setInput(''); setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: msg, timestamp: new Date().toISOString() }]);
    try {
      const d = await api.post('/chat/send', { sessionId: activeSession, message: msg, activeModels });
      if (d.error) throw new Error(d.error);
      if (!activeSession) setActiveSession(d.sessionId);
      setMessages(prev => [...prev, { role: 'assistant', content: d.response, timestamp: new Date().toISOString(), models: d.models, failedModels: d.failedModels, synthesized: d.synthesized, individualResponses: d.individualResponses }]);
      api.get('/chat/sessions').then(d2 => setSessions((d2.sessions || []).filter(s => s.type === 'career-chat')));
    } catch (e) { setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}`, isError: true }]); }
    finally { setLoading(false); }
  };

  const filteredSessions = sessions.filter(s => !searchQuery || s.title?.toLowerCase().includes(searchQuery.toLowerCase()));

  const quickPrompts = [
    { icon: '\uD83D\uDE80', text: 'Top AI & tech careers in 2026?' },
    { icon: '\uD83D\uDCB0', text: 'How to negotiate a higher salary?' },
    { icon: '\uD83C\uDFAF', text: 'Build a 90-day career transition plan' },
    { icon: '\uD83E\uDDE0', text: 'Most in-demand skills for remote work' },
    { icon: '\uD83C\uDFA4', text: 'How to ace behavioral interviews?' },
    { icon: '\uD83D\uDCCA', text: 'Career roadmap for data science' },
  ];

  return (
    <div className="flex h-full">
      {/* Session Sidebar */}
      <div className="w-72 flex flex-col h-full relative" style={{ background: 'rgba(8, 12, 24, 0.6)', borderRight: '1px solid rgba(148, 163, 184, 0.07)' }}>
        <div className="p-4 space-y-3">
          <Button onClick={() => { setActiveSession(null); setMessages([]); }} className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-0 rounded-xl h-10 btn-glow shadow-lg shadow-blue-500/15" size="sm" data-testid="new-chat-btn">
            <Plus className="w-4 h-4 mr-2" /> New Conversation
          </Button>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search chats..." className="input-glass h-8 rounded-lg pl-9 text-xs" />
          </div>
        </div>

        {/* Model Selector */}
        <button onClick={() => setShowModels(!showModels)} className="mx-4 mb-2 flex items-center justify-between text-[10px] text-slate-400 hover:text-slate-300 uppercase tracking-wider font-medium px-1 transition-colors">
          <span>AI Models ({activeModels.length}/{availableModels.length})</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${showModels ? 'rotate-180' : ''}`} />
        </button>
        {showModels && (
          <div className="mx-4 mb-3 space-y-1 animate-slide-up">
            {availableModels.map(m => (
              <button key={m.name} onClick={() => toggleModel(m.name)} className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all ${activeModels.includes(m.name) ? 'bg-white/[0.06] text-white' : 'text-slate-500 hover:bg-white/[0.03]'}`}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: activeModels.includes(m.name) ? m.color : '#475569' }} />
                <span className="truncate flex-1 text-left">{m.name}</span>
                {m.guaranteed && <span className="text-[8px] text-emerald-400 flex-shrink-0">\u25CF</span>}
              </button>
            ))}
          </div>
        )}

        <div className="px-4 mb-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Recent Chats</p>
        </div>
        <ScrollArea className="flex-1 px-3">
          {filteredSessions.length === 0 && (
            <p className="text-xs text-slate-600 text-center py-4">{searchQuery ? 'No matching chats' : 'No conversations yet'}</p>
          )}
          {filteredSessions.map(s => (
            <div key={s.id} onClick={() => { if (renamingSession !== s.id) loadSession(s.id); }} className={`p-3 rounded-xl cursor-pointer mb-1.5 flex items-center justify-between group transition-all duration-200 ${activeSession === s.id ? 'bg-blue-600/15 border border-blue-500/20' : 'hover:bg-white/[0.03]'}`}>
              <div className="min-w-0 flex-1">
                {renamingSession === s.id ? (
                  <input value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') renameSession(s.id); if (e.key === 'Escape') setRenamingSession(null); }} onBlur={() => renameSession(s.id)} autoFocus className="text-xs text-slate-200 bg-transparent border-b border-blue-500/50 outline-none w-full" />
                ) : (
                  <p className="text-xs text-slate-200 truncate font-medium" onDoubleClick={() => { setRenamingSession(s.id); setRenameValue(s.title || ''); }}>{s.title}</p>
                )}
                <p className="text-[10px] text-slate-500 mt-0.5">{formatDate(s.updatedAt)}</p>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={(e) => { e.stopPropagation(); setRenamingSession(s.id); setRenameValue(s.title || ''); }} className="text-slate-500 hover:text-blue-400 p-1 rounded-lg hover:bg-blue-500/10 transition-all" title="Rename">
                  <Edit2 className="w-3 h-3" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); api.del(`/chat/sessions/${s.id}`); if (activeSession === s.id) { setActiveSession(null); setMessages([]); } setSessions(prev => prev.filter(x => x.id !== s.id)); }} className="text-slate-500 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition-all" title="Delete">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col relative">
        <div className="absolute inset-0 bg-grid-pattern pointer-events-none opacity-50" />

        {/* Chat header bar */}
        {activeSession && messages.length > 0 && (
          <div className="relative z-10 flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.07)' }}>
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-medium text-white truncate max-w-[300px]">{sessions.find(s => s.id === activeSession)?.title || 'Chat'}</h3>
              <Badge className="bg-slate-800/80 text-slate-400 text-[10px] border-slate-700/50">{messages.filter(m => m.role === 'user').length} messages</Badge>
            </div>
            <div className="flex items-center gap-2" ref={exportRef}>
              <div className="relative">
                <Button onClick={() => setShowExport(!showExport)} variant="ghost" size="sm" className="text-slate-400 hover:text-white h-8 px-3 rounded-lg hover:bg-white/[0.05]">
                  <Share2 className="w-3.5 h-3.5 mr-1.5" /> Export
                </Button>
                {showExport && (
                  <div className="absolute right-0 top-full mt-1 w-52 glass-card-bright rounded-xl p-2 z-50 animate-slide-up" style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
                    <button onClick={() => exportChat('markdown')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.05] text-sm text-slate-300 transition-colors">
                      <FileText className="w-4 h-4 text-emerald-400" /> Export Markdown
                    </button>
                    <button onClick={() => exportChat('html')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.05] text-sm text-slate-300 transition-colors">
                      <Globe className="w-4 h-4 text-blue-400" /> Export HTML
                    </button>
                    <Separator className="my-1 bg-slate-700/30" />
                    <button onClick={shareChat} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.05] text-sm text-slate-300 transition-colors">
                      <Link2 className="w-4 h-4 text-purple-400" /> {copiedMsg === 'share' ? '\u2713 Link Copied!' : 'Copy Share Link'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1 p-4 relative z-10">
          {messages.length === 0 ? (
            <div className="max-w-xl mx-auto mt-16 text-center animate-slide-up">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-400 to-teal-400 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-cyan-500/20 animate-float">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">CareerGPT Chat</h2>
              <p className="text-slate-400 text-sm mb-2">Powered by {activeModels.length} AI model{activeModels.length !== 1 ? 's' : ''} for comprehensive career advice</p>
              <div className="flex justify-center flex-wrap gap-2 mb-8">
                {availableModels.filter(m => activeModels.includes(m.name)).map(m => (
                  <span key={m.name} className="text-[9px] px-2 py-0.5 rounded-full" style={{ backgroundColor: m.color + '15', color: m.color, border: `1px solid ${m.color}20` }}>{m.name}</span>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {quickPrompts.map((q, i) => (
                  <button key={i} onClick={() => setInput(q.text)} className="text-left p-4 rounded-xl border border-slate-700/50 bg-slate-900/30 hover:bg-slate-800/50 hover:border-cyan-500/20 text-slate-300 text-sm transition-all duration-300 group backdrop-blur-sm">
                    <span className="text-lg mb-1.5 block">{q.icon}</span>
                    <span>{q.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-5">
              {messages.filter(m => !m.hidden).map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''} animate-slide-up`} style={{ animationDelay: `${i * 30}ms` }}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0 mt-1 shadow-md shadow-blue-500/15">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 group/msg relative ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/15'
                      : msg.isError
                        ? 'bg-red-900/30 border border-red-700/30 text-red-200'
                        : 'glass-card-static text-slate-200'
                  }`}>
                    {/* Copy button */}
                    <button onClick={() => copyMessage(msg.content, i)} className="absolute -top-2 -right-2 opacity-0 group-hover/msg:opacity-100 transition-all bg-slate-800 border border-slate-700/50 rounded-lg p-1.5 hover:bg-slate-700 z-10" title="Copy">
                      {copiedMsg === i ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                    </button>

                    {msg.role === 'assistant' ? (
                      <div className="prose prose-invert prose-sm max-w-none [&>*]:text-slate-200 [&>p]:text-slate-200 [&>h1]:text-white [&>h2]:text-white [&>h3]:text-cyan-300 [&>strong]:text-cyan-300 [&>li]:text-slate-200 [&>ul]:text-slate-200 [&>ol]:text-slate-200 [&>code]:bg-slate-700/50 [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded-md [&>pre]:bg-slate-800/80 [&>pre]:rounded-xl [&>pre]:border [&>pre]:border-slate-700/50">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    )}

                    {/* Timestamp */}
                    {msg.timestamp && (
                      <p className="text-[9px] text-slate-500 mt-2">{formatDateTime(msg.timestamp)}</p>
                    )}

                    {/* Model badges + individual responses */}
                    {msg.models && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-700/30">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {msg.synthesized && <Badge className="bg-cyan-500/15 text-cyan-300 border-cyan-500/20 text-[9px] px-2 py-0.5 rounded-full">SYNTHESIZED</Badge>}
                          {msg.models.map((m, j) => <span key={j} className="text-[9px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (m.color || '#888') + '15', color: m.color || '#888', border: `1px solid ${(m.color || '#888')}20` }}>{m.name || m}</span>)}
                          {(msg.failedModels || []).map((f, j) => <span key={'f'+j} className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">\u2715 {f.name}</span>)}
                        </div>
                        {/* Individual model responses toggle */}
                        {msg.individualResponses && msg.individualResponses.length > 1 && (
                          <button onClick={() => setShowIndividual(showIndividual === i ? null : i)} className="mt-2 text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors">
                            <Eye className="w-3 h-3" />
                            {showIndividual === i ? 'Hide' : 'View'} individual responses ({msg.individualResponses.length})
                          </button>
                        )}
                        {showIndividual === i && msg.individualResponses && (
                          <div className="mt-3 space-y-2 animate-slide-up">
                            {msg.individualResponses.map((ir, k) => (
                              <div key={k} className="rounded-xl p-3 bg-slate-900/50 border border-slate-700/30">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ir.color }} />
                                  <span className="text-[10px] font-medium" style={{ color: ir.color }}>{ir.name}</span>
                                  <span className="text-[9px] text-slate-500 ml-auto">{ir.duration}ms</span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed">{ir.preview}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700/50 flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-4 h-4 text-slate-300" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-md shadow-blue-500/15">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="glass-card-static rounded-2xl px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                      </div>
                      <span className="text-xs text-slate-400">Consulting {activeModels.length} AI model{activeModels.length !== 1 ? 's' : ''}...</span>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      {availableModels.filter(m => activeModels.includes(m.name)).map(m => (
                        <span key={m.name} className="text-[8px] px-1.5 py-0.5 rounded-full animate-pulse" style={{ backgroundColor: m.color + '15', color: m.color }}>{m.name.split(' ')[0]}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="relative z-10 p-4" style={{ borderTop: '1px solid rgba(148, 163, 184, 0.07)' }}>
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Ask about careers, skills, interviews, salary..."
                  className="input-glass h-12 rounded-xl pr-4 text-sm"
                  disabled={loading}
                  maxLength={2000}
                />
              </div>
              <Button onClick={sendMessage} disabled={!input.trim() || loading} className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-0 rounded-xl h-12 w-12 p-0 btn-glow shadow-lg shadow-blue-500/15 hover:shadow-blue-500/25">
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between mt-1.5 px-1">
              <p className="text-[9px] text-slate-600">{activeModels.length} model{activeModels.length !== 1 ? 's' : ''} active \u2022 Enter to send</p>
              <p className={`text-[9px] ${input.length > 1800 ? 'text-amber-400' : 'text-slate-600'}`}>{input.length}/2000</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ RESUME ANALYZER (ATS) ============
function ResumeAnalyzer() {
  const [file, setFile] = useState(null);
  const [targetRole, setTargetRole] = useState('');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(-1);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const fileRef = useRef(null);

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['.pdf', '.txt', '.md', '.docx'];

  // Fetch resume history
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const d = await api.get('/resumes');
      if (d.resumes) setHistory(d.resumes);
    } catch (e) { console.error('Failed to load history:', e); }
    finally { setLoadingHistory(false); }
  };

  useEffect(() => { loadHistory(); }, []);

  const validateFile = (f) => {
    if (!f) return 'No file selected';
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!ALLOWED_TYPES.includes(ext)) return `Unsupported file type. Accepted: ${ALLOWED_TYPES.join(', ')}`;
    if (f.size > MAX_FILE_SIZE) return `File too large (${(f.size / 1024 / 1024).toFixed(1)}MB). Maximum: 5MB`;
    return null;
  };

  const handleFileSelect = (f) => {
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setError(''); setFile(f);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
  };

  const analyze = async () => {
    if (!file) return;
    const valErr = validateFile(file);
    if (valErr) { setError(valErr); return; }
    setError(''); setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const up = await api.post('/resume/upload', fd);
      if (up.error) throw new Error(up.error);
      setUploading(false); setAnalyzing(true);
      const an = await api.post('/resume/analyze', { resumeId: up.resumeId, targetRole });
      if (an.error) throw new Error(an.error);
      setAnalysis(an.analysis);
      loadHistory(); // refresh history
    } catch (e) { setError(e.message); }
    finally { setUploading(false); setAnalyzing(false); }
  };

  const loadPastAnalysis = async (resumeId) => {
    try {
      const d = await api.get(`/resumes/${resumeId}`);
      if (d.resume?.analysis) {
        setAnalysis(d.resume.analysis);
        setShowHistory(false);
      }
    } catch (e) { console.error(e); }
  };

  const copyBullet = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(-1), 2000);
  };

  const downloadPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const a = analysis;
    let y = 20;

    doc.setFontSize(20);
    doc.setTextColor(0, 120, 200);
    doc.text('CareerGPT Resume Analysis Report', 20, y); y += 12;

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`ATS Score: ${a.atsScore || 'N/A'}/100`, 20, y); y += 8;
    doc.text(`Experience Level: ${a.experienceLevel || 'N/A'}`, 20, y); y += 8;
    if (a.wordCount) { doc.text(`Word Count: ${a.wordCount} (~${a.pageEstimate || 1} page${(a.pageEstimate||1)>1?'s':''})`, 20, y); y += 8; }
    y += 2;

    if (a.sections) {
      doc.setFontSize(12);
      doc.setTextColor(0, 80, 150);
      doc.text('Section Scores:', 20, y); y += 7;
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      Object.entries(a.sections).forEach(([key, sec]) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${sec.score}/100 - ${sec.feedback || ''}`, 25, y); y += 6;
      });
      y += 4;
    }

    if (a.keywords) {
      doc.setFontSize(12);
      doc.setTextColor(0, 80, 150);
      doc.text('Keywords Found:', 20, y); y += 7;
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text((a.keywords.found || []).join(', '), 25, y, { maxWidth: 160 }); y += 8;
      doc.setTextColor(200, 0, 0);
      doc.text('Missing: ' + (a.keywords.missing || []).join(', '), 25, y, { maxWidth: 160 }); y += 10;
    }

    if (a.atsChecklist) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setTextColor(0, 80, 150);
      doc.text('ATS Compatibility Checklist:', 20, y); y += 7;
      doc.setFontSize(10);
      a.atsChecklist.forEach(c => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setTextColor(c.passed ? 0 : 200, c.passed ? 150 : 0, 0);
        doc.text(`${c.passed ? '✓' : '✗'} ${c.item}`, 25, y); y += 5;
        doc.setTextColor(120, 120, 120);
        doc.text(`  → ${c.tip}`, 30, y); y += 6;
      });
      y += 4;
    }

    if (a.strengths) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setTextColor(0, 150, 0);
      doc.text('Strengths:', 20, y); y += 7;
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      (a.strengths || []).forEach(s => { doc.text(`• ${s}`, 25, y); y += 6; });
      y += 4;
    }

    if (a.weaknesses) {
      doc.setFontSize(12);
      doc.setTextColor(200, 150, 0);
      doc.text('Areas to Improve:', 20, y); y += 7;
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      (a.weaknesses || []).forEach(w => { if (y > 270) { doc.addPage(); y = 20; } doc.text(`• ${w}`, 25, y); y += 6; });
      y += 4;
    }

    if (a.rewrittenBullets && a.rewrittenBullets.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setTextColor(0, 80, 150);
      doc.text('Improved Bullet Points:', 20, y); y += 7;
      doc.setFontSize(9);
      a.rewrittenBullets.forEach(b => {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setTextColor(200, 0, 0);
        doc.text(`Before: ${b.original}`, 25, y, { maxWidth: 155 }); y += 5;
        doc.setTextColor(0, 150, 0);
        doc.text(`After: ${b.improved}`, 25, y, { maxWidth: 155 }); y += 8;
      });
    }

    if (a.overallFeedback) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setTextColor(0, 80, 150);
      doc.text('Overall Feedback:', 20, y); y += 7;
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(a.overallFeedback, 160);
      doc.text(lines, 25, y);
    }

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by CareerGPT - AI-Powered Career Guidance', 20, 285);

    doc.save('CareerGPT_Resume_Analysis.pdf');
  };

  // Score color helper
  const scoreColor = (s) => s >= 70 ? 'text-green-400' : s >= 50 ? 'text-yellow-400' : 'text-red-400';
  const scoreBorder = (s) => s >= 70 ? '#22c55e' : s >= 50 ? '#eab308' : '#ef4444';
  const scoreBg = (s) => s >= 70 ? 'bg-green-500/15 border-green-500/20' : s >= 50 ? 'bg-yellow-500/15 border-yellow-500/20' : 'bg-red-500/15 border-red-500/20';

  // History panel
  if (showHistory) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto page-transition">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Resume History</h1>
          <Button onClick={() => setShowHistory(false)} variant="outline" className="border-slate-600/30 text-slate-300 hover:bg-slate-800/30 rounded-xl">
            <ArrowRight className="w-4 h-4 mr-2 rotate-180" />Back
          </Button>
        </div>
        {loadingHistory ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
        ) : history.length === 0 ? (
          <div className="glass-card-static p-10 text-center">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No past analyses found. Upload a resume to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((r, i) => (
              <div key={r.id || i} className="glass-card-static p-4 flex items-center justify-between hover:bg-white/[0.04] transition-colors cursor-pointer" onClick={() => r.analysis ? loadPastAnalysis(r.id) : null}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{r.fileName || 'Untitled Resume'}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-slate-500">{formatDate(r.createdAt)}</span>
                      {r.targetRole && <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/20 text-[10px]">{r.targetRole}</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {r.analysis?.atsScore != null && (
                    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center`} style={{ borderColor: scoreBorder(r.analysis.atsScore) }}>
                      <span className={`text-sm font-bold ${scoreColor(r.analysis.atsScore)}`}>{r.analysis.atsScore}</span>
                    </div>
                  )}
                  {r.analysis ? <ChevronRight className="w-4 h-4 text-slate-500" /> : <span className="text-xs text-slate-600">No analysis</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (analysis) {
    const a = analysis;
    const isRaw = a.raw;
    const sd = a.structuredData;
    const checklistPassed = (a.atsChecklist || []).filter(c => c.passed).length;
    const checklistTotal = (a.atsChecklist || []).length;

    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto page-transition">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Resume Analysis</h1>
          <div className="flex gap-2">
            {!isRaw && <Button onClick={downloadPDF} variant="outline" className="border-green-600/30 text-green-300 hover:bg-green-900/20 rounded-xl"><FileText className="w-4 h-4 mr-2" />Download PDF</Button>}
            <Button onClick={() => setShowHistory(true)} variant="outline" className="border-blue-600/30 text-blue-300 hover:bg-blue-900/20 rounded-xl"><Clock className="w-4 h-4 mr-2" />History</Button>
            <Button onClick={() => { setAnalysis(null); setFile(null); }} variant="outline" className="border-slate-600/30 text-slate-300 hover:bg-slate-800/30 rounded-xl">Analyze Another</Button>
          </div>
        </div>

        {isRaw ? (
          <div className="glass-card-static p-6"><div className="prose prose-invert max-w-none [&>*]:text-slate-200 [&>p]:text-slate-200 [&>h1]:text-white [&>h2]:text-white [&>h3]:text-cyan-300 [&>strong]:text-cyan-300 [&>li]:text-slate-200"><ReactMarkdown remarkPlugins={[remarkGfm]}>{a.overallFeedback || JSON.stringify(a)}</ReactMarkdown></div></div>
        ) : (
          <div className="space-y-6">
            {/* ATS Score + Quick Stats */}
            <div className="glass-card-bright">
              <div className="p-6">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                  <div className="relative w-28 h-28 flex-shrink-0">
                    <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                      <circle cx="60" cy="60" r="52" fill="none" stroke={scoreBorder(a.atsScore)} strokeWidth="8"
                        strokeDasharray={`${(a.atsScore / 100) * 327} 327`} strokeLinecap="round" className="transition-all duration-1000" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-bold text-white">{a.atsScore}</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-white">ATS Score: {a.atsScore}/100</h2>
                    <p className="text-slate-400 text-sm mt-1">{a.experienceLevel ? `Experience Level: ${a.experienceLevel}` : ''}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(a.matchingRoles || []).slice(0, 3).map((r, i) => <Badge key={i} className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">{r}</Badge>)}
                    </div>
                  </div>
                  {/* Quick stats */}
                  <div className="grid grid-cols-2 gap-3 text-center">
                    {a.wordCount && (
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                        <p className="text-lg font-bold text-white">{a.wordCount}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Words</p>
                      </div>
                    )}
                    {a.pageEstimate && (
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                        <p className="text-lg font-bold text-white">{a.pageEstimate}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{a.pageEstimate > 1 ? 'Pages' : 'Page'}</p>
                      </div>
                    )}
                    {sd?.totalExperienceYears != null && (
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                        <p className="text-lg font-bold text-white">{sd.totalExperienceYears}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Yrs Exp</p>
                      </div>
                    )}
                    {sd?.skills?.length > 0 && (
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                        <p className="text-lg font-bold text-white">{sd.skills.length}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Skills</p>
                      </div>
                    )}
                  </div>
                </div>
                {/* Focus area & seniority badges */}
                {sd && (
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/[0.05]">
                    {sd.focusArea && <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/20 text-xs"><Sparkles className="w-3 h-3 mr-1" />{sd.focusArea}</Badge>}
                    {sd.seniority && <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/20 text-xs"><Award className="w-3 h-3 mr-1" />{sd.seniority} level</Badge>}
                    {sd.certifications?.length > 0 && <Badge className="bg-green-500/15 text-green-300 border-green-500/20 text-xs"><Star className="w-3 h-3 mr-1" />{sd.certifications.length} certification{sd.certifications.length > 1 ? 's' : ''}</Badge>}
                  </div>
                )}
              </div>
            </div>

            {/* Readability Score */}
            {a.readability && (
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white flex items-center gap-2"><Eye className="w-4 h-4 text-cyan-400" />Readability</h3></div>
                <div className="p-5">
                  <div className="flex items-center gap-4 mb-3">
                    <div className={`px-3 py-1 rounded-lg text-sm font-semibold ${scoreBg(a.readability.score)}`}>
                      {a.readability.score}/100 — {a.readability.level}
                    </div>
                    {a.readability.avgSentenceLength && <span className="text-xs text-slate-500">Avg sentence: {a.readability.avgSentenceLength} words</span>}
                  </div>
                  {a.readability.suggestions?.length > 0 && (
                    <div className="space-y-1">
                      {a.readability.suggestions.map((s, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <Sparkles className="w-3 h-3 text-cyan-400 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-slate-400">{s}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ATS Compatibility Checklist */}
            {a.atsChecklist && a.atsChecklist.length > 0 && (
              <div className="glass-card-static">
                <div className="p-5 pb-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-white flex items-center gap-2"><Target className="w-4 h-4 text-cyan-400" />ATS Compatibility Checklist</h3>
                    <Badge className={`${checklistPassed >= checklistTotal * 0.7 ? 'bg-green-500/15 text-green-300 border-green-500/20' : checklistPassed >= checklistTotal * 0.5 ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20' : 'bg-red-500/15 text-red-300 border-red-500/20'} text-xs`}>{checklistPassed}/{checklistTotal} passed</Badge>
                  </div>
                </div>
                <div className="p-5 space-y-2">
                  {a.atsChecklist.map((c, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${c.passed ? 'bg-green-500/[0.03] border-green-500/10' : 'bg-red-500/[0.03] border-red-500/10'}`}>
                      {c.passed ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />}
                      <div>
                        <p className={`text-sm ${c.passed ? 'text-green-300' : 'text-red-300'}`}>{c.item}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{c.tip}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sections */}
            {a.sections && (
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white flex items-center gap-2"><BarChart3 className="w-4 h-4 text-cyan-400" />Section-by-Section Analysis</h3></div>
                <div className="p-5 space-y-3">
                  {Object.entries(a.sections).map(([key, sec]) => (
                    <div key={key} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white capitalize">{key}</span>
                        <div className="flex items-center gap-2">
                          {sec.present ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                          <span className={`text-sm font-bold ${scoreColor(sec.score)}`}>{sec.score}/100</span>
                        </div>
                      </div>
                      <Progress value={sec.score} className="h-1.5 mb-1" />
                      <p className="text-xs text-slate-400">{sec.feedback}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Keywords */}
            {a.keywords && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="glass-card-static">
                    <div className="p-5 pb-0"><h3 className="text-sm font-semibold text-green-400 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Keywords Found ({(a.keywords.found||[]).length})</h3></div>
                    <div className="p-5"><div className="flex flex-wrap gap-1.5">{(a.keywords.found || []).map((k, i) => <Badge key={i} className="bg-green-500/15 text-green-300 border-green-500/20 text-xs">{k}</Badge>)}</div></div>
                  </div>
                  <div className="glass-card-static">
                    <div className="p-5 pb-0"><h3 className="text-sm font-semibold text-red-400 flex items-center gap-2"><XCircle className="w-4 h-4" />Missing Keywords ({(a.keywords.missing||[]).length})</h3></div>
                    <div className="p-5"><div className="flex flex-wrap gap-1.5">{(a.keywords.missing || []).map((k, i) => <Badge key={i} className="bg-red-500/15 text-red-300 border-red-500/20 text-xs">{k}</Badge>)}</div></div>
                  </div>
                </div>
                {/* Keyword Suggestions */}
                {a.keywords.suggestions && a.keywords.suggestions.length > 0 && (
                  <div className="glass-card-static">
                    <div className="p-5 pb-0"><h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2"><Sparkles className="w-4 h-4" />Keyword Suggestions</h3></div>
                    <div className="p-5 space-y-2">
                      {a.keywords.suggestions.map((s, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <Zap className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-slate-300">{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Rewritten Bullets with Copy */}
            {a.rewrittenBullets && a.rewrittenBullets.length > 0 && (
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white flex items-center gap-2"><Edit2 className="w-4 h-4 text-cyan-400" />Improved Bullet Points</h3></div>
                <div className="p-5 space-y-3">
                  {a.rewrittenBullets.map((b, i) => (
                    <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] group">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-red-300 line-through mb-1.5">{b.original}</p>
                          <p className="text-xs text-green-300 font-medium">{b.improved}</p>
                          <p className="text-[10px] text-slate-500 mt-1.5 italic">{b.reason}</p>
                        </div>
                        <button onClick={() => copyBullet(b.improved, i)} className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors flex-shrink-0 opacity-60 group-hover:opacity-100" title="Copy improved bullet">
                          {copiedIdx === i ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strengths / Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-sm font-semibold text-green-400 flex items-center gap-2"><TrendingUp className="w-4 h-4" />Strengths</h3></div>
                <div className="p-5">{(a.strengths || []).map((s, i) => <div key={i} className="flex gap-2 mb-2"><CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /><span className="text-xs text-slate-300 leading-relaxed">{s}</span></div>)}</div>
              </div>
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" />Areas to Improve</h3></div>
                <div className="p-5">{(a.weaknesses || []).map((w, i) => <div key={i} className="flex gap-2 mb-2"><AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" /><span className="text-xs text-slate-300 leading-relaxed">{w}</span></div>)}</div>
              </div>
            </div>

            {/* Structured Data - Skills & Experience */}
            {sd?.skills?.length > 0 && (
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white flex items-center gap-2"><Zap className="w-4 h-4 text-cyan-400" />Detected Skills</h3></div>
                <div className="p-5"><div className="flex flex-wrap gap-1.5">{sd.skills.map((s, i) => <Badge key={i} className="bg-cyan-500/10 text-cyan-300 border-cyan-500/20 text-xs">{s}</Badge>)}</div></div>
              </div>
            )}

            {a.overallFeedback && (
              <div className="glass-card-static p-6"><p className="text-slate-300 text-sm leading-relaxed">{a.overallFeedback}</p></div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto page-transition">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Resume Analyzer & ATS Scorer</h1>
          <p className="text-sm text-slate-400">Upload your resume and get AI-powered ATS analysis</p>
        </div>
        {history.length > 0 && (
          <Button onClick={() => setShowHistory(true)} variant="outline" className="border-blue-600/30 text-blue-300 hover:bg-blue-900/20 rounded-xl">
            <Clock className="w-4 h-4 mr-2" />History ({history.length})
          </Button>
        )}
      </div>
      <div className="glass-card overflow-hidden">
        <div className="p-6 space-y-5">
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${
              dragActive ? 'border-cyan-400/60 bg-cyan-500/10 scale-[1.02]' :
              file ? 'border-green-500/40 bg-green-500/5' : 'border-slate-600/40 hover:border-cyan-500/30 hover:bg-cyan-500/5'
            }`}
          >
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.txt,.md,.docx" onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
            {file ? (
              <div className="animate-scale-in">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-white font-semibold text-lg">{file.name}</p>
                <p className="text-slate-400 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                <p className="text-slate-500 text-[10px] mt-2">Click or drop to change file</p>
              </div>
            ) : (
              <>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-colors ${dragActive ? 'bg-cyan-500/20' : 'bg-slate-800/50'}`}>
                  <Upload className={`w-7 h-7 ${dragActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                </div>
                <p className="text-white font-medium">{dragActive ? 'Drop your resume here' : 'Drop resume here or click to browse'}</p>
                <p className="text-slate-500 text-xs mt-1">PDF, DOCX, TXT supported • Max 5MB</p>
              </>
            )}
          </div>
          <div>
            <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Target Role (optional)</label>
            <Input value={targetRole} onChange={e => setTargetRole(e.target.value)} placeholder="e.g., Software Engineer, Data Scientist" className="input-glass h-11" />
          </div>
          {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</p>}
          <Button onClick={analyze} disabled={!file || uploading || analyzing} className="w-full bg-gradient-to-r from-teal-600 to-cyan-500 text-white border-0 h-12 rounded-xl btn-glow shadow-lg shadow-teal-500/15">
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Uploading...</> : analyzing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Analyzing with AI...</> : <><Target className="w-4 h-4 mr-2" />Analyze Resume</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============ CAREER PATH GENERATOR ============
function CareerPath({ onNavigate }) {
  const [skills, setSkills] = useState('');
  const [interests, setInterests] = useState('');
  const [education, setEducation] = useState('');
  const [experience, setExperience] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [completedGoals, setCompletedGoals] = useState({});
  const [expandedPhase, setExpandedPhase] = useState(0);

  // Load history
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const d = await api.get('/career-paths');
      if (d.paths) setHistory(d.paths);
    } catch (e) { console.error(e); }
    finally { setLoadingHistory(false); }
  };

  useEffect(() => { loadHistory(); }, []);

  const generate = async () => {
    setLoading(true); setError('');
    try {
      const d = await api.post('/career-path/generate', { skills, interests, education, experience, targetRole, location });
      if (d.error) throw new Error(d.error);
      setResult(d);
      loadHistory();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const toggleGoal = (phaseIdx, goalIdx) => {
    const key = `${phaseIdx}-${goalIdx}`;
    setCompletedGoals(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const downloadPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const cp = result.careerPath;
    let y = 20;

    doc.setFontSize(20); doc.setTextColor(0, 120, 200);
    doc.text('CareerGPT Career Path Report', 20, y); y += 12;

    doc.setFontSize(16); doc.setTextColor(0, 0, 0);
    doc.text(cp.title || 'Career Path', 20, y); y += 8;

    if (cp.matchScore) { doc.setFontSize(12); doc.text(`Match Score: ${cp.matchScore}%`, 20, y); y += 8; }

    if (cp.summary) {
      doc.setFontSize(10); doc.setTextColor(60, 60, 60);
      const sumLines = doc.splitTextToSize(cp.summary, 160);
      doc.text(sumLines, 20, y); y += sumLines.length * 5 + 5;
    }

    if (cp.timeline) {
      doc.setFontSize(13); doc.setTextColor(0, 80, 150);
      doc.text('Career Roadmap', 20, y); y += 8;
      cp.timeline.forEach(phase => {
        if (y > 255) { doc.addPage(); y = 20; }
        doc.setFontSize(11); doc.setTextColor(0, 60, 120);
        doc.text(`${phase.phase} (${phase.duration})`, 25, y); y += 6;
        doc.setFontSize(9); doc.setTextColor(60, 60, 60);
        (phase.goals || []).forEach(g => { doc.text(`• ${g}`, 30, y); y += 5; });
        if (phase.skills) { doc.text(`Skills: ${phase.skills.join(', ')}`, 30, y); y += 5; }
        if (phase.milestone) { doc.setTextColor(0, 130, 0); doc.text(`Milestone: ${phase.milestone}`, 30, y); y += 5; }
        y += 3;
      });
    }

    if (cp.salaryRange) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(13); doc.setTextColor(0, 80, 150);
      doc.text('Salary Ranges', 20, y); y += 8;
      doc.setFontSize(10); doc.setTextColor(60, 60, 60);
      Object.entries(cp.salaryRange).forEach(([k, v]) => { doc.text(`${k}: ${v}`, 25, y); y += 6; });
      y += 4;
    }

    if (cp.skillGaps) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(13); doc.setTextColor(0, 80, 150);
      doc.text('Skill Gaps to Address', 20, y); y += 8;
      doc.setFontSize(10); doc.setTextColor(60, 60, 60);
      cp.skillGaps.forEach(sg => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`• ${sg.skill} (${sg.importance}): ${sg.howToLearn}`, 25, y); y += 6;
      });
      y += 4;
    }

    if (cp.industryOutlook) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(13); doc.setTextColor(0, 80, 150);
      doc.text('Industry Outlook', 20, y); y += 8;
      doc.setFontSize(10); doc.setTextColor(60, 60, 60);
      const olLines = doc.splitTextToSize(cp.industryOutlook, 160);
      doc.text(olLines, 25, y);
    }

    doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text('Generated by CareerGPT - AI-Powered Career Guidance', 20, 285);
    doc.save('CareerGPT_Career_Path.pdf');
  };

  // History panel
  if (showHistory) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto page-transition">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Career Path History</h1>
          <Button onClick={() => setShowHistory(false)} variant="outline" className="border-slate-600/30 text-slate-300 hover:bg-slate-800/30 rounded-xl">
            <ArrowRight className="w-4 h-4 mr-2 rotate-180" />Back
          </Button>
        </div>
        {loadingHistory ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
        ) : history.length === 0 ? (
          <div className="glass-card-static p-10 text-center">
            <Compass className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No past career paths found. Generate one to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((h, i) => (
              <div key={h.id || i} className="glass-card-static p-4 flex items-center justify-between hover:bg-white/[0.04] transition-colors cursor-pointer" onClick={() => { setResult({ careerPath: h.result }); setShowHistory(false); }}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Compass className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{h.result?.title || 'Career Path'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">{formatDate(h.createdAt)}</span>
                      {h.input?.targetRole && <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/20 text-[10px]">{h.input.targetRole}</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {h.result?.matchScore && (
                    <Badge className="bg-green-500/15 text-green-300 border-green-500/20 text-xs">{h.result.matchScore}%</Badge>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (result) {
    const cp = result.careerPath;
    const isRaw = cp.raw;
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto page-transition">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">{cp.title || 'Career Path'}</h1>
          <div className="flex gap-2 flex-wrap">
            {!isRaw && <Button onClick={downloadPDF} variant="outline" className="border-green-600/30 text-green-300 hover:bg-green-900/20 rounded-xl"><FileText className="w-4 h-4 mr-2" />Download PDF</Button>}
            {onNavigate && <Button onClick={() => onNavigate('learning')} variant="outline" className="border-indigo-600/30 text-indigo-300 hover:bg-indigo-900/20 rounded-xl"><GraduationCap className="w-4 h-4 mr-2" />Create Learning Plan</Button>}
            <Button onClick={() => setShowHistory(true)} variant="outline" className="border-blue-600/30 text-blue-300 hover:bg-blue-900/20 rounded-xl"><Clock className="w-4 h-4 mr-2" />History</Button>
            <Button onClick={() => setResult(null)} variant="outline" className="border-slate-600/30 text-slate-300 hover:bg-slate-800/30 rounded-xl">Generate Another</Button>
          </div>
        </div>

        {isRaw ? (
          <div className="glass-card-static p-6"><div className="prose prose-invert max-w-none [&>*]:text-slate-200 [&>p]:text-slate-200 [&>h1]:text-white [&>h2]:text-white [&>h3]:text-cyan-300 [&>strong]:text-cyan-300 [&>li]:text-slate-200"><ReactMarkdown remarkPlugins={[remarkGfm]}>{cp.summary}</ReactMarkdown></div></div>
        ) : (
          <div className="space-y-6">
            {/* Summary + Match Score + Day in Life */}
            <div className="glass-card-bright">
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    {cp.summary && <p className="text-slate-300 leading-relaxed mb-3">{cp.summary}</p>}
                    {cp.dayInLife && (
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">A Day in This Career</p>
                        <p className="text-xs text-slate-400 leading-relaxed">{cp.dayInLife}</p>
                      </div>
                    )}
                  </div>
                  {cp.matchScore && (
                    <div className="flex-shrink-0 text-center">
                      <div className="relative w-20 h-20">
                        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                          <circle cx="40" cy="40" r="34" fill="none" stroke={cp.matchScore >= 70 ? '#22c55e' : cp.matchScore >= 50 ? '#eab308' : '#ef4444'} strokeWidth="6"
                            strokeDasharray={`${(cp.matchScore / 100) * 214} 214`} strokeLinecap="round" className="transition-all duration-1000" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xl font-bold text-white">{cp.matchScore}%</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Match Score</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Market Demand */}
            {cp.marketDemand && (
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-cyan-400" />Market Demand</h3></div>
                <div className="p-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] text-center">
                      <p className={`text-lg font-bold ${cp.marketDemand.level === 'high' ? 'text-green-400' : cp.marketDemand.level === 'medium' ? 'text-yellow-400' : 'text-red-400'}`}>{cp.marketDemand.level?.toUpperCase()}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Demand</p>
                    </div>
                    {cp.marketDemand.growthRate && (
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] text-center">
                        <p className="text-lg font-bold text-cyan-400">{cp.marketDemand.growthRate}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Growth</p>
                      </div>
                    )}
                    {cp.marketDemand.remoteAvailability && (
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] text-center">
                        <p className={`text-lg font-bold ${cp.marketDemand.remoteAvailability === 'high' ? 'text-green-400' : cp.marketDemand.remoteAvailability === 'medium' ? 'text-yellow-400' : 'text-red-400'}`}>{cp.marketDemand.remoteAvailability?.toUpperCase()}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Remote</p>
                      </div>
                    )}
                    {cp.marketDemand.topLocations?.length > 0 && (
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] text-center">
                        <p className="text-sm font-bold text-white">{cp.marketDemand.topLocations.slice(0, 2).join(', ')}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Top Locations</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Skill Gaps */}
            {cp.skillGaps && cp.skillGaps.length > 0 && (
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400" />Skill Gaps to Address</h3></div>
                <div className="p-5 space-y-2">
                  {cp.skillGaps.map((sg, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${sg.importance === 'critical' ? 'bg-red-500/[0.03] border-red-500/10' : sg.importance === 'important' ? 'bg-amber-500/[0.03] border-amber-500/10' : 'bg-slate-500/[0.03] border-slate-500/10'}`}>
                      <div className="flex-shrink-0 mt-0.5">
                        {sg.importance === 'critical' ? <AlertCircle className="w-4 h-4 text-red-400" /> : sg.importance === 'important' ? <AlertCircle className="w-4 h-4 text-amber-400" /> : <Star className="w-4 h-4 text-slate-400" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{sg.skill}</span>
                          <Badge className={`text-[9px] ${sg.importance === 'critical' ? 'bg-red-500/15 text-red-300 border-red-500/20' : sg.importance === 'important' ? 'bg-amber-500/15 text-amber-300 border-amber-500/20' : 'bg-slate-700/50 text-slate-400 border-slate-600/20'}`}>{sg.importance}</Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{sg.howToLearn}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline with Progress Tracking */}
            {cp.timeline && (
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white flex items-center gap-2"><Rocket className="w-4 h-4 text-cyan-400" />Career Roadmap</h3></div>
                <div className="p-5 space-y-4">
                  {cp.timeline.map((phase, i) => {
                    const phaseGoals = phase.goals || [];
                    const completedCount = phaseGoals.filter((_, j) => completedGoals[`${i}-${j}`]).length;
                    const isExpanded = expandedPhase === i;
                    return (
                      <div key={i} className="relative pl-8 pb-2 border-l-2 border-cyan-500/30 last:border-0">
                        <div className={`absolute -left-2.5 top-0 w-5 h-5 rounded-full flex items-center justify-center shadow-lg ${completedCount === phaseGoals.length && phaseGoals.length > 0 ? 'bg-green-500 shadow-green-500/30' : 'bg-gradient-to-br from-cyan-400 to-blue-500 shadow-cyan-500/30'}`}>
                          {completedCount === phaseGoals.length && phaseGoals.length > 0 ? <Check className="w-3 h-3 text-white" /> : <span className="text-[9px] text-white font-bold">{i + 1}</span>}
                        </div>
                        <div className="cursor-pointer" onClick={() => setExpandedPhase(isExpanded ? -1 : i)}>
                          <div className="flex items-center justify-between">
                            <h3 className="text-white font-semibold text-sm">{phase.phase}</h3>
                            <div className="flex items-center gap-2">
                              {phaseGoals.length > 0 && <span className="text-[10px] text-slate-500">{completedCount}/{phaseGoals.length} goals</span>}
                              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                          <p className="text-cyan-400 text-xs">{phase.duration}</p>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 space-y-3 animate-slide-up">
                            {/* Goals with checkboxes */}
                            {phaseGoals.length > 0 && (
                              <div className="space-y-1.5">
                                {phaseGoals.map((g, j) => (
                                  <div key={j} className="flex items-start gap-2 group cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleGoal(i, j); }}>
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${completedGoals[`${i}-${j}`] ? 'bg-green-500 border-green-500' : 'border-slate-600 group-hover:border-cyan-500'}`}>
                                      {completedGoals[`${i}-${j}`] && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <span className={`text-xs leading-relaxed transition-all ${completedGoals[`${i}-${j}`] ? 'text-slate-500 line-through' : 'text-slate-300'}`}>{g}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Milestone */}
                            {phase.milestone && (
                              <div className="p-2.5 rounded-lg bg-green-500/[0.05] border border-green-500/10">
                                <p className="text-[10px] text-green-400 uppercase tracking-wider mb-0.5">Milestone</p>
                                <p className="text-xs text-green-300">{phase.milestone}</p>
                              </div>
                            )}

                            {/* Skills */}
                            {phase.skills && (
                              <div className="flex flex-wrap gap-1.5">
                                {phase.skills.map((s, j) => <Badge key={j} className="bg-blue-500/15 text-blue-300 border-blue-500/20 text-[10px]">{s}</Badge>)}
                              </div>
                            )}

                            {/* Resources with links */}
                            {phase.resources && phase.resources.length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Resources</p>
                                {phase.resources.map((r, j) => {
                                  const res = typeof r === 'string' ? { name: r } : r;
                                  return (
                                    <div key={j} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.03]">
                                      {res.type === 'course' ? <Award className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" /> : res.type === 'book' ? <FileText className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" /> : res.type === 'project' ? <Rocket className="w-3.5 h-3.5 text-green-400 flex-shrink-0" /> : <Globe className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />}
                                      <span className="text-xs text-slate-300 flex-1">{res.name}</span>
                                      {res.free != null && <Badge className={`text-[8px] ${res.free ? 'bg-green-500/15 text-green-300 border-green-500/20' : 'bg-amber-500/15 text-amber-300 border-amber-500/20'}`}>{res.free ? 'Free' : 'Paid'}</Badge>}
                                      {res.url && <a href={res.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-1 rounded hover:bg-white/[0.05]"><ExternalLink className="w-3 h-3 text-cyan-400" /></a>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Salary & Top Roles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cp.salaryRange && (
                <div className="glass-card-static">
                  <div className="p-5 pb-0"><h3 className="text-sm font-semibold text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-400" />Salary Ranges</h3></div>
                  <div className="p-5 space-y-2">
                    {Object.entries(cp.salaryRange).map(([k, v]) => (
                      <div key={k} className="flex justify-between items-center p-2 rounded-lg bg-white/[0.02]">
                        <span className="text-slate-400 text-sm capitalize">{k}</span>
                        <span className="text-green-400 text-sm font-semibold">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {cp.certifications && cp.certifications.length > 0 && (
                <div className="glass-card-static">
                  <div className="p-5 pb-0"><h3 className="text-sm font-semibold text-white flex items-center gap-2"><Award className="w-4 h-4 text-amber-400" />Certifications</h3></div>
                  <div className="p-5 space-y-2.5">
                    {cp.certifications.map((c, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Award className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-300">{c.name || c}</span>
                            {c.priority && <Badge className={`text-[9px] ${c.priority === 'high' ? 'bg-red-500/15 text-red-300 border-red-500/20' : c.priority === 'medium' ? 'bg-amber-500/15 text-amber-300 border-amber-500/20' : 'bg-slate-700/50 text-slate-400 border-slate-600/20'}`}>{c.priority}</Badge>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {c.provider && <span className="text-[10px] text-slate-500">{c.provider}</span>}
                            {c.cost && <span className="text-[10px] text-slate-500">• {c.cost}</span>}
                            {c.duration && <span className="text-[10px] text-slate-500">• {c.duration}</span>}
                          </div>
                        </div>
                        {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-white/[0.05]"><ExternalLink className="w-3 h-3 text-cyan-400" /></a>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Top Roles */}
            {cp.topRoles && cp.topRoles.length > 0 && (
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white flex items-center gap-2"><Briefcase className="w-4 h-4 text-cyan-400" />Top Roles to Target</h3></div>
                <div className="p-5 space-y-2">
                  {cp.topRoles.map((r, i) => {
                    const role = typeof r === 'string' ? { title: r } : r;
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                          <Briefcase className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-white">{role.title}</span>
                          {role.description && <p className="text-xs text-slate-400 mt-0.5">{role.description}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {role.avgSalary && <span className="text-xs text-green-400 font-medium">{role.avgSalary}</span>}
                          {role.demand && <Badge className={`text-[9px] ${role.demand === 'high' ? 'bg-green-500/15 text-green-300 border-green-500/20' : role.demand === 'medium' ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20' : 'bg-slate-700/50 text-slate-400 border-slate-600/20'}`}>{role.demand}</Badge>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Alternative Paths */}
            {cp.alternativePaths && cp.alternativePaths.length > 0 && (
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white flex items-center gap-2"><ArrowRight className="w-4 h-4 text-purple-400" />Alternative Career Paths</h3></div>
                <div className="p-5 space-y-2">
                  {cp.alternativePaths.map((ap, i) => (
                    <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">{ap.title}</span>
                        {ap.matchScore && <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/20 text-xs">{ap.matchScore}% match</Badge>}
                      </div>
                      <p className="text-xs text-slate-400">{ap.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Industry Outlook */}
            {cp.industryOutlook && (
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white flex items-center gap-2"><BarChart3 className="w-4 h-4 text-cyan-400" />Industry Outlook</h3></div>
                <div className="p-5"><p className="text-sm text-slate-300 leading-relaxed">{cp.industryOutlook}</p></div>
              </div>
            )}

            {/* Networking Tips */}
            {cp.networkingTips && cp.networkingTips.length > 0 && (
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white flex items-center gap-2"><Globe className="w-4 h-4 text-cyan-400" />Networking Tips</h3></div>
                <div className="p-5 space-y-2">
                  {cp.networkingTips.map((tip, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-slate-300 leading-relaxed">{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto page-transition">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Career Path Generator</h1>
          <p className="text-sm text-slate-400">Get a personalized roadmap for your dream career</p>
        </div>
        {history.length > 0 && (
          <Button onClick={() => setShowHistory(true)} variant="outline" className="border-blue-600/30 text-blue-300 hover:bg-blue-900/20 rounded-xl">
            <Clock className="w-4 h-4 mr-2" />History ({history.length})
          </Button>
        )}
      </div>
      <div className="glass-card overflow-hidden">
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Your Skills *</label>
              <textarea value={skills} onChange={e => setSkills(e.target.value)} rows={2} placeholder="Python, React, SQL..." className="w-full input-glass resize-none text-sm" />
            </div>
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Interests *</label>
              <textarea value={interests} onChange={e => setInterests(e.target.value)} rows={2} placeholder="AI, web dev, data science..." className="w-full input-glass resize-none text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Education</label>
              <Input value={education} onChange={e => setEducation(e.target.value)} placeholder="B.Tech CS, MBA..." className="input-glass h-11" />
            </div>
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Experience</label>
              <Input value={experience} onChange={e => setExperience(e.target.value)} placeholder="2 years, fresher..." className="input-glass h-11" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Target / Dream Role</label>
              <Input value={targetRole} onChange={e => setTargetRole(e.target.value)} placeholder="e.g., AI Engineer, Product Manager" className="input-glass h-11" />
            </div>
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Location / Market</label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g., San Francisco, Remote, India" className="input-glass h-11" />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</p>}
          <Button onClick={generate} disabled={loading || (!skills && !interests)} className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 h-12 rounded-xl btn-glow shadow-lg shadow-amber-500/15">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating...</> : <><Compass className="w-4 h-4 mr-2" />Generate Career Path</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============ MOCK INTERVIEW (with Voice) ============
function MockInterview() {
  const [started, setStarted] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [currentContent, setCurrentContent] = useState('');
  const [questionNum, setQuestionNum] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [role, setRole] = useState('Software Engineer');
  const [level, setLevel] = useState('mid-level');
  const [type, setType] = useState('behavioral');
  const [questionCount, setQuestionCount] = useState(5);
  const [focusAreas, setFocusAreas] = useState('');
  const [allFeedback, setAllFeedback] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [allAnswers, setAllAnswers] = useState([]);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef(null);
  const [showTips, setShowTips] = useState(false);
  const [expandedQ, setExpandedQ] = useState(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);

  // Timer
  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerActive]);

  const formatTimer = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // Check voice support
  useEffect(() => {
    const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    setVoiceSupported(!!SpeechRecognition);
    return () => { stopVoice(); };
  }, []);

  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = answer;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setAnswer(finalTranscript + interim);
    };

    recognition.onerror = (e) => { console.error('Speech error:', e); stopVoice(); };
    recognition.onend = () => { if (isRecording) { try { recognition.start(); } catch(e) {} } };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setIsListening(true);

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      streamRef.current = stream;
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const updateLevel = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setAudioLevel(avg);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    }).catch(() => {});
  };

  const stopVoice = () => {
    setIsRecording(false);
    setIsListening(false);
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch(e) {} recognitionRef.current = null; }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) { try { audioContextRef.current.close(); } catch(e) {} }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); }
    setAudioLevel(0);
  };

  const toggleVoice = () => { isRecording ? stopVoice() : startVoice(); };

  const startInterview = async () => {
    setLoading(true); setError('');
    try {
      const d = await api.post('/mock-interview/start', { role, level, type, questionCount, focusAreas: focusAreas.trim() || undefined });
      if (d.error) throw new Error(d.error);
      setSessionId(d.sessionId); setCurrentContent(d.question); setQuestionNum(1); setStarted(true);
      setTotalQuestions(d.totalQuestions || questionCount);
      setAllQuestions([d.question]);
      setTimer(0); setTimerActive(true);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) return;
    setLoading(true); setFeedback(null); setError('');
    try {
      const d = await api.post('/mock-interview/respond', { sessionId, answer });
      if (d.error) throw new Error(d.error);
      const fb = d.feedback;
      setFeedback(fb);
      setAllFeedback(prev => [...prev, fb]);
      setAllAnswers(prev => [...prev, answer]);
      setQuestionNum(d.questionNumber);
      if (d.totalQuestions) setTotalQuestions(d.totalQuestions);
      setIsComplete(d.isComplete);
      setAnswer('');
      if (!d.isComplete && fb.nextQuestion) {
        setCurrentContent(fb.nextQuestion);
        setAllQuestions(prev => [...prev, fb.nextQuestion]);
        setTimer(0);
      } else {
        setTimerActive(false);
      }
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const downloadReport = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    let y = 20;
    const pageH = 280;
    const checkPage = (need = 20) => { if (y + need > pageH) { doc.addPage(); y = 20; } };

    // Title
    doc.setFontSize(20); doc.setTextColor(0, 100, 200);
    doc.text('CareerGPT Mock Interview Report', 20, y); y += 10;
    doc.setDrawColor(0, 100, 200); doc.setLineWidth(0.5);
    doc.line(20, y, 190, y); y += 8;

    // Session info
    doc.setFontSize(11); doc.setTextColor(60, 60, 60);
    doc.text(`Role: ${role}`, 20, y);
    doc.text(`Level: ${level}`, 100, y); y += 6;
    doc.text(`Type: ${type}`, 20, y);
    doc.text(`Questions: ${totalQuestions}`, 100, y); y += 6;
    if (focusAreas) { doc.text(`Focus: ${focusAreas}`, 20, y); y += 6; }
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, y); y += 10;

    // Overall score + grade
    const avgScore = allFeedback.length > 0 ? (allFeedback.reduce((a, b) => a + (b.score || 0), 0) / allFeedback.length).toFixed(1) : 'N/A';
    const lastFb = allFeedback[allFeedback.length - 1];
    const grade = lastFb?.overallGrade || (avgScore >= 9 ? 'A+' : avgScore >= 8 ? 'A' : avgScore >= 7 ? 'B+' : avgScore >= 6 ? 'B' : avgScore >= 5 ? 'C' : 'D');

    doc.setFillColor(240, 245, 255); doc.roundedRect(20, y, 170, 18, 3, 3, 'F');
    doc.setFontSize(14); doc.setTextColor(0, 80, 160);
    doc.text(`Overall Grade: ${grade}`, 28, y + 8);
    doc.text(`Average Score: ${avgScore}/10`, 110, y + 8);
    y += 14;
    if (lastFb?.hireRecommendation) {
      doc.setFontSize(10); doc.setTextColor(0, 120, 80);
      doc.text(`Hire Recommendation: ${lastFb.hireRecommendation}`, 28, y + 2);
      y += 6;
    }
    y += 8;

    // Final assessment
    if (lastFb?.finalAssessment) {
      checkPage(20);
      doc.setFontSize(12); doc.setTextColor(0, 80, 150);
      doc.text('Final Assessment', 20, y); y += 6;
      doc.setFontSize(9); doc.setTextColor(50, 50, 50);
      const faLines = doc.splitTextToSize(lastFb.finalAssessment, 165);
      doc.text(faLines, 25, y); y += faLines.length * 4 + 6;
    }

    // Category scores
    const catKeys = ['technicalAccuracy', 'communicationScore', 'structureScore', 'confidenceScore'];
    const catData = catKeys.map(key => {
      const vals = allFeedback.filter(fb => fb[key] != null).map(fb => fb[key]);
      return vals.length ? { label: key.replace(/([A-Z])/g, ' $1').replace('Score', '').trim(), avg: (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) } : null;
    }).filter(Boolean);
    if (catData.length) {
      checkPage(16);
      doc.setFontSize(12); doc.setTextColor(0, 80, 150);
      doc.text('Category Scores', 20, y); y += 6;
      doc.setFontSize(10); doc.setTextColor(50, 50, 50);
      catData.forEach(c => { doc.text(`${c.label}: ${c.avg}/10`, 25, y); y += 5; });
      y += 4;
    }

    // Top strengths
    if (lastFb?.topStrengths?.length) {
      checkPage(16);
      doc.setFontSize(12); doc.setTextColor(0, 130, 60);
      doc.text('Top Strengths', 20, y); y += 6;
      doc.setFontSize(9); doc.setTextColor(50, 50, 50);
      lastFb.topStrengths.forEach(s => {
        checkPage(8);
        const sLines = doc.splitTextToSize(`✓ ${s}`, 160);
        doc.text(sLines, 25, y); y += sLines.length * 4 + 2;
      });
      y += 4;
    }

    // Key improvements
    if (lastFb?.topImprovements?.length) {
      checkPage(16);
      doc.setFontSize(12); doc.setTextColor(200, 120, 0);
      doc.text('Key Improvements', 20, y); y += 6;
      doc.setFontSize(9); doc.setTextColor(50, 50, 50);
      lastFb.topImprovements.forEach(s => {
        checkPage(8);
        const sLines = doc.splitTextToSize(`• ${s}`, 160);
        doc.text(sLines, 25, y); y += sLines.length * 4 + 2;
      });
      y += 4;
    }

    // Improvement roadmap
    if (lastFb?.improvementRoadmap?.length) {
      checkPage(16);
      doc.setFontSize(12); doc.setTextColor(80, 60, 160);
      doc.text('Improvement Roadmap', 20, y); y += 6;
      doc.setFontSize(9); doc.setTextColor(50, 50, 50);
      lastFb.improvementRoadmap.forEach((step, i) => {
        checkPage(8);
        const sLines = doc.splitTextToSize(`${i + 1}. ${step}`, 160);
        doc.text(sLines, 25, y); y += sLines.length * 4 + 2;
      });
      y += 4;
    }

    // Question-by-question details
    allFeedback.forEach((fb, i) => {
      checkPage(40);
      doc.setFontSize(12); doc.setTextColor(0, 80, 150);
      let qHeader = `Question ${i + 1} — Score: ${fb.score || '?'}/10`;
      if (fb.difficulty) qHeader += ` | ${fb.difficulty}`;
      if (fb.questionCategory) qHeader += ` | ${fb.questionCategory}`;
      doc.text(qHeader, 20, y); y += 6;

      if (allQuestions[i]) {
        doc.setFontSize(9); doc.setTextColor(40, 40, 40);
        const qLines = doc.splitTextToSize(`Q: ${allQuestions[i].replace(/[\*#]/g, '')}`, 160);
        doc.text(qLines, 25, y); y += qLines.length * 4 + 2;
      }
      if (allAnswers[i]) {
        checkPage(10);
        doc.setTextColor(80, 80, 80);
        const aLines = doc.splitTextToSize(`Your Answer: ${allAnswers[i].substring(0, 400)}`, 160);
        doc.text(aLines, 25, y); y += aLines.length * 4 + 2;
      }
      if (fb.feedback) {
        checkPage(10);
        doc.setTextColor(0, 100, 0);
        const fLines = doc.splitTextToSize(`Feedback: ${fb.feedback.substring(0, 500)}`, 155);
        doc.text(fLines, 25, y); y += fLines.length * 4 + 2;
      }
      if (fb.keyMissing?.length) {
        checkPage(8);
        doc.setTextColor(180, 100, 0);
        doc.text(`Key Missing: ${fb.keyMissing.join(', ')}`, 25, y); y += 5;
      }
      if (fb.sampleAnswer) {
        checkPage(10);
        doc.setTextColor(0, 80, 120);
        const mLines = doc.splitTextToSize(`Model Answer: ${fb.sampleAnswer.substring(0, 400)}`, 155);
        doc.text(mLines, 25, y); y += mLines.length * 4 + 2;
      }
      y += 6;
    });

    // Footer on every page
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(7); doc.setTextColor(150, 150, 150);
      doc.text('Generated by CareerGPT — AI-Powered Career Guidance', 20, 290);
      doc.text(`Page ${p} of ${totalPages}`, 175, 290);
    }
    doc.save(`CareerGPT_Interview_${role.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const resetInterview = () => {
    stopVoice(); setStarted(false); setFeedback(null); setAllFeedback([]);
    setAllQuestions([]); setAllAnswers([]); setTimer(0); setTimerActive(false);
    setIsComplete(false); setError(''); setExpandedQ(null); setTotalQuestions(questionCount);
  };

  if (!started) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto page-transition">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">AI Mock Interview</h1>
          <p className="text-sm text-slate-400">Practice with AI-powered interview simulation</p>
        </div>
        <div className="glass-card overflow-hidden">
          <div className="p-6 space-y-5">
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Job Role</label>
              <Input value={role} onChange={e => setRole(e.target.value)} className="input-glass h-11" placeholder="e.g., Software Engineer, Product Manager" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Level</label>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger className="input-glass h-11"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="entry-level">Entry Level</SelectItem>
                    <SelectItem value="mid-level">Mid Level</SelectItem>
                    <SelectItem value="senior">Senior</SelectItem>
                    <SelectItem value="lead">Lead / Staff</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Type</label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="input-glass h-11"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="behavioral">Behavioral</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="system-design">System Design</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                    <SelectItem value="case-study">Case Study</SelectItem>
                    <SelectItem value="coding">Coding</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Question Count & Focus */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Questions</label>
                <Select value={String(questionCount)} onValueChange={v => setQuestionCount(Number(v))}>
                  <SelectTrigger className="input-glass h-11"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="3">3 Questions (Quick)</SelectItem>
                    <SelectItem value="5">5 Questions (Standard)</SelectItem>
                    <SelectItem value="7">7 Questions (Thorough)</SelectItem>
                    <SelectItem value="10">10 Questions (Full)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Focus Areas (optional)</label>
                <Input value={focusAreas} onChange={e => setFocusAreas(e.target.value)} className="input-glass h-11" placeholder="e.g., React, Leadership, SQL" />
              </div>
            </div>

            {/* Interview Tips */}
            <div className="p-4 rounded-xl bg-violet-500/[0.05] border border-violet-500/10">
              <button onClick={() => setShowTips(!showTips)} className="w-full flex items-center justify-between">
                <span className="text-sm font-medium text-violet-300 flex items-center gap-2"><Sparkles className="w-4 h-4" />Interview Tips</span>
                <ChevronDown className={`w-4 h-4 text-violet-400 transition-transform ${showTips ? 'rotate-180' : ''}`} />
              </button>
              {showTips && (
                <div className="mt-3 space-y-2 animate-slide-up">
                  {[
                    { title: 'STAR Method', desc: 'Structure answers: Situation → Task → Action → Result' },
                    { title: 'Be Specific', desc: 'Use real examples with numbers and outcomes' },
                    { title: 'Stay Concise', desc: 'Aim for 2-3 minute answers — quality over quantity' },
                    { title: 'Ask Clarifying Questions', desc: 'Show critical thinking by asking before answering' },
                    { title: 'Show Impact', desc: 'Focus on what YOU did and the measurable results' },
                  ].map((tip, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
                      <div><span className="text-xs text-white font-medium">{tip.title}: </span><span className="text-xs text-slate-400">{tip.desc}</span></div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</p>}
            <Button onClick={startInterview} disabled={loading} className="w-full bg-gradient-to-r from-violet-600 to-purple-500 text-white border-0 h-12 rounded-xl btn-glow shadow-lg shadow-violet-500/15">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Starting...</> : <><Mic className="w-4 h-4 mr-2" />Start Interview</>}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Mock Interview: {role}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 text-[10px]">{level}</Badge>
            <Badge className="bg-slate-500/20 text-slate-300 border-slate-500/30 text-[10px]">{type}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className={`text-sm font-mono font-bold ${timer > 180 ? 'text-red-400' : timer > 120 ? 'text-yellow-400' : 'text-white'}`}>{formatTimer(timer)}</span>
          </div>
          <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30">Q{Math.min(questionNum, totalQuestions)}/{totalQuestions}</Badge>
        </div>
      </div>
      <Progress value={Math.min(questionNum, totalQuestions) / totalQuestions * 100} className="h-2 mb-4" />

      {/* Current Question / Feedback */}
      {feedback && !feedback.raw ? (
        <div className="glass-card-static mb-4">
          <div className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 68 68">
                  <circle cx="34" cy="34" r="28" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
                  <circle cx="34" cy="34" r="28" fill="none" stroke={(feedback.score||0) >= 7 ? '#22c55e' : (feedback.score||0) >= 5 ? '#eab308' : '#ef4444'} strokeWidth="5"
                    strokeDasharray={`${((feedback.score||0) / 10) * 176} 176`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-white">{feedback.score}/{feedback.maxScore || 10}</span>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-2">
                {[['Technical', feedback.technicalAccuracy], ['Communication', feedback.communicationScore], ['Structure', feedback.structureScore], ['Confidence', feedback.confidenceScore]].map(([l, v]) => (
                  v !== undefined && <div key={l}><p className="text-[10px] text-slate-500">{l}</p><Progress value={(v || 0) * 10} className="h-1.5" /><p className="text-[10px] text-slate-300">{v}/10</p></div>
                ))}
              </div>
            </div>
            {feedback.usedSTAR !== undefined && (
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg mb-3 text-[10px] font-medium ${feedback.usedSTAR ? 'bg-green-500/10 text-green-300 border border-green-500/20' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}`}>
                {feedback.usedSTAR ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {feedback.usedSTAR ? 'STAR Method Used' : 'Try using STAR Method'}
              </div>
            )}
            {/* Difficulty & Category badges */}
            <div className="flex items-center gap-2 mb-3">
              {feedback.difficulty && (
                <Badge className={`text-[9px] ${feedback.difficulty === 'hard' ? 'bg-red-500/15 text-red-300 border-red-500/20' : feedback.difficulty === 'medium' ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20' : 'bg-green-500/15 text-green-300 border-green-500/20'}`}>
                  {feedback.difficulty.charAt(0).toUpperCase() + feedback.difficulty.slice(1)}
                </Badge>
              )}
              {feedback.questionCategory && (
                <Badge className="bg-slate-500/15 text-slate-300 border-slate-500/20 text-[9px]">{feedback.questionCategory}</Badge>
              )}
            </div>
            <p className="text-sm text-slate-300 mb-3 leading-relaxed">{feedback.feedback}</p>
            {feedback.strengths?.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-green-400 font-medium mb-1">Strengths:</p>
                <div className="flex flex-wrap gap-1">{feedback.strengths.map((s, i) => <Badge key={i} className="bg-green-500/10 text-green-300 border-green-500/20 text-[9px]">{s}</Badge>)}</div>
              </div>
            )}
            {feedback.improvements?.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-amber-400 font-medium mb-1">Areas to Improve:</p>
                <div className="flex flex-wrap gap-1">{feedback.improvements.map((s, i) => <Badge key={i} className="bg-amber-500/10 text-amber-300 border-amber-500/20 text-[9px]">{s}</Badge>)}</div>
              </div>
            )}
            {feedback.keyMissing?.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-red-400 font-medium mb-1">Key Points You Missed:</p>
                <div className="flex flex-wrap gap-1">{feedback.keyMissing.map((s, i) => <Badge key={i} className="bg-red-500/10 text-red-300 border-red-500/20 text-[9px]">{s}</Badge>)}</div>
              </div>
            )}
            {feedback.followUpTip && (
              <div className="p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-xl mb-3">
                <p className="text-[10px] text-cyan-400 mb-1 font-medium flex items-center gap-1"><Sparkles className="w-3 h-3" />Pro Tip</p>
                <p className="text-xs text-slate-300">{feedback.followUpTip}</p>
              </div>
            )}
            {feedback.sampleAnswer && <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl"><p className="text-[10px] text-green-400 mb-1 font-medium">Sample Better Answer:</p><p className="text-xs text-slate-300">{feedback.sampleAnswer}</p></div>}
            {feedback.nextQuestion && !isComplete && <div className="mt-4 p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]"><p className="text-[10px] text-cyan-400 mb-1 font-medium">Next Question:</p><p className="text-sm text-white">{feedback.nextQuestion}</p></div>}
          </div>
        </div>
      ) : (
        <div className="glass-card-static mb-4">
          <div className="p-5">
            <div className="prose prose-invert prose-sm max-w-none [&>*]:text-slate-200 [&>p]:text-slate-200 [&>h1]:text-white [&>h2]:text-white [&>h3]:text-cyan-300 [&>strong]:text-cyan-300 [&>em]:text-slate-300">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{feedback?.feedback || currentContent}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-2 mb-4"><AlertCircle className="w-4 h-4" />{error}</p>}

      {!isComplete ? (
        <div className="space-y-3">
          {isRecording && (
            <div className="flex items-center gap-3 p-3 bg-red-900/20 border border-red-500/30 rounded-xl">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm text-red-300">Recording... Speak your answer</span>
              <div className="flex-1 flex items-center gap-0.5 h-6">
                {[...Array(20)].map((_, i) => (
                  <div key={i} className="flex-1 bg-red-500/60 rounded-full transition-all duration-75" style={{ height: `${Math.max(4, Math.min(24, (audioLevel / 5) * (1 + (i % 3) * 0.5)))}px` }} />
                ))}
              </div>
            </div>
          )}

          <div className="relative">
            <textarea value={answer} onChange={e => setAnswer(e.target.value)} placeholder={isRecording ? "Listening... speak now" : "Type or use voice to answer..."} rows={5} className="input-glass w-full rounded-xl p-4 pr-14 text-sm resize-none" />
            {voiceSupported && (
              <button onClick={toggleVoice} className={`absolute right-3 top-3 w-10 h-10 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30' : 'bg-slate-700 text-slate-400 hover:bg-violet-600 hover:text-white'}`}>
                <Mic className="w-5 h-5" />
              </button>
            )}
            <div className="absolute right-3 bottom-3 text-[10px] text-slate-500">{answer.split(/\s+/).filter(w => w).length} words</div>
          </div>

          {voiceSupported && !isRecording && (
            <p className="text-[10px] text-slate-500 flex items-center gap-1"><Mic className="w-3 h-3" /> Click the mic icon to answer with your voice</p>
          )}

          <div className="flex gap-3">
            <Button onClick={() => { stopVoice(); submitAnswer(); }} disabled={!answer.trim() || loading} className="flex-1 bg-gradient-to-r from-violet-600 to-purple-500 text-white border-0 py-4 rounded-xl">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Evaluating...</> : <><Send className="w-4 h-4 mr-2" />Submit Answer</>}
            </Button>
            <Button onClick={resetInterview} variant="outline" className="border-slate-600 text-slate-300">End</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Final scores summary */}
          {allFeedback.length > 0 && (
            <div className="glass-card-bright">
              <div className="p-5">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Award className="w-5 h-5 text-amber-400" />Interview Performance Summary</h3>

                {/* Overall Grade & Hire Recommendation */}
                {(() => {
                  const lastFb = allFeedback[allFeedback.length - 1];
                  const avgScore = (allFeedback.reduce((a, b) => a + (b.score || 0), 0) / allFeedback.length);
                  const grade = lastFb?.overallGrade || (avgScore >= 9 ? 'A+' : avgScore >= 8 ? 'A' : avgScore >= 7 ? 'B+' : avgScore >= 6 ? 'B' : avgScore >= 5 ? 'C+' : avgScore >= 4 ? 'C' : 'D');
                  const gradeColor = grade.startsWith('A') ? 'text-green-400' : grade.startsWith('B') ? 'text-blue-400' : grade.startsWith('C') ? 'text-yellow-400' : 'text-red-400';
                  const hire = lastFb?.hireRecommendation || '';
                  const hireColor = hire.includes('Strong Hire') ? 'bg-green-500/15 text-green-300 border-green-500/20' : hire.includes('Hire') && !hire.includes('No') ? 'bg-blue-500/15 text-blue-300 border-blue-500/20' : hire.includes('Lean Hire') ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20' : 'bg-red-500/15 text-red-300 border-red-500/20';
                  return (
                    <div className="flex items-center gap-6 mb-5 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Grade</p>
                        <p className={`text-4xl font-black ${gradeColor}`}>{grade}</p>
                      </div>
                      <div className="text-center flex-1">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Average Score</p>
                        <p className="text-3xl font-bold text-gradient">{avgScore.toFixed(1)}/10</p>
                      </div>
                      {hire && (
                        <div className="text-center">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Verdict</p>
                          <Badge className={`${hireColor} text-xs px-3 py-1`}>{hire}</Badge>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Final Assessment */}
                {allFeedback[allFeedback.length - 1]?.finalAssessment && (
                  <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/10 mb-4">
                    <p className="text-sm text-slate-300 leading-relaxed">{allFeedback[allFeedback.length - 1].finalAssessment}</p>
                  </div>
                )}

                {/* Per-question scores */}
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {allFeedback.map((fb, i) => (
                    <div key={i} className="text-center p-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                      <p className="text-[10px] text-slate-400">Q{i+1}</p>
                      <p className={`text-lg font-bold ${(fb.score || 0) >= 7 ? 'text-green-400' : (fb.score || 0) >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>{fb.score || '?'}</p>
                      {fb.difficulty && <p className="text-[8px] text-slate-500 capitalize">{fb.difficulty}</p>}
                    </div>
                  ))}
                </div>

                {/* Category Averages */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {['technicalAccuracy', 'communicationScore', 'structureScore', 'confidenceScore'].map(key => {
                    const vals = allFeedback.filter(fb => fb[key] != null).map(fb => fb[key]);
                    if (vals.length === 0) return null;
                    const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
                    const label = key.replace(/([A-Z])/g, ' $1').replace('Score', '').trim();
                    return (
                      <div key={key} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] text-center">
                        <p className={`text-lg font-bold ${avg >= 7 ? 'text-green-400' : avg >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>{avg}</p>
                        <p className="text-[10px] text-slate-500 capitalize">{label}</p>
                      </div>
                    );
                  }).filter(Boolean)}
                </div>

                {/* Top Strengths & Improvements from final assessment */}
                {(() => {
                  const lastFb = allFeedback[allFeedback.length - 1];
                  return (
                    <>
                      {lastFb?.topStrengths?.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-green-400 font-medium mb-1.5 uppercase tracking-wider">Top Strengths</p>
                          <div className="space-y-1">{lastFb.topStrengths.map((s, i) => <div key={i} className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" /><span className="text-xs text-slate-300">{s}</span></div>)}</div>
                        </div>
                      )}
                      {lastFb?.topImprovements?.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-amber-400 font-medium mb-1.5 uppercase tracking-wider">Key Improvements</p>
                          <div className="space-y-1">{lastFb.topImprovements.map((s, i) => <div key={i} className="flex items-start gap-2"><AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" /><span className="text-xs text-slate-300">{s}</span></div>)}</div>
                        </div>
                      )}
                      {lastFb?.improvementRoadmap?.length > 0 && (
                        <div className="mb-4 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                          <p className="text-xs text-indigo-400 font-medium mb-2 uppercase tracking-wider">Improvement Roadmap</p>
                          <div className="space-y-2">
                            {lastFb.improvementRoadmap.map((step, i) => (
                              <div key={i} className="flex items-start gap-3">
                                <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{i+1}</div>
                                <p className="text-xs text-slate-300">{step}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Question Review — expandable */}
                <div className="space-y-3 border-t border-white/[0.05] pt-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Question Review</p>
                  {allFeedback.map((fb, i) => (
                    <div key={i} className="rounded-xl bg-white/[0.02] border border-white/[0.05] overflow-hidden">
                      <button onClick={() => setExpandedQ(expandedQ === i ? null : i)} className="w-full p-3 flex items-center justify-between text-left">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-xs text-slate-400">Q{i + 1}</span>
                          {fb.questionCategory && <Badge className="bg-slate-700/50 text-slate-400 border-slate-600/30 text-[8px]">{fb.questionCategory}</Badge>}
                          {fb.difficulty && <Badge className={`text-[8px] ${fb.difficulty === 'hard' ? 'bg-red-500/10 text-red-300' : fb.difficulty === 'medium' ? 'bg-yellow-500/10 text-yellow-300' : 'bg-green-500/10 text-green-300'}`}>{fb.difficulty}</Badge>}
                          <span className="text-xs text-white truncate flex-1">{allQuestions[i] ? allQuestions[i].replace(/[\*#]/g, '').substring(0, 60) + '...' : ''}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-[9px] ${(fb.score||0) >= 7 ? 'bg-green-500/15 text-green-300 border-green-500/20' : (fb.score||0) >= 5 ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20' : 'bg-red-500/15 text-red-300 border-red-500/20'}`}>{fb.score}/10</Badge>
                          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expandedQ === i ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      {expandedQ === i && (
                        <div className="p-3 pt-0 space-y-2 animate-slide-up border-t border-white/[0.03]">
                          {allQuestions[i] && <div><p className="text-[10px] text-cyan-400 font-medium mb-0.5">Question:</p><p className="text-xs text-white">{allQuestions[i].replace(/[\*#]/g, '')}</p></div>}
                          {allAnswers[i] && <div><p className="text-[10px] text-violet-400 font-medium mb-0.5">Your Answer:</p><p className="text-xs text-slate-400 italic">{allAnswers[i]}</p></div>}
                          {fb.feedback && <div><p className="text-[10px] text-slate-400 font-medium mb-0.5">Feedback:</p><p className="text-xs text-slate-500">{fb.feedback}</p></div>}
                          {fb.sampleAnswer && <div className="p-2 rounded-lg bg-green-500/5 border border-green-500/10"><p className="text-[10px] text-green-400 font-medium mb-0.5">Model Answer:</p><p className="text-xs text-slate-300">{fb.sampleAnswer}</p></div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={downloadReport} className="flex-1 bg-gradient-to-r from-green-600 to-emerald-500 text-white border-0 py-4 rounded-xl">
              <FileText className="w-4 h-4 mr-2" />Download Report
            </Button>
            <Button onClick={resetInterview} className="flex-1 bg-gradient-to-r from-violet-600 to-purple-500 text-white border-0 py-4 rounded-xl">
              <Mic className="w-4 h-4 mr-2" />New Interview
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ UNIFIED JOBS MODULE ============
function Jobs() {
  const [activeTab, setActiveTab] = useState('match');
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto page-transition">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Jobs</h1>
        <p className="text-sm text-slate-400">Find and apply to your ideal job opportunities</p>
      </div>
      {/* Tab Switcher */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-6 w-fit">
        <button onClick={() => setActiveTab('match')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'match' ? 'bg-gradient-to-r from-green-600/80 to-emerald-500/80 text-white shadow-lg shadow-green-500/15' : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'}`}>
          <Sparkles className="w-4 h-4" />AI Match
        </button>
        <button onClick={() => setActiveTab('browse')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'browse' ? 'bg-gradient-to-r from-emerald-600/80 to-teal-500/80 text-white shadow-lg shadow-emerald-500/15' : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'}`}>
          <Globe className="w-4 h-4" />Browse Jobs
        </button>
      </div>
      {activeTab === 'match' ? <JobMatchingTab /> : <JobBrowseTab />}
    </div>
  );
}

function JobMatchingTab() {
  const [skills, setSkills] = useState('');
  const [interests, setInterests] = useState('');
  const [experience, setExperience] = useState('');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [savedJobs, setSavedJobs] = useState(new Set());
  const [savingJob, setSavingJob] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [creatingAlert, setCreatingAlert] = useState(false);
  const [alertFrequency, setAlertFrequency] = useState('daily');
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [sortBy, setSortBy] = useState('matchScore');
  const [minScore, setMinScore] = useState(0);
  const [expandedMatch, setExpandedMatch] = useState(null);

  // Load search history, alerts, saved jobs, and resumes
  useEffect(() => {
    api.get('/job-match/history').then(d => {
      if (d.history) setHistory(d.history);
    }).catch(() => {});
    api.get('/saved-jobs').then(d => {
      if (d.jobs) setSavedJobs(new Set(d.jobs.map(j => j.jobTitle)));
    }).catch(() => {});
    api.get('/job-alerts').then(d => {
      if (d.alerts) setAlerts(d.alerts);
    }).catch(() => {});
    api.get('/resumes').then(d => {
      if (d.resumes) setResumes(d.resumes);
    }).catch(() => {});
  }, []);

  // Auto-fill skills from resume
  const fillFromResume = async (resumeId) => {
    if (!resumeId) return;
    setSelectedResumeId(resumeId);
    try {
      const resume = resumes.find(r => r.id === resumeId || r._id === resumeId);
      if (resume) {
        if (resume.skills?.length) setSkills(resume.skills.join(', '));
        if (resume.experience) setExperience(resume.experience);
      }
    } catch (e) { console.error(e); }
  };

  const match = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = { skills, interests, experience, targetIndustry: industry, location };
      if (employmentType) payload.employmentType = employmentType;
      if (experienceLevel) payload.experienceLevel = experienceLevel;
      if (selectedResumeId) payload.resumeId = selectedResumeId;
      const d = await api.post('/job-match', payload);
      if (d.error) throw new Error(d.error);
      setResult(d);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Failed to find job matches. Please try again.');
    } finally { setLoading(false); }
  };

  const saveJob = async (job, index) => {
    setSavingJob(index);
    try {
      const d = await api.post('/saved-jobs/save', { jobTitle: job.role, company: job.company_type, salary: job.salary, jobUrl: job.jobUrl, matchScore: job.matchScore, location: job.location, source: job.source });
      if (!d.error) setSavedJobs(prev => new Set([...prev, job.role]));
    } catch (e) { console.error(e); }
    finally { setSavingJob(null); }
  };

  const createAlert = async () => {
    if (!skills.trim()) return;
    setCreatingAlert(true);
    try {
      const d = await api.post('/job-alerts/create', { skills, location, frequency: alertFrequency });
      if (d.success) {
        setAlerts(prev => [...prev, { alertId: d.alertId, criteria: { skills: skills.split(',').map(s => s.trim()), locations: location ? [location] : [] }, frequency: alertFrequency, isActive: true }]);
        setShowAlerts(true);
      }
    } catch (e) { console.error(e); }
    finally { setCreatingAlert(false); }
  };

  const toggleAlert = async (alertId, isActive) => {
    await api.post('/job-alerts/toggle', { alertId, isActive: !isActive });
    setAlerts(prev => prev.map(a => a.alertId === alertId ? { ...a, isActive: !isActive } : a));
  };

  const deleteAlert = async (alertId) => {
    await api.post('/job-alerts/delete', { alertId });
    setAlerts(prev => prev.filter(a => a.alertId !== alertId));
  };

  const loadFromHistory = (h) => {
    setSkills(h.input.skills || '');
    setInterests(h.input.interests || '');
    setExperience(h.input.experience || '');
    setIndustry(h.input.targetIndustry || '');
    setLocation(h.input.location || '');
    setShowHistory(false);
  };

  if (result) {
    const allMatches = result.matches || [];
    // Filter by min score
    const filtered = allMatches.filter(m => (m.matchScore || 0) >= minScore);
    // Sort
    const matches = [...filtered].sort((a, b) => {
      if (sortBy === 'matchScore') return (b.matchScore || 0) - (a.matchScore || 0);
      if (sortBy === 'salary') return (b.salary || '').localeCompare(a.salary || '');
      if (sortBy === 'growth') { const order = { high: 3, medium: 2, low: 1 }; return (order[b.growth_potential] || 0) - (order[a.growth_potential] || 0); }
      return 0;
    });
    const isReal = result.dataSource === 'real_jobs_ranked_by_ai';
    const isMock = result.dataSource === 'mock_fallback';
    return (
      <div className="page-transition">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Job Matches</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`text-[10px] ${isReal ? 'bg-green-500/15 text-green-300 border-green-500/20' : isMock ? 'bg-amber-500/15 text-amber-300 border-amber-500/20' : 'bg-blue-500/15 text-blue-300 border-blue-500/20'}`}>
                {isReal ? '✓ Live Jobs' : isMock ? 'Sample Data' : 'AI Generated'}
              </Badge>
              <span className="text-slate-500 text-xs">{matches.length}/{allMatches.length} matches</span>
            </div>
          </div>
          <Button onClick={() => setResult(null)} variant="outline" className="border-slate-600 text-slate-300 rounded-xl">Search Again</Button>
        </div>

        {/* Sort & Filter Bar */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Sort:</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input-glass text-xs py-1.5 px-3 rounded-lg">
              <option value="matchScore">Match Score</option>
              <option value="salary">Salary</option>
              <option value="growth">Growth Potential</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Min Score:</span>
            <select value={minScore} onChange={e => setMinScore(Number(e.target.value))} className="input-glass text-xs py-1.5 px-3 rounded-lg">
              <option value={0}>All</option>
              <option value={50}>50+</option>
              <option value={60}>60+</option>
              <option value={70}>70+</option>
              <option value={80}>80+</option>
            </select>
          </div>
        </div>

        {/* Message banner */}
        {result.message && (
          <div className={`rounded-xl p-4 mb-4 flex items-start gap-3 ${isReal ? 'bg-green-500/5 border border-green-500/10' : 'bg-blue-500/5 border border-blue-500/10'}`}>
            <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isReal ? 'text-green-400' : 'text-blue-400'}`} />
            <p className="text-slate-300 text-sm">{result.message}</p>
          </div>
        )}

        {/* Summary */}
        {result.summary && (
          <div className="glass-card-static p-5 mb-4">
            <p className="text-slate-300 text-sm leading-relaxed">{result.summary}</p>
          </div>
        )}

        {/* Top Skill Gaps & Recommendations */}
        {((result.topSkillGaps && result.topSkillGaps.length > 0) || (result.recommendations && result.recommendations.length > 0)) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {result.topSkillGaps && result.topSkillGaps.length > 0 && (
              <div className="glass-card-static">
                <div className="p-4 pb-2"><h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Skill Gaps to Fill</h3></div>
                <div className="px-4 pb-4"><div className="flex flex-wrap gap-1.5">{result.topSkillGaps.map((s, i) => <Badge key={i} className="bg-amber-500/15 text-amber-300 border-amber-500/20 text-[10px]">{s}</Badge>)}</div></div>
              </div>
            )}
            {result.recommendations && result.recommendations.length > 0 && (
              <div className="glass-card-static">
                <div className="p-4 pb-2"><h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Recommendations</h3></div>
                <div className="px-4 pb-4 space-y-1.5">{result.recommendations.map((r, i) => <div key={i} className="flex gap-2"><CheckCircle2 className="w-3 h-3 text-cyan-400 mt-0.5 flex-shrink-0" /><span className="text-xs text-slate-300">{r}</span></div>)}</div>
              </div>
            )}
          </div>
        )}

        {result.raw ? (
          <div className="glass-card-static p-6"><div className="prose prose-invert max-w-none [&>*]:text-slate-200 [&>p]:text-slate-200 [&>h1]:text-white [&>h2]:text-white [&>h3]:text-cyan-300 [&>strong]:text-cyan-300 [&>li]:text-slate-200"><ReactMarkdown remarkPlugins={[remarkGfm]}>{result.summary}</ReactMarkdown></div></div>
        ) : (
          <div className="space-y-4">
            {matches.length === 0 && (
              <div className="glass-card-static p-8 text-center">
                <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">{minScore > 0 ? `No matches above ${minScore}%. Try lowering the filter.` : 'No matches found. Try broader keywords like "Developer", "Engineer", or "Data Scientist".'}</p>
              </div>
            )}
            {matches.map((m, i) => (
              <div key={i} className="glass-card overflow-hidden animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-lg font-semibold text-white">{m.role}</h3>
                        {m.source && m.source !== 'ai' && m.source !== 'mock' && (
                          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/20 text-[9px]">Live</Badge>
                        )}
                        {m.source === 'mock' && (
                          <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/20 text-[9px]">Sample</Badge>
                        )}
                        {m.source && m.source !== 'mock' && m.source !== 'ai' && (
                          <Badge className="bg-slate-700/50 text-slate-400 border-slate-600/30 text-[8px] uppercase">{m.source}</Badge>
                        )}
                        {m.timeToReady && (
                          <Badge className={`text-[9px] ${m.timeToReady.includes('Ready') || m.timeToReady.includes('0') ? 'bg-green-500/15 text-green-300 border-green-500/20' : m.timeToReady.includes('1-2') || m.timeToReady.includes('week') ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20' : 'bg-amber-500/15 text-amber-300 border-amber-500/20'}`}>
                            ⏱ {m.timeToReady}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                        <span>{m.company_type}</span>
                        {m.location && <><span className="text-slate-600">|</span><MapPin className="w-3 h-3" /><span>{m.location}</span></>}
                        {m.salary && <><span className="text-slate-600">|</span><span className="text-green-400 font-medium">{m.salary}</span></>}
                        {m.employmentType && <><span className="text-slate-600">|</span><span className="text-cyan-300">{m.employmentType}</span></>}
                      </div>
                    </div>
                    {m.matchScore > 0 && (
                      <div className="text-right ml-4">
                        <div className="w-14 h-14 rounded-full border-[3px] flex items-center justify-center" style={{ borderColor: m.matchScore >= 80 ? '#22c55e' : m.matchScore >= 60 ? '#eab308' : '#ef4444' }}>
                          <span className="text-lg font-bold text-white">{m.matchScore}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-slate-300 mb-3 leading-relaxed">{m.why_match}</p>
                  {m.jobDescription && m.source !== 'mock' && (
                    <p className="text-xs text-slate-500 mb-3 line-clamp-2">{m.jobDescription.substring(0, 200)}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {(m.skills_matched || []).map((s, j) => <Badge key={j} className="bg-green-500/15 text-green-300 border-green-500/20 text-[10px]">{s}</Badge>)}
                    {(m.skills_gap || []).map((s, j) => <Badge key={'g'+j} className="bg-red-500/15 text-red-300 border-red-500/20 text-[10px]">Gap: {s}</Badge>)}
                  </div>

                  {/* Interview Focus Tags */}
                  {m.interviewFocus && m.interviewFocus.length > 0 && (
                    <div className="mb-3 p-2.5 rounded-xl bg-violet-500/[0.04] border border-violet-500/10">
                      <p className="text-[10px] text-violet-400 font-medium uppercase tracking-wider mb-1.5">Interview Focus Areas</p>
                      <div className="flex flex-wrap gap-1.5">
                        {m.interviewFocus.map((f, j) => <Badge key={j} className="bg-violet-500/15 text-violet-300 border-violet-500/20 text-[10px]">{f}</Badge>)}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
                    <div className="flex gap-4 text-[10px] flex-wrap">
                      <span className="text-slate-400">Growth: <span className={m.growth_potential === 'high' ? 'text-green-400 font-medium' : 'text-yellow-400'}>{m.growth_potential}</span></span>
                      <span className="text-slate-400">Demand: <span className={m.demand === 'high' ? 'text-green-400 font-medium' : 'text-yellow-400'}>{m.demand}</span></span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setExpandedMatch(expandedMatch === i ? null : i)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white transition-colors text-[10px] font-medium">
                        <ChevronDown className={`w-3 h-3 transition-transform ${expandedMatch === i ? 'rotate-180' : ''}`} />Details
                      </button>
                      {m.jobUrl && m.source !== 'mock' && !m.jobUrl.includes('example.com') ? (
                        <a href={m.jobUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 transition-colors text-[10px] font-medium border border-blue-500/20">
                          <ExternalLink className="w-3 h-3" />Apply Now
                        </a>
                      ) : (
                        <a href={`https://www.google.com/search?q=${encodeURIComponent((m.role || '') + ' ' + (m.company_type || '') + ' careers apply')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-600/20 text-slate-300 hover:bg-slate-600/30 transition-colors text-[10px] font-medium border border-slate-500/20">
                          <Search className="w-3 h-3" />Find & Apply
                        </a>
                      )}
                      <button
                        onClick={() => saveJob(m, i)}
                        disabled={savingJob === i || savedJobs.has(m.role)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors text-[10px] font-medium ${savedJobs.has(m.role) ? 'bg-green-500/15 text-green-300' : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white'}`}
                      >
                        {savingJob === i ? <Loader2 className="w-3 h-3 animate-spin" /> : savedJobs.has(m.role) ? <><CheckCircle2 className="w-3 h-3" />Saved</> : <><Star className="w-3 h-3" />Save</>}
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expandedMatch === i && (
                    <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-3 animate-slide-up">
                      {m.jobDescription && (
                        <div><p className="text-[10px] text-slate-400 font-medium mb-1 uppercase tracking-wider">Full Description</p><p className="text-xs text-slate-300 leading-relaxed">{m.jobDescription}</p></div>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                        <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]"><p className="text-[9px] text-slate-500">Growth</p><p className={`text-xs font-medium ${m.growth_potential === 'high' ? 'text-green-400' : 'text-yellow-400'}`}>{m.growth_potential}</p></div>
                        <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]"><p className="text-[9px] text-slate-500">Demand</p><p className={`text-xs font-medium ${m.demand === 'high' ? 'text-green-400' : 'text-yellow-400'}`}>{m.demand}</p></div>
                        {m.employmentType && <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]"><p className="text-[9px] text-slate-500">Type</p><p className="text-xs font-medium text-slate-300">{m.employmentType}</p></div>}
                        {m.timeToReady && <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]"><p className="text-[9px] text-slate-500">Ready In</p><p className="text-xs font-medium text-cyan-300">{m.timeToReady}</p></div>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white mb-0.5">AI Job Matching</h2>
          <p className="text-xs text-slate-400">Find the best job matches based on your profile</p>
        </div>
        {history.length > 0 && (
          <Button onClick={() => setShowHistory(!showHistory)} variant="outline" className="border-slate-600 text-slate-300 rounded-xl text-xs">
            <Clock className="w-3.5 h-3.5 mr-1.5" />History
          </Button>
        )}
      </div>

      {/* Search History */}
      {showHistory && history.length > 0 && (
        <div className="glass-card-static mb-6">
          <div className="p-4 pb-2"><h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Recent Searches</h3></div>
          <div className="px-4 pb-4 space-y-2">
            {history.map((h, i) => (
              <button key={i} onClick={() => loadFromHistory(h)} className="w-full text-left p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">{h.input.skills}</p>
                    <p className="text-[10px] text-slate-500">{h.input.targetIndustry || 'Any industry'} • {h.totalMatches} matches</p>
                  </div>
                  <Badge className={`text-[9px] ${h.dataSource === 'REAL_JOBS' ? 'bg-green-500/15 text-green-300' : 'bg-blue-500/15 text-blue-300'}`}>{h.dataSource === 'REAL_JOBS' ? 'Real' : 'AI'}</Badge>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-300 font-medium">Match Failed</p>
            <p className="text-xs text-red-300/70 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="p-6 space-y-5">
          {/* Resume Auto-fill */}
          {resumes.length > 0 && (
            <div className="p-3 rounded-xl bg-cyan-500/[0.04] border border-cyan-500/10">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-cyan-300 font-medium">Auto-fill from Resume</p>
                  <p className="text-[10px] text-slate-500">Import skills & experience from your uploaded resume</p>
                </div>
                <select value={selectedResumeId} onChange={e => fillFromResume(e.target.value)} className="input-glass text-xs py-1.5 px-3 rounded-lg max-w-[200px]">
                  <option value="">Select resume...</option>
                  {resumes.map(r => <option key={r.id || r._id} value={r.id || r._id}>{r.name || r.fileName || 'Resume'}</option>)}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Skills *</label>
            <textarea value={skills} onChange={e => setSkills(e.target.value)} rows={2} placeholder="Python, React, SQL, Machine Learning..." className="w-full input-glass resize-none text-sm" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Interests</label>
              <Input value={interests} onChange={e => setInterests(e.target.value)} placeholder="AI, web dev, data science..." className="input-glass h-11" />
            </div>
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Experience</label>
              <Input value={experience} onChange={e => setExperience(e.target.value)} placeholder="2 years, fresher..." className="input-glass h-11" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Industry (optional)</label>
              <Input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="Tech, Finance, Healthcare..." className="input-glass h-11" />
            </div>
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Location (optional)</label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Remote, New York, India..." className="input-glass h-11" />
            </div>
          </div>

          {/* Employment Type & Experience Level */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Employment Type</label>
              <Select value={employmentType} onValueChange={setEmploymentType}>
                <SelectTrigger className="input-glass h-11"><SelectValue placeholder="Any type" /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="full-time">Full-time</SelectItem>
                  <SelectItem value="part-time">Part-time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="freelance">Freelance</SelectItem>
                  <SelectItem value="internship">Internship</SelectItem>
                  <SelectItem value="remote">Remote Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Experience Level</label>
              <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                <SelectTrigger className="input-glass h-11"><SelectValue placeholder="Any level" /></SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="entry">Entry Level / Fresher</SelectItem>
                  <SelectItem value="junior">Junior (1-2 years)</SelectItem>
                  <SelectItem value="mid">Mid-Level (3-5 years)</SelectItem>
                  <SelectItem value="senior">Senior (5-8 years)</SelectItem>
                  <SelectItem value="lead">Lead / Staff (8+ years)</SelectItem>
                  <SelectItem value="executive">Executive / Director</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={match} disabled={loading || !skills.trim()} className="w-full bg-gradient-to-r from-green-600 to-emerald-500 text-white border-0 h-12 rounded-xl btn-glow shadow-lg shadow-green-500/15">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Finding matches...</> : <><Search className="w-4 h-4 mr-2" />Find Matching Jobs</>}
          </Button>
        </div>
      </div>

      {/* Job Alerts Section */}
      <div className="mt-6 glass-card overflow-hidden">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Bell className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Job Alerts</h3>
                <p className="text-[10px] text-slate-500">{alerts.length} active alert{alerts.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <button onClick={() => setShowAlerts(!showAlerts)} className="text-xs text-cyan-400 hover:text-cyan-300">
              {showAlerts ? 'Hide' : 'Manage'}
            </button>
          </div>

          {/* Quick Create Alert */}
          {skills.trim() && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] mb-3">
              <Bell className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="text-xs text-slate-300 flex-1">Get notified for <span className="text-amber-300 font-medium">{skills.split(',')[0].trim()}</span> jobs</span>
              <select value={alertFrequency} onChange={e => setAlertFrequency(e.target.value)} className="input-glass text-[10px] py-1 px-2 rounded-lg w-20">
                <option value="immediately">Instant</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
              <Button onClick={createAlert} disabled={creatingAlert} size="sm" className="bg-amber-500/20 text-amber-300 border-amber-500/20 hover:bg-amber-500/30 text-[10px] h-7 px-3 rounded-lg">
                {creatingAlert ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Create Alert'}
              </Button>
            </div>
          )}

          {/* Existing Alerts */}
          {showAlerts && alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map(alert => (
                <div key={alert.alertId} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`w-2 h-2 rounded-full ${alert.isActive ? 'bg-green-400' : 'bg-slate-600'}`} />
                    <div className="min-w-0">
                      <p className="text-xs text-white truncate">{(alert.criteria?.skills || []).join(', ')}</p>
                      <p className="text-[10px] text-slate-500">{alert.frequency} • {(alert.criteria?.locations || []).join(', ') || 'Any location'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => toggleAlert(alert.alertId, alert.isActive)} className={`px-2 py-1 rounded text-[10px] transition-colors ${alert.isActive ? 'bg-green-500/15 text-green-300' : 'bg-slate-500/15 text-slate-400'}`}>
                      {alert.isActive ? 'On' : 'Off'}
                    </button>
                    <button onClick={() => deleteAlert(alert.alertId)} className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showAlerts && alerts.length === 0 && (
            <p className="text-[10px] text-slate-500 text-center py-2">No alerts yet. Enter skills above and click "Create Alert".</p>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="mt-6 glass-card-static p-4">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Tips for Better Matches</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {['Be specific with skills (e.g., "React, Node.js" not just "coding")', 'Include both technical and soft skills', 'Mention your experience level clearly', 'Add industry preference for targeted results'].map((tip, i) => (
            <div key={i} className="flex gap-2 items-start"><Sparkles className="w-3 h-3 text-cyan-400 mt-0.5 flex-shrink-0" /><span className="text-[11px] text-slate-400">{tip}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ SAVED JOBS DASHBOARD ============
function SavedJobs() {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [updating, setUpdating] = useState(null);
  const [sortBy, setSortBy] = useState('date-desc');
  const [editingNotes, setEditingNotes] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadJobs = async () => {
    const d = await api.get('/saved-jobs');
    if (d.jobs) { setJobs(d.jobs); setStats(d.stats || {}); }
    setLoading(false);
  };

  useEffect(() => { loadJobs(); }, []);

  const updateStatus = async (jobId, status) => {
    setUpdating(jobId);
    await api.post('/saved-jobs/update', { jobId, status });
    await loadJobs();
    setUpdating(null);
  };

  const updateNotes = async (jobId) => {
    setUpdating(jobId);
    await api.post('/saved-jobs/update', { jobId, notes: noteText });
    await loadJobs();
    setEditingNotes(null);
    setUpdating(null);
  };

  const removeJob = async (jobId) => {
    await api.post('/saved-jobs/delete', { jobId });
    setJobs(prev => prev.filter(j => j.jobId !== jobId));
    setStats(prev => ({ ...prev, total: (prev.total || 1) - 1 }));
  };

  const exportCSV = () => {
    const headers = ['Job Title', 'Company', 'Location', 'Salary', 'Status', 'Notes', 'Saved Date', 'Applied Date', 'URL'];
    const rows = jobs.map(j => [
      j.jobTitle, j.company, j.location || '', j.salary || '', j.status,
      (j.notes || '').replace(/,/g, ';'), j.savedAt ? new Date(j.savedAt).toLocaleDateString() : '',
      j.appliedAt ? new Date(j.appliedAt).toLocaleDateString() : '', j.jobUrl || ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'saved_jobs.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const statusConfig = {
    saved: { label: 'Saved', color: 'bg-slate-500/15 text-slate-300 border-slate-500/20', icon: Bookmark },
    applied: { label: 'Applied', color: 'bg-blue-500/15 text-blue-300 border-blue-500/20', icon: Send },
    interviewing: { label: 'Interviewing', color: 'bg-violet-500/15 text-violet-300 border-violet-500/20', icon: Mic },
    offered: { label: 'Offered', color: 'bg-green-500/15 text-green-300 border-green-500/20', icon: CheckCircle2 },
    rejected: { label: 'Rejected', color: 'bg-red-500/15 text-red-300 border-red-500/20', icon: XCircle }
  };

  let filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter);
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(j => (j.jobTitle || '').toLowerCase().includes(q) || (j.company || '').toLowerCase().includes(q));
  }

  // Sort
  filtered = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'date-desc': return new Date(b.savedAt || 0) - new Date(a.savedAt || 0);
      case 'date-asc': return new Date(a.savedAt || 0) - new Date(b.savedAt || 0);
      case 'company': return (a.company || '').localeCompare(b.company || '');
      case 'title': return (a.jobTitle || '').localeCompare(b.jobTitle || '');
      default: return 0;
    }
  });

  if (loading) return <div className="p-6 flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto page-transition">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Saved Jobs</h1>
          <p className="text-sm text-slate-400">Track your job applications and progress</p>
        </div>
        {jobs.length > 0 && (
          <Button onClick={exportCSV} variant="outline" className="border-slate-600 text-slate-300 rounded-xl text-xs">
            <FileText className="w-3.5 h-3.5 mr-1.5" />Export CSV
          </Button>
        )}
      </div>

      {/* Stats Pipeline */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Saved', value: stats.saved || 0, color: 'text-slate-300', bg: 'bg-slate-500/10' },
          { label: 'Applied', value: stats.applied || 0, color: 'text-blue-300', bg: 'bg-blue-500/10' },
          { label: 'Interviewing', value: stats.interviewing || 0, color: 'text-violet-300', bg: 'bg-violet-500/10' },
          { label: 'Offered', value: stats.offered || 0, color: 'text-green-300', bg: 'bg-green-500/10' },
          { label: 'Rejected', value: stats.rejected || 0, color: 'text-red-300', bg: 'bg-red-500/10' }
        ].map(s => (
          <button key={s.label} onClick={() => setFilter(s.label.toLowerCase())} className={`glass-card-static p-3 text-center transition-all ${filter === s.label.toLowerCase() ? 'ring-1 ring-cyan-500/30' : ''}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filter & Sort Bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === 'all' ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-400 hover:text-white'}`}>
            All ({stats.total || 0})
          </button>
          {Object.entries(statusConfig).map(([key, cfg]) => (
            <button key={key} onClick={() => setFilter(key)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all hidden md:inline-flex ${filter === key ? cfg.color : 'text-slate-400 hover:text-white'}`}>
              {cfg.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search jobs..." className="input-glass text-xs h-8 pl-8 pr-3 rounded-lg w-40" />
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input-glass text-[10px] py-1.5 px-2 rounded-lg">
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="company">Company A-Z</option>
            <option value="title">Title A-Z</option>
          </select>
        </div>
      </div>

      {/* Job List */}
      {filtered.length === 0 ? (
        <div className="glass-card-static p-12 text-center">
          <Bookmark className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 mb-1">{filter === 'all' ? 'No saved jobs yet' : `No ${filter} jobs`}</p>
          <p className="text-xs text-slate-500">Save jobs from Job Matching or Job Board to track them here</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">{filtered.length} job{filtered.length !== 1 ? 's' : ''} shown</p>
          {filtered.map((job, i) => {
            const cfg = statusConfig[job.status] || statusConfig.saved;
            return (
              <div key={job.jobId} className="glass-card overflow-hidden animate-slide-up" style={{ animationDelay: `${i * 0.03}s` }}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-white truncate">{job.jobTitle}</h3>
                        <Badge className={`${cfg.color} text-[9px] flex-shrink-0`}>{cfg.label}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                        <Building2 className="w-3 h-3" /><span>{job.company}</span>
                        {job.location && <><span className="text-slate-600">|</span><MapPin className="w-3 h-3" /><span>{job.location}</span></>}
                        {job.salary && <><span className="text-slate-600">|</span><span className="text-green-400">{job.salary}</span></>}
                      </div>

                      {/* Inline Notes Edit */}
                      {editingNotes === job.jobId ? (
                        <div className="flex items-center gap-2 mb-2">
                          <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add notes..." className="input-glass flex-1 text-xs h-8 px-3 rounded-lg" autoFocus />
                          <button onClick={() => updateNotes(job.jobId)} className="p-1.5 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25"><Check className="w-3 h-3" /></button>
                          <button onClick={() => setEditingNotes(null)} className="p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25"><X className="w-3 h-3" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 mb-2 group/notes">
                          {job.notes ? (
                            <p className="text-xs text-slate-500 italic flex-1">{job.notes}</p>
                          ) : (
                            <p className="text-xs text-slate-600 flex-1">No notes</p>
                          )}
                          <button onClick={() => { setEditingNotes(job.jobId); setNoteText(job.notes || ''); }} className="p-1 rounded text-slate-600 hover:text-cyan-400 opacity-0 group-hover/notes:opacity-100 transition-opacity">
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span>Saved {job.savedAt ? new Date(job.savedAt).toLocaleDateString() : 'N/A'}</span>
                        {job.appliedAt && <><span>•</span><span>Applied {new Date(job.appliedAt).toLocaleDateString()}</span></>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <select
                        value={job.status}
                        onChange={e => updateStatus(job.jobId, e.target.value)}
                        disabled={updating === job.jobId}
                        className="input-glass text-[10px] py-1 px-2 rounded-lg w-28"
                      >
                        <option value="saved">📌 Saved</option>
                        <option value="applied">📤 Applied</option>
                        <option value="interviewing">🎤 Interviewing</option>
                        <option value="offered">✅ Offered</option>
                        <option value="rejected">❌ Rejected</option>
                      </select>
                      {job.jobUrl && !job.jobUrl.includes('example.com') ? (
                        <a href={job.jobUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors" title="Open job posting">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <a href={`https://www.google.com/search?q=${encodeURIComponent((job.jobTitle || '') + ' ' + (job.company || '') + ' careers apply')}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 transition-colors" title="Search for this job">
                          <Search className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button onClick={() => removeJob(job.jobId)} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ JOB BROWSE TAB ============
function JobBrowseTab() {
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [hasRealJobs, setHasRealJobs] = useState(false);
  const [savedSet, setSavedSet] = useState(new Set());
  const [savingId, setSavingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Enhanced state
  const [sortBy, setSortBy] = useState('relevance');
  const [filterType, setFilterType] = useState('all');
  const [recentSearches, setRecentSearches] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  // Load recently saved and recent searches
  useEffect(() => {
    api.get('/saved-jobs').then(d => {
      if (d.jobs) setSavedSet(new Set(d.jobs.map(j => j.jobTitle)));
    }).catch(() => {});
    try {
      const saved = JSON.parse(localStorage.getItem('cgpt_recent_job_searches') || '[]');
      setRecentSearches(saved);
    } catch(e) {}
  }, []);

  const search = async () => {
    if (!keywords.trim()) return;
    setLoading(true);
    setSearched(true);
    setError('');
    try {
      const d = await api.post('/jobs/live-search', { keywords, location });
      if (d.error) throw new Error(d.error);
      setJobs(d.jobs || []);
      setHasRealJobs(d.hasRealJobs || false);
      setMessage(d.message || '');

      // Save to recent searches
      const newSearch = { keywords, location, count: (d.jobs || []).length, ts: Date.now() };
      const updated = [newSearch, ...recentSearches.filter(s => s.keywords !== keywords)].slice(0, 5);
      setRecentSearches(updated);
      try { localStorage.setItem('cgpt_recent_job_searches', JSON.stringify(updated)); } catch(e) {}
    } catch (e) {
      setError(e.message);
      setJobs([]);
    } finally { setLoading(false); }
  };

  const saveJob = async (job) => {
    setSavingId(job.id);
    try {
      await api.post('/saved-jobs/save', {
        jobTitle: job.title, company: job.company, salary: job.salary,
        jobUrl: job.url, location: job.location, source: job.source
      });
      setSavedSet(prev => new Set([...prev, job.title]));
    } catch (e) { console.error(e); }
    finally { setSavingId(null); }
  };

  // Filter & sort
  let displayJobs = [...jobs];
  if (filterType !== 'all') {
    displayJobs = displayJobs.filter(j => {
      if (filterType === 'remote') return (j.location || '').toLowerCase().includes('remote');
      if (filterType === 'fulltime') return (j.type || '').toLowerCase().includes('full');
      if (filterType === 'parttime') return (j.type || '').toLowerCase().includes('part');
      return true;
    });
  }
  if (sortBy === 'date') displayJobs.sort((a, b) => new Date(b.postedDate || 0) - new Date(a.postedDate || 0));
  if (sortBy === 'company') displayJobs.sort((a, b) => (a.company || '').localeCompare(b.company || ''));

  return (
    <div>
      {/* Search Bar */}
      <div className="glass-card overflow-hidden mb-4">
        <div className="p-5">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input value={keywords} onChange={e => setKeywords(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="Job title, skills, or keywords..." className="input-glass h-11" />
            </div>
            <div className="w-48">
              <Input value={location} onChange={e => setLocation(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="Location..." className="input-glass h-11" />
            </div>
            <Button onClick={search} disabled={loading || !keywords.trim()} className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white border-0 h-11 px-6 rounded-xl">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4 mr-2" />Search</>}
            </Button>
          </div>
          {message && <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1"><Globe className="w-3 h-3" />{message}</p>}
          {error && <p className="text-xs text-red-400 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
        </div>
      </div>

      {/* Recent Searches */}
      {!searched && recentSearches.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-wider">Recent Searches</p>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((s, i) => (
              <button key={i} onClick={() => { setKeywords(s.keywords); setLocation(s.location || ''); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors">
                <Clock className="w-3 h-3" />
                {s.keywords}{s.location ? ` • ${s.location}` : ''}
                <span className="text-[9px] text-slate-600">({s.count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters & Sort (shown after search) */}
      {searched && jobs.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <p className="text-sm text-slate-500">{displayJobs.length} of {jobs.length} jobs</p>
            <div className="flex items-center gap-1 ml-2">
              {[
                { label: 'All', value: 'all' },
                { label: 'Remote', value: 'remote' },
                { label: 'Full-time', value: 'fulltime' },
              ].map(f => (
                <button key={f.value} onClick={() => setFilterType(f.value)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${filterType === f.value ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-500 hover:text-white'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input-glass text-[10px] py-1.5 px-2 rounded-lg">
            <option value="relevance">Relevance</option>
            <option value="date">Newest</option>
            <option value="company">Company A-Z</option>
          </select>
        </div>
      )}

      {/* Results */}
      {!searched ? (
        <div className="glass-card-static p-16 text-center">
          <Globe className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-400 mb-2">Search for Jobs</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">Enter keywords like "React Developer" or "Data Scientist" to find job openings you can apply to directly.</p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <p className="text-sm text-slate-500">Searching job boards...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="glass-card-static p-12 text-center">
          <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No jobs found. Try different keywords or location.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mock data notice */}
          {!hasRealJobs && jobs.length > 0 && (
            <div className="rounded-xl p-4 mb-2 flex items-start gap-3 bg-amber-500/[0.05] border border-amber-500/10">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-400" />
              <div>
                <p className="text-sm text-amber-300 font-medium">Sample Listings</p>
                <p className="text-xs text-slate-400 mt-0.5">These are sample listings. Real jobs will appear when external job APIs are reachable. You can still click "Search to Apply" to find real openings via Google.</p>
              </div>
            </div>
          )}
          {displayJobs.map((job, i) => (
            <div key={job.id || i} className="glass-card overflow-hidden animate-slide-up" style={{ animationDelay: `${i * 0.04}s` }}>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-white">{job.title}</h3>
                      {job.source !== 'mock' ? (
                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/20 text-[9px]">Live</Badge>
                      ) : (
                        <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/20 text-[9px]">Sample</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 mb-3">
                      <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{job.company}</span>
                      {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>}
                      {job.salary && job.salary !== 'Competitive' && <span className="text-green-400 font-medium">{job.salary}</span>}
                      {job.type && <Badge className="bg-slate-500/15 text-slate-400 border-slate-500/20 text-[9px]">{job.type}</Badge>}
                    </div>
                    {job.description && (
                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-3">{job.description.substring(0, 200)}...</p>
                    )}
                    {job.postedDate && <p className="text-[10px] text-slate-600">Posted: {new Date(job.postedDate).toLocaleDateString()}</p>}
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {job.url && !job.url.includes('example.com') && job.source !== 'mock' ? (
                      <a href={job.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs font-medium hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-500/15">
                        <ExternalLink className="w-3.5 h-3.5" />Apply Now
                      </a>
                    ) : (
                      <a href={`https://www.google.com/search?q=${encodeURIComponent((job.title || '') + ' ' + (job.company || '') + ' careers apply')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-600 to-slate-500 text-white text-xs font-medium hover:from-slate-500 hover:to-slate-400 transition-all">
                        <Search className="w-3.5 h-3.5" />Search to Apply
                      </a>
                    )}
                    <button
                      onClick={() => saveJob(job)}
                      disabled={savingId === job.id || savedSet.has(job.title)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all ${savedSet.has(job.title) ? 'bg-green-500/15 text-green-300' : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white'}`}
                    >
                      {savingId === job.id ? <Loader2 className="w-3 h-3 animate-spin" /> : savedSet.has(job.title) ? <><CheckCircle2 className="w-3 h-3" />Saved</> : <><Bookmark className="w-3 h-3" />Save</>}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ LEARNING CENTER ============
function LearningCenter() {
  const [resumes, setResumes] = useState([]);
  const [paths, setPaths] = useState([]);
  const [selectedResume, setSelectedResume] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('generate');
  const [skillGaps, setSkillGaps] = useState(null);
  const [gapLoading, setGapLoading] = useState(false);

  useEffect(() => {
    api.get('/resumes').then(d => setResumes(d.resumes || []));
    api.get('/learning-paths').then(d => setPaths(d.paths || []));
  }, []);

  const generatePath = async () => {
    if (!selectedResume || !targetRole.trim()) { setError('Select a resume and enter target role'); return; }
    setLoading(true); setError('');
    try {
      const d = await api.post('/learning-path/generate', { resumeId: selectedResume, targetRole: targetRole.trim() });
      if (d.error) throw new Error(d.error);
      setPaths(prev => [{ pathId: d.pathId, targetRole: targetRole.trim(), learningPath: d.learningPath, createdAt: new Date().toISOString() }, ...prev]);
      setActiveTab('paths');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const analyzeGaps = async () => {
    if (!selectedResume || !targetRole.trim()) { setError('Select a resume and enter target role'); return; }
    setGapLoading(true); setError('');
    try {
      const d = await api.post('/learning-path/skill-gaps', { resumeId: selectedResume, targetRole: targetRole.trim() });
      if (d.error) throw new Error(d.error);
      setSkillGaps(d);
    } catch (e) { setError(e.message); }
    finally { setGapLoading(false); }
  };

  const tabs = [
    { id: 'generate', label: 'Generate Path', icon: Rocket },
    { id: 'paths', label: 'My Paths', icon: Compass, count: paths.length },
    { id: 'gaps', label: 'Skill Gaps', icon: Target },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto page-transition">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Learning Center</h1>
            <p className="text-sm text-slate-400">AI-powered learning paths & skill gap analysis</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-slate-800/50 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? 'bg-gradient-to-r from-indigo-600 to-purple-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Input Section */}
      {(activeTab === 'generate' || activeTab === 'gaps') && (
        <div className="glass-card p-6 mb-6 animate-slide-up">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Resume</label>
              <Select value={selectedResume} onValueChange={setSelectedResume}>
                <SelectTrigger className="input-glass h-11"><SelectValue placeholder="Select resume" /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {resumes.map(r => <SelectItem key={r.id} value={r.id} className="text-slate-200">{r.fileName}</SelectItem>)}
                </SelectContent>
              </Select>
              {resumes.length === 0 && <p className="text-[10px] text-amber-400 mt-1">Upload a resume first in Resume Analyzer</p>}
            </div>
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Target Role</label>
              <Input value={targetRole} onChange={e => setTargetRole(e.target.value)} placeholder="e.g., Senior Data Scientist" className="input-glass h-11" />
            </div>
            <div className="flex items-end gap-2">
              {activeTab === 'generate' && (
                <Button onClick={generatePath} disabled={loading} className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-500 text-white border-0 h-11 rounded-xl btn-glow">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating...</> : <><Sparkles className="w-4 h-4 mr-2" />Generate Path</>}
                </Button>
              )}
              {activeTab === 'gaps' && (
                <Button onClick={analyzeGaps} disabled={gapLoading} className="flex-1 bg-gradient-to-r from-amber-600 to-orange-500 text-white border-0 h-11 rounded-xl btn-glow">
                  {gapLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Analyzing...</> : <><Target className="w-4 h-4 mr-2" />Analyze Gaps</>}
                </Button>
              )}
            </div>
          </div>
          {error && <div className="mt-3 text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
        </div>
      )}

      {/* My Learning Paths */}
      {activeTab === 'paths' && (
        <div className="space-y-4 animate-slide-up">
          {paths.length === 0 ? (
            <div className="glass-card-static p-12 text-center">
              <GraduationCap className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-2">No learning paths yet</p>
              <p className="text-xs text-slate-500">Generate a learning path from the Generate tab</p>
            </div>
          ) : paths.map((p, idx) => (
            <div key={p.pathId || idx} className="glass-card overflow-hidden">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-indigo-400" />
                      {p.targetRole}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Created {formatDate(p.createdAt)}</p>
                  </div>
                  <Badge className="bg-indigo-500/15 text-indigo-300 border-indigo-500/20">Learning Path</Badge>
                </div>
                {p.learningPath && (
                  <div className="space-y-3">
                    {/* Skill Gaps */}
                    {p.learningPath.skillGaps && p.learningPath.skillGaps.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wider">Skills to Learn</p>
                        <div className="flex flex-wrap gap-2">
                          {p.learningPath.skillGaps.slice(0, 8).map((s, i) => (
                            <span key={i} className="px-3 py-1 rounded-full text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20">{typeof s === 'string' ? s : s.skill || s.name}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Courses */}
                    {p.learningPath.courses && p.learningPath.courses.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wider">Recommended Courses</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {p.learningPath.courses.slice(0, 6).map((c, i) => (
                            <div key={i} className="p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                              <p className="text-sm text-slate-200 font-medium">{c.title || c.name}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">{c.platform || c.provider} {c.duration ? `• ${c.duration}` : ''}</p>
                              {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:underline mt-1 inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" />View Course</a>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Steps/Milestones */}
                    {p.learningPath.steps && p.learningPath.steps.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wider">Learning Steps</p>
                        <div className="space-y-2">
                          {p.learningPath.steps.slice(0, 5).map((step, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02]">
                              <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                              <div>
                                <p className="text-sm text-slate-200">{typeof step === 'string' ? step : step.title || step.description}</p>
                                {step.duration && <p className="text-[10px] text-slate-500 mt-0.5">{step.duration}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Skill Gap Analysis */}
      {activeTab === 'gaps' && skillGaps && (
        <div className="space-y-4 animate-slide-up">
          {/* Analysis */}
          {skillGaps.skillAnalysis && (
            <div className="glass-card p-5">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-400" />
                Skill Gap Analysis
              </h3>
              {skillGaps.skillAnalysis.existingSkills && skillGaps.skillAnalysis.existingSkills.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-green-400 font-medium mb-2 uppercase tracking-wider">Your Current Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {skillGaps.skillAnalysis.existingSkills.map((s, i) => (
                      <span key={i} className="px-3 py-1 rounded-full text-xs bg-green-500/10 text-green-300 border border-green-500/20">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {skillGaps.skillAnalysis.missingSkills && skillGaps.skillAnalysis.missingSkills.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-red-400 font-medium mb-2 uppercase tracking-wider">Skills to Develop</p>
                  <div className="flex flex-wrap gap-2">
                    {skillGaps.skillAnalysis.missingSkills.map((s, i) => (
                      <span key={i} className="px-3 py-1 rounded-full text-xs bg-red-500/10 text-red-300 border border-red-500/20">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {skillGaps.skillAnalysis.prioritySkills && skillGaps.skillAnalysis.prioritySkills.length > 0 && (
                <div>
                  <p className="text-xs text-amber-400 font-medium mb-2 uppercase tracking-wider">Priority Skills to Learn First</p>
                  <div className="flex flex-wrap gap-2">
                    {skillGaps.skillAnalysis.prioritySkills.map((s, i) => (
                      <span key={i} className="px-3 py-1 rounded-full text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">{typeof s === 'string' ? s : s.skill || s.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Course Recommendations */}
          {skillGaps.courseRecommendations && skillGaps.courseRecommendations.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                Recommended Courses
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {skillGaps.courseRecommendations.map((c, i) => (
                  <div key={i} className="p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.03] transition-all group">
                    <p className="text-sm text-white font-medium mb-1">{c.title || c.name}</p>
                    <p className="text-[10px] text-slate-400">{c.platform || c.provider}</p>
                    {c.level && <Badge className="mt-2 bg-indigo-500/15 text-indigo-300 border-indigo-500/20 text-[10px]">{c.level}</Badge>}
                    {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:underline mt-2 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><ExternalLink className="w-3 h-3" />Open</a>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============ ADMIN ANALYTICS ============
function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const d = await api.get('/admin/analytics');
      setData(d);
    } catch(e) {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { loadData(); }, []);

  const exportData = () => {
    if (!data) return;
    const s = data.stats;
    const lines = [
      'CareerGPT Analytics Report',
      `Generated: ${new Date().toLocaleString()}`,
      '',
      'Key Metrics:',
      `Total Users: ${s.totalUsers || 0}`,
      `Resumes Analyzed: ${s.totalResumes || 0}`,
      `Mock Interviews: ${s.totalInterviews || 0}`,
      `Average ATS Score: ${s.avgAtsScore || 0}`,
      `Chat Sessions: ${s.totalChats || 0}`,
      `Career Paths: ${s.totalCareerPaths || 0}`,
      `Job Matches: ${s.totalJobMatches || 0}`,
      '',
      'Module Usage:',
      ...Object.entries(data.moduleUsage || {}).map(([mod, count]) => `  ${mod}: ${count}`),
      '',
      'Daily Activity (Last 7 Days):',
      ...(data.dailyActivity || []).map(d => `  ${d.date}: ${d.count} events`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'careergpt_analytics.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-6 flex items-center justify-center h-full"><div className="flex flex-col items-center gap-3"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /><p className="text-sm text-slate-500">Loading analytics...</p></div></div>;
  if (!data) return <div className="p-6 text-slate-400 text-center">No analytics data</div>;

  const s = data.stats;
  const totalActivity = (data.dailyActivity || []).reduce((a, b) => a + b.count, 0);
  const avgDaily = (data.dailyActivity || []).length > 0 ? (totalActivity / (data.dailyActivity || []).length).toFixed(1) : 0;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto page-transition">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Analytics Dashboard</h1>
          <p className="text-sm text-slate-400">Track usage and performance insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => loadData(true)} disabled={refreshing} variant="outline" className="border-slate-600 text-slate-300 rounded-xl text-xs h-9">
            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><BarChart3 className="w-3.5 h-3.5 mr-1.5" />Refresh</>}
          </Button>
          <Button onClick={exportData} variant="outline" className="border-slate-600 text-slate-300 rounded-xl text-xs h-9">
            <FileText className="w-3.5 h-3.5 mr-1.5" />Export
          </Button>
        </div>
      </div>
      {/* Engagement Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="glass-card-static p-4 text-center">
          <p className="text-2xl font-bold text-gradient">{totalActivity}</p>
          <p className="text-[10px] text-slate-500">Total Events (7d)</p>
        </div>
        <div className="glass-card-static p-4 text-center">
          <p className="text-2xl font-bold text-cyan-400">{avgDaily}</p>
          <p className="text-[10px] text-slate-500">Avg Daily Activity</p>
        </div>
        <div className="glass-card-static p-4 text-center">
          <p className="text-2xl font-bold text-violet-400">{Object.keys(data.moduleUsage || {}).length}</p>
          <p className="text-[10px] text-slate-500">Active Modules</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Users', value: s.totalUsers, icon: User, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
          { label: 'Resumes Analyzed', value: s.totalResumes, icon: FileText, color: 'text-teal-400', bgColor: 'bg-teal-500/10' },
          { label: 'Mock Interviews', value: s.totalInterviews, icon: Mic, color: 'text-violet-400', bgColor: 'bg-violet-500/10' },
          { label: 'Avg ATS Score', value: s.avgAtsScore, icon: Target, color: 'text-green-400', bgColor: 'bg-green-500/10' },
          { label: 'Chat Sessions', value: s.totalChats, icon: MessageSquare, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
          { label: 'Career Paths', value: s.totalCareerPaths, icon: Compass, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
          { label: 'Job Matches', value: s.totalJobMatches, icon: Briefcase, color: 'text-green-400', bgColor: 'bg-green-500/10' },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-5 group">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stat.value || 0}</p>
                <p className="text-xs text-slate-400">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Module Usage */}
      <div className="glass-card-static mb-6">
        <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white">Module Usage</h3></div>
        <div className="p-5">
          <div className="space-y-3">
            {Object.entries(data.moduleUsage || {}).sort((a, b) => b[1] - a[1]).map(([mod, count]) => {
              const maxCount = Math.max(...Object.values(data.moduleUsage || {}));
              return (
                <div key={mod}>
                  <div className="flex justify-between text-sm mb-1.5"><span className="text-slate-300 capitalize">{mod.replace(/_/g, ' ')}</span><span className="text-slate-400 font-medium">{count}</span></div>
                  <Progress value={(count / maxCount) * 100} className="h-2" />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Daily Activity */}
      <div className="glass-card-static mb-6">
        <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white">Daily Activity (Last 7 Days)</h3></div>
        <div className="p-5">
          <div className="flex items-end gap-3 h-36">
            {(data.dailyActivity || []).map((d, i) => {
              const maxVal = Math.max(...(data.dailyActivity || []).map(x => x.count), 1);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <div className="w-full bg-gradient-to-t from-cyan-500/40 to-cyan-500/10 rounded-t-lg transition-all duration-300 group-hover:from-cyan-500/60 group-hover:to-cyan-500/20" style={{ height: `${Math.max((d.count / maxVal) * 100, 5)}%` }} />
                  <span className="text-[10px] text-slate-500">{d.date?.slice(5)}</span>
                  <span className="text-[10px] text-slate-300 font-medium">{d.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Events */}
      <div className="glass-card-static">
        <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white">Recent Activity</h3></div>
        <div className="p-5">
          <div className="space-y-2">
            {(data.recentEvents || []).map((e, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                <div className="w-2 h-2 rounded-full bg-cyan-400" />
                <span className="text-xs text-slate-300 flex-1 capitalize">{e.type.replace(/_/g, ' ')}</span>
                <span className="text-[10px] text-slate-500">{formatDateTime(e.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ USER PROFILE ============
function UserProfile({ user, onUpdate }) {
  const [name, setName] = useState(user?.name || '');
  const [skills, setSkills] = useState((user?.profile?.skills || []).join(', '));
  const [interests, setInterests] = useState((user?.profile?.interests || []).join(', '));
  const [education, setEducation] = useState(user?.profile?.education || '');
  const [experience, setExperience] = useState(user?.profile?.experience || '');
  const [careerGoal, setCareerGoal] = useState(user?.profile?.careerGoal || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resumes, setResumes] = useState([]);
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  // Validation
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    api.get('/resumes').then(d => setResumes(d.resumes || []));
    api.get('/profile').then(d => {
      setStats(d.stats);
      setRecentActivity(d.recentActivity || []);
    });
  }, []);

  // Profile completeness
  const fields = [name, skills, interests, education, experience, careerGoal];
  const filledCount = fields.filter(f => f && f.trim().length > 0).length;
  const completeness = Math.round((filledCount / fields.length) * 100);

  const initials = (user?.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);

  const save = async () => {
    // Validate name
    if (!name || name.trim().length < 2) {
      setNameError('Name must be at least 2 characters');
      return;
    }
    setNameError('');
    setSaving(true);
    setSaved(false);
    await api.put('/profile', {
      name: name.trim(),
      profile: {
        skills: skills.split(',').map(s => s.trim()).filter(Boolean),
        interests: interests.split(',').map(s => s.trim()).filter(Boolean),
        education: education.trim(),
        experience: experience.trim(),
        careerGoal: careerGoal.trim(),
      },
    });
    setSaving(false);
    setSaved(true);
    if (onUpdate) onUpdate({ ...user, name: name.trim(), profile: { skills: skills.split(',').map(s => s.trim()).filter(Boolean), interests: interests.split(',').map(s => s.trim()).filter(Boolean), education: education.trim(), experience: experience.trim(), careerGoal: careerGoal.trim() } });
    setTimeout(() => setSaved(false), 3000);
  };

  // Export profile data
  const exportProfileData = () => {
    const data = {
      name: user?.name,
      email: user?.email,
      profile: {
        skills: skills.split(',').map(s => s.trim()).filter(Boolean),
        interests: interests.split(',').map(s => s.trim()).filter(Boolean),
        education,
        experience,
        careerGoal,
      },
      stats,
      resumes: resumes.map(r => ({
        fileName: r.fileName,
        atsScore: r.analysis?.atsScore,
        createdAt: r.createdAt,
      })),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `careergpt_profile_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const changePassword = async () => {
    setPwMsg(null);
    if (!currentPw || !newPw) { setPwMsg({ type: 'error', text: 'All fields required' }); return; }
    if (newPw.length < 6) { setPwMsg({ type: 'error', text: 'Password must be at least 6 characters' }); return; }
    if (newPw !== confirmPw) { setPwMsg({ type: 'error', text: 'New passwords do not match' }); return; }
    setPwLoading(true);
    try {
      const d = await api.post('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
      if (d.error) throw new Error(d.error);
      setPwMsg({ type: 'success', text: 'Password changed successfully!' });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => { setPwMsg(null); setShowPasswordChange(false); }, 3000);
    } catch (e) { setPwMsg({ type: 'error', text: e.message }); }
    finally { setPwLoading(false); }
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto page-transition">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">My Profile</h1>
        <p className="text-sm text-slate-400">Manage your career profile and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Form */}
        <div className="lg:col-span-2 space-y-5">
          {/* Avatar & Completeness */}
          <div className="glass-card overflow-hidden">
            <div className="p-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-cyan-500/20">
                  {initials}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">{user?.name || 'User'}</h3>
                  <p className="text-xs text-slate-400">{user?.email}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <Progress value={completeness} className="h-2 flex-1" />
                    <span className={`text-xs font-bold ${completeness >= 80 ? 'text-green-400' : completeness >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{completeness}%</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {completeness >= 100 ? 'Profile complete! Great job!' : `${fields.length - filledCount} field${fields.length - filledCount !== 1 ? 's' : ''} remaining to complete your profile`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="p-5 pb-0">
              <h3 className="text-base font-semibold text-white">Personal Information</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Full Name</label>
                <Input value={name} onChange={e => { setName(e.target.value); if (nameError) setNameError(''); }} className={`input-glass h-11 ${nameError ? 'border-red-500/50' : ''}`} placeholder="Your full name" />
                {nameError && <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{nameError}</p>}
              </div>
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Email</label>
                <Input value={user?.email || ''} disabled className="input-glass h-11 opacity-50" />
              </div>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="p-5 pb-0">
              <h3 className="text-base font-semibold text-white">Career Profile</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Career Goal</label>
                <Input value={careerGoal} onChange={e => setCareerGoal(e.target.value)} placeholder="e.g., Become a Senior Full-Stack Developer at a top tech company" className="input-glass h-11" />
                <p className="text-[10px] text-slate-500 mt-1">What's your dream career objective?</p>
              </div>
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Skills <span className="text-slate-500 normal-case">(comma separated)</span></label>
                <textarea value={skills} onChange={e => setSkills(e.target.value)} rows={2} placeholder="Python, React, SQL, Machine Learning..." className="w-full input-glass resize-none text-sm" />
                {skills.trim() && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {skills.split(',').map(s => s.trim()).filter(Boolean).map((skill, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 text-[10px] font-medium border border-cyan-500/20">{skill}</span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Interests <span className="text-slate-500 normal-case">(comma separated)</span></label>
                <textarea value={interests} onChange={e => setInterests(e.target.value)} rows={2} placeholder="AI, Web Development, Data Science..." className="w-full input-glass resize-none text-sm" />
                {interests.trim() && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {interests.split(',').map(s => s.trim()).filter(Boolean).map((interest, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-violet-500/10 text-violet-300 text-[10px] font-medium border border-violet-500/20">{interest}</span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Education</label>
                <Input value={education} onChange={e => setEducation(e.target.value)} placeholder="B.Tech Computer Science, MIT..." className="input-glass h-11" />
              </div>
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Experience</label>
                <Input value={experience} onChange={e => setExperience(e.target.value)} placeholder="2 years as Software Developer..." className="input-glass h-11" />
              </div>
              <Button onClick={save} disabled={saving} className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-0 h-11 rounded-xl btn-glow shadow-lg shadow-blue-500/15">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : saved ? <><CheckCircle2 className="w-4 h-4 mr-2" />Saved!</> : 'Save Profile'}
              </Button>
            </div>
          </div>

          {/* Password Change */}
          {user?.role !== 'guest' && (
            <div className="glass-card overflow-hidden">
              <div className="p-5">
                <button onClick={() => setShowPasswordChange(!showPasswordChange)} className="flex items-center justify-between w-full">
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center"><AlertCircle className="w-4 h-4 text-red-400" /></div>
                    Security
                  </h3>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showPasswordChange ? 'rotate-180' : ''}`} />
                </button>
                {showPasswordChange && (
                  <div className="mt-4 space-y-3 animate-fade-in">
                    <div>
                      <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Current Password</label>
                      <Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className="input-glass h-10" placeholder="Enter current password" />
                    </div>
                    <div>
                      <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">New Password</label>
                      <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="input-glass h-10" placeholder="Min 6 characters" />
                    </div>
                    <div>
                      <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Confirm New Password</label>
                      <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className="input-glass h-10" placeholder="Confirm new password" />
                    </div>
                    {pwMsg && (
                      <div className={`text-sm p-3 rounded-xl flex items-center gap-2 ${pwMsg.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                        {pwMsg.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        {pwMsg.text}
                      </div>
                    )}
                    <Button onClick={changePassword} disabled={pwLoading} className="w-full bg-gradient-to-r from-red-600 to-orange-500 text-white border-0 h-10 rounded-xl">
                      {pwLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Changing...</> : 'Change Password'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stats & Resume History */}
        <div className="space-y-5">
          <div className="glass-card overflow-hidden">
            <div className="p-5 pb-0 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Stats</h3>
              <Button onClick={exportProfileData} variant="ghost" className="text-slate-400 hover:text-white h-8 px-2 text-[10px]">
                <Download className="w-3.5 h-3.5 mr-1" />Export Data
              </Button>
            </div>
            <div className="p-5 space-y-2.5">
              {stats && [
                { label: 'Chat Sessions', value: stats.chatCount, icon: MessageSquare, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
                { label: 'Resumes Analyzed', value: stats.resumeCount, icon: FileText, color: 'text-teal-400', bgColor: 'bg-teal-500/10' },
                { label: 'Mock Interviews', value: stats.interviewCount, icon: Mic, color: 'text-violet-400', bgColor: 'bg-violet-500/10' },
                { label: 'Career Paths', value: stats.careerPathCount, icon: Compass, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
                { label: 'Job Matches', value: stats.jobMatchCount, icon: Target, color: 'text-green-400', bgColor: 'bg-green-500/10' },
                { label: 'Saved Jobs', value: stats.savedJobsCount, icon: Bookmark, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
                { label: 'Learning Paths', value: stats.learningPathCount, icon: GraduationCap, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10' },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  <div className={`w-8 h-8 rounded-lg ${s.bgColor} flex items-center justify-center`}>
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <span className="text-sm text-slate-300 flex-1">{s.label}</span>
                  <span className="text-sm font-bold text-white">{s.value || 0}</span>
                </div>
              ))}
              <div className="text-center pt-3 space-y-1">
                <p className="text-[10px] text-slate-500">Member since {formatDate(user?.createdAt)}</p>
                {stats && <p className="text-[10px] text-slate-600">Total: {(stats.chatCount || 0) + (stats.resumeCount || 0) + (stats.interviewCount || 0) + (stats.careerPathCount || 0) + (stats.jobMatchCount || 0) + (stats.savedJobsCount || 0) + (stats.learningPathCount || 0)} interactions</p>}
              </div>
            </div>
          </div>

          {/* Career Goal Card */}
          {careerGoal && (
            <div className="glass-card overflow-hidden">
              <div className="p-5">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-2"><Target className="w-4 h-4 text-amber-400" />Career Goal</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{careerGoal}</p>
              </div>
            </div>
          )}

          <div className="glass-card overflow-hidden">
            <div className="p-5 pb-0">
              <h3 className="text-base font-semibold text-white">Resume History</h3>
            </div>
            <div className="p-5">
              {resumes.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">No resumes uploaded yet</p>
              ) : (
                <div className="space-y-2">
                  {resumes.map(r => (
                    <div key={r.id} className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-teal-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-200 truncate font-medium">{r.fileName}</p>
                        <p className="text-[10px] text-slate-500">{formatDate(r.createdAt)}</p>
                      </div>
                      {r.analysis?.atsScore && (
                        <Badge className={`text-[10px] ${r.analysis.atsScore >= 70 ? 'bg-green-500/15 text-green-300 border-green-500/20' : r.analysis.atsScore >= 50 ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20' : 'bg-red-500/15 text-red-300 border-red-500/20'}`}>
                          ATS: {r.analysis.atsScore}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          {recentActivity.length > 0 && (
            <div className="glass-card overflow-hidden">
              <div className="p-5 pb-0">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  Recent Activity
                </h3>
              </div>
              <div className="p-5">
                <div className="space-y-2">
                  {recentActivity.slice(0, 5).map((event, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                      <div className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0" />
                      <span className="text-[11px] text-slate-300 flex-1 capitalize">{(event.type || 'activity').replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-slate-500">{formatDateTime(event.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ MAIN APP ============
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
          <span className="text-sm text-slate-400">Loading CareerGPT...</span>
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
      case 'chat': return <AIChat />;
      case 'resume': return <ResumeAnalyzer />;
      case 'career': return <CareerPath onNavigate={setPage} />;
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
