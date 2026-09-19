import React from 'react';
import { X, HelpCircle, CheckCircle2, ShieldAlert, Award } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-amber-500/30 bg-neutral-900 p-6 text-white shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
            <HelpCircle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-amber-400">Akkaataa Taphichaa (How To Play)</h3>
            <p className="text-xs text-neutral-400">Qajeelfama Spin Ethiopia Lakkoofsa 1–100</p>
          </div>
        </div>

        <div className="space-y-4 text-xs text-neutral-300">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <h4 className="flex items-center gap-2 font-bold text-amber-300 mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              1. Galmaa'aa & Seenaa (Register & Login)
            </h4>
            <p className="text-neutral-400">
              Lakkoofsa bilbilaa Itoophiyaa (09... ykn 07...) fayyadamuun herrega haaraa uumaa ykn seenaa.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <h4 className="flex items-center gap-2 font-bold text-amber-300 mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              2. Kaffaltii Galii Taasisaa (Deposit Funds)
            </h4>
            <p className="text-neutral-400">
              Kaffaltii karaa Baankii Daldala Itoophiyaa (CBE: 1000218818424 - Asefa Wasenu Tadese), Baankii Hawaash (Awash: 01320561958100 - Asefa Wasenu Tadese), ykn Telebirr (0929200166 - Gabre shifaraa hayilu) kaffaluun ragaa suuraa fi lakk FT ol-fe'aa. Admin erga mirkaneessee booda herregni keessan ni dabalama.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <h4 className="flex items-center gap-2 font-bold text-amber-300 mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              3. Lakkoofsa Caaraa Keessan Filadhaa (Pick Numbers 1–100)
            </h4>
            <p className="text-neutral-400">
              Mashina caaraa jalatti gabatee lakkoofsota 1–100 jiru keessaa lakkoofsa caaraa keessanii filadhaa. Gatiin tikkeetii tokkoo 50 ETB dha. Tikkeetii fedhan hunda bitachuun ni danda'ama!
            </p>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <h4 className="flex items-center gap-2 font-bold text-amber-300 mb-2">
              <Award className="h-4 w-4 text-yellow-400" />
              4. Badhaasa Mo'adhaa (Prize Distribution)
            </h4>
            <div className="text-neutral-400 space-y-1 mt-1">
              <p>• <strong>Mo'ataa 1ffaa:</strong> 75% waliigala baajata caaraa (Jackpot)!</p>
              <p>• <strong>Mo'ataa 2ffaa:</strong> 7% waliigala baajata caaraa</p>
              <p>• <strong>Mo'ataa 3ffaa:</strong> 3% waliigala baajata caaraa</p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] text-amber-300 flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Qarshii mo'attan battalumatti gara Telebirr ykn herrega baankii keessaniitti gaaffii baasii dhiheessuun fudhachuu dandeessu.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
