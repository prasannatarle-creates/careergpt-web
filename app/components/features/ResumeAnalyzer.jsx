'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Upload, Target, Sparkles, FileText, Loader2, ChevronRight,
  TrendingUp, Zap, ArrowRight, CheckCircle2, BarChart3,
  Award, Star, AlertCircle, Eye, Clock, XCircle, Copy, Check, Edit2
} from 'lucide-react';
import api, { formatDate } from '@/lib/api-client';

export default function ResumeAnalyzer() {
  const [file, setFile] = useState(null);
  const [targetRole, setTargetRole] = useState('');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(-1);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [trackingMetric, setTrackingMetric] = useState(null);
  const fileRef = useRef(null);

  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ALLOWED_TYPES = ['.pdf', '.txt', '.md', '.docx'];

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const d = await api.get('/resumes');
      if (d.resumes) setHistory(d.resumes);
    } catch (e) { console.error('Failed to load history:', e); }
    finally { setLoadingHistory(false); }
  };

  useEffect(() => { loadHistory(); }, []);

  const loadComparison = async (baseResumeId) => {
    setLoadingCompare(true);
    try {
      const d = await api.get(`/resume/compare/${baseResumeId}`);
      if (d.comparison) { setComparison(d); setShowCompare(true); }
    } catch(e) { console.error('Comparison load error:', e); }
    finally { setLoadingCompare(false); }
  };

  const trackMetric = async (resumeId, metricType) => {
    setTrackingMetric(`${resumeId}-${metricType}`);
    try {
      await api.post('/resume/track-metric', { resumeId, metricType, value: 1 });
      if (comparison) {
        const baseId = comparison.baseResumeId;
        const d = await api.get(`/resume/compare/${baseId}`);
        if (d.comparison) setComparison(d);
      }
    } catch(e) { console.error('Track metric error:', e); }
    finally { setTrackingMetric(null); }
  };

  const validateFile = (f) => {
    if (!f) return 'No file selected';
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!ALLOWED_TYPES.includes(ext)) return `Unsupported file type. Accepted: ${ALLOWED_TYPES.join(', ')}`;
    if (f.size > MAX_FILE_SIZE) return `File too large (${(f.size / 1024 / 1024).toFixed(1)}MB). Maximum: 5MB`;
    return null;
  };

  const handleFileSelect = (f) => {
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setError(''); setFile(f);
  };

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
  };

  const analyze = async () => {
    if (!file) return;
    const valErr = validateFile(file);
    if (valErr) { setError(valErr); return; }
    setError(''); setAnalysis(null); setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const up = await api.post('/resume/upload', fd);
      if (up.error) throw new Error(up.error);
      setUploading(false); setAnalyzing(true);
      const an = await api.post('/resume/analyze', { resumeId: up.resumeId, targetRole });
      if (an.error) throw new Error(an.error);
      setAnalysis(an.analysis);
      loadHistory();
    } catch (e) { setError(e.message); }
    finally { setUploading(false); setAnalyzing(false); }
  };

  const loadPastAnalysis = async (resumeId) => {
    try {
      const d = await api.get(`/resumes/${resumeId}`);
      if (d.resume?.analysis) {
        setAnalysis(d.resume.analysis);
        setShowHistory(false);
      }
    } catch (e) { console.error(e); }
  };

  const copyBullet = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(-1), 2000);
  };

  const downloadPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const a = analysis;
    let y = 20;

    doc.setFontSize(20);
    doc.setTextColor(0, 120, 200);
    doc.text('CareerGPT Resume Analysis Report', 20, y); y += 12;

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`ATS Score: ${a.atsScore || 'N/A'}/100`, 20, y); y += 8;
    doc.text(`Experience Level: ${a.experienceLevel || 'N/A'}`, 20, y); y += 8;
    if (a.wordCount) { doc.text(`Word Count: ${a.wordCount} (~${a.pageEstimate || 1} page${(a.pageEstimate||1)>1?'s':''})`, 20, y); y += 8; }
    y += 2;

    if (a.sections) {
      doc.setFontSize(12);
      doc.setTextColor(0, 80, 150);
      doc.text('Section Scores:', 20, y); y += 7;
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      Object.entries(a.sections).forEach(([key, sec]) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${sec.score}/100 - ${sec.feedback || ''}`, 25, y); y += 6;
      });
      y += 4;
    }

    if (a.keywords) {
      doc.setFontSize(12);
      doc.setTextColor(0, 80, 150);
      doc.text('Keywords Found:', 20, y); y += 7;
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text((a.keywords.found || []).join(', '), 25, y, { maxWidth: 160 }); y += 8;
      doc.setTextColor(200, 0, 0);
      doc.text('Missing: ' + (a.keywords.missing || []).join(', '), 25, y, { maxWidth: 160 }); y += 10;
    }

    if (a.atsChecklist) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setTextColor(0, 80, 150);
      doc.text('ATS Compatibility Checklist:', 20, y); y += 7;
      doc.setFontSize(10);
      a.atsChecklist.forEach(c => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setTextColor(c.passed ? 0 : 200, c.passed ? 150 : 0, 0);
        doc.text(`${c.passed ? '\u2713' : '\u2717'} ${c.item}`, 25, y); y += 5;
        doc.setTextColor(120, 120, 120);
        doc.text(`  \u2192 ${c.tip}`, 30, y); y += 6;
      });
      y += 4;
    }

    if (a.strengths) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setTextColor(0, 150, 0);
      doc.text('Strengths:', 20, y); y += 7;
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      (a.strengths || []).forEach(s => { doc.text(`\u2022 ${s}`, 25, y); y += 6; });
      y += 4;
    }

    if (a.weaknesses) {
      doc.setFontSize(12);
      doc.setTextColor(200, 150, 0);
      doc.text('Areas to Improve:', 20, y); y += 7;
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      (a.weaknesses || []).forEach(w => { if (y > 270) { doc.addPage(); y = 20; } doc.text(`\u2022 ${w}`, 25, y); y += 6; });
      y += 4;
    }

    if (a.rewrittenBullets && a.rewrittenBullets.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setTextColor(0, 80, 150);
      doc.text('Improved Bullet Points:', 20, y); y += 7;
      doc.setFontSize(9);
      a.rewrittenBullets.forEach(b => {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setTextColor(200, 0, 0);
        doc.text(`Before: ${b.original}`, 25, y, { maxWidth: 155 }); y += 5;
        doc.setTextColor(0, 150, 0);
        doc.text(`After: ${b.improved}`, 25, y, { maxWidth: 155 }); y += 8;
      });
    }

    if (a.overallFeedback) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.setTextColor(0, 80, 150);
      doc.text('Overall Feedback:', 20, y); y += 7;
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(a.overallFeedback, 160);
      doc.text(lines, 25, y);
    }

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by CareerGPT - AI-Powered Career Guidance', 20, 285);

    doc.save('CareerGPT_Resume_Analysis.pdf');
  };

  const scoreColor = (s) => s >= 70 ? 'text-green-400' : s >= 50 ? 'text-yellow-400' : 'text-red-400';
  const scoreBorder = (s) => s >= 70 ? '#22c55e' : s >= 50 ? '#eab308' : '#ef4444';
  const scoreBg = (s) => s >= 70 ? 'bg-green-500/15 border-green-500/20' : s >= 50 ? 'bg-yellow-500/15 border-yellow-500/20' : 'bg-red-500/15 border-red-500/20';

  if (showHistory) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto page-transition">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Resume History</h1>
          <Button onClick={() => setShowHistory(false)} variant="outline" className="border-slate-600/30 text-slate-300 hover:bg-slate-800/30 rounded-xl">
            <ArrowRight className="w-4 h-4 mr-2 rotate-180" />Back
          </Button>
        </div>
        {loadingHistory ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
        ) : history.length === 0 ? (
          <div className="glass-card-static p-10 text-center">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No past analyses found. Upload a resume to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((r, i) => (
              <div key={r.id || i} className="glass-card-static p-4 flex items-center justify-between hover:bg-white/[0.04] transition-colors cursor-pointer" onClick={() => r.analysis ? loadPastAnalysis(r.id) : null}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{r.fileName || 'Untitled Resume'}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-slate-500">{formatDate(r.createdAt)}</span>
                      {r.targetRole && <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/20 text-[10px]">{r.targetRole}</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm" variant="ghost" className="text-xs text-purple-400 hover:bg-purple-500/10" onClick={(e) => { e.stopPropagation(); loadComparison(r.id); }}>
                    {loadingCompare ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Compare'}
                  </Button>
                  {r.analysis?.atsScore != null && (
                    <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center" style={{ borderColor: scoreBorder(r.analysis.atsScore) }}>
                      <span className={`text-sm font-bold ${scoreColor(r.analysis.atsScore)}`}>{r.analysis.atsScore}</span>
                    </div>
                  )}
                  {r.analysis ? <ChevronRight className="w-4 h-4 text-slate-500" /> : <span className="text-xs text-slate-600">No analysis</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (showCompare && comparison) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto page-transition">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Resume Version Comparison</h1>
            <p className="text-sm text-slate-400">{comparison.totalVariants} version{comparison.totalVariants !== 1 ? 's' : ''} tracked</p>
          </div>
          <Button onClick={() => setShowCompare(false)} variant="outline" className="border-slate-600/30 text-slate-300 hover:bg-slate-800/30 rounded-xl">
            <ArrowRight className="w-4 h-4 mr-2 rotate-180" />Back
          </Button>
        </div>

        <div className="space-y-4">
          {comparison.comparison.map((v, i) => (
            <div key={v.resumeId} className={`glass-card overflow-hidden ${i === 0 ? 'ring-1 ring-green-500/30' : ''}`}>
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${v.isBaseResume ? 'bg-blue-500/15' : 'bg-purple-500/15'}`}>
                      <FileText className={`w-5 h-5 ${v.isBaseResume ? 'text-blue-400' : 'text-purple-400'}`} />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                        {v.label}
                        {i === 0 && <Badge className="bg-green-500/15 text-green-300 border-green-500/20 text-[9px]">Best</Badge>}
                        {v.isBaseResume && <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/20 text-[9px]">Original</Badge>}
                      </h3>
                      <p className="text-[10px] text-slate-500">{formatDate(v.createdAt)}</p>
                    </div>
                  </div>
                  {v.atsScore > 0 && (
                    <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center" style={{ borderColor: v.atsScore >= 70 ? '#22c55e' : v.atsScore >= 50 ? '#eab308' : '#ef4444' }}>
                      <span className={`text-sm font-bold ${v.atsScore >= 70 ? 'text-green-400' : v.atsScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{v.atsScore}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-5 gap-2 mb-3">
                  {[
                    { label: 'Views', key: 'views', value: v.metrics.views },
                    { label: 'Sent', key: 'application', value: v.metrics.applicationsSent },
                    { label: 'Interviews', key: 'interview', value: v.metrics.interviews },
                    { label: 'Offers', key: 'offer', value: v.metrics.offers },
                    { label: 'Conv. Rate', value: `${v.conversionRate}%`, noTrack: true },
                  ].map(m => (
                    <div key={m.label} className="text-center p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                      <p className="text-lg font-bold text-white">{m.value}</p>
                      <p className="text-[9px] text-slate-500 uppercase tracking-wider">{m.label}</p>
                      {!m.noTrack && (
                        <button
                          onClick={(e) => { e.stopPropagation(); trackMetric(v.resumeId, m.key); }}
                          disabled={trackingMetric === `${v.resumeId}-${m.key}`}
                          className="mt-1 text-[9px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                        >+1</button>
                      )}
                    </div>
                  ))}
                </div>

                {v.changes && <p className="text-[10px] text-slate-500">Changes: {v.changes.label || JSON.stringify(v.changes).substring(0, 80)}</p>}
              </div>
            </div>
          ))}
        </div>

        {comparison.analysis?.insights && (
          <div className="mt-4 glass-card-static p-4">
            <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-400" />Insights</h4>
            <div className="space-y-1.5">
              {comparison.analysis.insights.map((insight, i) => (
                <p key={i} className="text-xs text-slate-400 flex items-start gap-2"><span className="text-cyan-400 mt-0.5">{'\u2022'}</span>{insight}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (analysis) {
    const a = analysis;
    const isRaw = a.raw;
    const sd = a.structuredData;
    const checklistPassed = (a.atsChecklist || []).filter(c => c.passed).length;
    const checklistTotal = (a.atsChecklist || []).length;

    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto page-transition">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Resume Analysis</h1>
          <div className="flex gap-2">
            {!isRaw && <Button onClick={downloadPDF} variant="outline" className="border-green-600/30 text-green-300 hover:bg-green-900/20 rounded-xl"><FileText className="w-4 h-4 mr-2" />Download PDF</Button>}
            <Button onClick={() => setShowHistory(true)} variant="outline" className="border-blue-600/30 text-blue-300 hover:bg-blue-900/20 rounded-xl"><Clock className="w-4 h-4 mr-2" />History</Button>
            <Button onClick={() => { setAnalysis(null); setFile(null); }} variant="outline" className="border-slate-600/30 text-slate-300 hover:bg-slate-800/30 rounded-xl">Analyze Another</Button>
          </div>
        </div>

        {isRaw ? (
          <div className="glass-card-static p-6"><div className="prose prose-invert max-w-none [&>*]:text-slate-200 [&>p]:text-slate-200 [&>h1]:text-white [&>h2]:text-white [&>h3]:text-cyan-300 [&>strong]:text-cyan-300 [&>li]:text-slate-200"><ReactMarkdown remarkPlugins={[remarkGfm]}>{a.overallFeedback || JSON.stringify(a)}</ReactMarkdown></div></div>
        ) : (
          <div className="space-y-6">
            <div className="glass-card-bright">
              <div className="p-6">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                  <div className="relative w-28 h-28 flex-shrink-0">
                    <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                      <circle cx="60" cy="60" r="52" fill="none" stroke={scoreBorder(a.atsScore)} strokeWidth="8"
                        strokeDasharray={`${(a.atsScore / 100) * 327} 327`} strokeLinecap="round" className="transition-all duration-1000" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-bold text-white">{a.atsScore}</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-white">ATS Score: {a.atsScore}/100</h2>
                    <p className="text-slate-400 text-sm mt-1">{a.experienceLevel ? `Experience Level: ${a.experienceLevel}` : ''}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(a.matchingRoles || []).slice(0, 3).map((r, i) => <Badge key={i} className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">{r}</Badge>)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    {a.wordCount && (
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                        <p className="text-lg font-bold text-white">{a.wordCount}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Words</p>
                      </div>
                    )}
                    {a.pageEstimate && (
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                        <p className="text-lg font-bold text-white">{a.pageEstimate}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{a.pageEstimate > 1 ? 'Pages' : 'Page'}</p>
                      </div>
                    )}
                    {sd?.totalExperienceYears != null && (
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                        <p className="text-lg font-bold text-white">{sd.totalExperienceYears}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Yrs Exp</p>
                      </div>
                    )}
                    {sd?.skills?.length > 0 && (
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                        <p className="text-lg font-bold text-white">{sd.skills.length}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Skills</p>
                      </div>
                    )}
                  </div>
                </div>
                {sd && (
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/[0.05]">
                    {sd.focusArea && <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/20 text-xs"><Sparkles className="w-3 h-3 mr-1" />{sd.focusArea}</Badge>}
                    {sd.seniority && <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/20 text-xs"><Award className="w-3 h-3 mr-1" />{sd.seniority} level</Badge>}
                    {sd.certifications?.length > 0 && <Badge className="bg-green-500/15 text-green-300 border-green-500/20 text-xs"><Star className="w-3 h-3 mr-1" />{sd.certifications.length} certification{sd.certifications.length > 1 ? 's' : ''}</Badge>}
                  </div>
                )}
              </div>
            </div>

            {a.readability && (
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white flex items-center gap-2"><Eye className="w-4 h-4 text-cyan-400" />Readability</h3></div>
                <div className="p-5">
                  <div className="flex items-center gap-4 mb-3">
                    <div className={`px-3 py-1 rounded-lg text-sm font-semibold ${scoreBg(a.readability.score)}`}>
                      {a.readability.score}/100 — {a.readability.level}
                    </div>
                    {a.readability.avgSentenceLength && <span className="text-xs text-slate-500">Avg sentence: {a.readability.avgSentenceLength} words</span>}
                  </div>
                  {a.readability.suggestions?.length > 0 && (
                    <div className="space-y-1">
                      {a.readability.suggestions.map((s, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <Sparkles className="w-3 h-3 text-cyan-400 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-slate-400">{s}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {a.atsChecklist && a.atsChecklist.length > 0 && (
              <div className="glass-card-static">
                <div className="p-5 pb-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-white flex items-center gap-2"><Target className="w-4 h-4 text-cyan-400" />ATS Compatibility Checklist</h3>
                    <Badge className={`${checklistPassed >= checklistTotal * 0.7 ? 'bg-green-500/15 text-green-300 border-green-500/20' : checklistPassed >= checklistTotal * 0.5 ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20' : 'bg-red-500/15 text-red-300 border-red-500/20'} text-xs`}>{checklistPassed}/{checklistTotal} passed</Badge>
                  </div>
                </div>
                <div className="p-5 space-y-2">
                  {a.atsChecklist.map((c, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${c.passed ? 'bg-green-500/[0.03] border-green-500/10' : 'bg-red-500/[0.03] border-red-500/10'}`}>
                      {c.passed ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />}
                      <div>
                        <p className={`text-sm ${c.passed ? 'text-green-300' : 'text-red-300'}`}>{c.item}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{c.tip}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {a.sections && (
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white flex items-center gap-2"><BarChart3 className="w-4 h-4 text-cyan-400" />Section-by-Section Analysis</h3></div>
                <div className="p-5 space-y-3">
                  {Object.entries(a.sections).map(([key, sec]) => (
                    <div key={key} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white capitalize">{key}</span>
                        <div className="flex items-center gap-2">
                          {sec.present ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                          <span className={`text-sm font-bold ${scoreColor(sec.score)}`}>{sec.score}/100</span>
                        </div>
                      </div>
                      <Progress value={sec.score} className="h-1.5 mb-1" />
                      <p className="text-xs text-slate-400">{sec.feedback}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {a.keywords && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="glass-card-static">
                    <div className="p-5 pb-0"><h3 className="text-sm font-semibold text-green-400 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Keywords Found ({(a.keywords.found||[]).length})</h3></div>
                    <div className="p-5"><div className="flex flex-wrap gap-1.5">{(a.keywords.found || []).map((k, i) => <Badge key={i} className="bg-green-500/15 text-green-300 border-green-500/20 text-xs">{k}</Badge>)}</div></div>
                  </div>
                  <div className="glass-card-static">
                    <div className="p-5 pb-0"><h3 className="text-sm font-semibold text-red-400 flex items-center gap-2"><XCircle className="w-4 h-4" />Missing Keywords ({(a.keywords.missing||[]).length})</h3></div>
                    <div className="p-5"><div className="flex flex-wrap gap-1.5">{(a.keywords.missing || []).map((k, i) => <Badge key={i} className="bg-red-500/15 text-red-300 border-red-500/20 text-xs">{k}</Badge>)}</div></div>
                  </div>
                </div>
                {a.keywords.suggestions && a.keywords.suggestions.length > 0 && (
                  <div className="glass-card-static">
                    <div className="p-5 pb-0"><h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2"><Sparkles className="w-4 h-4" />Keyword Suggestions</h3></div>
                    <div className="p-5 space-y-2">
                      {a.keywords.suggestions.map((s, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <Zap className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-slate-300">{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {a.rewrittenBullets && a.rewrittenBullets.length > 0 && (
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white flex items-center gap-2"><Edit2 className="w-4 h-4 text-cyan-400" />Improved Bullet Points</h3></div>
                <div className="p-5 space-y-3">
                  {a.rewrittenBullets.map((b, i) => (
                    <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] group">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-red-300 line-through mb-1.5">{b.original}</p>
                          <p className="text-xs text-green-300 font-medium">{b.improved}</p>
                          <p className="text-[10px] text-slate-500 mt-1.5 italic">{b.reason}</p>
                        </div>
                        <button onClick={() => copyBullet(b.improved, i)} className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors flex-shrink-0 opacity-60 group-hover:opacity-100" title="Copy improved bullet">
                          {copiedIdx === i ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-sm font-semibold text-green-400 flex items-center gap-2"><TrendingUp className="w-4 h-4" />Strengths</h3></div>
                <div className="p-5">{(a.strengths || []).map((s, i) => <div key={i} className="flex gap-2 mb-2"><CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" /><span className="text-xs text-slate-300 leading-relaxed">{s}</span></div>)}</div>
              </div>
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" />Areas to Improve</h3></div>
                <div className="p-5">{(a.weaknesses || []).map((w, i) => <div key={i} className="flex gap-2 mb-2"><AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" /><span className="text-xs text-slate-300 leading-relaxed">{w}</span></div>)}</div>
              </div>
            </div>

            {sd?.skills?.length > 0 && (
              <div className="glass-card-static">
                <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white flex items-center gap-2"><Zap className="w-4 h-4 text-cyan-400" />Detected Skills</h3></div>
                <div className="p-5"><div className="flex flex-wrap gap-1.5">{sd.skills.map((s, i) => <Badge key={i} className="bg-cyan-500/10 text-cyan-300 border-cyan-500/20 text-xs">{s}</Badge>)}</div></div>
              </div>
            )}

            {a.overallFeedback && (
              <div className="glass-card-static p-6"><p className="text-slate-300 text-sm leading-relaxed">{a.overallFeedback}</p></div>
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
          <h1 className="text-2xl font-bold text-white mb-1">Resume Analyzer & ATS Scorer</h1>
          <p className="text-sm text-slate-400">Upload your resume and get AI-powered ATS analysis</p>
        </div>
        {history.length > 0 && (
          <Button onClick={() => setShowHistory(true)} variant="outline" className="border-blue-600/30 text-blue-300 hover:bg-blue-900/20 rounded-xl">
            <Clock className="w-4 h-4 mr-2" />History ({history.length})
          </Button>
        )}
      </div>
      <div className="glass-card overflow-hidden">
        <div className="p-6 space-y-5">
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${
              dragActive ? 'border-cyan-400/60 bg-cyan-500/10 scale-[1.02]' :
              file ? 'border-green-500/40 bg-green-500/5' : 'border-slate-600/40 hover:border-cyan-500/30 hover:bg-cyan-500/5'
            }`}
          >
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.txt,.md,.docx" onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
            {file ? (
              <div className="animate-scale-in">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-white font-semibold text-lg">{file.name}</p>
                <p className="text-slate-400 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                <p className="text-slate-500 text-[10px] mt-2">Click or drop to change file</p>
              </div>
            ) : (
              <>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-colors ${dragActive ? 'bg-cyan-500/20' : 'bg-slate-800/50'}`}>
                  <Upload className={`w-7 h-7 ${dragActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                </div>
                <p className="text-white font-medium">{dragActive ? 'Drop your resume here' : 'Drop resume here or click to browse'}</p>
                <p className="text-slate-500 text-xs mt-1">PDF, DOCX, TXT supported {'\u2022'} Max 5MB</p>
              </>
            )}
          </div>
          <div>
            <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Target Role (optional)</label>
            <Input value={targetRole} onChange={e => setTargetRole(e.target.value)} placeholder="e.g., Software Engineer, Data Scientist" className="input-glass h-11" />
          </div>
          {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</p>}
          <Button onClick={analyze} disabled={!file || uploading || analyzing} className="w-full bg-gradient-to-r from-teal-600 to-cyan-500 text-white border-0 h-12 rounded-xl btn-glow shadow-lg shadow-teal-500/15">
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Uploading...</> : analyzing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Analyzing with AI...</> : <><Target className="w-4 h-4 mr-2" />Analyze Resume</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
