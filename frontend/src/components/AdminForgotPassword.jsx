import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, KeyRound, CheckCircle, ArrowLeft, Loader, ShieldCheck, Mail, ShieldAlert } from 'lucide-react';
import BhcCrestLogo from './BhcCrestLogo';

export default function AdminForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveryData, setRecoveryData] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // 60-Second Resend Cooldown Timer
  const [resendCooldown, setResendCooldown] = useState(0);

  const startCooldownTimer = (seconds = 60) => {
    setResendCooldown(seconds);
    const interval = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSearchAccount = async (e) => {
    if (e) e.preventDefault();
    if (!email.trim()) return;

    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setRecoveryData(data);
        setInfoMsg(data.message || `A 6-digit verification code has been dispatched to ${email}.`);
        startCooldownTimer(data.cooldownSeconds || 60);
      } else if (res.status === 429) {
        setErrorMsg(data.message || 'Please wait before requesting another OTP code.');
        if (data.retryAfterSeconds) startCooldownTimer(data.retryAfterSeconds);
      } else {
        setErrorMsg(data.message || 'No registered admin account found with this email address.');
      }
    } catch {
      setErrorMsg('Network error while connecting to server. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword.trim() || !otpInput.trim()) return;

    if (newPassword.trim().length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }

    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword, otp: otpInput })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResetSuccess(true);
        setTimeout(() => {
          navigate('/admin');
        }, 1800);
      } else {
        setErrorMsg(data.message || 'Verification failed. Incorrect or expired OTP code.');
      }
    } catch {
      setErrorMsg('Error updating admin password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 my-12 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xl space-y-6">

        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <Link to="/admin" className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition">
            <ArrowLeft size={15} /> Back to Sign In
          </Link>
          <span className="text-[10px] bg-[#d4af37] text-slate-900 font-extrabold px-2.5 py-0.5 rounded-full uppercase border border-amber-300">
            Secure Reset
          </span>
        </div>

        <div className="text-center space-y-2">
          <BhcCrestLogo className="w-16 h-20 mx-auto drop-shadow-sm" />
          <h2 className="text-2xl font-black text-slate-900 font-serif">Reset Admin Password</h2>
          <p className="text-xs text-slate-600">
            Bishop Heber College Administrator Account Recovery
          </p>
        </div>

        {/* Error Alert Banner */}
        {errorMsg && (
          <div className="p-3.5 bg-red-50 border border-red-300 rounded-xl text-xs text-red-900 font-medium flex items-start gap-2 animate-shake">
            <ShieldAlert size={16} className="text-red-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Info / Success Alert Banner */}
        {infoMsg && !resetSuccess && (
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 font-medium flex items-start gap-2">
            <Mail size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <span>{infoMsg}</span>
          </div>
        )}

        {!recoveryData ? (
          <form onSubmit={handleSearchAccount} className="space-y-4">
            <div className="form-group">
              <label className="form-label text-xs font-bold text-slate-700">Registered Admin Email</label>
              <input
                type="email"
                className="form-input text-xs px-4 py-2.5 w-full font-medium"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="cs255214307@bhc.edu.in"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full py-3 text-xs font-extrabold shadow-md rounded-xl"
              disabled={loading || resendCooldown > 0}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader className="animate-spin" size={16} /> Verifying Admin Account...
                </span>
              ) : resendCooldown > 0 ? (
                <span>Request OTP again in {resendCooldown}s</span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <KeyRound size={16} /> Request Password Reset Verification Code
                </span>
              )}
            </button>
          </form>
        ) : resetSuccess ? (
          <div className="p-6 bg-emerald-50 border border-emerald-300 rounded-2xl text-center text-xs text-emerald-900 font-bold space-y-3 shadow-inner">
            <CheckCircle className="mx-auto text-emerald-600" size={38} />
            <h3 className="text-base font-black text-slate-900 font-serif">Admin Password Reset Successfully!</h3>
            <p className="text-slate-600 font-medium">Your credentials have been updated. Redirecting to College Admin Portal...</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
              <div className="font-extrabold text-slate-900 flex justify-between items-center border-b border-slate-200 pb-1.5">
                <span className="flex items-center gap-1.5"><Mail size={14} className="text-blue-700" /> Verification Code Sent</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1"><CheckCircle size={12} /> Valid 10 mins</span>
              </div>
              <p className="text-slate-700 leading-relaxed pt-1">
                A 6-digit security OTP has been generated for <strong className="text-slate-900">{email}</strong>.
              </p>
              <p className="text-[11px] text-slate-500 italic">
                Please check your inbox or server log, then enter your 6-digit OTP code below.
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="form-group">
                <div className="flex justify-between items-center mb-1">
                  <label className="form-label text-xs font-bold text-slate-700">Enter 6-Digit OTP</label>
                  <button
                    type="button"
                    onClick={handleSearchAccount}
                    disabled={loading || resendCooldown > 0}
                    className="text-[11px] font-bold text-amber-700 hover:underline disabled:opacity-50 disabled:no-underline"
                  >
                    {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP Code'}
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  className="form-input text-xs px-4 py-2.5 w-full font-mono font-bold tracking-widest text-center text-slate-900 text-sm"
                  placeholder="e.g. 849201"
                  value={otpInput}
                  onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label text-xs font-bold text-slate-700">Set New Admin Password</label>
                <input
                  type="password"
                  className="form-input text-xs px-4 py-2.5 w-full font-medium"
                  placeholder="Enter new password (min 6 characters)"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full py-3 text-xs font-extrabold shadow-md rounded-xl"
                disabled={loading}
              >
                {loading ? 'Updating Password...' : 'Save New Password & Sign In'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
