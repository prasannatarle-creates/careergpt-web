'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Brain, Upload, MessageSquare, Target, Sparkles, Send, Plus,
  Trash2, FileText, Loader2, ChevronRight, Briefcase, GraduationCap,
  TrendingUp, Zap, ArrowRight, CheckCircle2, Star, Users,
  BarChart3, Shield, Rocket, Menu, X, Bot, User, Clock,
  Mic, BookOpen, Award, Compass, MapPin
} from 'lucide-react';

// Hero images from vision expert
const HERO_IMAGE = 'https://images.unsplash.com/photo-1597733336794-12d05021d510?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODh8MHwxfHNlYXJjaHwzfHx0ZWNobm9sb2d5fGVufDB8fHxibHVlfDE3NzA2MzM0Mzd8MA&ixlib=rb-4.1.0&q=85';
const CAREER_IMAGE = 'https://images.unsplash.com/photo-1513530534585-c7b1394c6d51?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWx8ZW58MHx8fGJsdWV8MTc3MDYzMzQ0MXww&ixlib=rb-4.1.0&q=85';
const RESUME_IMAGE = 'https://images.unsplash.com/photo-1581090464777-f3220bbe1b8b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODh8MHwxfHNlYXJjaHw0fHx0ZWNobm9sb2d5fGVufDB8fHxibHVlfDE3NzA2MzM0Mzd8MA&ixlib=rb-4.1.0&q=85';
const INTERVIEW_IMAGE = 'https://images.unsplash.com/photo-1589386417686-0d34b5903d23?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTN8MHwxfHNlYXJjaHwyfHxwcm9mZXNzaW9uYWx8ZW58MHx8fGJsdWV8MTc3MDYzMzQ0MXww&ixlib=rb-4.1.0&q=85';

// ========================
// LANDING PAGE COMPONENT
// ========================
function LandingPage({ onNavigate }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={HERO_IMAGE} alt="" className="w-full h-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-blue-950/60 to-slate-950" />
        </div>

        {/* Floating particles effect */}
        <div className="absolute inset-0 z-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-blue-400/20 animate-pulse"
              style={{
                width: Math.random() * 6 + 2 + 'px',
                height: Math.random() * 6 + 2 + 'px',
                left: Math.random() * 100 + '%',
                top: Math.random() * 100 + '%',
                animationDelay: Math.random() * 3 + 's',
                animationDuration: Math.random() * 3 + 2 + 's',
              }}
            />
          ))}
        </div>

        <div className="relative z-10 container mx-auto px-6 pt-8">
          {/* Nav */}
          <nav className="flex items-center justify-between mb-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">Career<span className="text-cyan-400">GPT</span></span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <button onClick={() => onNavigate('chat')} className="text-slate-300 hover:text-white transition-colors">AI Chat</button>
              <button onClick={() => onNavigate('resume')} className="text-slate-300 hover:text-white transition-colors">Resume</button>
              <button onClick={() => onNavigate('interview')} className="text-slate-300 hover:text-white transition-colors">Interview</button>
              <button onClick={() => onNavigate('career')} className="text-slate-300 hover:text-white transition-colors">Career Paths</button>
            </div>
            <Button onClick={() => onNavigate('chat')} className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white border-0">
              Get Started <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </nav>

          {/* Hero Content */}
          <div className="text-center max-w-4xl mx-auto pb-32 pt-12">
            <Badge className="mb-6 bg-blue-500/20 text-cyan-300 border-blue-500/30 px-4 py-1.5 text-sm">
              <Sparkles className="w-4 h-4 mr-2" /> Powered by Multiple AI Models
            </Badge>
            <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-tight mb-6">
              Your AI-Powered
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
                Career Navigator
              </span>
            </h1>
            <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
              Combining 5 AI models — GPT-4.1, Claude, Gemini, Grok & Perplexity — to deliver the most comprehensive career guidance.
              Resume analysis, mock interviews, and personalized career paths — all in one platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => onNavigate('chat')}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white text-lg px-8 py-6 rounded-xl border-0 shadow-lg shadow-blue-500/25"
              >
                <MessageSquare className="w-5 h-5 mr-2" /> Start AI Chat
              </Button>
              <Button
                onClick={() => onNavigate('resume')}
                size="lg"
                variant="outline"
                className="border-slate-600 text-slate-200 hover:bg-slate-800 text-lg px-8 py-6 rounded-xl"
              >
                <Upload className="w-5 h-5 mr-2" /> Analyze Resume
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container mx-auto px-6 -mt-16 relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: MessageSquare, title: 'AI Career Chat', desc: '5-model AI: GPT-4.1, Claude, Gemini, Grok & Perplexity combined', color: 'from-blue-500 to-blue-600', nav: 'chat' },
            { icon: FileText, title: 'Resume Analyzer', desc: 'Upload & get AI-powered resume feedback instantly', color: 'from-cyan-500 to-teal-500', nav: 'resume' },
            { icon: Mic, title: 'Mock Interviews', desc: 'Practice with AI interviewer and get real-time feedback', color: 'from-violet-500 to-purple-600', nav: 'interview' },
            { icon: Compass, title: 'Career Explorer', desc: 'Discover career paths matched to your skills', color: 'from-amber-500 to-orange-500', nav: 'career' },
          ].map((feature, i) => (
            <Card
              key={i}
              onClick={() => onNavigate(feature.nav)}
              className="bg-slate-900/80 border-slate-700/50 backdrop-blur-sm cursor-pointer hover:bg-slate-800/80 hover:border-slate-600 transition-all duration-300 hover:-translate-y-1 group"
            >
              <CardContent className="p-6">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm">{feature.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Stats Section */}
      <div className="container mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Why CareerGPT?</h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            We combine multiple AI models to give you the most comprehensive and accurate career advice possible.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Brain, stat: 'Multi-Model AI', label: '5 AI models: GPT-4.1, Claude, Gemini, Grok & Perplexity', color: 'text-blue-400' },
            { icon: Target, stat: 'Smart Analysis', label: 'Resume scoring, skill gaps, and ATS optimization', color: 'text-cyan-400' },
            { icon: Rocket, stat: 'Career Growth', label: 'Personalized paths, interview prep, and job matching', color: 'text-teal-400' },
          ].map((item, i) => (
            <div key={i} className="text-center p-8 rounded-2xl bg-slate-900/50 border border-slate-800">
              <item.icon className={`w-12 h-12 ${item.color} mx-auto mb-4`} />
              <h3 className="text-2xl font-bold text-white mb-2">{item.stat}</h3>
              <p className="text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features Detail */}
      <div className="container mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <Badge className="mb-4 bg-cyan-500/20 text-cyan-300 border-cyan-500/30">AI-Powered Analysis</Badge>
            <h2 className="text-3xl font-bold text-white mb-6">Resume Analysis That Actually Helps</h2>
            <div className="space-y-4">
              {[
                'ATS-optimized keyword suggestions',
                'Detailed scoring across 10+ criteria',
                'Specific, actionable improvement steps',
                'Industry-specific recommendations',
                'Skills gap identification',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                  <span className="text-slate-300">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <img src={RESUME_IMAGE} alt="Resume Analysis" className="rounded-2xl shadow-2xl shadow-blue-500/10 border border-slate-700" />
            <div className="absolute -bottom-6 -left-6 bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-white font-semibold">Resume Score</p>
                  <p className="text-green-400 text-sm">85/100 — Great!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="container mx-auto px-6 pb-24">
        <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 rounded-3xl p-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Supercharge Your Career?</h2>
          <p className="text-slate-300 mb-8 max-w-xl mx-auto">Join thousands of students and job seekers using AI to navigate their career path.</p>
          <Button
            onClick={() => onNavigate('chat')}
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white text-lg px-10 py-6 rounded-xl border-0"
          >
            Get Started Free <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-cyan-400" />
            <span className="text-white font-semibold">CareerGPT</span>
          </div>
          <p className="text-slate-500 text-sm">AI-Powered Career Guidance Platform</p>
        </div>
      </footer>
    </div>
  );
}

// ========================
// AI CHAT COMPONENT
// ========================
function AIChat({ onBack }) {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/sessions');
      const data = await res.json();
      setSessions((data.sessions || []).filter(s => s.type === 'career-chat'));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const loadSession = async (sessionId) => {
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`);
      const data = await res.json();
      setActiveSession(sessionId);
      setMessages(data.session?.messages || []);
    } catch (e) { console.error(e); }
  };

  const startNewChat = () => {
    setActiveSession(null);
    setMessages([]);
  };

  const deleteSession = async (e, sessionId) => {
    e.stopPropagation();
    await fetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' });
    if (activeSession === sessionId) startNewChat();
    loadSessions();
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    setLoading(true);

    const userMsg = { role: 'user', content: msg, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSession, message: msg }),
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      if (!activeSession) setActiveSession(data.sessionId);

      const assistantMsg = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
        models: data.models,
        synthesized: data.synthesized,
      };
      setMessages(prev => [...prev, assistantMsg]);
      loadSessions();
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}`, timestamp: new Date().toISOString(), isError: true }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestedQuestions = [
    'What career paths are best for someone interested in AI and machine learning?',
    'How should I prepare for a software engineering interview at a top tech company?',
    'What skills should I learn in 2025 to stay competitive in the tech industry?',
    'Can you help me create a 6-month career development plan?',
  ];

  return (
    <div className="h-screen flex bg-slate-950">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden border-r border-slate-800 bg-slate-900/50 flex flex-col`}>
        <div className="p-4">
          <Button onClick={startNewChat} className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-0 mb-4">
            <Plus className="w-4 h-4 mr-2" /> New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-1">
            {sessions.map(s => (
              <div
                key={s.id}
                onClick={() => loadSession(s.id)}
                className={`p-3 rounded-lg cursor-pointer flex items-center justify-between group transition-colors ${
                  activeSession === s.id ? 'bg-blue-600/20 border border-blue-500/30' : 'hover:bg-slate-800'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{s.title}</p>
                  <p className="text-xs text-slate-500">{new Date(s.updatedAt).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={(e) => deleteSession(e, s.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-4 border-t border-slate-800">
          <button onClick={onBack} className="text-slate-400 hover:text-white text-sm flex items-center gap-2 transition-colors">
            <ChevronRight className="w-4 h-4 rotate-180" /> Back to Home
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-800 p-4 flex items-center gap-4 bg-slate-900/30">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-slate-400 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">CareerGPT Chat</h2>
              <p className="text-xs text-slate-400">Multi-Model AI Career Guidance</p>
            </div>
          </div>
          <Badge className="ml-auto bg-green-500/20 text-green-300 border-green-500/30 text-xs">
            <div className="w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse" />
            GPT-4.1 + Gemini 2.5
          </Badge>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-6">
          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto mt-12">
              <div className="text-center mb-10">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mx-auto mb-4">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Welcome to CareerGPT</h2>
                <p className="text-slate-400">Your AI career advisor powered by multiple models. Ask me anything about careers!</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(q); }}
                    className="text-left p-4 rounded-xl border border-slate-700 bg-slate-900/50 hover:bg-slate-800 hover:border-slate-600 text-slate-300 text-sm transition-all"
                  >
                    <Sparkles className="w-4 h-4 text-cyan-400 mb-2" />
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.filter(m => !m.hidden).map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : msg.isError
                        ? 'bg-red-900/50 border border-red-700 text-red-200'
                        : 'bg-slate-800 text-slate-200 border border-slate-700'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                    {msg.models && msg.synthesized && (
                      <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center gap-2">
                        <Sparkles className="w-3 h-3 text-cyan-400" />
                        <span className="text-xs text-slate-400">Synthesized from {msg.models.join(' + ')}</span>
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-5 h-5 text-slate-300" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                      <span className="text-sm text-slate-400">Consulting GPT-4.1 & Gemini 2.5...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-slate-800 p-4 bg-slate-900/30">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Ask about career paths, skills, interviews..."
                className="flex-1 bg-slate-800 border-slate-700 text-white placeholder-slate-500 rounded-xl focus:border-cyan-500 focus:ring-cyan-500/20"
                disabled={loading}
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-0 rounded-xl px-6"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========================
// RESUME ANALYZER COMPONENT
// ========================
function ResumeAnalyzer({ onBack }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [resumeId, setResumeId] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const uploadAndAnalyze = async () => {
    if (!file) return;
    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/resume/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (uploadData.error) throw new Error(uploadData.error);

      setResumeId(uploadData.resumeId);
      setUploading(false);
      setAnalyzing(true);

      const analyzeRes = await fetch('/api/resume/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId: uploadData.resumeId }),
      });
      const analyzeData = await analyzeRes.json();
      if (analyzeData.error) throw new Error(analyzeData.error);

      setAnalysis(analyzeData.analysis);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResumeId(null);
    setAnalysis(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="container mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-white font-semibold">Resume Analyzer</h1>
          </div>
          <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-xs">AI-Powered</Badge>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        {!analysis ? (
          <div className="space-y-8">
            {/* Upload Zone */}
            <Card className="bg-slate-900/80 border-slate-700">
              <CardContent className="p-8">
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                    dragActive
                      ? 'border-cyan-400 bg-cyan-500/10'
                      : file
                        ? 'border-green-500 bg-green-500/10'
                        : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.txt,.md,.doc,.docx"
                    onChange={handleFileSelect}
                  />
                  {file ? (
                    <div>
                      <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
                      <p className="text-white font-semibold text-lg mb-1">{file.name}</p>
                      <p className="text-slate-400 text-sm">{(file.size / 1024).toFixed(1)} KB</p>
                      <button onClick={(e) => { e.stopPropagation(); reset(); }} className="text-slate-400 hover:text-red-400 text-sm mt-3 underline">
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                      <p className="text-white font-semibold text-lg mb-1">Drop your resume here</p>
                      <p className="text-slate-400 text-sm">or click to browse • PDF, TXT, MD supported</p>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="mt-4 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
                    {error}
                  </div>
                )}

                <Button
                  onClick={uploadAndAnalyze}
                  disabled={!file || uploading || analyzing}
                  className="w-full mt-6 bg-gradient-to-r from-cyan-600 to-teal-500 text-white border-0 py-6 text-lg rounded-xl"
                >
                  {uploading ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Uploading...</>
                  ) : analyzing ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analyzing with AI...</>
                  ) : (
                    <><Sparkles className="w-5 h-5 mr-2" /> Analyze Resume</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Info cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { icon: Target, title: 'ATS Score', desc: 'Check how well your resume passes automated screening' },
                { icon: TrendingUp, title: 'Improvements', desc: 'Get specific, actionable improvement suggestions' },
                { icon: Briefcase, title: 'Job Match', desc: 'See which roles match your experience and skills' },
              ].map((item, i) => (
                <Card key={i} className="bg-slate-900/50 border-slate-800">
                  <CardContent className="p-5">
                    <item.icon className="w-8 h-8 text-cyan-400 mb-3" />
                    <h3 className="text-white font-semibold mb-1">{item.title}</h3>
                    <p className="text-slate-400 text-sm">{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Analysis Results</h2>
                <p className="text-slate-400 text-sm">Powered by GPT-4.1</p>
              </div>
              <Button onClick={reset} variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
                Analyze Another Resume
              </Button>
            </div>
            <Card className="bg-slate-900/80 border-slate-700">
              <CardContent className="p-8">
                <div className="prose prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// ========================
// MOCK INTERVIEW COMPONENT
// ========================
function MockInterview({ onBack }) {
  const [started, setStarted] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [question, setQuestion] = useState('');
  const [questionNumber, setQuestionNumber] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [history, setHistory] = useState([]);

  // Config
  const [role, setRole] = useState('Software Engineer');
  const [level, setLevel] = useState('mid-level');
  const [type, setType] = useState('behavioral');

  const startInterview = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mock-interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, level, type }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setSessionId(data.sessionId);
      setQuestion(data.question);
      setQuestionNumber(data.questionNumber);
      setStarted(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) return;
    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/mock-interview/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, answer }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setHistory(prev => [...prev, { question, answer, feedback: data.feedback }]);
      setFeedback(data.feedback);
      setQuestionNumber(data.questionNumber);
      setIsComplete(data.isComplete);
      setAnswer('');

      if (!data.isComplete) {
        setQuestion(data.feedback);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetInterview = () => {
    setStarted(false);
    setSessionId(null);
    setQuestion('');
    setQuestionNumber(0);
    setAnswer('');
    setFeedback(null);
    setIsComplete(false);
    setHistory([]);
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="container mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-white font-semibold">Mock Interview</h1>
          </div>
          {started && (
            <Badge className="ml-auto bg-violet-500/20 text-violet-300 border-violet-500/30">
              Question {Math.min(questionNumber, 5)} of 5
            </Badge>
          )}
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-3xl">
        {!started ? (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-6">
                <Mic className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-3">AI Mock Interview</h2>
              <p className="text-slate-400 max-w-lg mx-auto">Practice with an AI interviewer that provides real-time feedback, scoring, and improvement tips.</p>
            </div>

            <Card className="bg-slate-900/80 border-slate-700">
              <CardContent className="p-8 space-y-6">
                <div>
                  <label className="text-slate-300 text-sm font-medium mb-2 block">Job Role</label>
                  <Input
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="e.g., Software Engineer, Product Manager"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-300 text-sm font-medium mb-2 block">Experience Level</label>
                    <Select value={level} onValueChange={setLevel}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="entry-level">Entry Level</SelectItem>
                        <SelectItem value="mid-level">Mid Level</SelectItem>
                        <SelectItem value="senior">Senior</SelectItem>
                        <SelectItem value="lead">Lead / Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-slate-300 text-sm font-medium mb-2 block">Interview Type</label>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="behavioral">Behavioral</SelectItem>
                        <SelectItem value="technical">Technical</SelectItem>
                        <SelectItem value="system-design">System Design</SelectItem>
                        <SelectItem value="mixed">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={startInterview}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-violet-600 to-purple-500 text-white border-0 py-6 text-lg rounded-xl"
                >
                  {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Starting...</> : <><Rocket className="w-5 h-5 mr-2" /> Start Interview</>}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Progress */}
            <div>
              <div className="flex justify-between text-sm text-slate-400 mb-2">
                <span>Interview Progress</span>
                <span>{Math.min(questionNumber, 5)}/5 Questions</span>
              </div>
              <Progress value={Math.min(questionNumber, 5) * 20} className="h-2" />
            </div>

            {/* Current Q/A */}
            <Card className="bg-slate-900/80 border-slate-700">
              <CardContent className="p-6">
                {feedback ? (
                  <div className="prose prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{feedback}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{question}</ReactMarkdown>
                  </div>
                )}
              </CardContent>
            </Card>

            {!isComplete && (
              <div className="space-y-3">
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  rows={6}
                  className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl p-4 focus:border-violet-500 focus:ring-violet-500/20 focus:outline-none resize-none"
                />
                <div className="flex gap-3">
                  <Button
                    onClick={submitAnswer}
                    disabled={!answer.trim() || loading}
                    className="flex-1 bg-gradient-to-r from-violet-600 to-purple-500 text-white border-0 py-5 rounded-xl"
                  >
                    {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Evaluating...</> : <><Send className="w-4 h-4 mr-2" /> Submit Answer</>}
                  </Button>
                  <Button onClick={resetInterview} variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 rounded-xl py-5">
                    End Interview
                  </Button>
                </div>
              </div>
            )}

            {isComplete && (
              <Button onClick={resetInterview} className="w-full bg-gradient-to-r from-violet-600 to-purple-500 text-white border-0 py-5 rounded-xl">
                Start New Interview
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ========================
// CAREER EXPLORER COMPONENT
// ========================
function CareerExplorer({ onBack }) {
  const [interests, setInterests] = useState('');
  const [skills, setSkills] = useState('');
  const [experience, setExperience] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [models, setModels] = useState([]);

  const explore = async () => {
    if (!interests && !skills) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/career-paths/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interests, skills, experience }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data.paths);
      setModels(data.models || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="container mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-white font-semibold">Career Explorer</h1>
          </div>
          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">Multi-Model AI</Badge>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        {!result ? (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mx-auto mb-6">
                <Compass className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-3">Explore Career Paths</h2>
              <p className="text-slate-400 max-w-lg mx-auto">Tell us about yourself and our multi-model AI will suggest personalized career paths with detailed roadmaps.</p>
            </div>

            <Card className="bg-slate-900/80 border-slate-700">
              <CardContent className="p-8 space-y-6">
                <div>
                  <label className="text-slate-300 text-sm font-medium mb-2 block">Your Interests</label>
                  <textarea
                    value={interests}
                    onChange={(e) => setInterests(e.target.value)}
                    placeholder="e.g., AI, web development, data science, design, entrepreneurship..."
                    rows={3}
                    className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl p-4 focus:border-amber-500 focus:ring-amber-500/20 focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="text-slate-300 text-sm font-medium mb-2 block">Your Skills</label>
                  <textarea
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    placeholder="e.g., Python, React, SQL, project management, communication..."
                    rows={3}
                    className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl p-4 focus:border-amber-500 focus:ring-amber-500/20 focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="text-slate-300 text-sm font-medium mb-2 block">Experience Level</label>
                  <Input
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    placeholder="e.g., Final year CS student, 2 years as junior developer..."
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <Button
                  onClick={explore}
                  disabled={loading || (!interests && !skills)}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 py-6 text-lg rounded-xl"
                >
                  {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Exploring Paths...</> : <><Rocket className="w-5 h-5 mr-2" /> Discover Career Paths</>}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Your Career Paths</h2>
                {models.length > 0 && (
                  <p className="text-slate-400 text-sm flex items-center gap-2 mt-1">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Synthesized from {models.join(' + ')}
                  </p>
                )}
              </div>
              <Button onClick={() => setResult(null)} variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
                Explore Again
              </Button>
            </div>
            <Card className="bg-slate-900/80 border-slate-700">
              <CardContent className="p-8">
                <div className="prose prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// ========================
// MAIN APP COMPONENT
// ========================
function App() {
  const [currentPage, setCurrentPage] = useState('landing');

  const navigate = (page) => setCurrentPage(page);
  const goHome = () => setCurrentPage('landing');

  switch (currentPage) {
    case 'chat':
      return <AIChat onBack={goHome} />;
    case 'resume':
      return <ResumeAnalyzer onBack={goHome} />;
    case 'interview':
      return <MockInterview onBack={goHome} />;
    case 'career':
      return <CareerExplorer onBack={goHome} />;
    default:
      return <LandingPage onNavigate={navigate} />;
  }
}

export default App;
