import React, { useState, useEffect } from 'react';
import { Trophy, Crown, Calendar, Sparkles, ChevronRight } from 'lucide-react';
import { Round } from '../types/index';
import { apiFetch } from '../lib/api';

export const PreviousWinners: React.FC = () => {
  const [history, setHistory] = useState<Round[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/round/history');
      if (res.history) {
        setHistory(res.history);
      }
    } catch {}
    finally {
      setLoading(false);
    }
  };

  if (history.length === 0) {
    return null;
  }

  return (
    <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 shadow-xl">
      <div className="mb-4 flex items-center justify-between border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-400" />
          <h3 className="text-base font-bold text-amber-400">
            Mo'attoota Marsaalee Darban (Previous Round Winners)
          </h3>
        </div>
        <span className="text-xs text-neutral-400">
          Marsaalee Xumuraman: {history.length}
        </span>
      </div>

      <div className="space-y-3">
        {history.slice(0, 5).map((rnd) => (
          <div
            key={rnd.id}
            className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-4 transition hover:border-neutral-700"
          >
            <div className="flex items-center justify-between border-b border-neutral-800/60 pb-2 text-xs">
              <span className="font-bold text-white">Marsaa #{rnd.roundNumber}</span>
              <div className="flex items-center gap-3 text-neutral-400">
                <span>Baajata: <strong className="text-emerald-400 font-mono">{rnd.totalPool.toFixed(2)} ETB</strong></span>
                <span>•</span>
                <span>{rnd.completedAt ? new Date(rnd.completedAt).toLocaleDateString() : 'Completed'}</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {rnd.winners &&
                rnd.winners.map((win, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      {idx === 0 ? (
                        <Crown className="h-4 w-4 text-yellow-400" />
                      ) : (
                        <Trophy className="h-3.5 w-3.5 text-neutral-400" />
                      )}
                      <div>
                        <span className="font-bold text-white">
                          {win.place}: #{win.number}
                        </span>
                        <div className="text-[10px] text-neutral-400 truncate max-w-[100px]">
                          {win.userName}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-emerald-400">
                      +{win.prizeAmount.toFixed(2)} ETB
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
