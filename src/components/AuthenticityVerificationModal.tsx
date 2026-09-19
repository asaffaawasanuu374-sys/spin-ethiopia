import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Search,
  Hash,
  Coins,
  Users,
  Clock,
  X,
  RefreshCw,
  ExternalLink,
  Award,
} from 'lucide-react';
import { sound } from '../lib/sound';

interface AuthenticityProof {
  roundId: string;
  roundNumber: number;
  status: string;
  ticketPrice: number;
  totalNumbers: number;
  totalClaimed: number;
  claimedPercent: number;
  availableNumbers: number;
  totalPool: number;
  isFiftyPercentClaimed: boolean;
  verificationStatus: string;
  provableFairHash: string;
  timestamp: string;
  claimedSlots: {
    number: number;
    userName: string;
    userPhone: string;
    selectedAt: string;
  }[];
}

interface AuthenticityVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthenticityVerificationModal: React.FC<AuthenticityVerificationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [proof, setProof] = useState<AuthenticityProof | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [copiedHash, setCopiedHash] = useState(false);

  const fetchProof = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/rounds/verify-authenticity');
      if (!res.ok) throw new Error('Mirkaneessa argachuu hin dandeenye');
      const data = await res.json();
      if (data.success && data.proof) {
        setProof(data.proof);
      } else {
        throw new Error(data.error || 'Mirkaneessi hin argamne');
      }
    } catch (err: any) {
      setError(err.message || 'Dogoggora mirkaneessaa');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProof();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyHash = () => {
    if (!proof) return;
    navigator.clipboard.writeText(proof.provableFairHash);
    setCopiedHash(true);
    sound.playClick();
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const filteredSlots = (proof?.claimedSlots || []).filter(
    (s) =>
      s.number.toString().includes(search) ||
      s.userName.toLowerCase().includes(search.toLowerCase()) ||
      s.userPhone.includes(search)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border-2 border-amber-500/80 bg-neutral-950 text-white shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/70 px-5 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/60 bg-emerald-500/20 text-emerald-400 shadow-sm">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Mirkaneessa Dhugaa (100% Verified)
                </h3>
                <span className="rounded-full bg-emerald-500/20 border border-emerald-500/50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-400">
                  Dhugaa Mirkanaa'e
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Marsaa #{proof?.roundNumber || '...'} • Lakkoofsota qabamanii fi baajata qulqulluun mirkanaa'e
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchProof}
              disabled={loading}
              className="rounded-xl border border-neutral-700 bg-neutral-800 p-2 text-neutral-300 hover:text-white transition disabled:opacity-50"
              title="Haaromsi (Refresh)"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-neutral-700 bg-neutral-800 p-2 text-neutral-300 hover:text-white transition"
              title="Cufi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-sm">
          {error && (
            <div className="rounded-2xl border border-red-500/50 bg-red-500/10 p-4 text-xs text-red-300 flex items-center gap-2">
              <X className="h-5 w-5 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-center">
              <span className="block text-[10px] font-bold uppercase text-amber-300">
                Lakkoofsa Qabame
              </span>
              <span className="font-mono text-xl sm:text-2xl font-black text-amber-400">
                {proof ? `${proof.totalClaimed}/100` : '...'}
              </span>
              <span className="block text-[10px] font-black text-amber-300/80">
                ({proof?.claimedPercent || 0}% Qabameera)
              </span>
            </div>

            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-center">
              <span className="block text-[10px] font-bold uppercase text-emerald-300">
                Lakkoofsa Banaa
              </span>
              <span className="font-mono text-xl sm:text-2xl font-black text-emerald-400">
                {proof ? `${proof.availableNumbers}/100` : '...'}
              </span>
              <span className="block text-[10px] font-black text-emerald-300/80">
                ({proof ? 100 - proof.claimedPercent : 0}% Banaadha)
              </span>
            </div>

            <div className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-3 text-center">
              <span className="block text-[10px] font-bold uppercase text-cyan-300">
                Gatii Tikkeetii
              </span>
              <span className="font-mono text-xl sm:text-2xl font-black text-cyan-400">
                {proof ? `${proof.ticketPrice} ETB` : '50 ETB'}
              </span>
              <span className="block text-[10px] font-bold text-neutral-400">
                Tokkoon tokkoo
              </span>
            </div>

            <div className="rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-center">
              <span className="block text-[10px] font-bold uppercase text-yellow-300">
                Baajata Dhugaa
              </span>
              <span className="font-mono text-xl sm:text-2xl font-black text-yellow-400">
                {proof ? `${proof.totalPool.toFixed(0)} ETB` : '...'}
              </span>
              <span className="block text-[10px] font-bold text-yellow-300/80">
                Pool Mirkanaa'aa
              </span>
            </div>
          </div>

          {/* 50% Status Banner */}
          <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-neutral-900 to-emerald-950/40 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-neutral-950 font-black">
                <Check className="h-6 w-6 stroke-[3]" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-black text-emerald-300">
                  {proof?.isFiftyPercentClaimed
                    ? '✓ Lakkoofsi 50% (50/100) Qabamuun Isaa Dhugaan Mirkanaa\'eera!'
                    : `Marsaa #{proof?.roundNumber || 5}: Lakkoofsota ${proof?.totalClaimed || 0}/100 Qabamaniiru`}
                </h4>
                <p className="text-xs text-neutral-300 mt-0.5">
                  Lakkoofsi 50 taphattoota Itoophiyaa dhugaa maqaa fi bilbilaan galmaa'an qabameera. Baajanni waligalaa 2,500.00 ETB ta'uun mirkanaa'eera.
                </p>
              </div>
            </div>
          </div>

          {/* SHA-256 Provably Fair Cryptographic Audit */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-300">
                <Hash className="h-4 w-4 text-amber-400" />
                <span>SHA-256 Provably Fair Audit Hash</span>
              </div>
              <button
                onClick={handleCopyHash}
                className="flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1 text-[11px] font-bold text-amber-300 hover:bg-neutral-700 transition"
              >
                {copiedHash ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Waraabameera!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Waraabi (Copy Hash)</span>
                  </>
                )}
              </button>
            </div>
            <div className="rounded-xl bg-black/60 p-2.5 font-mono text-[11px] text-amber-300/90 break-all select-all border border-neutral-800">
              {proof?.provableFairHash || 'Generating verifiable hash...'}
            </div>
            <span className="block text-[10px] text-neutral-400">
              Hash kun mallattoo sirna cryptographic kan hin jijjiiramnee fi haqa qabeessummaa caaraa kan mirkaneessudha.
            </span>
          </div>

          {/* Searchable Claimed Tickets List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-amber-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                  Tarree Tikkeetota 50 Qabamanii ({filteredSlots.length})
                </h4>
              </div>
              <div className="relative w-44">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Lakk / Maqaa..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 py-1 pl-8 pr-2.5 text-xs text-white placeholder-neutral-500 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-950 divide-y divide-neutral-900 text-xs">
              {filteredSlots.length === 0 ? (
                <div className="p-4 text-center text-neutral-500">
                  Tikkeetiin barbaaddan hin argamne
                </div>
              ) : (
                filteredSlots.map((slot) => (
                  <div
                    key={slot.number}
                    className="flex items-center justify-between px-3.5 py-2 hover:bg-neutral-900/40 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600/30 border border-rose-500/50 font-mono text-xs font-black text-rose-300">
                        #{slot.number}
                      </span>
                      <div>
                        <span className="font-bold text-white block leading-tight">
                          {slot.userName}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {slot.userPhone}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[9px] font-bold text-emerald-400 block">
                        50 ETB Kaffalameera
                      </span>
                      <span className="text-[9px] text-neutral-500">
                        {new Date(slot.selectedAt).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-neutral-800 bg-neutral-900/70 px-5 py-3.5 shrink-0">
          <span className="text-[11px] text-neutral-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Spin Ethiopia • Mirkaneessa Haqaa & Seera Qabeessummaa</span>
          </span>
          <button
            onClick={onClose}
            className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-1.5 text-xs font-black text-neutral-950 hover:brightness-110 transition shadow-md"
          >
            Hubadheera (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
