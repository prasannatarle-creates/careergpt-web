'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, BarChart3, Users, TrendingUp, PieChart, Clock, Layers, FileText, Mic, Target, MessageSquare, Compass, Briefcase, User } from 'lucide-react';
import api, { formatDateTime } from '@/lib/api-client';

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [tabData, setTabData] = useState({});
  const [tabLoading, setTabLoading] = useState(null);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const d = await api.get('/admin/analytics');
      if (d.error) { setError(d.error); }
      else { setData(d); }
    } catch(e) {
      setError('Failed to load analytics data');
    }
    setLoading(false);
    setRefreshing(false);
  };

  const loadTabData = async (tab) => {
    if (tabData[tab]) return; // Already loaded
    setTabLoading(tab);
    try {
      const endpointMap = {
        'active-users': ['/analytics/dau', '/analytics/wau', '/analytics/mau'],
        'funnel': ['/analytics/funnel'],
        'segmentation': ['/analytics/segmentation'],
        'cohorts': ['/analytics/cohorts'],
        'module-usage': ['/analytics/module-usage'],
      };
      const endpoints = endpointMap[tab] || [];
      const results = await Promise.all(endpoints.map(ep => api.get(ep)));
      if (tab === 'active-users') {
        setTabData(prev => ({ ...prev, [tab]: { dau: results[0], wau: results[1], mau: results[2] } }));
      } else {
        setTabData(prev => ({ ...prev, [tab]: results[0] }));
      }
    } catch(e) {
      console.error(`Failed to load ${tab}:`, e);
    }
    setTabLoading(null);
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (activeTab !== 'overview') loadTabData(activeTab); }, [activeTab]);

  const exportData = () => {
    if (!data) return;
    const s = data.stats;
    const lines = [
      'CareerGPT Analytics Report',
      `Generated: ${new Date().toLocaleString()}`,
      '',
      'Key Metrics:',
      `Total Users: ${s.totalUsers || 0}`,
      `Resumes Analyzed: ${s.totalResumes || 0}`,
      `Mock Interviews: ${s.totalInterviews || 0}`,
      `Average ATS Score: ${s.avgAtsScore || 0}`,
      `Chat Sessions: ${s.totalChats || 0}`,
      `Career Paths: ${s.totalCareerPaths || 0}`,
      `Job Matches: ${s.totalJobMatches || 0}`,
      '',
      'Module Usage:',
      ...Object.entries(data.moduleUsage || {}).map(([mod, count]) => `  ${mod}: ${count}`),
      '',
      'Daily Activity (Last 7 Days):',
      ...(data.dailyActivity || []).map(d => `  ${d.date}: ${d.count} events`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'careergpt_analytics.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'active-users', label: 'Active Users', icon: Users },
    { id: 'funnel', label: 'Funnel', icon: TrendingUp },
    { id: 'segmentation', label: 'Segments', icon: PieChart },
    { id: 'cohorts', label: 'Cohorts', icon: Clock },
    { id: 'module-usage', label: 'Features', icon: Layers },
  ];

  if (loading) return <div className="p-6 flex items-center justify-center h-full"><div className="flex flex-col items-center gap-3"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /><p className="text-sm text-slate-500">Loading analytics...</p></div></div>;
  if (error) return <div className="p-6 text-center"><p className="text-red-400 mb-3">{error}</p><Button onClick={() => loadData()} variant="outline" className="border-slate-600 text-slate-300 rounded-xl text-xs h-9">Retry</Button></div>;
  if (!data) return <div className="p-6 text-slate-400 text-center">No analytics data</div>;

  const s = data.stats;
  const totalActivity = (data.dailyActivity || []).reduce((a, b) => a + b.count, 0);
  const avgDaily = (data.dailyActivity || []).length > 0 ? (totalActivity / (data.dailyActivity || []).length).toFixed(1) : 0;

  const renderActiveUsers = () => {
    const d = tabData['active-users'];
    if (!d) return null;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="glass-card p-5 text-center"><p className="text-3xl font-bold text-blue-400">{d.dau?.dau ?? 0}</p><p className="text-xs text-slate-400 mt-1">Daily Active Users</p><p className="text-[10px] text-slate-500">{d.dau?.totalEvents ?? 0} events today</p></div>
          <div className="glass-card p-5 text-center"><p className="text-3xl font-bold text-cyan-400">{d.wau?.wau ?? 0}</p><p className="text-xs text-slate-400 mt-1">Weekly Active Users</p><p className="text-[10px] text-slate-500">Avg {d.wau?.avgDailyUsers ?? 0}/day</p></div>
          <div className="glass-card p-5 text-center"><p className="text-3xl font-bold text-violet-400">{d.mau?.mau ?? 0}</p><p className="text-xs text-slate-400 mt-1">Monthly Active Users</p><p className="text-[10px] text-slate-500">{d.mau?.totalEvents ?? 0} total events</p></div>
        </div>
        {d.wau?.dailyBreakdown && (
          <div className="glass-card-static p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Weekly Breakdown</h4>
            <div className="flex items-end gap-3 h-28">
              {Object.entries(d.wau.dailyBreakdown).map(([day, count], i) => {
                const max = Math.max(...Object.values(d.wau.dailyBreakdown), 1);
                return (<div key={i} className="flex-1 flex flex-col items-center gap-1"><div className="w-full bg-gradient-to-t from-cyan-500/40 to-cyan-500/10 rounded-t-lg" style={{ height: `${Math.max((count / max) * 100, 5)}%` }} /><span className="text-[9px] text-slate-500">{day.slice(5)}</span><span className="text-[9px] text-slate-300">{count}</span></div>);
              })}
            </div>
          </div>
        )}
        {d.mau?.weeklyBreakdown && (
          <div className="glass-card-static p-5">
            <h4 className="text-sm font-semibold text-white mb-3">Monthly Weekly Breakdown</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(d.mau.weeklyBreakdown).map(([week, count]) => (
                <div key={week} className="text-center p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]"><p className="text-lg font-bold text-violet-400">{count}</p><p className="text-[10px] text-slate-500">{week}</p></div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFunnel = () => {
    const d = tabData['funnel'];
    if (!d) return null;
    const stages = d.stages || {};
    const conversions = d.conversions || {};
    const dropoff = d.dropoff || {};
    const funnelSteps = [
      { label: 'Signups', value: stages.signup, color: 'bg-blue-500', width: '100%' },
      { label: 'Resume Uploaded', value: stages.resumeUploaded, color: 'bg-teal-500', width: `${conversions.signupToResume}%` },
      { label: 'Interview Started', value: stages.interviewStarted, color: 'bg-amber-500', width: `${conversions.resumeToInterview}%` },
      { label: 'Offers Received', value: stages.offersReceived, color: 'bg-green-500', width: `${conversions.interviewToOffer}%` },
    ];
    return (
      <div className="space-y-6">
        <div className="glass-card-static p-5">
          <h4 className="text-sm font-semibold text-white mb-4">Conversion Funnel</h4>
          <div className="space-y-3">
            {funnelSteps.map((step, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1"><span className="text-slate-300">{step.label}</span><span className="text-white font-medium">{step.value ?? 0}</span></div>
                <div className="h-6 bg-white/[0.05] rounded-lg overflow-hidden"><div className={`h-full ${step.color}/30 rounded-lg transition-all duration-700`} style={{ width: step.width }} /></div>
                {i < funnelSteps.length - 1 && <p className="text-[10px] text-slate-500 mt-1">↓ {Object.values(dropoff)[i] ?? 0}% drop-off</p>}
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Signup → Resume', value: `${conversions.signupToResume ?? 0}%`, color: 'text-teal-400' },
            { label: 'Resume → Interview', value: `${conversions.resumeToInterview ?? 0}%`, color: 'text-amber-400' },
            { label: 'Interview → Offer', value: `${conversions.interviewToOffer ?? 0}%`, color: 'text-green-400' },
            { label: 'Overall', value: `${conversions.overallConversion ?? 0}%`, color: 'text-cyan-400' },
          ].map((c, i) => (
            <div key={i} className="glass-card p-4 text-center"><p className={`text-xl font-bold ${c.color}`}>{c.value}</p><p className="text-[10px] text-slate-500 mt-1">{c.label}</p></div>
          ))}
        </div>
      </div>
    );
  };

  const renderSegmentation = () => {
    const d = tabData['segmentation'];
    if (!d) return null;
    const segments = d.segments || {};
    const total = Object.values(segments).reduce((a, b) => a + b, 0) || 1;
    const colors = ['bg-blue-400', 'bg-teal-400', 'bg-violet-400', 'bg-amber-400', 'bg-green-400', 'bg-pink-400', 'bg-cyan-400', 'bg-red-400'];
    return (
      <div className="space-y-6">
        <div className="glass-card-static p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-white">User Segmentation: {d.segmentType || 'role'}</h4>
            <Badge className="bg-slate-700/50 text-slate-300 text-[10px]">{d.totalUsers ?? 0} users</Badge>
          </div>
          <div className="space-y-3">
            {Object.entries(segments).sort((a, b) => b[1] - a[1]).map(([seg, count], i) => {
              const pct = Math.round((count / total) * 100);
              return (
                <div key={seg}>
                  <div className="flex justify-between text-sm mb-1"><span className="text-slate-300 capitalize">{seg.replace(/_/g, ' ')}</span><span className="text-slate-400">{count} ({pct}%)</span></div>
                  <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden"><div className={`h-full ${colors[i % colors.length]}/40 rounded-full`} style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
        {d.largestSegment && (
          <div className="glass-card p-4 border-l-2 border-blue-500/50">
            <p className="text-xs text-slate-400">Largest Segment</p>
            <p className="text-white font-medium capitalize">{d.largestSegment[0]?.replace(/_/g, ' ')}</p>
            <p className="text-sm text-blue-400">{d.largestSegment[1]} users</p>
          </div>
        )}
      </div>
    );
  };

  const renderCohorts = () => {
    const d = tabData['cohorts'];
    if (!d) return null;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="glass-card p-4 text-center"><p className="text-2xl font-bold text-blue-400">{d.totalCohorts ?? 0}</p><p className="text-[10px] text-slate-500">Total Cohorts</p></div>
          <div className="glass-card p-4 text-center"><p className="text-2xl font-bold text-green-400">{d.avgWeek1Retention ?? 0}%</p><p className="text-[10px] text-slate-500">Avg Week 1 Retention</p></div>
          <div className="glass-card p-4 text-center"><p className="text-2xl font-bold text-amber-400">{d.avgWeek4Retention ?? 0}%</p><p className="text-[10px] text-slate-500">Avg Week 4 Retention</p></div>
        </div>
        <div className="glass-card-static p-5">
          <h4 className="text-sm font-semibold text-white mb-4">Cohort Retention</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-slate-500 border-b border-white/[0.05]"><th className="text-left p-2">Signup Week</th><th className="text-center p-2">Users</th><th className="text-center p-2">Week 1</th><th className="text-center p-2">Week 2</th><th className="text-center p-2">Week 4</th></tr></thead>
              <tbody>
                {(d.cohorts || []).slice(0, 10).map((c, i) => (
                  <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="p-2 text-slate-300">{c.signupWeek}</td>
                    <td className="p-2 text-center text-white font-medium">{c.signups}</td>
                    <td className="p-2 text-center"><span className={c.week1Retention >= 50 ? 'text-green-400' : 'text-amber-400'}>{c.week1Retention}%</span></td>
                    <td className="p-2 text-center"><span className={c.week2Retention >= 40 ? 'text-green-400' : 'text-amber-400'}>{c.week2Retention}%</span></td>
                    <td className="p-2 text-center"><span className={c.week4Retention >= 30 ? 'text-green-400' : 'text-red-400'}>{c.week4Retention}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderModuleUsage = () => {
    const d = tabData['module-usage'];
    if (!d) return null;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="glass-card p-4 text-center"><p className="text-2xl font-bold text-gradient">{d.totalEvents ?? 0}</p><p className="text-[10px] text-slate-500">Total Events</p></div>
          <div className="glass-card p-4 text-center"><p className="text-2xl font-bold text-cyan-400">{d.uniqueFeatures ?? 0}</p><p className="text-[10px] text-slate-500">Unique Features</p></div>
          <div className="glass-card p-4 text-center"><p className="text-2xl font-bold text-amber-400">{d.topFeatures?.[0]?.percentage ?? 0}%</p><p className="text-[10px] text-slate-500">Top Feature Share</p></div>
        </div>
        {d.topFeatures?.length > 0 && (
          <div className="glass-card-static p-5">
            <h4 className="text-sm font-semibold text-white mb-4">Top Features</h4>
            <div className="space-y-3">
              {d.topFeatures.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-lg font-bold text-slate-600 w-6">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1"><span className="text-slate-300">{f.name}</span><span className="text-slate-400">{f.count} ({f.percentage}%)</span></div>
                    <Progress value={f.percentage} className="h-1.5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="glass-card-static p-5">
          <h4 className="text-sm font-semibold text-white mb-4">All Feature Usage</h4>
          <div className="space-y-2">
            {Object.entries(d.usage || {}).map(([feat, count]) => {
              const max = Math.max(...Object.values(d.usage || {}), 1);
              return (
                <div key={feat}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">{feat}</span><span className="text-slate-500">{count}</span></div>
                  <Progress value={(count / max) * 100} className="h-1" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto page-transition">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Analytics Dashboard</h1>
          <p className="text-sm text-slate-400">Track usage and performance insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => loadData(true)} disabled={refreshing} variant="outline" className="border-slate-600 text-slate-300 rounded-xl text-xs h-9">
            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><BarChart3 className="w-3.5 h-3.5 mr-1.5" />Refresh</>}
          </Button>
          <Button onClick={exportData} variant="outline" className="border-slate-600 text-slate-300 rounded-xl text-xs h-9">
            <FileText className="w-3.5 h-3.5 mr-1.5" />Export
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20' : 'text-slate-400 hover:text-slate-300 hover:bg-white/[0.03]'}`}>
            <tab.icon className="w-3.5 h-3.5" />{tab.label}
          </button>
        ))}
      </div>

      {/* Tab Loading */}
      {tabLoading && (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
      )}

      {/* Tab Content */}
      {activeTab === 'active-users' && !tabLoading && tabData['active-users'] && renderActiveUsers()}
      {activeTab === 'funnel' && !tabLoading && tabData['funnel'] && renderFunnel()}
      {activeTab === 'segmentation' && !tabLoading && tabData['segmentation'] && renderSegmentation()}
      {activeTab === 'cohorts' && !tabLoading && tabData['cohorts'] && renderCohorts()}
      {activeTab === 'module-usage' && !tabLoading && tabData['module-usage'] && renderModuleUsage()}

      {activeTab === 'overview' && <>
      {/* Engagement Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="glass-card-static p-4 text-center">
          <p className="text-2xl font-bold text-gradient">{totalActivity}</p>
          <p className="text-[10px] text-slate-500">Total Events (7d)</p>
        </div>
        <div className="glass-card-static p-4 text-center">
          <p className="text-2xl font-bold text-cyan-400">{avgDaily}</p>
          <p className="text-[10px] text-slate-500">Avg Daily Activity</p>
        </div>
        <div className="glass-card-static p-4 text-center">
          <p className="text-2xl font-bold text-violet-400">{Object.keys(data.moduleUsage || {}).length}</p>
          <p className="text-[10px] text-slate-500">Active Modules</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Users', value: s.totalUsers, icon: User, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
          { label: 'Resumes Analyzed', value: s.totalResumes, icon: FileText, color: 'text-teal-400', bgColor: 'bg-teal-500/10' },
          { label: 'Mock Interviews', value: s.totalInterviews, icon: Mic, color: 'text-violet-400', bgColor: 'bg-violet-500/10' },
          { label: 'Avg ATS Score', value: s.avgAtsScore, icon: Target, color: 'text-green-400', bgColor: 'bg-green-500/10' },
          { label: 'Chat Sessions', value: s.totalChats, icon: MessageSquare, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
          { label: 'Career Paths', value: s.totalCareerPaths, icon: Compass, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
          { label: 'Job Matches', value: s.totalJobMatches, icon: Briefcase, color: 'text-green-400', bgColor: 'bg-green-500/10' },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-5 group">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stat.value || 0}</p>
                <p className="text-xs text-slate-400">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Module Usage */}
      <div className="glass-card-static mb-6">
        <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white">Module Usage</h3></div>
        <div className="p-5">
          <div className="space-y-3">
            {Object.entries(data.moduleUsage || {}).sort((a, b) => b[1] - a[1]).map(([mod, count]) => {
              const maxCount = Math.max(...Object.values(data.moduleUsage || {}));
              return (
                <div key={mod}>
                  <div className="flex justify-between text-sm mb-1.5"><span className="text-slate-300 capitalize">{mod.replace(/_/g, ' ')}</span><span className="text-slate-400 font-medium">{count}</span></div>
                  <Progress value={(count / maxCount) * 100} className="h-2" />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Daily Activity */}
      <div className="glass-card-static mb-6">
        <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white">Daily Activity (Last 7 Days)</h3></div>
        <div className="p-5">
          <div className="flex items-end gap-3 h-36">
            {(data.dailyActivity || []).map((d, i) => {
              const maxVal = Math.max(...(data.dailyActivity || []).map(x => x.count), 1);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <div className="w-full bg-gradient-to-t from-cyan-500/40 to-cyan-500/10 rounded-t-lg transition-all duration-300 group-hover:from-cyan-500/60 group-hover:to-cyan-500/20" style={{ height: `${Math.max((d.count / maxVal) * 100, 5)}%` }} />
                  <span className="text-[10px] text-slate-500">{d.date?.slice(5)}</span>
                  <span className="text-[10px] text-slate-300 font-medium">{d.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Events */}
      <div className="glass-card-static">
        <div className="p-5 pb-0"><h3 className="text-base font-semibold text-white">Recent Activity</h3></div>
        <div className="p-5">
          <div className="space-y-2">
            {(data.recentEvents || []).map((e, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                <div className="w-2 h-2 rounded-full bg-cyan-400" />
                <span className="text-xs text-slate-300 flex-1 capitalize">{e.type.replace(/_/g, ' ')}</span>
                <span className="text-[10px] text-slate-500">{formatDateTime(e.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      </>}
    </div>
  );
}
