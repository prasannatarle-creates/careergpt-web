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
  Award, Star, AlertCircle, Eye, EyeOff, Search
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = mode === 'register'
        ? await api.post('/auth/register', { name, email, password })
        : await api.post('/auth/login', { email, password });
      if (data.error) throw new Error(data.error);
      api.setToken(data.token);
      onAuth(data.user);
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
              {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-2 animate-scale-in"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
              <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white border-0 h-12 rounded-xl text-sm font-semibold btn-glow shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {mode === 'register' ? 'Create Account' : 'Sign In'}
              </Button>
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
    { id: 'jobs', label: 'Job Matching', icon: Briefcase, color: 'from-green-500 to-emerald-500', iconColor: 'text-green-400' },
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
  useEffect(() => {
    if (user) api.get('/profile').then(d => setStats(d.stats));
  }, [user]);

  const features = [
    { id: 'chat', title: 'AI Career Chat', desc: '5-model AI guidance', icon: MessageSquare, color: 'from-blue-500 to-cyan-500', count: stats?.chatCount },
    { id: 'resume', title: 'Resume Analyzer', desc: 'ATS scoring & feedback', icon: FileText, color: 'from-teal-500 to-cyan-500', count: stats?.resumeCount },
    { id: 'career', title: 'Career Path', desc: 'Structured roadmaps', icon: Compass, color: 'from-amber-500 to-orange-500', count: stats?.careerPathCount },
    { id: 'interview', title: 'Mock Interview', desc: 'AI interview practice', icon: Mic, color: 'from-violet-500 to-purple-500', count: stats?.interviewCount },
    { id: 'jobs', title: 'Job Matching', desc: 'AI skill matching', icon: Briefcase, color: 'from-green-500 to-emerald-500' },
    { id: 'analytics', title: 'Analytics', desc: 'Usage insights', icon: BarChart3, color: 'from-pink-500 to-rose-500' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto page-transition">
      {/* Hero Section */}
      <div className="mb-10 relative">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Welcome back</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-white mb-2 tracking-tight">
            {user ? `Hello, ${user.name}` : 'Welcome'}! <span className="inline-block animate-float" style={{ animationDuration: '3s' }}>👋</span>
          </h1>
          <p className="text-slate-400 text-base">Your AI-powered career guidance hub</p>
        </div>
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Chat Sessions', value: stats.chatCount, icon: MessageSquare, color: 'from-cyan-500 to-blue-500', bgColor: 'bg-cyan-500/10', textColor: 'text-cyan-400' },
            { label: 'Resumes', value: stats.resumeCount, icon: FileText, color: 'from-teal-500 to-cyan-500', bgColor: 'bg-teal-500/10', textColor: 'text-teal-400' },
            { label: 'Interviews', value: stats.interviewCount, icon: Mic, color: 'from-violet-500 to-purple-500', bgColor: 'bg-violet-500/10', textColor: 'text-violet-400' },
            { label: 'Career Paths', value: stats.careerPathCount, icon: Compass, color: 'from-amber-500 to-orange-500', bgColor: 'bg-amber-500/10', textColor: 'text-amber-400' },
          ].map((s, i) => (
            <div key={i} className="glass-card p-5 group" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${s.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                  <s.icon className={`w-5 h-5 ${s.textColor}`} />
                </div>
                <TrendingUp className="w-4 h-4 text-slate-600" />
              </div>
              <p className="text-2xl font-bold text-white">{s.value || 0}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Feature Cards */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" /> Quick Actions
        </h2>
        <p className="text-sm text-slate-500 mb-5">Jump into any tool to supercharge your career</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
        {features.map((f, i) => (
          <div
            key={f.id}
            onClick={() => onNavigate(f.id)}
            className="glass-card cursor-pointer group overflow-hidden relative"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {/* Hover gradient overlay */}
            <div className={`absolute inset-0 bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-[0.06] transition-opacity duration-500`} />
            <div className="p-6 relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300`}>
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all duration-300" />
              </div>
              <h3 className="text-white font-semibold text-base mb-1">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              {f.count !== undefined && f.count > 0 && (
                <div className="mt-4">
                  <span className="badge-primary text-[11px]">
                    <CheckCircle2 className="w-3 h-3" /> {f.count} completed
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

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

// ============ AI CHAT (condensed) ============
function AIChat() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedMsg, setExpandedMsg] = useState(null);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { api.get('/chat/sessions').then(d => setSessions((d.sessions || []).filter(s => s.type === 'career-chat'))); }, []);

  const loadSession = async (id) => {
    const d = await api.get(`/chat/sessions/${id}`);
    setActiveSession(id);
    setMessages(d.session?.messages || []);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim(); setInput(''); setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: msg, timestamp: new Date().toISOString() }]);
    try {
      const d = await api.post('/chat/send', { sessionId: activeSession, message: msg });
      if (d.error) throw new Error(d.error);
      if (!activeSession) setActiveSession(d.sessionId);
      setMessages(prev => [...prev, { role: 'assistant', content: d.response, timestamp: new Date().toISOString(), models: d.models, failedModels: d.failedModels, synthesized: d.synthesized, individualResponses: d.individualResponses }]);
      api.get('/chat/sessions').then(d2 => setSessions((d2.sessions || []).filter(s => s.type === 'career-chat')));
    } catch (e) { setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}`, isError: true }]); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex h-full">
      {/* Session List */}
      <div className="w-72 flex flex-col h-full relative" style={{ background: 'rgba(8, 12, 24, 0.6)', borderRight: '1px solid rgba(148, 163, 184, 0.07)' }}>
        <div className="p-4">
          <Button onClick={() => { setActiveSession(null); setMessages([]); }} className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-0 rounded-xl h-10 btn-glow shadow-lg shadow-blue-500/15" size="sm" data-testid="new-chat-btn">
            <Plus className="w-4 h-4 mr-2" /> New Conversation
          </Button>
        </div>
        <div className="px-4 mb-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Recent Chats</p>
        </div>
        <ScrollArea className="flex-1 px-3">
          {sessions.map(s => (
            <div key={s.id} onClick={() => loadSession(s.id)} className={`p-3 rounded-xl cursor-pointer mb-1.5 flex items-center justify-between group transition-all duration-200 ${activeSession === s.id ? 'bg-blue-600/15 border border-blue-500/20' : 'hover:bg-white/[0.03]'}`}>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-200 truncate font-medium">{s.title}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{formatDate(s.updatedAt)}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); api.del(`/chat/sessions/${s.id}`); if (activeSession === s.id) { setActiveSession(null); setMessages([]); } setSessions(prev => prev.filter(x => x.id !== s.id)); }} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Subtle background */}
        <div className="absolute inset-0 bg-grid-pattern pointer-events-none opacity-50" />
        
        <ScrollArea className="flex-1 p-4 relative z-10">
          {messages.length === 0 ? (
            <div className="max-w-xl mx-auto mt-16 text-center animate-slide-up">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-400 to-teal-400 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-cyan-500/20 animate-float">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">CareerGPT Chat</h2>
              <p className="text-slate-400 text-sm mb-8">Powered by 5 AI models for comprehensive career advice</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {['Best AI career paths for 2025?', 'How to prepare for tech interviews?', 'Skills for data science career?', 'Create a 6-month career plan'].map((q, i) => (
                  <button key={i} onClick={() => setInput(q)} className="text-left p-4 rounded-xl border border-slate-700/50 bg-slate-900/30 hover:bg-slate-800/50 hover:border-cyan-500/20 text-slate-300 text-sm transition-all duration-300 group backdrop-blur-sm">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 mb-1.5 group-hover:scale-110 transition-transform" />
                    <span>{q}</span>
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
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/15'
                      : msg.isError
                        ? 'bg-red-900/30 border border-red-700/30 text-red-200'
                        : 'glass-card-static text-slate-200'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-invert prose-sm max-w-none [&>*]:text-slate-200 [&>p]:text-slate-200 [&>h1]:text-white [&>h2]:text-white [&>h3]:text-cyan-300 [&>strong]:text-cyan-300 [&>li]:text-slate-200 [&>ul]:text-slate-200 [&>ol]:text-slate-200 [&>code]:bg-slate-700/50 [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded-md [&>pre]:bg-slate-800/80 [&>pre]:rounded-xl [&>pre]:border [&>pre]:border-slate-700/50">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    )}
                    {msg.models && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-700/30 flex flex-wrap gap-1.5 items-center">
                        {msg.synthesized && <Badge className="bg-cyan-500/15 text-cyan-300 border-cyan-500/20 text-[9px] px-2 py-0.5 rounded-full">SYNTHESIZED</Badge>}
                        {msg.models.map((m, j) => <span key={j} className="text-[9px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (m.color || '#888') + '15', color: m.color || '#888', border: `1px solid ${(m.color || '#888')}20` }}>{m.name || m}</span>)}
                        {(msg.failedModels || []).map((f, j) => <span key={'f'+j} className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">✕ {f.name}</span>)}
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
                      <span className="text-xs text-slate-400">Consulting AI models...</span>
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
          <div className="max-w-3xl mx-auto flex gap-3">
            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Ask about careers, skills, interviews..."
                className="input-glass h-12 rounded-xl pr-4 text-sm"
                disabled={loading}
              />
            </div>
            <Button onClick={sendMessage} disabled={!input.trim() || loading} className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-0 rounded-xl h-12 w-12 p-0 btn-glow shadow-lg shadow-blue-500/15 hover:shadow-blue-500/25">
              <Send className="w-4 h-4" />
            </Button>
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
  const fileRef = useRef(null);

  const analyze = async () => {
    if (!file) return;
    setError(''); setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const up = await api.post('/resume/upload', fd);
      if (up.error) throw new Error(up.error);
      setUploading(false); setAnalyzing(true);
      const an = await api.post('/resume/analyze', { resumeId: up.resumeId, targetRole });
      if (an.error) throw new Error(an.error);
      setAnalysis(an.analysis);
    } catch (e) { setError(e.message); }
    finally { setUploading(false); setAnalyzing(false); }
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
    doc.text(`Experience Level: ${a.experienceLevel || 'N/A'}`, 20, y); y += 10;

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

  if (analysis) {
    const a = analysis;
    const isRaw = a.raw;
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto page-transition">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Resume Analysis</h1>
          <div className="flex gap-2">
            {!isRaw && <Button onClick={downloadPDF} variant="outline" className="border-green-600/30 text-green-300 hover:bg-green-900/20 rounded-xl"><FileText className="w-4 h-4 mr-2" />Download PDF</Button>}
            <Button onClick={() => { setAnalysis(null); setFile(null); }} variant="outline" className="border-slate-600/30 text-slate-300 hover:bg-slate-800/30 rounded-xl">Analyze Another</Button>
          </div>
        </div>

        {isRaw ? (
          <div className="glass-card-static p-6"><div className="prose prose-invert max-w-none [&>*]:text-slate-200 [&>p]:text-slate-200 [&>h1]:text-white [&>h2]:text-white [&>h3]:text-cyan-300 [&>strong]:text-cyan-300 [&>li]:text-slate-200"><ReactMarkdown remarkPlugins={[remarkGfm]}>{a.overallFeedback || JSON.stringify(a)}</ReactMarkdown></div></div>
        ) : (
          <div className="space-y-6">
            {/* ATS Score */}
            <div className="glass-card-bright">
              <div className="p-6">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-full border-4 flex items-center justify-center animate-scale-in" style={{ borderColor: a.atsScore >= 70 ? '#22c55e' : a.atsScore >= 50 ? '#eab308' : '#ef4444' }}>
                    <span className="text-3xl font-bold text-white">{a.atsScore}</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">ATS Score: {a.atsScore}/100</h2>
                    <p className="text-slate-400 text-sm mt-1">{a.experienceLevel ? `Experience Level: ${a.experienceLevel}` : ''}</p>
                    <div className="flex gap-2 mt-2">
                      {(a.matchingRoles || []).slice(0, 3).map((r, i) => <Badge key={i} className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">{r}</Badge>)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sections */}
            {a.sections && (
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white">Section-by-Section Analysis</h3></div>
                <div className="p-5 space-y-3">
                  {Object.entries(a.sections).map(([key, sec]) => (
                    <div key={key} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white capitalize">{key}</span>
                        <div className="flex items-center gap-2">
                          {sec.present ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                          <span className={`text-sm font-bold ${sec.score >= 70 ? 'text-green-400' : sec.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{sec.score}/100</span>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card-static">
                  <div className="p-5 pb-0"><h3 className="text-sm font-semibold text-green-400">Keywords Found</h3></div>
                  <div className="p-5"><div className="flex flex-wrap gap-1.5">{(a.keywords.found || []).map((k, i) => <Badge key={i} className="bg-green-500/15 text-green-300 border-green-500/20 text-xs">{k}</Badge>)}</div></div>
                </div>
                <div className="glass-card-static">
                  <div className="p-5 pb-0"><h3 className="text-sm font-semibold text-red-400">Missing Keywords</h3></div>
                  <div className="p-5"><div className="flex flex-wrap gap-1.5">{(a.keywords.missing || []).map((k, i) => <Badge key={i} className="bg-red-500/15 text-red-300 border-red-500/20 text-xs">{k}</Badge>)}</div></div>
                </div>
              </div>
            )}

            {/* Rewritten Bullets */}
            {a.rewrittenBullets && a.rewrittenBullets.length > 0 && (
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-sm font-semibold text-white">Improved Bullet Points</h3></div>
                <div className="p-5 space-y-3">
                  {a.rewrittenBullets.map((b, i) => (
                    <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                      <p className="text-xs text-red-300 line-through mb-1">{b.original}</p>
                      <p className="text-xs text-green-300">{b.improved}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{b.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strengths / Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-sm font-semibold text-green-400">Strengths</h3></div>
                <div className="p-5">{(a.strengths || []).map((s, i) => <div key={i} className="flex gap-2 mb-2"><CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /><span className="text-xs text-slate-300 leading-relaxed">{s}</span></div>)}</div>
              </div>
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-sm font-semibold text-amber-400">Areas to Improve</h3></div>
                <div className="p-5">{(a.weaknesses || []).map((w, i) => <div key={i} className="flex gap-2 mb-2"><AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" /><span className="text-xs text-slate-300 leading-relaxed">{w}</span></div>)}</div>
              </div>
            </div>

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Resume Analyzer & ATS Scorer</h1>
        <p className="text-sm text-slate-400">Upload your resume and get AI-powered ATS analysis</p>
      </div>
      <div className="glass-card overflow-hidden">
        <div className="p-6 space-y-5">
          <div onClick={() => fileRef.current?.click()} className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${file ? 'border-green-500/40 bg-green-500/5' : 'border-slate-600/40 hover:border-cyan-500/30 hover:bg-cyan-500/5'}`}>
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.txt,.md" onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />
            {file ? (
              <div className="animate-scale-in">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-white font-semibold text-lg">{file.name}</p>
                <p className="text-slate-400 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-7 h-7 text-slate-400" />
                </div>
                <p className="text-white font-medium">Drop resume here or click to browse</p>
                <p className="text-slate-500 text-xs mt-1">PDF, TXT supported</p>
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
function CareerPath() {
  const [skills, setSkills] = useState('');
  const [interests, setInterests] = useState('');
  const [education, setEducation] = useState('');
  const [experience, setExperience] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const generate = async () => {
    setLoading(true);
    try {
      const d = await api.post('/career-path/generate', { skills, interests, education, experience });
      if (d.error) throw new Error(d.error);
      setResult(d);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (result) {
    const cp = result.careerPath;
    const isRaw = cp.raw;
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">{cp.title || 'Career Path'}</h1>
          <Button onClick={() => setResult(null)} variant="outline" className="border-slate-600 text-slate-300">Generate Another</Button>
        </div>

        {isRaw ? (
          <div className="glass-card-static p-6"><div className="prose prose-invert max-w-none [&>*]:text-slate-200 [&>p]:text-slate-200 [&>h1]:text-white [&>h2]:text-white [&>h3]:text-cyan-300 [&>strong]:text-cyan-300 [&>li]:text-slate-200"><ReactMarkdown remarkPlugins={[remarkGfm]}>{cp.summary}</ReactMarkdown></div></div>
        ) : (
          <div className="space-y-6">
            {cp.summary && <div className="glass-card-static p-6"><p className="text-slate-300 leading-relaxed">{cp.summary}</p>{cp.matchScore && <Badge className="mt-3 bg-green-500/15 text-green-300 border-green-500/20">{cp.matchScore}% Match</Badge>}</div>}

            {/* Timeline */}
            {cp.timeline && (
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white">Roadmap Timeline</h3></div>
                <div className="p-5 space-y-4">
                  {cp.timeline.map((phase, i) => (
                    <div key={i} className="relative pl-8 pb-4 border-l-2 border-cyan-500/30 last:border-0">
                      <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/30" />
                      <h3 className="text-white font-semibold">{phase.phase}</h3>
                      <p className="text-cyan-400 text-xs mb-2">{phase.duration}</p>
                      {phase.goals && <div className="space-y-1 mb-2">{phase.goals.map((g, j) => <div key={j} className="flex gap-2"><CheckCircle2 className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" /><span className="text-xs text-slate-300">{g}</span></div>)}</div>}
                      {phase.skills && <div className="flex flex-wrap gap-1.5">{phase.skills.map((s, j) => <Badge key={j} className="bg-blue-500/15 text-blue-300 border-blue-500/20 text-[10px]">{s}</Badge>)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Salary & Roles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cp.salaryRange && (
                <div className="glass-card-static">
                  <div className="p-5 pb-0"><h3 className="text-sm font-semibold text-white">Salary Ranges</h3></div>
                  <div className="p-5 space-y-2">
                    {Object.entries(cp.salaryRange).map(([k, v]) => <div key={k} className="flex justify-between items-center"><span className="text-slate-400 text-sm capitalize">{k}</span><span className="text-green-400 text-sm font-semibold">{v}</span></div>)}
                  </div>
                </div>
              )}
              {cp.certifications && (
                <div className="glass-card-static">
                  <div className="p-5 pb-0"><h3 className="text-sm font-semibold text-white">Certifications</h3></div>
                  <div className="p-5">{cp.certifications.map((c, i) => <div key={i} className="flex items-center gap-2 mb-2.5"><Award className="w-4 h-4 text-amber-400" /><span className="text-sm text-slate-300">{c.name}</span><Badge className={`text-[9px] ${c.priority === 'high' ? 'bg-red-500/15 text-red-300' : 'bg-slate-700/50 text-slate-400'}`}>{c.priority}</Badge></div>)}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto page-transition">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Career Path Generator</h1>
        <p className="text-sm text-slate-400">Get a personalized roadmap for your dream career</p>
      </div>
      <div className="glass-card overflow-hidden">
        <div className="p-6 space-y-5">
          <div>
            <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Your Skills</label>
            <textarea value={skills} onChange={e => setSkills(e.target.value)} rows={2} placeholder="Python, React, SQL..." className="w-full input-glass resize-none text-sm" />
          </div>
          <div>
            <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Interests</label>
            <textarea value={interests} onChange={e => setInterests(e.target.value)} rows={2} placeholder="AI, web dev, data science..." className="w-full input-glass resize-none text-sm" />
          </div>
          <div>
            <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Education</label>
            <Input value={education} onChange={e => setEducation(e.target.value)} placeholder="B.Tech CS, MBA..." className="input-glass h-11" />
          </div>
          <div>
            <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Experience</label>
            <Input value={experience} onChange={e => setExperience(e.target.value)} placeholder="2 years, fresher..." className="input-glass h-11" />
          </div>
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
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [role, setRole] = useState('Software Engineer');
  const [level, setLevel] = useState('mid-level');
  const [type, setType] = useState('behavioral');
  const [allFeedback, setAllFeedback] = useState([]);

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

    // Audio visualization
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
    setLoading(true);
    try {
      const d = await api.post('/mock-interview/start', { role, level, type });
      if (d.error) throw new Error(d.error);
      setSessionId(d.sessionId); setCurrentContent(d.question); setQuestionNum(1); setStarted(true);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) return;
    setLoading(true); setFeedback(null);
    try {
      const d = await api.post('/mock-interview/respond', { sessionId, answer });
      if (d.error) throw new Error(d.error);
      const fb = d.feedback;
      setFeedback(fb);
      setAllFeedback(prev => [...prev, fb]);
      setQuestionNum(d.questionNumber);
      setIsComplete(d.isComplete);
      setAnswer('');
      if (!d.isComplete && fb.nextQuestion) setCurrentContent(fb.nextQuestion);
    } catch (e) { console.error(e); } finally { setLoading(false); }
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
              <Input value={role} onChange={e => setRole(e.target.value)} className="input-glass h-11" />
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
                  </SelectContent>
                </Select>
              </div>
            </div>
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
        <h1 className="text-xl font-bold text-white">Mock Interview: {role}</h1>
        <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30">Q{Math.min(questionNum, 5)}/5</Badge>
      </div>
      <Progress value={Math.min(questionNum, 5) * 20} className="h-2 mb-4" />

      {/* Current Question / Feedback */}
      {feedback && !feedback.raw ? (
        <div className="glass-card-static mb-4">
          <div className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full border-4 flex items-center justify-center animate-scale-in" style={{ borderColor: feedback.score >= 7 ? '#22c55e' : feedback.score >= 5 ? '#eab308' : '#ef4444' }}>
                <span className="text-xl font-bold text-white">{feedback.score}/{feedback.maxScore || 10}</span>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-2">
                {[['Technical', feedback.technicalAccuracy], ['Communication', feedback.communicationScore], ['Structure', feedback.structureScore], ['Confidence', feedback.confidenceScore]].map(([l, v]) => (
                  v !== undefined && <div key={l}><p className="text-[10px] text-slate-500">{l}</p><Progress value={(v || 0) * 10} className="h-1.5" /><p className="text-[10px] text-slate-300">{v}/10</p></div>
                ))}
              </div>
            </div>
            <p className="text-sm text-slate-300 mb-3 leading-relaxed">{feedback.feedback}</p>
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

      {!isComplete ? (
        <div className="space-y-3">
          {/* Voice recording indicator */}
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
          </div>

          {voiceSupported && !isRecording && (
            <p className="text-[10px] text-slate-500 flex items-center gap-1"><Mic className="w-3 h-3" /> Click the mic icon to answer with your voice</p>
          )}

          <div className="flex gap-3">
            <Button onClick={() => { stopVoice(); submitAnswer(); }} disabled={!answer.trim() || loading} className="flex-1 bg-gradient-to-r from-violet-600 to-purple-500 text-white border-0 py-4 rounded-xl">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Evaluating...</> : <><Send className="w-4 h-4 mr-2" />Submit Answer</>}
            </Button>
            <Button onClick={() => { stopVoice(); setStarted(false); setFeedback(null); setAllFeedback([]); }} variant="outline" className="border-slate-600 text-slate-300">End</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Final scores summary */}
          {allFeedback.length > 0 && (
            <div className="glass-card-bright">
              <div className="p-5">
                <h3 className="text-white font-semibold mb-3">Interview Performance Summary</h3>
                <div className="grid grid-cols-5 gap-2">
                  {allFeedback.map((fb, i) => (
                    <div key={i} className="text-center p-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                      <p className="text-[10px] text-slate-400">Q{i+1}</p>
                      <p className={`text-lg font-bold ${(fb.score || 0) >= 7 ? 'text-green-400' : (fb.score || 0) >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>{fb.score || '?'}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-center">
                  <p className="text-slate-400 text-xs">Average Score</p>
                  <p className="text-2xl font-bold text-gradient">{(allFeedback.reduce((a, b) => a + (b.score || 0), 0) / allFeedback.length).toFixed(1)}/10</p>
                </div>
              </div>
            </div>
          )}
          <Button onClick={() => { stopVoice(); setStarted(false); setFeedback(null); setAllFeedback([]); }} className="w-full bg-gradient-to-r from-violet-600 to-purple-500 text-white border-0 py-4 rounded-xl">Start New Interview</Button>
        </div>
      )}
    </div>
  );
}

// ============ JOB MATCHING ============
function JobMatching() {
  const [skills, setSkills] = useState('');
  const [interests, setInterests] = useState('');
  const [experience, setExperience] = useState('');
  const [industry, setIndustry] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const match = async () => {
    setLoading(true);
    try {
      const d = await api.post('/job-match', { skills, interests, experience, targetIndustry: industry });
      if (d.error) throw new Error(d.error);
      setResult(d.matches);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (result) {
    const matches = result.matches || [];
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Job Matches</h1>
          <Button onClick={() => setResult(null)} variant="outline" className="border-slate-600 text-slate-300">Search Again</Button>
        </div>

        {result.summary && <div className="glass-card-static p-4 mb-4"><p className="text-slate-300 text-sm leading-relaxed">{result.summary}</p></div>}

        {result.raw ? (
          <div className="glass-card-static p-6"><div className="prose prose-invert max-w-none [&>*]:text-slate-200 [&>p]:text-slate-200 [&>h1]:text-white [&>h2]:text-white [&>h3]:text-cyan-300 [&>strong]:text-cyan-300 [&>li]:text-slate-200"><ReactMarkdown remarkPlugins={[remarkGfm]}>{result.summary}</ReactMarkdown></div></div>
        ) : (
          <div className="space-y-4">
            {matches.map((m, i) => (
              <div key={i} className="glass-card overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{m.role}</h3>
                      <p className="text-slate-400 text-xs">{m.company_type} | {m.salary}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold" style={{ color: m.matchScore >= 80 ? '#22c55e' : m.matchScore >= 60 ? '#eab308' : '#ef4444' }}>{m.matchScore}%</div>
                      <p className="text-[10px] text-slate-500">Match Score</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-300 mb-3 leading-relaxed">{m.why_match}</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(m.skills_matched || []).map((s, j) => <Badge key={j} className="bg-green-500/15 text-green-300 border-green-500/20 text-[10px]">{s}</Badge>)}
                    {(m.skills_gap || []).map((s, j) => <Badge key={'g'+j} className="bg-red-500/15 text-red-300 border-red-500/20 text-[10px]">Gap: {s}</Badge>)}
                  </div>
                  <div className="flex gap-4 text-[10px]">
                    <span className="text-slate-400">Growth: <span className={m.growth_potential === 'high' ? 'text-green-400' : 'text-yellow-400'}>{m.growth_potential}</span></span>
                    <span className="text-slate-400">Demand: <span className={m.demand === 'high' ? 'text-green-400' : 'text-yellow-400'}>{m.demand}</span></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto page-transition">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">AI Job Matching</h1>
        <p className="text-sm text-slate-400">Find the best job matches based on your profile</p>
      </div>
      <div className="glass-card overflow-hidden">
        <div className="p-6 space-y-5">
          <div>
            <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Skills</label>
            <textarea value={skills} onChange={e => setSkills(e.target.value)} rows={2} placeholder="Python, React, SQL..." className="w-full input-glass resize-none text-sm" />
          </div>
          <div>
            <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Interests</label>
            <Input value={interests} onChange={e => setInterests(e.target.value)} placeholder="AI, web dev..." className="input-glass h-11" />
          </div>
          <div>
            <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Experience</label>
            <Input value={experience} onChange={e => setExperience(e.target.value)} placeholder="2 years..." className="input-glass h-11" />
          </div>
          <div>
            <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Industry (optional)</label>
            <Input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="Tech, Finance..." className="input-glass h-11" />
          </div>
          <Button onClick={match} disabled={loading || !skills} className="w-full bg-gradient-to-r from-green-600 to-emerald-500 text-white border-0 h-12 rounded-xl btn-glow shadow-lg shadow-green-500/15">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Matching...</> : <><Search className="w-4 h-4 mr-2" />Find Matching Jobs</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============ ADMIN ANALYTICS ============
function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/analytics').then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 flex items-center justify-center h-full"><div className="flex flex-col items-center gap-3"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /><p className="text-sm text-slate-500">Loading analytics...</p></div></div>;
  if (!data) return <div className="p-6 text-slate-400 text-center">No analytics data</div>;

  const s = data.stats;
  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto page-transition">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Analytics Dashboard</h1>
        <p className="text-sm text-slate-400">Track usage and performance insights</p>
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resumes, setResumes] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/resumes').then(d => setResumes(d.resumes || []));
    api.get('/profile').then(d => setStats(d.stats));
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await api.put('/profile', {
      name,
      profile: {
        skills: skills.split(',').map(s => s.trim()).filter(Boolean),
        interests: interests.split(',').map(s => s.trim()).filter(Boolean),
        education,
        experience,
      },
    });
    setSaving(false);
    setSaved(true);
    if (onUpdate) onUpdate({ ...user, name, profile: { skills: skills.split(',').map(s => s.trim()).filter(Boolean), interests: interests.split(',').map(s => s.trim()).filter(Boolean), education, experience } });
    setTimeout(() => setSaved(false), 3000);
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
          <div className="glass-card overflow-hidden">
            <div className="p-5 pb-0">
              <h3 className="text-base font-semibold text-white">Personal Information</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Full Name</label>
                <Input value={name} onChange={e => setName(e.target.value)} className="input-glass h-11" />
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
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Skills <span className="text-slate-500 normal-case">(comma separated)</span></label>
                <textarea value={skills} onChange={e => setSkills(e.target.value)} rows={2} placeholder="Python, React, SQL, Machine Learning..." className="w-full input-glass resize-none text-sm" />
              </div>
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Interests <span className="text-slate-500 normal-case">(comma separated)</span></label>
                <textarea value={interests} onChange={e => setInterests(e.target.value)} rows={2} placeholder="AI, Web Development, Data Science..." className="w-full input-glass resize-none text-sm" />
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
        </div>

        {/* Stats & Resume History */}
        <div className="space-y-5">
          <div className="glass-card overflow-hidden">
            <div className="p-5 pb-0">
              <h3 className="text-base font-semibold text-white">Stats</h3>
            </div>
            <div className="p-5 space-y-2.5">
              {stats && [
                { label: 'Chat Sessions', value: stats.chatCount, icon: MessageSquare, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
                { label: 'Resumes Analyzed', value: stats.resumeCount, icon: FileText, color: 'text-teal-400', bgColor: 'bg-teal-500/10' },
                { label: 'Mock Interviews', value: stats.interviewCount, icon: Mic, color: 'text-violet-400', bgColor: 'bg-violet-500/10' },
                { label: 'Career Paths', value: stats.careerPathCount, icon: Compass, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  <div className={`w-8 h-8 rounded-lg ${s.bgColor} flex items-center justify-center`}>
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <span className="text-sm text-slate-300 flex-1">{s.label}</span>
                  <span className="text-sm font-bold text-white">{s.value || 0}</span>
                </div>
              ))}
              <div className="text-center pt-3">
                <p className="text-[10px] text-slate-500">Member since {formatDate(user?.createdAt)}</p>
              </div>
            </div>
          </div>

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
      case 'career': return <CareerPath />;
      case 'interview': return <MockInterview />;
      case 'jobs': return <JobMatching />;
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
