'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Globe, AlertCircle, Briefcase, Building2, MapPin, CheckCircle2, Bookmark, ExternalLink, Clock } from 'lucide-react';
import api from '@/lib/api-client';

export default function JobBrowseTab() {
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
