import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Crown, Trophy, Sparkles, Send, X, CheckCircle2 } from 'lucide-react';
import { RoundWinner } from '../types/index';

interface DrawStepInfo {
  rank: 1 | 2 | 3;
  number: number;
  userName: string;
  userPhone?: string;
  prizeAmount: number;
}

interface DrawCelebrationProps {
  currentStep: DrawStepInfo | null;
  grandWinners: RoundWinner[] | null;
  roundNumber?: number;
  onCloseGrand: () => void;
}

export const DrawCelebrationModal: React.FC<DrawCelebrationProps> = ({
  currentStep,
  grandWinners,
  roundNumber,
  onCloseGrand,
}) => {
  // Trigger celebratory confetti explosion when each individual winner step is announced
  useEffect(() => {
    if (!currentStep) return;

    try {
      if (currentStep.rank === 1) {
        // Grand 1st place explosion (Gold & Emerald)
        confetti({
          particleCount: 110,
          spread: 90,
          origin: { y: 0.32 },
          colors: ['#ffd700', '#f59e0b', '#10b981', '#ffffff', '#eab308'],
          zIndex: 99999,
        });

        const timer = setTimeout(() => {
          confetti({
            particleCount: 80,
            angle: 60,
            spread: 60,
            origin: { x: 0.05, y: 0.38 },
            colors: ['#ffd700', '#f59e0b', '#3b82f6', '#ffffff'],
            zIndex: 99999,
          });
          confetti({
            particleCount: 80,
            angle: 120,
            spread: 60,
            origin: { x: 0.95, y: 0.38 },
            colors: ['#ffd700', '#f59e0b', '#10b981', '#ffffff'],
            zIndex: 99999,
          });
        }, 220);

        return () => clearTimeout(timer);
      } else {
        // 2nd and 3rd place celebration bursts
        confetti({
          particleCount: 75,
          spread: 75,
          origin: { y: 0.32 },
          colors:
            currentStep.rank === 2
              ? ['#cbd5e1', '#94a3b8', '#38bdf8', '#ffffff']
              : ['#d97706', '#b45309', '#f59e0b', '#ffffff'],
          zIndex: 99999,
        });
      }
    } catch (e) {
      console.warn('Confetti trigger failed:', e);
    }
  }, [currentStep?.rank, currentStep?.number]);

  // Trigger grand celebration fireworks cascades when all 3 winners summary is displayed
  useEffect(() => {
    if (!grandWinners || grandWinners.length === 0) return;

    try {
      confetti({
        particleCount: 130,
        spread: 110,
        origin: { y: 0.35 },
        colors: ['#ffd700', '#f59e0b', '#10b981', '#6366f1', '#ec4899', '#ffffff'],
        zIndex: 99999,
      });

      const end = Date.now() + 1400;
      let frameId: number;

      const frame = () => {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.55 },
          colors: ['#ffd700', '#f59e0b', '#10b981', '#ffffff'],
          zIndex: 99999,
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.55 },
          colors: ['#ffd700', '#f59e0b', '#10b981', '#ffffff'],
          zIndex: 99999,
        });

        if (Date.now() < end) {
          frameId = requestAnimationFrame(frame);
        }
      };

      frame();

      return () => {
        if (frameId) cancelAnimationFrame(frameId);
      };
    } catch (e) {
      console.warn('Confetti grand trigger failed:', e);
    }
  }, [grandWinners]);
  return (
    <>
      {/* Active Step Congratulation Floating Banner */}
      {currentStep && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-lg animate-in zoom-in-95 duration-200">
          <div className="rounded-3xl border-4 border-yellow-400 bg-gradient-to-b from-neutral-900 via-neutral-950 to-neutral-900 p-5 shadow-[0_0_60px_rgba(250,204,21,0.5)] text-center">
            <div className="flex items-center justify-center gap-2 text-yellow-300">
              <Sparkles className="h-5 w-5 animate-spin text-yellow-300" />
              <span className="text-xs font-black tracking-widest uppercase">
                🎉 CONGRATULATIONS! / BAGA GAMMADDAN! 🎉
              </span>
              <Sparkles className="h-5 w-5 animate-spin text-yellow-300" />
            </div>

            <div className="mt-2 flex items-center justify-center gap-2">
              <Crown className="h-7 w-7 text-yellow-400 animate-bounce" />
              <h3 className="text-xl sm:text-2xl font-black text-white">
                MO'ATAA {currentStep.rank}FFAA
              </h3>
              <Crown className="h-7 w-7 text-yellow-400 animate-bounce" />
            </div>

            {/* Winning Number Badge */}
            <div className="my-3 inline-flex items-center justify-center rounded-2xl border-2 border-yellow-400 bg-gradient-to-br from-amber-500/30 to-neutral-950 px-6 py-2 shadow-inner">
              <span className="font-mono text-3xl sm:text-4xl font-black text-yellow-300">
                LAKK #{currentStep.number}
              </span>
            </div>

            {/* Winner Details */}
            <div className="space-y-1">
              <div className="text-base sm:text-lg font-extrabold text-white">
                Abbaa Tikkeetii: <span className="text-emerald-400">{currentStep.userName}</span>
              </div>
              <div className="text-sm font-mono font-bold text-amber-300">
                Bilbila: <span>{currentStep.userPhone || '09********'}</span>
              </div>
              <div className="text-xs font-bold text-neutral-400">
                Badhaasa {currentStep.rank}ffaa:{' '}
                <span className="font-mono text-lg font-black text-amber-400">
                  {currentStep.prizeAmount.toLocaleString()} ETB
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grand Summary Modal for All 3 Winners */}
      {grandWinners && grandWinners.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border-2 border-yellow-400/80 bg-neutral-950 p-5 sm:p-7 text-white shadow-[0_0_80px_rgba(250,204,21,0.4)] overflow-hidden">
            {/* Background Glow */}
            <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-rose-500/20 blur-3xl pointer-events-none" />

            {/* Close Button */}
            <button
              onClick={onCloseGrand}
              className="absolute top-4 right-4 rounded-full bg-neutral-900 p-2 text-neutral-400 hover:text-white transition"
              title="Cufi"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Modal Header */}
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400/50 bg-yellow-400/10 px-4 py-1 text-xs font-black text-yellow-300">
                <Crown className="h-4 w-4 text-yellow-400 animate-bounce" />
                <span>MO'ATTOOTA MARSAA #{roundNumber || 1}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                🎊 CONGRATULATIONS! 🎊
              </h2>
              <p className="text-xs sm:text-sm text-neutral-300">
                Baga gammaddan! Badhaasni mo'attoota 3f milkaa'inaan qoodameera.
              </p>
            </div>

            {/* 3 Winners Cards */}
            <div className="mt-5 space-y-2.5">
              {grandWinners.map((winner) => {
                const isFirst = winner.rank === 1;
                const isSecond = winner.rank === 2;

                return (
                  <div
                    key={winner.rank}
                    className={`flex items-center justify-between rounded-2xl p-3.5 border transition ${
                      isFirst
                        ? 'border-yellow-400/80 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-neutral-900 shadow-md shadow-yellow-500/20'
                        : isSecond
                        ? 'border-neutral-600 bg-neutral-900/90'
                        : 'border-amber-800/60 bg-neutral-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-base font-black ${
                          isFirst
                            ? 'bg-yellow-400 text-neutral-950 shadow-md shadow-yellow-400/50'
                            : isSecond
                            ? 'bg-neutral-300 text-neutral-950'
                            : 'bg-amber-700 text-white'
                        }`}
                      >
                        {winner.rank}ff
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-base font-black text-white">
                            #{winner.number}
                          </span>
                          <span className="text-xs font-bold text-neutral-300">
                            • {winner.userName}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-neutral-400">
                          Bilbila: {winner.userPhone ? winner.userPhone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2') : 'Qabameera'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="block text-[10px] uppercase font-bold text-neutral-400">
                        Badhaasa
                      </span>
                      <span
                        className={`font-mono text-base sm:text-lg font-black ${
                          isFirst ? 'text-yellow-300' : isSecond ? 'text-neutral-200' : 'text-amber-400'
                        }`}
                      >
                        {winner.prizeAmount.toLocaleString()} ETB
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Telegram Channel Join Link */}
            <div className="mt-5 rounded-2xl border border-sky-500/40 bg-sky-500/10 p-3.5 text-center">
              <div className="text-xs text-sky-200 font-bold mb-2">
                Odeeffannoo fi bu'aa caaraa hunda Telegram keenya irraa hordofaa:
              </div>
              <a
                href="https://t.me/+FL3pQRdAyCBmN2M8"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-sky-500/30 hover:from-sky-400 hover:to-blue-500 transition active:scale-95"
              >
                <Send className="h-4 w-4" />
                <span>Garee Telegram Keenya Seenaa (Join Telegram)</span>
              </a>
            </div>

            {/* Close / Action Button */}
            <div className="mt-4">
              <button
                onClick={onCloseGrand}
                className="w-full rounded-xl bg-neutral-800 py-2.5 text-sm font-bold text-neutral-200 hover:bg-neutral-700 transition"
              >
                Galatoomaa (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
