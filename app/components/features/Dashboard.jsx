'use client';

import { useState, useEffect } from 'react';
import {
  MessageSquare, FileText, Compass, Mic, Briefcase, Bookmark,
  GraduationCap, BarChart3, Globe, User, Zap, Target, Sparkles,
  ArrowRight, CheckCircle2, Clock, Loader2, Settings
} from 'lucide-react';
import { formatDateTime } from '@/lib/api-client';
import api from '@/lib/api-client';

export default function Dashboard({ user, onNavigate }) {
  const [stats, setStats] = useState(null);
  const [profile, setProfile] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiModels, setAiModels] = useState([]);

  useEffect(() => {
    if (user) {
      api.get('/profile').then(d => {
        setStats(d.stats);
        setProfile(d.profile);
        setRecentActivity(d.recentActivity || []);
      }).catch(() => {}).finally(() => setLoading(false));

      api.get('/models').then(d => {
        if (d.models) setAiModels(d.models.map(m => ({
          name: m.name, color: m.color,
          status: m.guaranteed ? 'active' : 'beta'
        })));
      }).catch(() => {});
    } else {
      setLoading(false);
    }
  }, [user]);

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

  const totalActivity = stats ? (stats.chatCount || 0) + (stats.resumeCount || 0) + (stats.interviewCount || 0) + (stats.careerPathCount || 0) + (stats.savedJobsCount || 0) + (stats.jobMatchCount || 0) + (stats.learningPathCount || 0) : 0;

  const getSuggestions = () => {
    if (!stats) return [];
    const tips = [];
    if (profileCompleteness < 100) tips.push({ text: 'Complete your profile for better AI recommendations', action: 'profile', icon: User, color: 'text-violet-400' });
    if ((stats.resumeCount || 0) === 0) tips.push({ text: 'Upload your resume for ATS scoring & feedback', action: 'resume', icon: FileText, color: 'text-teal-400' });
    if ((stats.interviewCount || 0) === 0) tips.push({ text: 'Practice with an AI mock interview', action: 'interview', icon: Mic, color: 'text-purple-400' });
    if ((stats.careerPathCount || 0) === 0) tips.push({ text: 'Generate a personalized career roadmap', action: 'career', icon: Compass, color: 'text-amber-400' });
    if ((stats.savedJobsCount || 0) === 0) tips.push({ text: 'Search and save jobs to track applications', action: 'jobs', icon: Briefcase, color: 'text-green-400' });
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
    { id: 'jobs', title: 'Job Board', desc: 'Live job openings', icon: Globe, color: 'from-emerald-500 to-teal-500' },
    { id: 'savedjobs', title: 'Saved Jobs', desc: 'Track applications', icon: Bookmark, color: 'from-yellow-500 to-amber-500', count: stats?.savedJobsCount },
    { id: 'learning', title: 'Learning Center', desc: 'Skill gap analysis', icon: GraduationCap, color: 'from-indigo-500 to-purple-500', count: stats?.learningPathCount },
    { id: 'analytics', title: 'Analytics', desc: 'Usage insights', icon: BarChart3, color: 'from-pink-500 to-rose-500' },
  ];

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
          {aiModels.map(m => (
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
