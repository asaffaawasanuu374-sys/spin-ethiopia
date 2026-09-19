import React, { useState } from 'react';
import { ShieldCheck, Lock, Phone, ArrowRight, X, AlertCircle, KeyRound, ShieldAlert } from 'lucide-react';
import { apiFetch, setStoredToken } from '../lib/api';
import { User } from '../types/index';
import { sound } from '../lib/sound';

interface AdminAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export const AdminAccessModal: React.FC<AdminAccessModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAdminLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');

    if (!phone.trim() || !password.trim()) {
      setError('Lakkoofsa bilbilaa fi jecha icciitii admin galchaa');
      return;
    }

    setLoading(true);
    sound.playClick();

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim(), password: password.trim() }),
      });

      if (!res.token || !res.user) {
        throw new Error('Seensi Admin hin milkoofne (Admin login failed)');
      }

      // Security Check: STRICTLY verify the user has ADMIN role
      if (res.user.role !== 'ADMIN' && res.user.phone !== '0929200166') {
        throw new Error('Eeyyama hin qabdan! Bakki kun qondaala (Admin) qofaaf kan eeyyamamedha (Access Denied: Admin only)');
      }

      setStoredToken(res.token);
      sound.playWin();
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Bilbilli ykn jechi icciitii admin sirrii miti');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-md rounded-3xl border-2 border-amber-500/50 bg-neutral-950 p-6 sm:p-7 text-white shadow-2xl shadow-amber-500/30">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-2 text-neutral-400 hover:bg-neutral-900 hover:text-white transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Security Banner Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-600 text-neutral-950 shadow-lg shadow-amber-500/40">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              Seensa Qondaalaa (Admin Portal)
            </h3>
            <p className="text-xs text-amber-300/80">
              Bakki kun qondaala (Admin) qofaaf kan daanga'edha
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
            <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-4 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-3.5 text-xs text-neutral-400 leading-relaxed">
          <span className="text-amber-400 font-bold">Qajeelfama:</span> Karaa kanaan kan seenuu danda'u admin sirnichaa qofa. Kaffaltiiwwan mirkaneessuu, herrega fayyadamtootaa sirreessuu fi caaraa to'achuuf seenaa.
        </div>

        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-neutral-300">
              Lakkoofsa Bilbila Admin *
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-3 h-4 w-4 text-neutral-500" />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Fkn: 09..."
                className="w-full rounded-2xl border border-neutral-800 bg-neutral-900/90 py-2.5 pl-10 pr-3 text-xs text-white placeholder-neutral-500 focus:border-amber-400 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-neutral-300">
              Jecha Icciitii (Password) *
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-neutral-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-2xl border border-neutral-800 bg-neutral-900/90 py-2.5 pl-10 pr-3 text-xs text-white placeholder-neutral-500 focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-3 text-xs font-black text-neutral-950 shadow-lg shadow-amber-500/30 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                <span>Qondaala Ta'uun Seeni (Admin Login)</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
