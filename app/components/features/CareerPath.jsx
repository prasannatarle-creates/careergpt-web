'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Target, Sparkles, FileText, Loader2, ChevronRight, Briefcase,
  TrendingUp, Zap, ArrowRight, CheckCircle2, BarChart3, Rocket,
  Compass, ChevronDown, Award, Star, AlertCircle, ExternalLink,
  Clock, Globe, GraduationCap, Check
} from 'lucide-react';
import api, { formatDate } from '@/lib/api-client';

export default function CareerPath({ onNavigate, user }) {
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
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('cgpt_career_goals') || '{}');
      if (Object.keys(saved).length > 0) setCompletedGoals(saved);
    } catch(e) {}
  }, []);

  useEffect(() => {
    if (Object.keys(completedGoals).length > 0) {
      try { localStorage.setItem('cgpt_career_goals', JSON.stringify(completedGoals)); } catch(e) {}
    }
  }, [completedGoals]);

  useEffect(() => {
    if (profileLoaded) return;
    const fillFromProfile = async () => {
      try {
        let profile = user?.profile;
        if (!profile) {
          const d = await api.get('/profile');
          profile = d?.profile;
        }
        if (profile) {
          if (!skills && profile.skills) setSkills(Array.isArray(profile.skills) ? profile.skills.join(', ') : profile.skills);
          if (!interests && profile.interests) setInterests(Array.isArray(profile.interests) ? profile.interests.join(', ') : profile.interests);
          if (!education && profile.education) setEducation(profile.education);
          if (!experience && profile.experience) setExperience(profile.experience);
          if (!targetRole && profile.careerGoal) setTargetRole(profile.careerGoal);
          if (!location && profile.location) setLocation(profile.location);
        }
      } catch (e) { console.error('Profile load error:', e); }
      setProfileLoaded(true);
    };
    fillFromProfile();
  }, [user]);

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
        (phase.goals || []).forEach(g => { doc.text(`\u2022 ${g}`, 30, y); y += 5; });
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
        doc.text(`\u2022 ${sg.skill} (${sg.importance}): ${sg.howToLearn}`, 25, y); y += 6;
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
            {cp.timeline && cp.timeline.length > 0 && (() => {
              const totalGoals = cp.timeline.reduce((sum, phase) => sum + (phase.goals?.length || 0), 0);
              const totalCompleted = Object.values(completedGoals).filter(Boolean).length;
              const progressPct = totalGoals > 0 ? Math.round((totalCompleted / totalGoals) * 100) : 0;
              return totalGoals > 0 ? (
                <div className="glass-card-bright p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-cyan-400" />
                      <span className="text-sm font-medium text-white">Overall Progress</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: progressPct >= 80 ? '#22c55e' : progressPct >= 40 ? '#eab308' : '#94a3b8' }}>{progressPct}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${progressPct}%`, background: progressPct >= 80 ? 'linear-gradient(90deg, #22c55e, #10b981)' : progressPct >= 40 ? 'linear-gradient(90deg, #eab308, #f59e0b)' : 'linear-gradient(90deg, #3b82f6, #06b6d4)' }} />
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-slate-500">{totalCompleted} of {totalGoals} goals completed</span>
                    <span className="text-[10px] text-slate-500">{cp.timeline.length} phases</span>
                  </div>
                </div>
              ) : null;
            })()}

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
                            {phase.milestone && (
                              <div className="p-2.5 rounded-lg bg-green-500/[0.05] border border-green-500/10">
                                <p className="text-[10px] text-green-400 uppercase tracking-wider mb-0.5">Milestone</p>
                                <p className="text-xs text-green-300">{phase.milestone}</p>
                              </div>
                            )}
                            {phase.skills && (
                              <div className="flex flex-wrap gap-1.5">
                                {phase.skills.map((s, j) => <Badge key={j} className="bg-blue-500/15 text-blue-300 border-blue-500/20 text-[10px]">{s}</Badge>)}
                              </div>
                            )}
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
                            {c.cost && <span className="text-[10px] text-slate-500">{'\u2022'} {c.cost}</span>}
                            {c.duration && <span className="text-[10px] text-slate-500">{'\u2022'} {c.duration}</span>}
                          </div>
                        </div>
                        {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-white/[0.05]"><ExternalLink className="w-3 h-3 text-cyan-400" /></a>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

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

            {cp.industryOutlook && (
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white flex items-center gap-2"><BarChart3 className="w-4 h-4 text-cyan-400" />Industry Outlook</h3></div>
                <div className="p-5"><p className="text-sm text-slate-300 leading-relaxed">{cp.industryOutlook}</p></div>
              </div>
            )}

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
