'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bookmark, Send, Mic, CheckCircle2, XCircle, Building2, MapPin, ExternalLink, Search, Trash2, FileText, Edit2, Check, X } from 'lucide-react';
import api from '@/lib/api-client';

export default function SavedJobs() {
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
    const job = jobs.find(j => j.jobId === jobId);
    await api.post('/saved-jobs/delete', { jobId });
    setJobs(prev => prev.filter(j => j.jobId !== jobId));
    setStats(prev => {
      const status = job?.status || 'saved';
      return { ...prev, total: Math.max(0, (prev.total || 1) - 1), [status]: Math.max(0, (prev[status] || 1) - 1) };
    });
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
      case 'match': return (b.matchScore || 0) - (a.matchScore || 0);
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
            <option value="match">Match Score</option>
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
                        {job.matchScore && job.matchScore > 0 && <><span className="text-slate-600">|</span><span className={`font-semibold ${job.matchScore >= 80 ? 'text-green-400' : job.matchScore >= 60 ? 'text-yellow-400' : 'text-slate-400'}`}>{job.matchScore}% match</span></>}
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
