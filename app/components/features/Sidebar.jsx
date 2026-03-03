'use client';

import {
  Brain, Home, MessageSquare, FileText, Compass, Mic, Briefcase,
  Bookmark, GraduationCap, BarChart3, Settings, LogOut
} from 'lucide-react';

export default function Sidebar({ currentPage, onNavigate, user, onLogout, collapsed, onToggle }) {
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
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 to-transparent pointer-events-none" />
      
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
              {isActive && (
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600/20 to-cyan-500/10 border border-blue-500/20" />
              )}
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

      <div className="p-3 relative z-10">
        {user ? (
          <div className={`flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.04] transition-colors ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/15">
              <span className="text-white text-xs font-bold">{(user.name || 'U')[0]?.toUpperCase()}</span>
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
