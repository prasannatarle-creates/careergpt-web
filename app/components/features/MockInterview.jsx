'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, ChevronDown, CheckCircle2, AlertCircle, Loader2, Mic, Clock, Send, Award, FileText } from 'lucide-react';
import api, { formatDate, formatDateTime } from '@/lib/api-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MockInterview() {
  const [started, setStarted] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [currentContent, setCurrentContent] = useState('');
  const [questionNum, setQuestionNum] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [role, setRole] = useState('Software Engineer');
  const [level, setLevel] = useState('mid-level');
  const [type, setType] = useState('behavioral');
  const [questionCount, setQuestionCount] = useState(5);
  const [focusAreas, setFocusAreas] = useState('');
  const [allFeedback, setAllFeedback] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);
  const [allAnswers, setAllAnswers] = useState([]);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef(null);
  const [showTips, setShowTips] = useState(false);
  const [expandedQ, setExpandedQ] = useState(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const answerRef = useRef('');
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);

  // Timer
  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerActive]);

  const formatTimer = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // Check voice support
  useEffect(() => {
    const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    setVoiceSupported(!!SpeechRecognition);
    return () => { stopVoice(); };
  }, []);

  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = answerRef.current;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setAnswer(finalTranscript + interim);
      answerRef.current = finalTranscript;
    };

    recognition.onerror = (e) => { console.error('Speech error:', e); stopVoice(); };
    recognition.onend = () => { if (isRecordingRef.current) { try { recognition.start(); } catch(e) {} } };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    isRecordingRef.current = true;
    setIsListening(true);

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      streamRef.current = stream;
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const updateLevel = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setAudioLevel(avg);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    }).catch(() => {});
  };

  const stopVoice = () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch(e) {} recognitionRef.current = null; }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) { try { audioContextRef.current.close(); } catch(e) {} }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); }
    setAudioLevel(0);
  };

  const toggleVoice = () => { isRecording ? stopVoice() : startVoice(); };

  const startInterview = async () => {
    setLoading(true); setError('');
    try {
      const d = await api.post('/mock-interview/start', { role, level, type, questionCount, focusAreas: focusAreas.trim() || undefined });
      if (d.error) throw new Error(d.error);
      setSessionId(d.sessionId); setCurrentContent(d.question); setQuestionNum(1); setStarted(true);
      setTotalQuestions(d.totalQuestions || questionCount);
      setAllQuestions([d.question]);
      setTimer(0); setTimerActive(true);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) return;
    setLoading(true); setFeedback(null); setError('');
    setTimerActive(false); // Pause timer while submitting
    try {
      const d = await api.post('/mock-interview/respond', { sessionId, answer });
      if (d.error) throw new Error(d.error);
      const fb = d.feedback;
      setFeedback(fb);
      setAllFeedback(prev => [...prev, fb]);
      setAllAnswers(prev => [...prev, answer]);
      setQuestionNum(d.questionNumber);
      if (d.totalQuestions) setTotalQuestions(d.totalQuestions);
      setIsComplete(d.isComplete);
      setAnswer('');
      if (!d.isComplete && fb.nextQuestion) {
        setCurrentContent(fb.nextQuestion);
        setAllQuestions(prev => [...prev, fb.nextQuestion]);
        setTimer(0);
        setTimerActive(true); // Resume timer for next question
      } else {
        setTimerActive(false);
      }
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  const downloadReport = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    let y = 20;
    const pageH = 280;
    const checkPage = (need = 20) => { if (y + need > pageH) { doc.addPage(); y = 20; } };

    // Title
    doc.setFontSize(20); doc.setTextColor(0, 100, 200);
    doc.text('CareerGPT Mock Interview Report', 20, y); y += 10;
    doc.setDrawColor(0, 100, 200); doc.setLineWidth(0.5);
    doc.line(20, y, 190, y); y += 8;

    // Session info
    doc.setFontSize(11); doc.setTextColor(60, 60, 60);
    doc.text(`Role: ${role}`, 20, y);
    doc.text(`Level: ${level}`, 100, y); y += 6;
    doc.text(`Type: ${type}`, 20, y);
    doc.text(`Questions: ${totalQuestions}`, 100, y); y += 6;
    if (focusAreas) { doc.text(`Focus: ${focusAreas}`, 20, y); y += 6; }
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, y); y += 10;

    // Overall score + grade
    const avgScore = allFeedback.length > 0 ? (allFeedback.reduce((a, b) => a + (b.score || 0), 0) / allFeedback.length).toFixed(1) : 'N/A';
    const lastFb = allFeedback[allFeedback.length - 1];
    const grade = lastFb?.overallGrade || (avgScore >= 9 ? 'A+' : avgScore >= 8 ? 'A' : avgScore >= 7 ? 'B+' : avgScore >= 6 ? 'B' : avgScore >= 5 ? 'C' : 'D');

    doc.setFillColor(240, 245, 255); doc.roundedRect(20, y, 170, 18, 3, 3, 'F');
    doc.setFontSize(14); doc.setTextColor(0, 80, 160);
    doc.text(`Overall Grade: ${grade}`, 28, y + 8);
    doc.text(`Average Score: ${avgScore}/10`, 110, y + 8);
    y += 14;
    if (lastFb?.hireRecommendation) {
      doc.setFontSize(10); doc.setTextColor(0, 120, 80);
      doc.text(`Hire Recommendation: ${lastFb.hireRecommendation}`, 28, y + 2);
      y += 6;
    }
    y += 8;

    // Final assessment
    if (lastFb?.finalAssessment) {
      checkPage(20);
      doc.setFontSize(12); doc.setTextColor(0, 80, 150);
      doc.text('Final Assessment', 20, y); y += 6;
      doc.setFontSize(9); doc.setTextColor(50, 50, 50);
      const faLines = doc.splitTextToSize(lastFb.finalAssessment, 165);
      doc.text(faLines, 25, y); y += faLines.length * 4 + 6;
    }

    // Category scores
    const catKeys = ['technicalAccuracy', 'communicationScore', 'structureScore', 'confidenceScore'];
    const catData = catKeys.map(key => {
      const vals = allFeedback.filter(fb => fb[key] != null).map(fb => fb[key]);
      return vals.length ? { label: key.replace(/([A-Z])/g, ' $1').replace('Score', '').trim(), avg: (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) } : null;
    }).filter(Boolean);
    if (catData.length) {
      checkPage(16);
      doc.setFontSize(12); doc.setTextColor(0, 80, 150);
      doc.text('Category Scores', 20, y); y += 6;
      doc.setFontSize(10); doc.setTextColor(50, 50, 50);
      catData.forEach(c => { doc.text(`${c.label}: ${c.avg}/10`, 25, y); y += 5; });
      y += 4;
    }

    // Top strengths
    if (lastFb?.topStrengths?.length) {
      checkPage(16);
      doc.setFontSize(12); doc.setTextColor(0, 130, 60);
      doc.text('Top Strengths', 20, y); y += 6;
      doc.setFontSize(9); doc.setTextColor(50, 50, 50);
      lastFb.topStrengths.forEach(s => {
        checkPage(8);
        const sLines = doc.splitTextToSize(`✓ ${s}`, 160);
        doc.text(sLines, 25, y); y += sLines.length * 4 + 2;
      });
      y += 4;
    }

    // Key improvements
    if (lastFb?.topImprovements?.length) {
      checkPage(16);
      doc.setFontSize(12); doc.setTextColor(200, 120, 0);
      doc.text('Key Improvements', 20, y); y += 6;
      doc.setFontSize(9); doc.setTextColor(50, 50, 50);
      lastFb.topImprovements.forEach(s => {
        checkPage(8);
        const sLines = doc.splitTextToSize(`• ${s}`, 160);
        doc.text(sLines, 25, y); y += sLines.length * 4 + 2;
      });
      y += 4;
    }

    // Improvement roadmap
    if (lastFb?.improvementRoadmap?.length) {
      checkPage(16);
      doc.setFontSize(12); doc.setTextColor(80, 60, 160);
      doc.text('Improvement Roadmap', 20, y); y += 6;
      doc.setFontSize(9); doc.setTextColor(50, 50, 50);
      lastFb.improvementRoadmap.forEach((step, i) => {
        checkPage(8);
        const sLines = doc.splitTextToSize(`${i + 1}. ${step}`, 160);
        doc.text(sLines, 25, y); y += sLines.length * 4 + 2;
      });
      y += 4;
    }

    // Question-by-question details
    allFeedback.forEach((fb, i) => {
      checkPage(40);
      doc.setFontSize(12); doc.setTextColor(0, 80, 150);
      let qHeader = `Question ${i + 1} — Score: ${fb.score || '?'}/10`;
      if (fb.difficulty) qHeader += ` | ${fb.difficulty}`;
      if (fb.questionCategory) qHeader += ` | ${fb.questionCategory}`;
      doc.text(qHeader, 20, y); y += 6;

      if (allQuestions[i]) {
        doc.setFontSize(9); doc.setTextColor(40, 40, 40);
        const qLines = doc.splitTextToSize(`Q: ${allQuestions[i].replace(/[\*#]/g, '')}`, 160);
        doc.text(qLines, 25, y); y += qLines.length * 4 + 2;
      }
      if (allAnswers[i]) {
        checkPage(10);
        doc.setTextColor(80, 80, 80);
        const aLines = doc.splitTextToSize(`Your Answer: ${allAnswers[i].substring(0, 400)}`, 160);
        doc.text(aLines, 25, y); y += aLines.length * 4 + 2;
      }
      if (fb.feedback) {
        checkPage(10);
        doc.setTextColor(0, 100, 0);
        const fLines = doc.splitTextToSize(`Feedback: ${fb.feedback.substring(0, 500)}`, 155);
        doc.text(fLines, 25, y); y += fLines.length * 4 + 2;
      }
      if (fb.keyMissing?.length) {
        checkPage(8);
        doc.setTextColor(180, 100, 0);
        doc.text(`Key Missing: ${fb.keyMissing.join(', ')}`, 25, y); y += 5;
      }
      if (fb.sampleAnswer) {
        checkPage(10);
        doc.setTextColor(0, 80, 120);
        const mLines = doc.splitTextToSize(`Model Answer: ${fb.sampleAnswer.substring(0, 400)}`, 155);
        doc.text(mLines, 25, y); y += mLines.length * 4 + 2;
      }
      y += 6;
    });

    // Footer on every page
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(7); doc.setTextColor(150, 150, 150);
      doc.text('Generated by CareerGPT — AI-Powered Career Guidance', 20, 290);
      doc.text(`Page ${p} of ${totalPages}`, 175, 290);
    }
    doc.save(`CareerGPT_Interview_${role.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const resetInterview = () => {
    stopVoice(); setStarted(false); setFeedback(null); setAllFeedback([]);
    setAllQuestions([]); setAllAnswers([]); setTimer(0); setTimerActive(false);
    setIsComplete(false); setError(''); setExpandedQ(null); setTotalQuestions(questionCount);
  };

  if (!started) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto page-transition">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">AI Mock Interview</h1>
          <p className="text-sm text-slate-400">Practice with AI-powered interview simulation</p>
        </div>
        <div className="glass-card overflow-hidden">
          <div className="p-6 space-y-5">
            <div>
              <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Job Role</label>
              <Input value={role} onChange={e => setRole(e.target.value)} className="input-glass h-11" placeholder="e.g., Software Engineer, Product Manager" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Level</label>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger className="input-glass h-11"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="entry-level">Entry Level</SelectItem>
                    <SelectItem value="mid-level">Mid Level</SelectItem>
                    <SelectItem value="senior">Senior</SelectItem>
                    <SelectItem value="lead">Lead / Staff</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Type</label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="input-glass h-11"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="behavioral">Behavioral</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="system-design">System Design</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                    <SelectItem value="case-study">Case Study</SelectItem>
                    <SelectItem value="coding">Coding</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Question Count & Focus */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Questions</label>
                <Select value={String(questionCount)} onValueChange={v => setQuestionCount(Number(v))}>
                  <SelectTrigger className="input-glass h-11"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="3">3 Questions (Quick)</SelectItem>
                    <SelectItem value="5">5 Questions (Standard)</SelectItem>
                    <SelectItem value="7">7 Questions (Thorough)</SelectItem>
                    <SelectItem value="10">10 Questions (Full)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Focus Areas (optional)</label>
                <Input value={focusAreas} onChange={e => setFocusAreas(e.target.value)} className="input-glass h-11" placeholder="e.g., React, Leadership, SQL" />
              </div>
            </div>

            {/* Interview Tips */}
            <div className="p-4 rounded-xl bg-violet-500/[0.05] border border-violet-500/10">
              <button onClick={() => setShowTips(!showTips)} className="w-full flex items-center justify-between">
                <span className="text-sm font-medium text-violet-300 flex items-center gap-2"><Sparkles className="w-4 h-4" />Interview Tips</span>
                <ChevronDown className={`w-4 h-4 text-violet-400 transition-transform ${showTips ? 'rotate-180' : ''}`} />
              </button>
              {showTips && (
                <div className="mt-3 space-y-2 animate-slide-up">
                  {[
                    { title: 'STAR Method', desc: 'Structure answers: Situation → Task → Action → Result' },
                    { title: 'Be Specific', desc: 'Use real examples with numbers and outcomes' },
                    { title: 'Stay Concise', desc: 'Aim for 2-3 minute answers — quality over quantity' },
                    { title: 'Ask Clarifying Questions', desc: 'Show critical thinking by asking before answering' },
                    { title: 'Show Impact', desc: 'Focus on what YOU did and the measurable results' },
                  ].map((tip, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
                      <div><span className="text-xs text-white font-medium">{tip.title}: </span><span className="text-xs text-slate-400">{tip.desc}</span></div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</p>}
            <Button onClick={startInterview} disabled={loading} className="w-full bg-gradient-to-r from-violet-600 to-purple-500 text-white border-0 h-12 rounded-xl btn-glow shadow-lg shadow-violet-500/15">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Starting...</> : <><Mic className="w-4 h-4 mr-2" />Start Interview</>}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Mock Interview: {role}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 text-[10px]">{level}</Badge>
            <Badge className="bg-slate-500/20 text-slate-300 border-slate-500/30 text-[10px]">{type}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className={`text-sm font-mono font-bold ${timer > 180 ? 'text-red-400' : timer > 120 ? 'text-yellow-400' : 'text-white'}`}>{formatTimer(timer)}</span>
          </div>
          <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30">Q{Math.min(questionNum, totalQuestions)}/{totalQuestions}</Badge>
        </div>
      </div>
      <Progress value={Math.min(questionNum, totalQuestions) / totalQuestions * 100} className="h-2 mb-4" />

      {/* Current Question / Feedback */}
      {feedback && !feedback.raw ? (
        <div className="glass-card-static mb-4">
          <div className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 68 68">
                  <circle cx="34" cy="34" r="28" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
                  <circle cx="34" cy="34" r="28" fill="none" stroke={(feedback.score||0) >= 7 ? '#22c55e' : (feedback.score||0) >= 5 ? '#eab308' : '#ef4444'} strokeWidth="5"
                    strokeDasharray={`${((feedback.score||0) / 10) * 176} 176`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-white">{feedback.score}/{feedback.maxScore || 10}</span>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-2">
                {[['Technical', feedback.technicalAccuracy], ['Communication', feedback.communicationScore], ['Structure', feedback.structureScore], ['Confidence', feedback.confidenceScore]].map(([l, v]) => (
                  v !== undefined && <div key={l}><p className="text-[10px] text-slate-500">{l}</p><Progress value={(v || 0) * 10} className="h-1.5" /><p className="text-[10px] text-slate-300">{v}/10</p></div>
                ))}
              </div>
            </div>
            {feedback.usedSTAR !== undefined && (
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg mb-3 text-[10px] font-medium ${feedback.usedSTAR ? 'bg-green-500/10 text-green-300 border border-green-500/20' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}`}>
                {feedback.usedSTAR ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {feedback.usedSTAR ? 'STAR Method Used' : 'Try using STAR Method'}
              </div>
            )}
            {/* Difficulty & Category badges */}
            <div className="flex items-center gap-2 mb-3">
              {feedback.difficulty && (
                <Badge className={`text-[9px] ${feedback.difficulty === 'hard' ? 'bg-red-500/15 text-red-300 border-red-500/20' : feedback.difficulty === 'medium' ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20' : 'bg-green-500/15 text-green-300 border-green-500/20'}`}>
                  {feedback.difficulty.charAt(0).toUpperCase() + feedback.difficulty.slice(1)}
                </Badge>
              )}
              {feedback.questionCategory && (
                <Badge className="bg-slate-500/15 text-slate-300 border-slate-500/20 text-[9px]">{feedback.questionCategory}</Badge>
              )}
            </div>
            <p className="text-sm text-slate-300 mb-3 leading-relaxed">{feedback.feedback}</p>
            {feedback.strengths?.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-green-400 font-medium mb-1">Strengths:</p>
                <div className="flex flex-wrap gap-1">{feedback.strengths.map((s, i) => <Badge key={i} className="bg-green-500/10 text-green-300 border-green-500/20 text-[9px]">{s}</Badge>)}</div>
              </div>
            )}
            {feedback.improvements?.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-amber-400 font-medium mb-1">Areas to Improve:</p>
                <div className="flex flex-wrap gap-1">{feedback.improvements.map((s, i) => <Badge key={i} className="bg-amber-500/10 text-amber-300 border-amber-500/20 text-[9px]">{s}</Badge>)}</div>
              </div>
            )}
            {feedback.keyMissing?.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-red-400 font-medium mb-1">Key Points You Missed:</p>
                <div className="flex flex-wrap gap-1">{feedback.keyMissing.map((s, i) => <Badge key={i} className="bg-red-500/10 text-red-300 border-red-500/20 text-[9px]">{s}</Badge>)}</div>
              </div>
            )}
            {feedback.followUpTip && (
              <div className="p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-xl mb-3">
                <p className="text-[10px] text-cyan-400 mb-1 font-medium flex items-center gap-1"><Sparkles className="w-3 h-3" />Pro Tip</p>
                <p className="text-xs text-slate-300">{feedback.followUpTip}</p>
              </div>
            )}
            {feedback.sampleAnswer && <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl"><p className="text-[10px] text-green-400 mb-1 font-medium">Sample Better Answer:</p><p className="text-xs text-slate-300">{feedback.sampleAnswer}</p></div>}
            {feedback.nextQuestion && !isComplete && <div className="mt-4 p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]"><p className="text-[10px] text-cyan-400 mb-1 font-medium">Next Question:</p><p className="text-sm text-white">{feedback.nextQuestion}</p></div>}
          </div>
        </div>
      ) : (
        <div className="glass-card-static mb-4">
          <div className="p-5">
            <div className="prose prose-invert prose-sm max-w-none [&>*]:text-slate-200 [&>p]:text-slate-200 [&>h1]:text-white [&>h2]:text-white [&>h3]:text-cyan-300 [&>strong]:text-cyan-300 [&>em]:text-slate-300">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{feedback?.feedback || currentContent}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-2 mb-4"><AlertCircle className="w-4 h-4" />{error}</p>}

      {!isComplete ? (
        <div className="space-y-3">
          {isRecording && (
            <div className="flex items-center gap-3 p-3 bg-red-900/20 border border-red-500/30 rounded-xl">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm text-red-300">Recording... Speak your answer</span>
              <div className="flex-1 flex items-center gap-0.5 h-6">
                {[...Array(20)].map((_, i) => (
                  <div key={i} className="flex-1 bg-red-500/60 rounded-full transition-all duration-75" style={{ height: `${Math.max(4, Math.min(24, (audioLevel / 5) * (1 + (i % 3) * 0.5)))}px` }} />
                ))}
              </div>
            </div>
          )}

          <div className="relative">
            <textarea value={answer} onChange={e => setAnswer(e.target.value)} placeholder={isRecording ? "Listening... speak now" : "Type or use voice to answer..."} rows={5} className="input-glass w-full rounded-xl p-4 pr-14 text-sm resize-none" />
            {voiceSupported && (
              <button onClick={toggleVoice} className={`absolute right-3 top-3 w-10 h-10 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30' : 'bg-slate-700 text-slate-400 hover:bg-violet-600 hover:text-white'}`}>
                <Mic className="w-5 h-5" />
              </button>
            )}
            <div className="absolute right-3 bottom-3 text-[10px] text-slate-500">{answer.split(/\s+/).filter(w => w).length} words</div>
          </div>

          {voiceSupported && !isRecording && (
            <p className="text-[10px] text-slate-500 flex items-center gap-1"><Mic className="w-3 h-3" /> Click the mic icon to answer with your voice</p>
          )}

          <div className="flex gap-3">
            <Button onClick={() => { stopVoice(); submitAnswer(); }} disabled={!answer.trim() || loading} className="flex-1 bg-gradient-to-r from-violet-600 to-purple-500 text-white border-0 py-4 rounded-xl">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Evaluating...</> : <><Send className="w-4 h-4 mr-2" />Submit Answer</>}
            </Button>
            <Button onClick={resetInterview} variant="outline" className="border-slate-600 text-slate-300">End</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Final scores summary */}
          {allFeedback.length > 0 && (
            <div className="glass-card-bright">
              <div className="p-5">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Award className="w-5 h-5 text-amber-400" />Interview Performance Summary</h3>

                {/* Overall Grade & Hire Recommendation */}
                {(() => {
                  const lastFb = allFeedback[allFeedback.length - 1];
                  const avgScore = (allFeedback.reduce((a, b) => a + (b.score || 0), 0) / allFeedback.length);
                  const grade = lastFb?.overallGrade || (avgScore >= 9 ? 'A+' : avgScore >= 8 ? 'A' : avgScore >= 7 ? 'B+' : avgScore >= 6 ? 'B' : avgScore >= 5 ? 'C+' : avgScore >= 4 ? 'C' : 'D');
                  const gradeColor = grade.startsWith('A') ? 'text-green-400' : grade.startsWith('B') ? 'text-blue-400' : grade.startsWith('C') ? 'text-yellow-400' : 'text-red-400';
                  const hire = lastFb?.hireRecommendation || '';
                  const hireColor = hire.includes('Strong Hire') ? 'bg-green-500/15 text-green-300 border-green-500/20' : hire.includes('Hire') && !hire.includes('No') ? 'bg-blue-500/15 text-blue-300 border-blue-500/20' : hire.includes('Lean Hire') ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20' : 'bg-red-500/15 text-red-300 border-red-500/20';
                  return (
                    <div className="flex items-center gap-6 mb-5 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="text-center">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Grade</p>
                        <p className={`text-4xl font-black ${gradeColor}`}>{grade}</p>
                      </div>
                      <div className="text-center flex-1">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Average Score</p>
                        <p className="text-3xl font-bold text-gradient">{avgScore.toFixed(1)}/10</p>
                      </div>
                      {hire && (
                        <div className="text-center">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Verdict</p>
                          <Badge className={`${hireColor} text-xs px-3 py-1`}>{hire}</Badge>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Final Assessment */}
                {allFeedback[allFeedback.length - 1]?.finalAssessment && (
                  <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/10 mb-4">
                    <p className="text-sm text-slate-300 leading-relaxed">{allFeedback[allFeedback.length - 1].finalAssessment}</p>
                  </div>
                )}

                {/* Per-question scores */}
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {allFeedback.map((fb, i) => (
                    <div key={i} className="text-center p-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                      <p className="text-[10px] text-slate-400">Q{i+1}</p>
                      <p className={`text-lg font-bold ${(fb.score || 0) >= 7 ? 'text-green-400' : (fb.score || 0) >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>{fb.score || '?'}</p>
                      {fb.difficulty && <p className="text-[8px] text-slate-500 capitalize">{fb.difficulty}</p>}
                    </div>
                  ))}
                </div>

                {/* Category Averages */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {['technicalAccuracy', 'communicationScore', 'structureScore', 'confidenceScore'].map(key => {
                    const vals = allFeedback.filter(fb => fb[key] != null).map(fb => fb[key]);
                    if (vals.length === 0) return null;
                    const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
                    const label = key.replace(/([A-Z])/g, ' $1').replace('Score', '').trim();
                    return (
                      <div key={key} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] text-center">
                        <p className={`text-lg font-bold ${avg >= 7 ? 'text-green-400' : avg >= 5 ? 'text-yellow-400' : 'text-red-400'}`}>{avg}</p>
                        <p className="text-[10px] text-slate-500 capitalize">{label}</p>
                      </div>
                    );
                  }).filter(Boolean)}
                </div>

                {/* Top Strengths & Improvements from final assessment */}
                {(() => {
                  const lastFb = allFeedback[allFeedback.length - 1];
                  return (
                    <>
                      {lastFb?.topStrengths?.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-green-400 font-medium mb-1.5 uppercase tracking-wider">Top Strengths</p>
                          <div className="space-y-1">{lastFb.topStrengths.map((s, i) => <div key={i} className="flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" /><span className="text-xs text-slate-300">{s}</span></div>)}</div>
                        </div>
                      )}
                      {lastFb?.topImprovements?.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-amber-400 font-medium mb-1.5 uppercase tracking-wider">Key Improvements</p>
                          <div className="space-y-1">{lastFb.topImprovements.map((s, i) => <div key={i} className="flex items-start gap-2"><AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" /><span className="text-xs text-slate-300">{s}</span></div>)}</div>
                        </div>
                      )}
                      {lastFb?.improvementRoadmap?.length > 0 && (
                        <div className="mb-4 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                          <p className="text-xs text-indigo-400 font-medium mb-2 uppercase tracking-wider">Improvement Roadmap</p>
                          <div className="space-y-2">
                            {lastFb.improvementRoadmap.map((step, i) => (
                              <div key={i} className="flex items-start gap-3">
                                <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{i+1}</div>
                                <p className="text-xs text-slate-300">{step}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Question Review — expandable */}
                <div className="space-y-3 border-t border-white/[0.05] pt-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Question Review</p>
                  {allFeedback.map((fb, i) => (
                    <div key={i} className="rounded-xl bg-white/[0.02] border border-white/[0.05] overflow-hidden">
                      <button onClick={() => setExpandedQ(expandedQ === i ? null : i)} className="w-full p-3 flex items-center justify-between text-left">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-xs text-slate-400">Q{i + 1}</span>
                          {fb.questionCategory && <Badge className="bg-slate-700/50 text-slate-400 border-slate-600/30 text-[8px]">{fb.questionCategory}</Badge>}
                          {fb.difficulty && <Badge className={`text-[8px] ${fb.difficulty === 'hard' ? 'bg-red-500/10 text-red-300' : fb.difficulty === 'medium' ? 'bg-yellow-500/10 text-yellow-300' : 'bg-green-500/10 text-green-300'}`}>{fb.difficulty}</Badge>}
                          <span className="text-xs text-white truncate flex-1">{allQuestions[i] ? allQuestions[i].replace(/[\*#]/g, '').substring(0, 60) + '...' : ''}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-[9px] ${(fb.score||0) >= 7 ? 'bg-green-500/15 text-green-300 border-green-500/20' : (fb.score||0) >= 5 ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20' : 'bg-red-500/15 text-red-300 border-red-500/20'}`}>{fb.score}/10</Badge>
                          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expandedQ === i ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      {expandedQ === i && (
                        <div className="p-3 pt-0 space-y-2 animate-slide-up border-t border-white/[0.03]">
                          {allQuestions[i] && <div><p className="text-[10px] text-cyan-400 font-medium mb-0.5">Question:</p><p className="text-xs text-white">{allQuestions[i].replace(/[\*#]/g, '')}</p></div>}
                          {allAnswers[i] && <div><p className="text-[10px] text-violet-400 font-medium mb-0.5">Your Answer:</p><p className="text-xs text-slate-400 italic">{allAnswers[i]}</p></div>}
                          {fb.feedback && <div><p className="text-[10px] text-slate-400 font-medium mb-0.5">Feedback:</p><p className="text-xs text-slate-500">{fb.feedback}</p></div>}
                          {fb.sampleAnswer && <div className="p-2 rounded-lg bg-green-500/5 border border-green-500/10"><p className="text-[10px] text-green-400 font-medium mb-0.5">Model Answer:</p><p className="text-xs text-slate-300">{fb.sampleAnswer}</p></div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={downloadReport} className="flex-1 bg-gradient-to-r from-green-600 to-emerald-500 text-white border-0 py-4 rounded-xl">
              <FileText className="w-4 h-4 mr-2" />Download Report
            </Button>
            <Button onClick={resetInterview} className="flex-1 bg-gradient-to-r from-violet-600 to-purple-500 text-white border-0 py-4 rounded-xl">
              <Mic className="w-4 h-4 mr-2" />New Interview
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
