import React, { useState } from 'react';
import { User, Lock, Phone, UserCheck, X, AlertCircle, ArrowRight } from 'lucide-react';
import { apiFetch, setStoredToken } from '../lib/api';
import { User as UserType } from '../types/index';
import { sound } from '../lib/sound';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess: (user: UserType) => void;
  initialReferralCode?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
  initialReferralCode = '',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [phone, setPhone] = useState(() => {
    try {
      return localStorage.getItem('spin_saved_phone') || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [referralCode, setReferralCode] = useState(initialReferralCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    sound.playClick();

    try {
      if (mode === 'login') {
        const res = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ phone: phone.trim(), password: password.trim() }),
        });
        try {
          localStorage.setItem('spin_saved_phone', phone.trim());
        } catch {}
        setStoredToken(res.token);
        onSuccess(res.user);
        onClose();
      } else {
        if (password !== confirmPassword) {
          throw new Error('Jechi icciitii lamaan wal hin simne (Passwords do not match)');
        }
        const res = await apiFetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone.trim(),
            password: password.trim(),
            confirmPassword: confirmPassword.trim(),
            referralCode: referralCode.trim(),
          }),
        });
        try {
          localStorage.setItem('spin_saved_phone', phone.trim());
        } catch {}
        setStoredToken(res.token);
        onSuccess(res.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Dogoggorri uumameera (An error occurred)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-amber-500/30 bg-neutral-900 p-6 text-white shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Tab Switcher */}
        <div className="mb-6 flex rounded-xl bg-neutral-800/80 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
              sound.playClick();
            }}
            className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold transition ${
              mode === 'login'
                ? 'bg-amber-500 text-neutral-950 shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Seensa (Login)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
              sound.playClick();
            }}
            className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold transition ${
              mode === 'register'
                ? 'bg-amber-500 text-neutral-950 shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Galmaa'i (Register)
          </button>
        </div>

        <div className="mb-4">
          <h2 className="text-xl font-bold text-amber-400">
            {mode === 'login' ? 'Gara Herrega Keetti Seeni' : 'Herrega Haaraa Uumi'}
          </h2>
          <p className="text-xs text-neutral-400">
            {mode === 'login'
              ? 'Lakkoofsa bilbilaa fi jecha icciitii keessaniin seenaa'
              : 'Spin Ethiopia irratti galmaa\'uun caaraa badhaasa guddaa qooddadhaa'}
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-300">
                  Maqaa (First Name)
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Asefa"
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 py-2 pl-9 pr-3 text-sm text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-300">
                  Maqaa Abbaa (Last Name)
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Wasenu"
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-300">
              Lakkoofsa Bilbilaa (Ethiopian Phone)
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09... ykn 07..."
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 py-2 pl-9 pr-3 text-sm text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <p className="mt-1 text-[10px] text-neutral-500">
              Fakkeenya: 0912345678, 0712345678
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-300">
              Jecha Icciitii (Password)
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 py-2 pl-9 pr-3 text-sm text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-300">
                Jecha Icciitii Mirkaneessi (Confirm Password)
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 py-2 pl-9 pr-3 text-sm text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-300">
                Koodii Afeerraa / Referral Code (Filannoo)
              </label>
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                placeholder="SPIN123456"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none uppercase"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 py-3 text-sm font-bold text-neutral-950 transition hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50 shadow-lg shadow-amber-500/20"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent"></span>
                Eegaa jira...
              </span>
            ) : (
              <>
                <span>{mode === 'login' ? 'Seeni (Login)' : 'Galmaa\'i (Register)'}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {mode === 'login' && (
          <div className="mt-4 text-center">
            <p className="text-xs text-neutral-400">
              Herrega hin qabdan?{' '}
              <button
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className="font-semibold text-amber-400 hover:underline"
              >
                Amma Galmaa'aa
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
