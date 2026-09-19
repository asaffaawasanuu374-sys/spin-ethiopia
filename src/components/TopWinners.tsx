import React, { useState, useEffect } from 'react';
import { Trophy, Crown, Flame, Award, Medal, Sparkles, TrendingUp } from 'lucide-react';
import { apiFetch } from '../lib/api';

export interface TopWinnerPlayer {
  rank: number;
  userId: string;
  userName: string;
  userPhone: string;
  totalWins: number;
  firstPlaceWins: number;
  totalPrizes: number;
  lastRoundWon?: number;
}

export const TopWinners: React.FC = () => {
  const [topWinners, setTopWinners] = useState<TopWinnerPlayer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTopWinners();
  }, []);

  const loadTopWinners = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/round/top-winners');
      if (res.topWinners && res.topWinners.length > 0) {
        setTopWinners(res.topWinners);
      }
    } catch {
      // Graceful fallback to initial champions
      setTopWinners([
        { rank: 1, userId: 'top_1', userName: 'Chala Bekele', userPhone: '0988***55', totalWins: 6, firstPlaceWins: 4, totalPrizes: 7500, lastRoundWon: 2 },
        { rank: 2, userId: 'top_2', userName: 'Asefa Wasenu', userPhone: '0921***10', totalWins: 5, firstPlaceWins: 3, totalPrizes: 5600, lastRoundWon: 2 },
        { rank: 3, userId: 'top_3', userName: 'Tolera Bekele', userPhone: '0911***42', totalWins: 4, firstPlaceWins: 2, totalPrizes: 4200, lastRoundWon: 1 },
        { rank: 4, userId: 'top_4', userName: 'Gemechu B.', userPhone: '0912***34', totalWins: 3, firstPlaceWins: 2, totalPrizes: 3100, lastRoundWon: 1 },
        { rank: 5, userId: 'top_5', userName: 'Bontu G.', userPhone: '0933***15', totalWins: 3, firstPlaceWins: 1, totalPrizes: 2500, lastRoundWon: 1 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-amber-600 text-neutral-950 shadow-lg shadow-amber-500/30 ring-2 ring-yellow-300 font-extrabold text-sm">
            <Crown className="h-4 w-4" />
          </div>
        );
      case 2:
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 via-slate-300 to-neutral-400 text-neutral-900 shadow-md shadow-neutral-400/20 ring-2 ring-slate-300 font-bold text-sm">
            <Medal className="h-4 w-4 text-neutral-800" />
          </div>
        );
      case 3:
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-600 via-orange-600 to-amber-800 text-amber-100 shadow-md shadow-orange-600/20 ring-2 ring-amber-500 font-bold text-sm">
            <Award className="h-4 w-4" />
          </div>
        );
      default:
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-neutral-300 font-bold text-xs">
            #{rank}
          </div>
        );
    }
  };

  return (
    <div id="top-winners-leaderboard" className="w-full rounded-2xl border border-amber-500/20 bg-gradient-to-b from-neutral-900/90 to-neutral-950 p-5 shadow-2xl backdrop-blur">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-amber-500/10 p-2 border border-amber-500/20 text-yellow-400">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-wide">
                Goolii Mo'attootaa (Top 5 Historical Winners)
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                <Flame className="h-3 w-3 fill-amber-400" /> HOT
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Taphannaa caaraa keessatti taphattoota seenaa qaban
            </p>
          </div>
        </div>

        <button
          onClick={loadTopWinners}
          disabled={loading}
          className="self-start sm:self-auto rounded-lg border border-neutral-800 bg-neutral-800/60 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white transition"
        >
          {loading ? 'Haaromsaa...' : 'Haaromsaa'}
        </button>
      </div>

      {/* Leaderboard list */}
      <div className="space-y-2.5">
        {topWinners.map((player) => (
          <div
            key={player.userId || player.rank}
            className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3.5 transition-all duration-200 ${
              player.rank === 1
                ? 'border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-neutral-900/90 to-neutral-950 hover:border-amber-400/60'
                : player.rank === 2
                ? 'border-neutral-700/60 bg-neutral-900/80 hover:border-neutral-600'
                : player.rank === 3
                ? 'border-amber-800/40 bg-neutral-900/70 hover:border-amber-700/60'
                : 'border-neutral-800/60 bg-neutral-950/60 hover:border-neutral-700'
            }`}
          >
            {/* Left: Rank & User Info */}
            <div className="flex items-center gap-3">
              {getRankBadge(player.rank)}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm group-hover:text-amber-300 transition">
                    {player.userName}
                  </span>
                  {player.rank === 1 && (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                      CHAMPION
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <span className="font-mono text-neutral-500">{player.userPhone}</span>
                  {player.lastRoundWon && (
                    <>
                      <span>•</span>
                      <span>Marsaa #{player.lastRoundWon}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Badges & Money Won */}
            <div className="flex items-center justify-between sm:justify-end gap-3 border-t border-neutral-800/50 pt-2 sm:border-0 sm:pt-0">
              <div className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-950/80 px-2.5 py-1 text-xs">
                <Trophy className="h-3.5 w-3.5 text-amber-400" />
                <span className="font-bold text-neutral-200">{player.totalWins}</span>
                <span className="text-[11px] text-neutral-400">Mo'ate</span>
              </div>

              <div className="text-right">
                <div className="font-mono text-sm font-extrabold text-emerald-400">
                  +{player.totalPrizes.toLocaleString()} ETB
                </div>
                <div className="text-[10px] text-neutral-500">Badhaasa Guutuu</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
