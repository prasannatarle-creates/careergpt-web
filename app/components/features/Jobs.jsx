'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Globe, AlertCircle, CheckCircle2, Loader2, Clock, Search, ExternalLink, Star, ChevronDown, MapPin, Briefcase, Bell, Trash2, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '@/lib/api-client';
import JobBrowseTab from './JobBrowseTab';

export default function Jobs() {
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
