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

// ============ API HELPER ============
const api = {
  token: null,
  setToken(t) { this.token = t; if (t) localStorage.setItem('cgpt_token', t); else localStorage.removeItem('cgpt_token'); },
  getToken() { if (!this.token) this.token = typeof window !== 'undefined' ? localStorage.getItem('cgpt_token') : null; return this.token; },
  async fetch(url, options = {}) {
    const headers = { ...options.headers };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const res = await fetch(`/api${url}`, { ...options, headers });
    const data = await res.json();
    if (res.status === 401 && url !== '/auth/login' && url !== '/auth/register') {
      this.setToken(null);
      window.location.reload();
    }
    return data;
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Career<span className="text-cyan-400">GPT</span></h1>
          <p className="text-slate-400 mt-1">AI-Powered Career Guidance Platform</p>
        </div>

        <Card className="bg-slate-900/80 border-slate-700">
          <CardContent className="p-6">
            <div className="flex gap-2 mb-6">
              <Button onClick={() => setMode('login')} variant={mode === 'login' ? 'default' : 'ghost'} className={`flex-1 ${mode === 'login' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>
                <LogIn className="w-4 h-4 mr-2" /> Login
              </Button>
              <Button onClick={() => setMode('register')} variant={mode === 'register' ? 'default' : 'ghost'} className={`flex-1 ${mode === 'register' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>
                <UserPlus className="w-4 h-4 mr-2" /> Register
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="text-slate-300 text-sm block mb-1">Full Name</label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" className="bg-slate-800 border-slate-700 text-white" required />
                </div>
              )}
              <div>
                <label className="text-slate-300 text-sm block mb-1">Email</label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="bg-slate-800 border-slate-700 text-white" required />
              </div>
              <div>
                <label className="text-slate-300 text-sm block mb-1">Password</label>
                <div className="relative">
                  <Input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" className="bg-slate-800 border-slate-700 text-white pr-10" required minLength={6} />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <div className="text-red-400 text-sm bg-red-900/20 p-2 rounded">{error}</div>}
              <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-0">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {mode === 'register' ? 'Create Account' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <button onClick={() => onAuth(null)} className="mt-4 text-slate-500 hover:text-slate-300 text-sm flex items-center justify-center gap-1 w-full">
          Continue as Guest <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ============ SIDEBAR NAVIGATION ============
function Sidebar({ currentPage, onNavigate, user, onLogout, collapsed, onToggle }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, color: 'text-blue-400' },
    { id: 'chat', label: 'AI Career Chat', icon: MessageSquare, color: 'text-cyan-400' },
    { id: 'resume', label: 'Resume Analyzer', icon: FileText, color: 'text-teal-400' },
    { id: 'career', label: 'Career Path', icon: Compass, color: 'text-amber-400' },
    { id: 'interview', label: 'Mock Interview', icon: Mic, color: 'text-violet-400' },
    { id: 'jobs', label: 'Job Matching', icon: Briefcase, color: 'text-green-400' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, color: 'text-pink-400' },
  ];

  return (
    <div className={`${collapsed ? 'w-16' : 'w-64'} transition-all duration-300 border-r border-slate-800 bg-slate-900/70 flex flex-col h-screen`}>
      <div className="p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0 cursor-pointer" onClick={onToggle}>
          <Brain className="w-5 h-5 text-white" />
        </div>
        {!collapsed && <span className="text-lg font-bold text-white">Career<span className="text-cyan-400">GPT</span></span>}
      </div>

      <Separator className="bg-slate-800" />

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              currentPage === item.id
                ? 'bg-blue-600/20 text-white border border-blue-500/30'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon className={`w-5 h-5 flex-shrink-0 ${currentPage === item.id ? item.color : ''}`} />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      <Separator className="bg-slate-800" />

      <div className="p-3">
        {user ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{user.name?.[0]?.toUpperCase()}</span>
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{user.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
              </div>
            )}
            {!collapsed && (
              <button onClick={onLogout} className="text-slate-500 hover:text-red-400 p-1"><LogOut className="w-4 h-4" /></button>
            )}
          </div>
        ) : (
          !collapsed && <p className="text-xs text-slate-500 text-center">Guest Mode</p>
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
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">Welcome{user ? `, ${user.name}` : ''}!</h1>
        <p className="text-slate-400">Your AI-powered career guidance dashboard</p>
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Chats', value: stats.chatCount, icon: MessageSquare, color: 'text-cyan-400' },
            { label: 'Resumes', value: stats.resumeCount, icon: FileText, color: 'text-teal-400' },
            { label: 'Interviews', value: stats.interviewCount, icon: Mic, color: 'text-violet-400' },
            { label: 'Career Paths', value: stats.careerPathCount, icon: Compass, color: 'text-amber-400' },
          ].map((s, i) => (
            <Card key={i} className="bg-slate-900/60 border-slate-800">
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`w-8 h-8 ${s.color}`} />
                <div>
                  <p className="text-2xl font-bold text-white">{s.value || 0}</p>
                  <p className="text-xs text-slate-400">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map(f => (
          <Card
            key={f.id}
            onClick={() => onNavigate(f.id)}
            className="bg-slate-900/60 border-slate-800 cursor-pointer hover:bg-slate-800/60 hover:border-slate-600 transition-all group"
          >
            <CardContent className="p-6">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <f.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-white font-semibold mb-1">{f.title}</h3>
              <p className="text-slate-400 text-sm">{f.desc}</p>
              {f.count !== undefined && f.count > 0 && (
                <Badge className="mt-3 bg-slate-800 text-slate-300 border-slate-700">{f.count} completed</Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Models Status */}
      <Card className="bg-slate-900/60 border-slate-800 mt-8">
        <CardHeader>
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" /> AI Models Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {[
              { name: 'GPT-4.1', color: '#10a37f', status: 'active' },
              { name: 'Claude 4 Sonnet', color: '#d97706', status: 'active' },
              { name: 'Gemini 2.5 Flash', color: '#4285f4', status: 'active' },
              { name: 'Grok 3 Mini', color: '#ef4444', status: 'beta' },
              { name: 'Perplexity Sonar', color: '#22d3ee', status: 'beta' },
            ].map(m => (
              <div key={m.name} className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ borderColor: m.color + '30', backgroundColor: m.color + '10' }}>
                <div className={`w-2.5 h-2.5 rounded-full ${m.status === 'active' ? 'animate-pulse' : 'opacity-50'}`} style={{ backgroundColor: m.color }} />
                <span className="text-sm" style={{ color: m.color }}>{m.name}</span>
                {m.status === 'beta' && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400">beta</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
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
      <div className="w-64 border-r border-slate-800 bg-slate-900/30 flex flex-col">
        <div className="p-3">
          <Button onClick={() => { setActiveSession(null); setMessages([]); }} className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-0" size="sm">
            <Plus className="w-4 h-4 mr-2" /> New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1 px-3">
          {sessions.map(s => (
            <div key={s.id} onClick={() => loadSession(s.id)} className={`p-2.5 rounded-lg cursor-pointer mb-1 flex items-center justify-between group ${activeSession === s.id ? 'bg-blue-600/20 border border-blue-500/30' : 'hover:bg-slate-800'}`}>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-200 truncate">{s.title}</p>
                <p className="text-[10px] text-slate-500">{new Date(s.updatedAt).toLocaleDateString()}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); api.del(`/chat/sessions/${s.id}`); if (activeSession === s.id) { setActiveSession(null); setMessages([]); } setSessions(prev => prev.filter(x => x.id !== s.id)); }} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="max-w-xl mx-auto mt-8 text-center">
              <Brain className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">CareerGPT Chat</h2>
              <p className="text-slate-400 text-sm mb-6">Powered by 5 AI models for comprehensive career advice</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {['Best AI career paths for 2025?', 'How to prepare for tech interviews?', 'Skills for data science career?', 'Create a 6-month career plan'].map((q, i) => (
                  <button key={i} onClick={() => setInput(q)} className="text-left p-3 rounded-lg border border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-300 text-xs"><Sparkles className="w-3 h-3 text-cyan-400 mb-1" />{q}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.filter(m => !m.hidden).map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'assistant' && <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0 mt-1"><Bot className="w-4 h-4 text-white" /></div>}
                  <div className={`max-w-[80%] rounded-xl px-4 py-2.5 ${msg.role === 'user' ? 'bg-blue-600 text-white' : msg.isError ? 'bg-red-900/50 border border-red-700 text-red-200' : 'bg-slate-800 border border-slate-700 text-slate-200'}`}>
                    {msg.role === 'assistant' ? <div className="prose prose-invert prose-sm max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown></div> : <p className="text-sm">{msg.content}</p>}
                    {msg.models && (
                      <div className="mt-2 pt-2 border-t border-slate-700/50 flex flex-wrap gap-1 items-center">
                        {msg.synthesized && <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-[9px] px-1.5 py-0">SYNTHESIZED</Badge>}
                        {msg.models.map((m, j) => <span key={j} className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: (m.color || '#888') + '20', color: m.color || '#888' }}>{m.name || m}</span>)}
                        {(msg.failedModels || []).map((f, j) => <span key={'f'+j} className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">X {f.name}</span>)}
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0 mt-1"><User className="w-4 h-4 text-slate-300" /></div>}
                </div>
              ))}
              {loading && (
                <div className="flex gap-2"><div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center"><Bot className="w-4 h-4 text-white" /></div>
                  <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3"><div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-cyan-400" /><span className="text-xs text-slate-400">Consulting AI models...</span></div></div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </ScrollArea>
        <div className="border-t border-slate-800 p-3">
          <div className="max-w-3xl mx-auto flex gap-2">
            <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Ask about careers..." className="bg-slate-800 border-slate-700 text-white rounded-xl" disabled={loading} />
            <Button onClick={sendMessage} disabled={!input.trim() || loading} className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-0 rounded-xl"><Send className="w-4 h-4" /></Button>
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

  if (analysis) {
    const a = analysis;
    const isRaw = a.raw;
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Resume Analysis</h1>
          <Button onClick={() => { setAnalysis(null); setFile(null); }} variant="outline" className="border-slate-600 text-slate-300">Analyze Another</Button>
        </div>

        {isRaw ? (
          <Card className="bg-slate-900/60 border-slate-800"><CardContent className="p-6"><div className="prose prose-invert max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{a.overallFeedback || JSON.stringify(a)}</ReactMarkdown></div></CardContent></Card>
        ) : (
          <div className="space-y-6">
            {/* ATS Score */}
            <Card className="bg-slate-900/60 border-slate-800">
              <CardContent className="p-6">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-full border-4 flex items-center justify-center" style={{ borderColor: a.atsScore >= 70 ? '#22c55e' : a.atsScore >= 50 ? '#eab308' : '#ef4444' }}>
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
              </CardContent>
            </Card>

            {/* Sections */}
            {a.sections && (
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader><CardTitle className="text-white">Section-by-Section Analysis</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(a.sections).map(([key, sec]) => (
                    <div key={key} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
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
                </CardContent>
              </Card>
            )}

            {/* Keywords */}
            {a.keywords && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-slate-900/60 border-slate-800">
                  <CardHeader><CardTitle className="text-green-400 text-sm">Keywords Found</CardTitle></CardHeader>
                  <CardContent><div className="flex flex-wrap gap-1">{(a.keywords.found || []).map((k, i) => <Badge key={i} className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">{k}</Badge>)}</div></CardContent>
                </Card>
                <Card className="bg-slate-900/60 border-slate-800">
                  <CardHeader><CardTitle className="text-red-400 text-sm">Missing Keywords</CardTitle></CardHeader>
                  <CardContent><div className="flex flex-wrap gap-1">{(a.keywords.missing || []).map((k, i) => <Badge key={i} className="bg-red-500/20 text-red-300 border-red-500/30 text-xs">{k}</Badge>)}</div></CardContent>
                </Card>
              </div>
            )}

            {/* Rewritten Bullets */}
            {a.rewrittenBullets && a.rewrittenBullets.length > 0 && (
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader><CardTitle className="text-white text-sm">Improved Bullet Points</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {a.rewrittenBullets.map((b, i) => (
                    <div key={i} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                      <p className="text-xs text-red-300 line-through mb-1">{b.original}</p>
                      <p className="text-xs text-green-300">{b.improved}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{b.reason}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Strengths / Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader><CardTitle className="text-green-400 text-sm">Strengths</CardTitle></CardHeader>
                <CardContent>{(a.strengths || []).map((s, i) => <div key={i} className="flex gap-2 mb-1"><CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" /><span className="text-xs text-slate-300">{s}</span></div>)}</CardContent>
              </Card>
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader><CardTitle className="text-amber-400 text-sm">Areas to Improve</CardTitle></CardHeader>
                <CardContent>{(a.weaknesses || []).map((w, i) => <div key={i} className="flex gap-2 mb-1"><AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" /><span className="text-xs text-slate-300">{w}</span></div>)}</CardContent>
              </Card>
            </div>

            {a.overallFeedback && (
              <Card className="bg-slate-900/60 border-slate-800"><CardContent className="p-6"><p className="text-slate-300 text-sm">{a.overallFeedback}</p></CardContent></Card>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Resume Analyzer & ATS Scorer</h1>
      <Card className="bg-slate-900/60 border-slate-800">
        <CardContent className="p-6 space-y-4">
          <div onClick={() => fileRef.current?.click()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${file ? 'border-green-500 bg-green-500/10' : 'border-slate-600 hover:border-slate-500'}`}>
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.txt,.md" onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />
            {file ? <><CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" /><p className="text-white font-semibold">{file.name}</p><p className="text-slate-400 text-xs">{(file.size / 1024).toFixed(1)} KB</p></> : <><Upload className="w-10 h-10 text-slate-500 mx-auto mb-2" /><p className="text-white">Drop resume here or click to browse</p><p className="text-slate-400 text-xs">PDF, TXT supported</p></>}
          </div>
          <div>
            <label className="text-slate-300 text-sm block mb-1">Target Role (optional)</label>
            <Input value={targetRole} onChange={e => setTargetRole(e.target.value)} placeholder="e.g., Software Engineer, Data Scientist" className="bg-slate-800 border-slate-700 text-white" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <Button onClick={analyze} disabled={!file || uploading || analyzing} className="w-full bg-gradient-to-r from-teal-600 to-cyan-500 text-white border-0 py-5 rounded-xl">
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Uploading...</> : analyzing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Analyzing with AI...</> : <><Target className="w-4 h-4 mr-2" />Analyze Resume</>}
          </Button>
        </CardContent>
      </Card>
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
          <Card className="bg-slate-900/60 border-slate-800"><CardContent className="p-6"><div className="prose prose-invert max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{cp.summary}</ReactMarkdown></div></CardContent></Card>
        ) : (
          <div className="space-y-6">
            {cp.summary && <Card className="bg-slate-900/60 border-slate-800"><CardContent className="p-6"><p className="text-slate-300">{cp.summary}</p>{cp.matchScore && <Badge className="mt-2 bg-green-500/20 text-green-300 border-green-500/30">{cp.matchScore}% Match</Badge>}</CardContent></Card>}

            {/* Timeline */}
            {cp.timeline && (
              <Card className="bg-slate-900/60 border-slate-800">
                <CardHeader><CardTitle className="text-white">Roadmap Timeline</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {cp.timeline.map((phase, i) => (
                    <div key={i} className="relative pl-8 pb-4 border-l-2 border-cyan-500/30 last:border-0">
                      <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-cyan-500" />
                      <h3 className="text-white font-semibold">{phase.phase}</h3>
                      <p className="text-cyan-400 text-xs mb-2">{phase.duration}</p>
                      {phase.goals && <div className="space-y-1 mb-2">{phase.goals.map((g, j) => <div key={j} className="flex gap-2"><CheckCircle2 className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" /><span className="text-xs text-slate-300">{g}</span></div>)}</div>}
                      {phase.skills && <div className="flex flex-wrap gap-1">{phase.skills.map((s, j) => <Badge key={j} className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[10px]">{s}</Badge>)}</div>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Salary & Roles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cp.salaryRange && (
                <Card className="bg-slate-900/60 border-slate-800">
                  <CardHeader><CardTitle className="text-white text-sm">Salary Ranges</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(cp.salaryRange).map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-slate-400 text-sm capitalize">{k}</span><span className="text-green-400 text-sm font-semibold">{v}</span></div>)}
                  </CardContent>
                </Card>
              )}
              {cp.certifications && (
                <Card className="bg-slate-900/60 border-slate-800">
                  <CardHeader><CardTitle className="text-white text-sm">Certifications</CardTitle></CardHeader>
                  <CardContent>{cp.certifications.map((c, i) => <div key={i} className="flex items-center gap-2 mb-2"><Award className="w-4 h-4 text-amber-400" /><span className="text-sm text-slate-300">{c.name}</span><Badge className={`text-[9px] ${c.priority === 'high' ? 'bg-red-500/20 text-red-300' : 'bg-slate-700 text-slate-400'}`}>{c.priority}</Badge></div>)}</CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Career Path Generator</h1>
      <Card className="bg-slate-900/60 border-slate-800">
        <CardContent className="p-6 space-y-4">
          <div><label className="text-slate-300 text-sm block mb-1">Your Skills</label><textarea value={skills} onChange={e => setSkills(e.target.value)} rows={2} placeholder="Python, React, SQL..." className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-3 text-sm focus:border-amber-500 focus:outline-none resize-none" /></div>
          <div><label className="text-slate-300 text-sm block mb-1">Interests</label><textarea value={interests} onChange={e => setInterests(e.target.value)} rows={2} placeholder="AI, web dev, data science..." className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-3 text-sm focus:border-amber-500 focus:outline-none resize-none" /></div>
          <div><label className="text-slate-300 text-sm block mb-1">Education</label><Input value={education} onChange={e => setEducation(e.target.value)} placeholder="B.Tech CS, MBA..." className="bg-slate-800 border-slate-700 text-white" /></div>
          <div><label className="text-slate-300 text-sm block mb-1">Experience</label><Input value={experience} onChange={e => setExperience(e.target.value)} placeholder="2 years, fresher..." className="bg-slate-800 border-slate-700 text-white" /></div>
          <Button onClick={generate} disabled={loading || (!skills && !interests)} className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 py-5 rounded-xl">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating...</> : <><Compass className="w-4 h-4 mr-2" />Generate Career Path</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ MOCK INTERVIEW ============
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
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">AI Mock Interview</h1>
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-6 space-y-4">
            <div><label className="text-slate-300 text-sm block mb-1">Job Role</label><Input value={role} onChange={e => setRole(e.target.value)} className="bg-slate-800 border-slate-700 text-white" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-slate-300 text-sm block mb-1">Level</label><Select value={level} onValueChange={setLevel}><SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-800 border-slate-700"><SelectItem value="entry-level">Entry</SelectItem><SelectItem value="mid-level">Mid</SelectItem><SelectItem value="senior">Senior</SelectItem></SelectContent></Select></div>
              <div><label className="text-slate-300 text-sm block mb-1">Type</label><Select value={type} onValueChange={setType}><SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger><SelectContent className="bg-slate-800 border-slate-700"><SelectItem value="behavioral">Behavioral</SelectItem><SelectItem value="technical">Technical</SelectItem><SelectItem value="system-design">System Design</SelectItem><SelectItem value="mixed">Mixed</SelectItem></SelectContent></Select></div>
            </div>
            <Button onClick={startInterview} disabled={loading} className="w-full bg-gradient-to-r from-violet-600 to-purple-500 text-white border-0 py-5 rounded-xl">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Starting...</> : <><Mic className="w-4 h-4 mr-2" />Start Interview</>}
            </Button>
          </CardContent>
        </Card>
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
        <Card className="bg-slate-900/60 border-slate-800 mb-4">
          <CardContent className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full border-4 flex items-center justify-center" style={{ borderColor: feedback.score >= 7 ? '#22c55e' : feedback.score >= 5 ? '#eab308' : '#ef4444' }}>
                <span className="text-xl font-bold text-white">{feedback.score}/{feedback.maxScore || 10}</span>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-2">
                {[['Technical', feedback.technicalAccuracy], ['Communication', feedback.communicationScore], ['Structure', feedback.structureScore], ['Confidence', feedback.confidenceScore]].map(([l, v]) => (
                  v !== undefined && <div key={l}><p className="text-[10px] text-slate-500">{l}</p><Progress value={(v || 0) * 10} className="h-1.5" /><p className="text-[10px] text-slate-300">{v}/10</p></div>
                ))}
              </div>
            </div>
            <p className="text-sm text-slate-300 mb-3">{feedback.feedback}</p>
            {feedback.sampleAnswer && <div className="p-3 bg-green-900/20 border border-green-700/30 rounded-lg"><p className="text-[10px] text-green-400 mb-1">Sample Better Answer:</p><p className="text-xs text-slate-300">{feedback.sampleAnswer}</p></div>}
            {feedback.nextQuestion && !isComplete && <div className="mt-4 p-3 bg-slate-800 rounded-lg border border-slate-700"><p className="text-[10px] text-cyan-400 mb-1">Next Question:</p><p className="text-sm text-white">{feedback.nextQuestion}</p></div>}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-900/60 border-slate-800 mb-4">
          <CardContent className="p-5">
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{feedback?.feedback || currentContent}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {!isComplete ? (
        <div className="space-y-3">
          <textarea value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Type your answer..." rows={5} className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-4 text-sm focus:border-violet-500 focus:outline-none resize-none" />
          <div className="flex gap-3">
            <Button onClick={submitAnswer} disabled={!answer.trim() || loading} className="flex-1 bg-gradient-to-r from-violet-600 to-purple-500 text-white border-0 py-4 rounded-xl">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Evaluating...</> : <><Send className="w-4 h-4 mr-2" />Submit Answer</>}
            </Button>
            <Button onClick={() => { setStarted(false); setFeedback(null); setAllFeedback([]); }} variant="outline" className="border-slate-600 text-slate-300">End</Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => { setStarted(false); setFeedback(null); setAllFeedback([]); }} className="w-full bg-gradient-to-r from-violet-600 to-purple-500 text-white border-0 py-4 rounded-xl">Start New Interview</Button>
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

        {result.summary && <Card className="bg-slate-900/60 border-slate-800 mb-4"><CardContent className="p-4"><p className="text-slate-300 text-sm">{result.summary}</p></CardContent></Card>}

        {result.raw ? (
          <Card className="bg-slate-900/60 border-slate-800"><CardContent className="p-6"><div className="prose prose-invert max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{result.summary}</ReactMarkdown></div></CardContent></Card>
        ) : (
          <div className="space-y-4">
            {matches.map((m, i) => (
              <Card key={i} className="bg-slate-900/60 border-slate-800 hover:border-slate-600 transition-all">
                <CardContent className="p-5">
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
                  <p className="text-sm text-slate-300 mb-3">{m.why_match}</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(m.skills_matched || []).map((s, j) => <Badge key={j} className="bg-green-500/20 text-green-300 border-green-500/30 text-[10px]">{s}</Badge>)}
                    {(m.skills_gap || []).map((s, j) => <Badge key={'g'+j} className="bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">Gap: {s}</Badge>)}
                  </div>
                  <div className="flex gap-4 text-[10px]">
                    <span className="text-slate-400">Growth: <span className={m.growth_potential === 'high' ? 'text-green-400' : 'text-yellow-400'}>{m.growth_potential}</span></span>
                    <span className="text-slate-400">Demand: <span className={m.demand === 'high' ? 'text-green-400' : 'text-yellow-400'}>{m.demand}</span></span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">AI Job Matching</h1>
      <Card className="bg-slate-900/60 border-slate-800">
        <CardContent className="p-6 space-y-4">
          <div><label className="text-slate-300 text-sm block mb-1">Skills</label><textarea value={skills} onChange={e => setSkills(e.target.value)} rows={2} placeholder="Python, React, SQL..." className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl p-3 text-sm focus:border-green-500 focus:outline-none resize-none" /></div>
          <div><label className="text-slate-300 text-sm block mb-1">Interests</label><Input value={interests} onChange={e => setInterests(e.target.value)} placeholder="AI, web dev..." className="bg-slate-800 border-slate-700 text-white" /></div>
          <div><label className="text-slate-300 text-sm block mb-1">Experience</label><Input value={experience} onChange={e => setExperience(e.target.value)} placeholder="2 years..." className="bg-slate-800 border-slate-700 text-white" /></div>
          <div><label className="text-slate-300 text-sm block mb-1">Industry (optional)</label><Input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="Tech, Finance..." className="bg-slate-800 border-slate-700 text-white" /></div>
          <Button onClick={match} disabled={loading || !skills} className="w-full bg-gradient-to-r from-green-600 to-emerald-500 text-white border-0 py-5 rounded-xl">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Matching...</> : <><Search className="w-4 h-4 mr-2" />Find Matching Jobs</>}
          </Button>
        </CardContent>
      </Card>
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

  if (loading) return <div className="p-6 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>;
  if (!data) return <div className="p-6 text-slate-400 text-center">No analytics data</div>;

  const s = data.stats;
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Analytics Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Users', value: s.totalUsers, icon: User, color: 'text-blue-400' },
          { label: 'Resumes Analyzed', value: s.totalResumes, icon: FileText, color: 'text-teal-400' },
          { label: 'Mock Interviews', value: s.totalInterviews, icon: Mic, color: 'text-violet-400' },
          { label: 'Avg ATS Score', value: s.avgAtsScore, icon: Target, color: 'text-green-400' },
          { label: 'Chat Sessions', value: s.totalChats, icon: MessageSquare, color: 'text-cyan-400' },
          { label: 'Career Paths', value: s.totalCareerPaths, icon: Compass, color: 'text-amber-400' },
          { label: 'Job Matches', value: s.totalJobMatches, icon: Briefcase, color: 'text-green-400' },
        ].map((stat, i) => (
          <Card key={i} className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className={`w-8 h-8 ${stat.color}`} />
              <div>
                <p className="text-2xl font-bold text-white">{stat.value || 0}</p>
                <p className="text-xs text-slate-400">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Module Usage */}
      <Card className="bg-slate-900/60 border-slate-800 mb-6">
        <CardHeader><CardTitle className="text-white">Module Usage</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(data.moduleUsage || {}).sort((a, b) => b[1] - a[1]).map(([mod, count]) => {
              const maxCount = Math.max(...Object.values(data.moduleUsage || {}));
              return (
                <div key={mod}>
                  <div className="flex justify-between text-sm mb-1"><span className="text-slate-300">{mod.replace(/_/g, ' ')}</span><span className="text-slate-400">{count}</span></div>
                  <Progress value={(count / maxCount) * 100} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Daily Activity */}
      <Card className="bg-slate-900/60 border-slate-800 mb-6">
        <CardHeader><CardTitle className="text-white">Daily Activity (Last 7 Days)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-32">
            {(data.dailyActivity || []).map((d, i) => {
              const maxVal = Math.max(...(data.dailyActivity || []).map(x => x.count), 1);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-cyan-500/30 rounded-t" style={{ height: `${(d.count / maxVal) * 100}%`, minHeight: '4px' }} />
                  <span className="text-[9px] text-slate-500">{d.date?.slice(5)}</span>
                  <span className="text-[10px] text-slate-300">{d.count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader><CardTitle className="text-white">Recent Activity</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(data.recentEvents || []).map((e, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50">
                <div className="w-2 h-2 rounded-full bg-cyan-400" />
                <span className="text-xs text-slate-300 flex-1">{e.type.replace(/_/g, ' ')}</span>
                <span className="text-[10px] text-slate-500">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ MAIN APP ============
function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = guest
  const [page, setPage] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.get('/profile').then(d => {
        if (d.user) setUser(d.user);
        else { api.setToken(null); setUser(null); }
      }).catch(() => { api.setToken(null); setUser(null); });
    } else {
      setUser(null);
    }
  }, []);

  if (user === undefined) return <div className="h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>;
  if (user === null) return <AuthPage onAuth={(u) => { setUser(u || { name: 'Guest', role: 'guest' }); }} />;

  const logout = () => { api.setToken(null); setUser(null); };

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard user={user} onNavigate={setPage} />;
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
    <div className="h-screen flex bg-slate-950">
      <Sidebar currentPage={page} onNavigate={setPage} user={user.role !== 'guest' ? user : null} onLogout={logout} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="flex-1 overflow-auto">{renderPage()}</div>
    </div>
  );
}

export default App;
