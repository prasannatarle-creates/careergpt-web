'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Brain, Sparkles, Loader2, ArrowRight, CheckCircle2,
  LogIn, UserPlus, AlertCircle, Eye, EyeOff, RefreshCw
} from 'lucide-react';
import api from '@/lib/api-client';

export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get('verify');
    if (verifyToken) {
      setVerifying(true);
      setSuccess('Verifying your email...');
      api.post('/auth/verify-email', { token: verifyToken }).then(data => {
        if (data.error) {
          setError(data.error);
          setSuccess('');
        } else if (data.token && data.user) {
          api.setToken(data.token);
          onAuth(data.user);
        } else {
          setSuccess(data.message || 'Email verified! You can now sign in.');
        }
        window.history.replaceState({}, '', window.location.pathname);
      }).catch(err => {
        setError(err.message);
        setSuccess('');
      }).finally(() => setVerifying(false));
    }
  }, []);

  const handleResendVerification = async () => {
    setResending(true);
    setError('');
    try {
      const data = await api.post('/auth/resend-verification', { email: verificationEmail });
      if (data.error) throw new Error(data.error);
      if (data.token && data.user) {
        api.setToken(data.token);
        onAuth(data.user);
        return;
      }
      setSuccess(data.message || 'Verification email sent!');
      setNeedsVerification(false);
    } catch (err) { setError(err.message); }
    finally { setResending(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setNeedsVerification(false);
    setLoading(true);
    try {
      const data = mode === 'register'
        ? await api.post('/auth/register', { name, email, password })
        : await api.post('/auth/login', { email, password });
      if (data.error) {
        if (data.requiresVerification || data.error.includes('not verified')) {
          setNeedsVerification(true);
          setVerificationEmail(data.email || email);
          setError(data.error);
        } else {
          throw new Error(data.error);
        }
        return;
      }
      if (data.requiresVerification && !data.token) {
        setSuccess(data.message);
        setMode('login');
        return;
      }
      if (data.token && data.user) {
        api.setToken(data.token);
        onAuth(data.user);
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-animated-mesh relative overflow-hidden flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl animate-blob" style={{ animationDelay: '2s' }} />
        <div className="absolute -bottom-40 left-1/3 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-blob" style={{ animationDelay: '4s' }} />
        <div className="bg-grid-pattern absolute inset-0" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-slide-up">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-400 to-teal-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-cyan-500/20 animate-float">
            <Brain className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Career<span className="text-gradient-cyan">GPT</span></h1>
          <p className="text-slate-400 mt-2 text-sm">AI-Powered Career Guidance Platform</p>
        </div>

        <div className="glass-card-bright p-1 animate-scale-in" style={{ animationDelay: '0.15s' }}>
          <div className="p-7">
            <div className="flex gap-1 mb-7 p-1 rounded-xl bg-slate-800/50">
              <Button onClick={() => setMode('login')} variant="ghost" className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-300 ${mode === 'login' ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20' : 'text-slate-400 hover:text-white'}`}>
                <LogIn className="w-4 h-4 mr-2" /> Sign In
              </Button>
              <Button onClick={() => setMode('register')} variant="ghost" className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-300 ${mode === 'register' ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/20' : 'text-slate-400 hover:text-white'}`}>
                <UserPlus className="w-4 h-4 mr-2" /> Register
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'register' && (
                <div className="animate-fade-in">
                  <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Full Name</label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" className="input-glass h-11" required />
                </div>
              )}
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Email</label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="input-glass h-11" required />
              </div>
              <div>
                <label className="text-slate-300 text-xs font-medium block mb-1.5 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" className="input-glass h-11 pr-10" required minLength={6} />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-xl animate-scale-in">
                  <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>
                  {needsVerification && (
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resending}
                      className="mt-2 w-full text-center text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg py-2 px-3 transition-all flex items-center justify-center gap-1.5"
                    >
                      {resending ? <><Loader2 className="w-3 h-3 animate-spin" /> Verifying...</> : <><RefreshCw className="w-3 h-3" /> Click here to verify your account</>}
                    </button>
                  )}
                </div>
              )}
              {success && <div className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 p-3 rounded-xl flex items-center gap-2 animate-scale-in"><CheckCircle2 className="w-4 h-4 flex-shrink-0" />{success}</div>}
              {verifying ? (
                <Button disabled className="w-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white border-0 h-12 rounded-xl text-sm font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Verifying Email...
                </Button>
              ) : (
                <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white border-0 h-12 rounded-xl text-sm font-semibold btn-glow shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {mode === 'register' ? 'Create Account' : 'Sign In'}
                </Button>
              )}
            </form>
          </div>
        </div>

        <button
          onClick={() => {
            localStorage.setItem('cgpt_guest', 'true');
            onAuth({ name: 'Guest', role: 'guest' });
          }}
          className="mt-6 text-slate-500 hover:text-cyan-400 text-sm flex items-center justify-center gap-2 w-full transition-colors duration-300 group"
        >
          Continue as Guest <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </button>

        <div className="mt-8 text-center">
          <p className="text-[11px] text-slate-600 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3 h-3" /> Powered by 5 AI Models
          </p>
        </div>
      </div>
    </div>
  );
}
