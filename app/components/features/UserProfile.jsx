'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, AlertCircle, ChevronDown, Upload, MessageSquare, FileText, Mic, Compass, Target, Bookmark, GraduationCap, Clock, Download } from 'lucide-react';
import api, { formatDate, formatDateTime } from '@/lib/api-client';

export default function UserProfile({ user, onUpdate }) {
  const [name, setName] = useState(user?.name || '');
  const [skills, setSkills] = useState((user?.profile?.skills || []).join(', '));
  const [interests, setInterests] = useState((user?.profile?.interests || []).join(', '));
  const [education, setEducation] = useState(user?.profile?.education || '');
  const [experience, setExperience] = useState(user?.profile?.experience || '');
  const [careerGoal, setCareerGoal] = useState(user?.profile?.careerGoal || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resumes, setResumes] = useState([]);
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  // Validation
  const [nameError, setNameError] = useState('');
  // Profile picture
  const [profilePic, setProfilePic] = useState(user?.profile?.avatar || null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const picInputRef = useRef(null);

  useEffect(() => {
    api.get('/resumes').then(d => setResumes(d.resumes || [])).catch(() => {});
    api.get('/profile').then(d => {
      setStats(d.stats);
      setRecentActivity(d.recentActivity || []);
      // Populate form fields from server profile if local state is empty
      const p = d.profile || d.user?.profile;
      if (p) {
        if (p.avatar) setProfilePic(p.avatar);
        if (!skills && p.skills) setSkills(Array.isArray(p.skills) ? p.skills.join(', ') : p.skills);
        if (!interests && p.interests) setInterests(Array.isArray(p.interests) ? p.interests.join(', ') : p.interests);
        if (!education && p.education) setEducation(p.education);
        if (!experience && p.experience) setExperience(p.experience);
        if (!careerGoal && p.careerGoal) setCareerGoal(p.careerGoal);
      }
    }).catch(() => {});
  }, []);

  // Profile completeness
  const fields = [name, skills, interests, education, experience, careerGoal];
  const filledCount = fields.filter(f => f && f.trim().length > 0).length;
  const completeness = Math.round((filledCount / fields.length) * 100);

  const initials = (user?.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);

  const save = async () => {
    // Validate name
    if (!name || name.trim().length < 2) {
      setNameError('Name must be at least 2 characters');
      return;
    }
    setNameError('');
    setSaving(true);
    setSaved(false);
    try {
      const profileData = {
        skills: skills.split(',').map(s => s.trim()).filter(Boolean),
        interests: interests.split(',').map(s => s.trim()).filter(Boolean),
        education: education.trim(),
        experience: experience.trim(),
        careerGoal: careerGoal.trim(),
      };
      const result = await api.put('/profile', { name: name.trim(), profile: profileData });
      if (result.error) throw new Error(result.error);
      setSaved(true);
      if (onUpdate) onUpdate({ ...user, name: name.trim(), profile: profileData });
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setNameError(e.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  // Export profile data
  const exportProfileData = () => {
    const data = {
      name: user?.name,
      email: user?.email,
      profile: {
        skills: skills.split(',').map(s => s.trim()).filter(Boolean),
        interests: interests.split(',').map(s => s.trim()).filter(Boolean),
        education,
        experience,
        careerGoal,
      },
      stats,
      resumes: resumes.map(r => ({
        fileName: r.fileName,
        atsScore: r.analysis?.atsScore,
        createdAt: r.createdAt,
      })),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `careergpt_profile_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const changePassword = async () => {
    setPwMsg(null);
    if (!currentPw || !newPw) { setPwMsg({ type: 'error', text: 'All fields required' }); return; }
    if (newPw.length < 6) { setPwMsg({ type: 'error', text: 'Password must be at least 6 characters' }); return; }
    if (newPw !== confirmPw) { setPwMsg({ type: 'error', text: 'New passwords do not match' }); return; }
    setPwLoading(true);
    try {
      const d = await api.post('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
      if (d.error) throw new Error(d.error);
      setPwMsg({ type: 'success', text: 'Password changed successfully!' });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => { setPwMsg(null); setShowPasswordChange(false); }, 3000);
    } catch (e) { setPwMsg({ type: 'error', text: e.message }); }
    finally { setPwLoading(false); }
  };

  const handlePicUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) { setNameError('Image must be under 2MB'); return; }
    setUploadingPic(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result;
        const d = await api.post('/profile/avatar', { avatar: base64 });
        if (d.error) throw new Error(d.error);
        setProfilePic(base64);
        if (onUpdate) onUpdate({ ...user, profile: { ...user?.profile, avatar: base64 } });
        setUploadingPic(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setNameError(err.message || 'Failed to upload picture');
      setUploadingPic(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto page-transition">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">My Profile</h1>
        <p className="text-sm text-slate-400">Manage your career profile and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Form */}
        <div className="lg:col-span-2 space-y-5">
          {/* Avatar & Completeness */}
          <div className="glass-card overflow-hidden">
            <div className="p-5">
              <div className="flex items-center gap-4">
                <div className="relative group cursor-pointer" onClick={() => picInputRef.current?.click()}>
                  {profilePic ? (
                    <img src={profilePic} alt="Avatar" className="w-16 h-16 rounded-2xl object-cover shadow-lg shadow-cyan-500/20" />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-cyan-500/20">
                      {initials}
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    {uploadingPic ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : <Upload className="w-5 h-5 text-white" />}
                  </div>
                  <input ref={picInputRef} type="file" accept="image/*" className="hidden" onChange={handlePicUpload} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">{user?.name || 'User'}</h3>
                  <p className="text-xs text-slate-400">{user?.email}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <Progress value={completeness} className="h-2 flex-1" />
                    <span className={`text-xs font-bold ${completeness >= 80 ? 'text-green-400' : completeness >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{completeness}%</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {completeness >= 100 ? 'Profile complete! Great job!' : `${fields.length - filledCount} field${fields.length - filledCount !== 1 ? 's' : ''} remaining to complete your profile`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="p-5 pb-0">
              <h3 className="text-base font-semibold text-white">Personal Information</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Full Name</label>
                <Input value={name} onChange={e => { setName(e.target.value); if (nameError) setNameError(''); }} className={`input-glass h-11 ${nameError ? 'border-red-500/50' : ''}`} placeholder="Your full name" />
                {nameError && <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{nameError}</p>}
              </div>
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Email</label>
                <Input value={user?.email || ''} disabled className="input-glass h-11 opacity-50" />
              </div>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="p-5 pb-0">
              <h3 className="text-base font-semibold text-white">Career Profile</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Career Goal</label>
                <Input value={careerGoal} onChange={e => setCareerGoal(e.target.value)} placeholder="e.g., Become a Senior Full-Stack Developer at a top tech company" className="input-glass h-11" />
                <p className="text-[10px] text-slate-500 mt-1">What's your dream career objective?</p>
              </div>
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Skills <span className="text-slate-500 normal-case">(comma separated)</span></label>
                <textarea value={skills} onChange={e => setSkills(e.target.value)} rows={2} placeholder="Python, React, SQL, Machine Learning..." className="w-full input-glass resize-none text-sm" />
                {skills.trim() && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {skills.split(',').map(s => s.trim()).filter(Boolean).map((skill, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 text-[10px] font-medium border border-cyan-500/20">{skill}</span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Interests <span className="text-slate-500 normal-case">(comma separated)</span></label>
                <textarea value={interests} onChange={e => setInterests(e.target.value)} rows={2} placeholder="AI, Web Development, Data Science..." className="w-full input-glass resize-none text-sm" />
                {interests.trim() && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {interests.split(',').map(s => s.trim()).filter(Boolean).map((interest, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-violet-500/10 text-violet-300 text-[10px] font-medium border border-violet-500/20">{interest}</span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Education</label>
                <Input value={education} onChange={e => setEducation(e.target.value)} placeholder="B.Tech Computer Science, MIT..." className="input-glass h-11" />
              </div>
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Experience</label>
                <Input value={experience} onChange={e => setExperience(e.target.value)} placeholder="2 years as Software Developer..." className="input-glass h-11" />
              </div>
              <Button onClick={save} disabled={saving} className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-0 h-11 rounded-xl btn-glow shadow-lg shadow-blue-500/15">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : saved ? <><CheckCircle2 className="w-4 h-4 mr-2" />Saved!</> : 'Save Profile'}
              </Button>
            </div>
          </div>

          {/* Password Change */}
          {user?.role !== 'guest' && (
            <div className="glass-card overflow-hidden">
              <div className="p-5">
                <button onClick={() => setShowPasswordChange(!showPasswordChange)} className="flex items-center justify-between w-full">
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center"><AlertCircle className="w-4 h-4 text-red-400" /></div>
                    Security
                  </h3>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showPasswordChange ? 'rotate-180' : ''}`} />
                </button>
                {showPasswordChange && (
                  <div className="mt-4 space-y-3 animate-fade-in">
                    <div>
                      <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Current Password</label>
                      <Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className="input-glass h-10" placeholder="Enter current password" />
                    </div>
                    <div>
                      <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">New Password</label>
                      <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="input-glass h-10" placeholder="Min 6 characters" />
                    </div>
                    <div>
                      <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Confirm New Password</label>
                      <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className="input-glass h-10" placeholder="Confirm new password" />
                    </div>
                    {pwMsg && (
                      <div className={`text-sm p-3 rounded-xl flex items-center gap-2 ${pwMsg.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                        {pwMsg.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        {pwMsg.text}
                      </div>
                    )}
                    <Button onClick={changePassword} disabled={pwLoading} className="w-full bg-gradient-to-r from-red-600 to-orange-500 text-white border-0 h-10 rounded-xl">
                      {pwLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Changing...</> : 'Change Password'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stats & Resume History */}
        <div className="space-y-5">
          <div className="glass-card overflow-hidden">
            <div className="p-5 pb-0 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Stats</h3>
              <Button onClick={exportProfileData} variant="ghost" className="text-slate-400 hover:text-white h-8 px-2 text-[10px]">
                <Download className="w-3.5 h-3.5 mr-1" />Export Data
              </Button>
            </div>
            <div className="p-5 space-y-2.5">
              {stats && [
                { label: 'Chat Sessions', value: stats.chatCount, icon: MessageSquare, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
                { label: 'Resumes Analyzed', value: stats.resumeCount, icon: FileText, color: 'text-teal-400', bgColor: 'bg-teal-500/10' },
                { label: 'Mock Interviews', value: stats.interviewCount, icon: Mic, color: 'text-violet-400', bgColor: 'bg-violet-500/10' },
                { label: 'Career Paths', value: stats.careerPathCount, icon: Compass, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
                { label: 'Job Matches', value: stats.jobMatchCount, icon: Target, color: 'text-green-400', bgColor: 'bg-green-500/10' },
                { label: 'Saved Jobs', value: stats.savedJobsCount, icon: Bookmark, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
                { label: 'Learning Paths', value: stats.learningPathCount, icon: GraduationCap, color: 'text-indigo-400', bgColor: 'bg-indigo-500/10' },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  <div className={`w-8 h-8 rounded-lg ${s.bgColor} flex items-center justify-center`}>
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                  </div>
                  <span className="text-sm text-slate-300 flex-1">{s.label}</span>
                  <span className="text-sm font-bold text-white">{s.value || 0}</span>
                </div>
              ))}
              <div className="text-center pt-3 space-y-1">
                <p className="text-[10px] text-slate-500">Member since {formatDate(user?.createdAt)}</p>
                {stats && <p className="text-[10px] text-slate-600">Total: {(stats.chatCount || 0) + (stats.resumeCount || 0) + (stats.interviewCount || 0) + (stats.careerPathCount || 0) + (stats.jobMatchCount || 0) + (stats.savedJobsCount || 0) + (stats.learningPathCount || 0)} interactions</p>}
              </div>
            </div>
          </div>

          {/* Career Goal Card */}
          {careerGoal && (
            <div className="glass-card overflow-hidden">
              <div className="p-5">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-2"><Target className="w-4 h-4 text-amber-400" />Career Goal</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{careerGoal}</p>
              </div>
            </div>
          )}

          <div className="glass-card overflow-hidden">
            <div className="p-5 pb-0">
              <h3 className="text-base font-semibold text-white">Resume History</h3>
            </div>
            <div className="p-5">
              {resumes.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">No resumes uploaded yet</p>
              ) : (
                <div className="space-y-2">
                  {resumes.map(r => (
                    <div key={r.id} className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-teal-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-200 truncate font-medium">{r.fileName}</p>
                        <p className="text-[10px] text-slate-500">{formatDate(r.createdAt)}</p>
                      </div>
                      {r.analysis?.atsScore && (
                        <Badge className={`text-[10px] ${r.analysis.atsScore >= 70 ? 'bg-green-500/15 text-green-300 border-green-500/20' : r.analysis.atsScore >= 50 ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20' : 'bg-red-500/15 text-red-300 border-red-500/20'}`}>
                          ATS: {r.analysis.atsScore}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          {recentActivity.length > 0 && (
            <div className="glass-card overflow-hidden">
              <div className="p-5 pb-0">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  Recent Activity
                </h3>
              </div>
              <div className="p-5">
                <div className="space-y-2">
                  {recentActivity.slice(0, 5).map((event, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                      <div className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0" />
                      <span className="text-[11px] text-slate-300 flex-1 capitalize">{(event.type || 'activity').replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-slate-500">{formatDateTime(event.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
