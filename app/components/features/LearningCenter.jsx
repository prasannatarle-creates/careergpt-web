'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, AlertCircle, Rocket, Compass, Target, GraduationCap, BookOpen, ExternalLink } from 'lucide-react';
import api, { formatDate } from '@/lib/api-client';

export default function LearningCenter() {
  const [resumes, setResumes] = useState([]);
  const [paths, setPaths] = useState([]);
  const [selectedResume, setSelectedResume] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('generate');
  const [skillGaps, setSkillGaps] = useState(null);
  const [gapLoading, setGapLoading] = useState(false);
  const [courseProgress, setCourseProgress] = useState({});
  const [updatingProgress, setUpdatingProgress] = useState(null);

  useEffect(() => {
    api.get('/resumes').then(d => setResumes(d.resumes || [])).catch(() => {});
    api.get('/learning-paths').then(d => setPaths(d.paths || [])).catch(() => {});
    api.get('/learning-progress').then(d => {
      if (d.courses) {
        const map = {};
        d.courses.forEach(c => { map[`${c.courseId}_${c.platform}`] = c.progressPercentage || 0; });
        setCourseProgress(map);
      }
    }).catch(() => {});
  }, []);

  const updateProgress = async (courseId, platform, progress) => {
    const key = `${courseId}_${platform}`;
    setUpdatingProgress(key);
    try {
      await api.post('/course/track-progress', { courseId, platform, progressPercentage: progress });
      setCourseProgress(prev => ({ ...prev, [key]: progress }));
    } catch(e) { console.error('Progress update error:', e); }
    finally { setUpdatingProgress(null); }
  };

  const generatePath = async () => {
    if (!selectedResume || !targetRole.trim()) { setError('Select a resume and enter target role'); return; }
    setLoading(true); setError('');
    try {
      const d = await api.post('/learning-path/generate', { resumeId: selectedResume, targetRole: targetRole.trim() });
      if (d.error) throw new Error(d.error);
      setPaths(prev => [{ pathId: d.pathId, targetRole: targetRole.trim(), learningPath: d.learningPath, createdAt: new Date().toISOString() }, ...prev]);
      setActiveTab('paths');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const analyzeGaps = async () => {
    if (!selectedResume || !targetRole.trim()) { setError('Select a resume and enter target role'); return; }
    setGapLoading(true); setError('');
    try {
      const d = await api.post('/learning-path/skill-gaps', { resumeId: selectedResume, targetRole: targetRole.trim() });
      if (d.error) throw new Error(d.error);
      setSkillGaps(d);
    } catch (e) { setError(e.message); }
    finally { setGapLoading(false); }
  };

  const tabs = [
    { id: 'generate', label: 'Generate Path', icon: Rocket },
    { id: 'paths', label: 'My Paths', icon: Compass, count: paths.length },
    { id: 'gaps', label: 'Skill Gaps', icon: Target },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto page-transition">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Learning Center</h1>
            <p className="text-sm text-slate-400">AI-powered learning paths & skill gap analysis</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-slate-800/50 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? 'bg-gradient-to-r from-indigo-600 to-purple-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Input Section */}
      {(activeTab === 'generate' || activeTab === 'gaps') && (
        <div className="glass-card p-6 mb-6 animate-slide-up">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Resume</label>
              <Select value={selectedResume} onValueChange={setSelectedResume}>
                <SelectTrigger className="input-glass h-11"><SelectValue placeholder="Select resume" /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {resumes.map(r => <SelectItem key={r.id} value={r.id} className="text-slate-200">{r.fileName}</SelectItem>)}
                </SelectContent>
              </Select>
              {resumes.length === 0 && <p className="text-[10px] text-amber-400 mt-1">Upload a resume first in Resume Analyzer</p>}
            </div>
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Target Role</label>
              <Input value={targetRole} onChange={e => setTargetRole(e.target.value)} placeholder="e.g., Senior Data Scientist" className="input-glass h-11" />
            </div>
            <div className="flex items-end gap-2">
              {activeTab === 'generate' && (
                <Button onClick={generatePath} disabled={loading} className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-500 text-white border-0 h-11 rounded-xl btn-glow">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating...</> : <><Sparkles className="w-4 h-4 mr-2" />Generate Path</>}
                </Button>
              )}
              {activeTab === 'gaps' && (
                <Button onClick={analyzeGaps} disabled={gapLoading} className="flex-1 bg-gradient-to-r from-amber-600 to-orange-500 text-white border-0 h-11 rounded-xl btn-glow">
                  {gapLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Analyzing...</> : <><Target className="w-4 h-4 mr-2" />Analyze Gaps</>}
                </Button>
              )}
            </div>
          </div>
          {error && <div className="mt-3 text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
        </div>
      )}

      {/* My Learning Paths */}
      {activeTab === 'paths' && (
        <div className="space-y-4 animate-slide-up">
          {paths.length === 0 ? (
            <div className="glass-card-static p-12 text-center">
              <GraduationCap className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-2">No learning paths yet</p>
              <p className="text-xs text-slate-500">Generate a learning path from the Generate tab</p>
            </div>
          ) : paths.map((p, idx) => (
            <div key={p.pathId || idx} className="glass-card overflow-hidden">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-indigo-400" />
                      {p.targetRole}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Created {formatDate(p.createdAt)}</p>
                  </div>
                  <Badge className="bg-indigo-500/15 text-indigo-300 border-indigo-500/20">Learning Path</Badge>
                </div>
                {p.learningPath && (
                  <div className="space-y-3">
                    {/* Skill Gaps */}
                    {p.learningPath.skillGaps && p.learningPath.skillGaps.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wider">Skills to Learn</p>
                        <div className="flex flex-wrap gap-2">
                          {p.learningPath.skillGaps.slice(0, 8).map((s, i) => (
                            <span key={i} className="px-3 py-1 rounded-full text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20">{typeof s === 'string' ? s : s.skill || s.name}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Courses */}
                    {p.learningPath.courses && p.learningPath.courses.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wider">Recommended Courses</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {p.learningPath.courses.slice(0, 6).map((c, i) => {
                            const courseKey = `${c.id || c.title || i}_${c.platform || c.provider || 'unknown'}`;
                            const progress = courseProgress[courseKey] || 0;
                            return (
                            <div key={i} className="p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                              <p className="text-sm text-slate-200 font-medium">{c.title || c.name}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">{c.platform || c.provider} {c.duration ? `• ${c.duration}` : ''}</p>
                              {/* Progress Bar */}
                              <div className="mt-2">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] text-slate-500">Progress</span>
                                  <span className={`text-[10px] font-medium ${progress >= 100 ? 'text-green-400' : progress > 0 ? 'text-cyan-400' : 'text-slate-500'}`}>{progress}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: progress >= 100 ? '#22c55e' : progress > 0 ? 'linear-gradient(90deg, #06b6d4, #3b82f6)' : 'transparent' }} />
                                </div>
                                <div className="flex items-center gap-1 mt-1.5">
                                  {[25, 50, 75, 100].map(val => (
                                    <button key={val} onClick={(e) => { e.stopPropagation(); updateProgress(c.id || c.title || i, c.platform || c.provider || 'unknown', val); }}
                                      disabled={updatingProgress === courseKey}
                                      className={`px-1.5 py-0.5 rounded text-[9px] transition-all ${progress >= val ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800/50 text-slate-500 hover:bg-slate-700/50 hover:text-slate-300'}`}
                                    >{val}%</button>
                                  ))}
                                </div>
                              </div>
                              {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:underline mt-1.5 inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" />View Course</a>}
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {/* Steps/Milestones */}
                    {p.learningPath.steps && p.learningPath.steps.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wider">Learning Steps</p>
                        <div className="space-y-2">
                          {p.learningPath.steps.slice(0, 5).map((step, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02]">
                              <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                              <div>
                                <p className="text-sm text-slate-200">{typeof step === 'string' ? step : step.title || step.description}</p>
                                {step.duration && <p className="text-[10px] text-slate-500 mt-0.5">{step.duration}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Skill Gap Analysis */}
      {activeTab === 'gaps' && skillGaps && (
        <div className="space-y-4 animate-slide-up">
          {/* Analysis */}
          {skillGaps.skillAnalysis && (
            <div className="glass-card p-5">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-400" />
                Skill Gap Analysis
              </h3>
              {skillGaps.skillAnalysis.existingSkills && skillGaps.skillAnalysis.existingSkills.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-green-400 font-medium mb-2 uppercase tracking-wider">Your Current Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {skillGaps.skillAnalysis.existingSkills.map((s, i) => (
                      <span key={i} className="px-3 py-1 rounded-full text-xs bg-green-500/10 text-green-300 border border-green-500/20">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {skillGaps.skillAnalysis.missingSkills && skillGaps.skillAnalysis.missingSkills.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-red-400 font-medium mb-2 uppercase tracking-wider">Skills to Develop</p>
                  <div className="flex flex-wrap gap-2">
                    {skillGaps.skillAnalysis.missingSkills.map((s, i) => (
                      <span key={i} className="px-3 py-1 rounded-full text-xs bg-red-500/10 text-red-300 border border-red-500/20">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {skillGaps.skillAnalysis.prioritySkills && skillGaps.skillAnalysis.prioritySkills.length > 0 && (
                <div>
                  <p className="text-xs text-amber-400 font-medium mb-2 uppercase tracking-wider">Priority Skills to Learn First</p>
                  <div className="flex flex-wrap gap-2">
                    {skillGaps.skillAnalysis.prioritySkills.map((s, i) => (
                      <span key={i} className="px-3 py-1 rounded-full text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">{typeof s === 'string' ? s : s.skill || s.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Course Recommendations */}
          {skillGaps.courseRecommendations && skillGaps.courseRecommendations.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                Recommended Courses
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {skillGaps.courseRecommendations.map((c, i) => (
                  <div key={i} className="p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.03] transition-all group">
                    <p className="text-sm text-white font-medium mb-1">{c.title || c.name}</p>
                    <p className="text-[10px] text-slate-400">{c.platform || c.provider}</p>
                    {c.level && <Badge className="mt-2 bg-indigo-500/15 text-indigo-300 border-indigo-500/20 text-[10px]">{c.level}</Badge>}
                    {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:underline mt-2 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><ExternalLink className="w-3 h-3" />Open</a>}
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
