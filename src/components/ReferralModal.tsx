import React, { useState } from 'react';
import { X, Copy, Check, Users, Gift, Share2 } from 'lucide-react';
import { User } from '../types/index';
import { sound } from '../lib/sound';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({
  isOpen,
  onClose,
  user,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://spinethiopia.com';
  const referralLink = `${origin}/?ref=${user.referralCode}`;

  const copyCode = () => {
    navigator.clipboard.writeText(user.referralCode);
    setCopiedCode(true);
    sound.playClick();
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    sound.playClick();
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-amber-500/30 bg-neutral-900 p-6 text-white shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
            <Gift className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-bold text-amber-400">
            Afeerraa & Badhaasa (Invite & Earn)
          </h3>
          <p className="mt-1 text-xs text-neutral-400">
            Hiriyoota keessan afeeruun tokkoon tokkoon isaaniirraa <strong className="text-emerald-400">25.00 ETB</strong> argadhaa!
          </p>
        </div>

        <div className="space-y-4">
          {/* Referral Code Box */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <span className="text-xs text-neutral-400">Koodii Afeerraa Keessan:</span>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-mono text-2xl font-black text-amber-400">
                {user.referralCode}
              </span>
              <button
                type="button"
                onClick={copyCode}
                className="flex items-center gap-1.5 rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-700 hover:text-white"
              >
                {copiedCode ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                <span>{copiedCode ? 'Koppii!' : 'Copy Code'}</span>
              </button>
            </div>
          </div>

          {/* Referral Link Box */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <span className="text-xs text-neutral-400">Geessituu Afeerraa (Referral Link):</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={referralLink}
                className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs font-mono text-neutral-300 truncate"
              />
              <button
                type="button"
                onClick={copyLink}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-bold text-neutral-950 hover:bg-amber-400"
              >
                {copiedLink ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                <span>{copiedLink ? 'Koppii!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Guidelines */}
          <div className="rounded-xl bg-neutral-950/60 p-4 text-xs text-neutral-400 space-y-1.5 border border-neutral-800/80">
            <h5 className="font-bold text-neutral-200">Ulaagaalee Badhaasaa:</h5>
            <p>1. Hiriyyaan keessan koodii ykn linkii kanaan galmaa'uu qaba.</p>
            <p>2. Yoo xiqqaate kaffaltii jalqabaa 100 ETB yeroo mirkaneessan, badhaasni 25 ETB battalumatti herrega keessanitti dabalama.</p>
            <p>3. Daangaa malee hiriyoota hedduu afeeruun ni danda'ama!</p>
          </div>
        </div>
      </div>
    </div>
  );
};
