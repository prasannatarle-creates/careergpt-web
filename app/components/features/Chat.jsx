'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Brain, Send, Plus, Trash2, FileText, Loader2, Bot, User,
  ChevronDown, Search, Globe, Copy, Check, Share2, Edit2,
  Link2, Eye
} from 'lucide-react';
import api, { formatDate, formatDateTime } from '@/lib/api-client';

export default function Chat() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const exportRef = useRef(null);

  const [showModels, setShowModels] = useState(false);
  const [activeModels, setActiveModels] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(null);
  const [showIndividual, setShowIndividual] = useState(null);
  const [renamingSession, setRenamingSession] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    api.get('/chat/sessions').then(d => setSessions((d.sessions || []).filter(s => s.type === 'career-chat')));
    api.get('/models').then(d => {
      if (d.models) {
        setAvailableModels(d.models);
        setActiveModels(d.models.map(m => m.name));
      }
    });
    api.get('/profile').then(d => {
      if (d.profile) setUserProfile(d.profile);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => { if (exportRef.current && !exportRef.current.contains(e.target)) setShowExport(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadSession = async (id) => {
    try {
      setLoading(true);
      const d = await api.get(`/chat/sessions/${id}`);
      if (d.error) throw new Error(d.error);
      setActiveSession(id);
      setMessages(d.session?.messages || []);
    } catch (e) {
      console.error('Failed to load session:', e);
      setMessages([{ role: 'assistant', content: `Failed to load conversation: ${e.message}`, isError: true }]);
    } finally {
      setLoading(false);
    }
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
      setMessages(prev => [...prev, { role: 'assistant', content: d.response, timestamp: new Date().toISOString(), models: d.models, failedModels: d.failedModels, synthesized: d.synthesized, individualResponses: d.individualResponses, followUpSuggestions: d.followUpSuggestions }]);
      api.get('/chat/sessions').then(d2 => setSessions((d2.sessions || []).filter(s => s.type === 'career-chat')));
    } catch (e) { setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}`, isError: true }]); }
    finally { setLoading(false); }
  };

  const filteredSessions = sessions.filter(s => !searchQuery || s.title?.toLowerCase().includes(searchQuery.toLowerCase()));

  const quickPrompts = useMemo(() => {
    const basePrompts = [
      { icon: '\uD83D\uDE80', text: 'Top AI & tech careers in 2026?' },
      { icon: '\uD83D\uDCB0', text: 'How to negotiate a higher salary?' },
      { icon: '\uD83C\uDFAF', text: 'Build a 90-day career transition plan' },
      { icon: '\uD83E\uDDE0', text: 'Most in-demand skills for remote work' },
      { icon: '\uD83C\uDFA4', text: 'How to ace behavioral interviews?' },
      { icon: '\uD83D\uDCCA', text: 'Career roadmap for data science' },
    ];
    if (!userProfile) return basePrompts;
    const personalized = [];
    const p = userProfile;
    const skillList = Array.isArray(p.skills) ? p.skills.join(', ') : p.skills;
    const interestList = Array.isArray(p.interests) ? p.interests.join(', ') : p.interests;
    if (p.careerGoal) personalized.push({ icon: '\uD83C\uDFAF', text: `What skills do I need to become a ${p.careerGoal}?` });
    if (skillList) personalized.push({ icon: '\uD83D\uDCAA', text: `Best career paths for someone with ${skillList} skills?` });
    if (interestList) personalized.push({ icon: '\u2728', text: `High-paying jobs in ${interestList}?` });
    if (p.experience) personalized.push({ icon: '\uD83D\uDCC8', text: `Career growth strategies with ${p.experience} experience` });
    if (p.education) personalized.push({ icon: '\uD83C\uDF93', text: `Best roles for a ${p.education} graduate?` });
    if (personalized.length > 0) personalized.push({ icon: '\uD83D\uDCB0', text: 'How to negotiate a higher salary?' });
    return personalized.length >= 4 ? personalized.slice(0, 6) : [...personalized, ...basePrompts.slice(0, 6 - personalized.length)];
  }, [userProfile]);

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
                {m.guaranteed && <span className="text-[8px] text-emerald-400 flex-shrink-0">{'\u25CF'}</span>}
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

                    {msg.timestamp && (
                      <p className="text-[9px] text-slate-500 mt-2">{formatDateTime(msg.timestamp)}</p>
                    )}

                    {msg.models && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-700/30">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {msg.synthesized && <Badge className="bg-cyan-500/15 text-cyan-300 border-cyan-500/20 text-[9px] px-2 py-0.5 rounded-full">SYNTHESIZED</Badge>}
                          {msg.models.map((m, j) => <span key={j} className="text-[9px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (m.color || '#888') + '15', color: m.color || '#888', border: `1px solid ${(m.color || '#888')}20` }}>{m.name || m}</span>)}
                          {(msg.failedModels || []).map((f, j) => <span key={'f'+j} className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">{'\u2715'} {f.name}</span>)}
                        </div>
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
                    {msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-700/30">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Follow-up Questions</p>
                        <div className="flex flex-wrap gap-2">
                          {msg.followUpSuggestions.map((q, k) => (
                            <button key={k} onClick={() => { setInput(q); }} className="text-xs text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-500/40 px-3 py-1.5 rounded-full transition-all duration-200">
                              {q}
                            </button>
                          ))}
                        </div>
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
              <p className="text-[9px] text-slate-600">{activeModels.length} model{activeModels.length !== 1 ? 's' : ''} active {'\u2022'} Enter to send</p>
              <p className={`text-[9px] ${input.length > 1800 ? 'text-amber-400' : 'text-slate-600'}`}>{input.length}/2000</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
