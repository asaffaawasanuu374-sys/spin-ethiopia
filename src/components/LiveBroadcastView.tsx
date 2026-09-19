import React, { useState, useEffect } from 'react';
import { SpinWheel } from './SpinWheel';
import { Round, TicketSelection, RoundWinner } from '../types/index';
import { apiFetch, getLiveStreamUrl } from '../lib/api';
import { sound } from '../lib/sound';
import { DrawCelebrationModal } from './DrawCelebrationModal';
import {
  Trophy,
  Volume2,
  VolumeX,
  Sparkles,
  Users,
  Crown,
  Radio,
  Smartphone,
  Monitor,
  UserPlus,
  Play,
  RotateCw,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Flame,
  Wallet,
  Send,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AuthenticityVerificationModal } from './AuthenticityVerificationModal';

interface LiveBroadcastViewProps {
  onExit?: () => void;
  onLogout?: () => void;
}

export const LiveBroadcastView: React.FC<LiveBroadcastViewProps> = ({ onExit, onLogout }) => {
  const [round, setRound] = useState<Round | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winningNumber, setWinningNumber] = useState<number | null>(null);
  const [spinKey, setSpinKey] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [recentNotification, setRecentNotification] = useState<string>('');
  const [layoutMode, setLayoutMode] = useState<'tiktok' | 'landscape'>('tiktok');

  // Streamer Quick Assign Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignSlotNum, setAssignSlotNum] = useState<string>('');
  const [assignName, setAssignName] = useState<string>('');
  const [assignPhone, setAssignPhone] = useState<string>('');
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [filling50, setFilling50] = useState(false);
  const [filling100, setFilling100] = useState(false);


  // Manual spin trigger state
  const [isDrawing, setIsDrawing] = useState(false);

  // 3-step draw celebration state
  const [drawPhase, setDrawPhase] = useState<
    'IDLE' | 'SPINNING_1' | 'WAITING_2' | 'SPINNING_2' | 'WAITING_3' | 'SPINNING_3' | 'COMPLETED'
  >('IDLE');
  const [pendingDrawWinners, setPendingDrawWinners] = useState<RoundWinner[]>([]);
  const [pendingCompletedRound, setPendingCompletedRound] = useState<any>(null);
  const [nextStepCountdown, setNextStepCountdown] = useState<number | null>(null);

  const [revealedDrawStep, setRevealedDrawStep] = useState<{
    rank: 1 | 2 | 3;
    number: number;
    userName: string;
    userPhone?: string;
    prizeAmount: number;
  } | null>(null);
  const [revealedWinnersList, setRevealedWinnersList] = useState<RoundWinner[]>([]);
  const [grandWinners, setGrandWinners] = useState<RoundWinner[] | null>(null);
  const [grandRoundNum, setGrandRoundNum] = useState<number>(1);

  // Automatic progression timer between steps
  useEffect(() => {
    if (nextStepCountdown === null) return;
    if (nextStepCountdown <= 0) {
      if (drawPhase === 'WAITING_2') {
        triggerStep2();
      } else if (drawPhase === 'WAITING_3') {
        triggerStep3();
      }
      return;
    }
    const timer = setTimeout(() => {
      setNextStepCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [nextStepCountdown, drawPhase]);

  const startDrawSequence = (winners: RoundWinner[], completedRound: any) => {
    if (!winners || winners.length === 0) return;

    setPendingDrawWinners(winners);
    setPendingCompletedRound(completedRound);
    setIsDrawing(true);
    setRevealedWinnersList([]);
    setRevealedDrawStep(null);

    const w1 = winners.find((w) => w.rank === 1) || winners[0];

    // Step 1: 1ffaa (3,000 ETB)
    setWinningNumber(w1.number);
    setSpinKey(Date.now());
    setIsSpinning(true);
    setDrawPhase('SPINNING_1');
  };

  const triggerStep2 = () => {
    setNextStepCountdown(null);
    if (!pendingDrawWinners || pendingDrawWinners.length === 0) return;
    const w2 = pendingDrawWinners.find((w) => w.rank === 2) || pendingDrawWinners[1] || pendingDrawWinners[0];

    setRevealedDrawStep(null);
    setWinningNumber(w2.number);
    setSpinKey(Date.now());
    setIsSpinning(true);
    setDrawPhase('SPINNING_2');
  };

  const triggerStep3 = () => {
    setNextStepCountdown(null);
    if (!pendingDrawWinners || pendingDrawWinners.length === 0) return;
    const w3 = pendingDrawWinners.find((w) => w.rank === 3) || pendingDrawWinners[2] || pendingDrawWinners[1] || pendingDrawWinners[0];

    setRevealedDrawStep(null);
    setWinningNumber(w3.number);
    setSpinKey(Date.now());
    setIsSpinning(true);
    setDrawPhase('SPINNING_3');
  };

  const handleSpinEnd = (finalNumber: number) => {
    setIsSpinning(false);

    if (drawPhase === 'SPINNING_1') {
      sound.playWin();
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.55 },
        colors: ['#fbbf24', '#f59e0b', '#d97706'],
      });
      const w1 = pendingDrawWinners.find((w) => w.rank === 1) || pendingDrawWinners[0];
      setRevealedWinnersList([w1]);
      setRevealedDrawStep({
        rank: 1,
        number: w1.number,
        userName: w1.userName,
        userPhone: w1.userPhone,
        prizeAmount: w1.prizeAmount || 3000,
      });
      setDrawPhase('WAITING_2');
      setNextStepCountdown(6);
    } else if (drawPhase === 'SPINNING_2') {
      sound.playWin();
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.55 },
        colors: ['#94a3b8', '#cbd5e1', '#e2e8f0'],
      });
      const w2 = pendingDrawWinners.find((w) => w.rank === 2) || pendingDrawWinners[1] || pendingDrawWinners[0];
      setRevealedWinnersList((prev) => [...prev, w2]);
      setRevealedDrawStep({
        rank: 2,
        number: w2.number,
        userName: w2.userName,
        userPhone: w2.userPhone,
        prizeAmount: w2.prizeAmount || 500,
      });
      setDrawPhase('WAITING_3');
      setNextStepCountdown(6);
    } else if (drawPhase === 'SPINNING_3') {
      sound.playWin();
      const w3 = pendingDrawWinners.find((w) => w.rank === 3) || pendingDrawWinners[2] || pendingDrawWinners[1] || pendingDrawWinners[0];
      setRevealedWinnersList((prev) => [...prev, w3]);
      setRevealedDrawStep({
        rank: 3,
        number: w3.number,
        userName: w3.userName,
        userPhone: w3.userPhone,
        prizeAmount: w3.prizeAmount || 200,
      });
      setDrawPhase('COMPLETED');
      setNextStepCountdown(null);

      setTimeout(() => {
        setIsDrawing(false);
        setDrawPhase('IDLE');
        setRevealedDrawStep(null);
        setGrandWinners(pendingDrawWinners);
        setGrandRoundNum(pendingCompletedRound?.roundNumber || round?.roundNumber || 1);
        confetti({
          particleCount: 220,
          spread: 110,
          origin: { y: 0.5 },
          colors: ['#fbbf24', '#f43f5e', '#10b981', '#38bdf8', '#c084fc'],
        });
        loadActiveRound();
      }, 3500);
    }
  };

  useEffect(() => {
    loadActiveRound();

    // SSE Realtime stream
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(getLiveStreamUrl());

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'round_updated') {
            setRound(data.round);
          } else if (data.type === 'ticket_purchased') {
            sound.playClick();
            setRecentNotification(
              `🔥 Tikkeetii #${data.number} qabameera (${data.userName})`
            );
            setTimeout(() => setRecentNotification(''), 5000);
            loadActiveRound();
          } else if (data.type === 'spin_started') {
            setWinningNumber(data.winningNumber || null);
            setIsSpinning(true);
          } else if (data.type === 'winner_revealed') {
            sound.playWin();
            if (data.winners && data.winners.length > 0) {
              startDrawSequence(data.winners, data.completedRound || { roundNumber: round?.roundNumber || 1 });
            } else {
              confetti({
                particleCount: 200,
                spread: 100,
                origin: { y: 0.5 },
                colors: ['#fbbf24', '#f43f5e', '#10b981', '#38bdf8', '#c084fc'],
              });
              loadActiveRound();
            }
          }
        } catch {}
      };
    } catch {}

    // Polling fallback every 3.5s for seamless TikTok stream connection
    const interval = setInterval(() => {
      loadActiveRound();
    }, 3500);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(interval);
    };
  }, []);

  const loadActiveRound = async () => {
    try {
      const res = await apiFetch('/api/round/active');
      if (res.round) setRound(res.round);
    } catch {}
  };

  const toggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const handleQuickAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignError(null);
    setAssignSuccess(null);

    const slot = Number(assignSlotNum);
    if (!slot || slot < 1 || slot > 100) {
      setAssignError('Lakkoofsi 1 hanga 100 gidduu ta\'uu qaba.');
      return;
    }
    if (!assignName.trim()) {
      setAssignError('Maqaa namaa galchaa.');
      return;
    }

    setIsSubmittingAssign(true);
    try {
      const res = await apiFetch('/api/admin/rounds/assign-slot', {
        method: 'POST',
        body: JSON.stringify({
          number: slot,
          userName: assignName.trim(),
          userPhone: assignPhone.trim() || '0900000000',
        }),
      });

      if (res.success && res.round) {
        setRound(res.round);
        sound.playWin();
        setAssignSuccess(`Tikkeetiin #${slot} maqaa ${assignName.trim()}tiin qabameera!`);
        setRecentNotification(`★ Qabameera: #${slot} (${assignName.trim()})`);
        setAssignSlotNum('');
        setAssignName('');
        setAssignPhone('');
        setTimeout(() => {
          setAssignModalOpen(false);
          setAssignSuccess(null);
        }, 1200);
      } else {
        setAssignError(res.error || 'Qabsiisuun hin danda\'amne.');
      }
    } catch (err: any) {
      setAssignError(err.message || 'Dogoggorri uumameera (Admin authentication required).');
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  // Streamer 50% Quick Claim
  const handleFill50 = async () => {
    setFilling50(true);
    sound.playClick();
    try {
      const res = await apiFetch('/api/admin/rounds/fill-fifty-percent', {
        method: 'POST',
      });
      if (res.round) {
        setRound(res.round);
        sound.playWin();
        setRecentNotification(`✓ Lakkoofsi 50% (50/100) qabameera! Baajanni: ${res.totalPool} ETB`);
      }
    } catch (err: any) {
      alert(err.message || 'Lakkoofsa 50% qabuun hin danda\'amne');
    } finally {
      setFilling50(false);
    }
  };

  // Streamer 100% Full Board Claim ("lakk hundii akka qabamani jiranitii")
  const handleFill100 = async () => {
    setFilling100(true);
    sound.playClick();
    try {
      const res = await apiFetch('/api/admin/rounds/fill-hundred-percent', {
        method: 'POST',
      });
      if (res.round) {
        setRound(res.round);
        sound.playWin();
        setRecentNotification(`✓ Lakkoofsi hundi (100/100) guutameera! Baajanni: ${res.totalPool} ETB`);
      }
    } catch (err: any) {
      alert(err.message || 'Lakkoofsa hunda (100%) qabsiisuun hin danda\'amne');
    } finally {
      setFilling100(false);
    }
  };

  // Streamer Spin / Draw Trigger

  const handleTriggerDraw = async () => {
    setIsDrawing(true);
    sound.playClick();
    try {
      const res = await apiFetch('/api/admin/rounds/draw', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      sound.playWin();
      if (res.success && res.winners && res.winners.length > 0) {
        startDrawSequence(res.winners, res.completedRound || { roundNumber: round?.roundNumber || 1 });
      } else {
        setIsDrawing(false);
        loadActiveRound();
      }
    } catch (err: any) {
      setIsDrawing(false);
      alert(err.message || "Dogoggorri uumameera (Admin permissions required)");
    }
  };

  const claimedNumbers = round
    ? Object.keys(round.selections).map((k) => Number(k))
    : [];

  const numbers = Array.from({ length: 100 }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center selection:bg-amber-500 selection:text-black">
      {/* Top Streamer Header with Live Pool & Bank Accounts */}
      <header className="w-full border-b border-amber-500/40 bg-neutral-900/95 px-3 py-2.5 shadow-2xl backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Live Indicator */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => {
                if (onExit) onExit();
                else window.location.href = '/';
              }}
              className="flex items-center gap-1 rounded-xl border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-xs font-bold text-neutral-400 hover:text-white hover:border-amber-500"
              title="Gara Fuula Duraatti Deebi'i"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden xs:inline">Deebi'i</span>
            </button>

            <div className="flex items-center gap-1.5 rounded-full bg-red-600/20 border border-red-500/60 px-3 py-1">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-ping" />
              <span className="text-[11px] font-black uppercase tracking-wider text-red-400">
                TIKTOK LIVE
              </span>
            </div>

            {/* Streamer Logout / Exit Button placed inside Live TikTok View as requested */}
            {onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center gap-1 rounded-xl border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-xs font-bold text-neutral-400 hover:text-red-400 hover:border-red-500 transition"
                title="Ba'i (Logout)"
              >
                <LogOut className="h-3.5 w-3.5 text-red-400" />
                <span className="hidden sm:inline">Ba'i</span>
              </button>
            )}

            {/* Telegram Channel Link */}
            <a
              href="https://t.me/+FL3pQRdAyCBmN2M8"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-xl border border-sky-500/60 bg-sky-500/20 px-2.5 py-1.5 text-xs font-bold text-sky-300 hover:bg-sky-500/30 transition"
              title="Garee Telegram Keenya Seenaa"
            >
              <Send className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Telegram</span>
            </a>

            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-black tracking-tight text-amber-400 leading-none">
                  SPIN ETHIOPIA
                </h1>
                <button
                  onClick={() => setVerificationModalOpen(true)}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-500/20 px-2 py-0.5 text-[9px] font-black text-emerald-300 hover:bg-emerald-500/30 transition shadow-sm"
                  title="Mirkaneessa Dhugaa Ilaali"
                >
                  <ShieldCheck className="h-3 w-3 text-emerald-400" />
                  <span>{claimedNumbers.length === 50 ? '50% DHUGAA ✓' : `${claimedNumbers.length}/100 DHUGAA`}</span>
                </button>
              </div>
              <span className="text-[10px] text-neutral-400">
                Marsaa #{round?.roundNumber || 1} • {claimedNumbers.length}/100 Qabameera ({claimedNumbers.length}%)
              </span>
            </div>
          </div>

          {/* Bank Accounts Ticker */}
          <div className="hidden md:flex items-center gap-2 text-[11px] rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-1 font-mono">
            <span className="text-neutral-400 font-bold">Kaffaltii:</span>
            <span className="text-amber-300">CBE: 1000218818424</span>
            <span className="text-neutral-600">|</span>
            <span className="text-emerald-400">Awash: 01320561958100</span>
            <span className="text-neutral-600">|</span>
            <span className="text-cyan-300">Telebirr: 0929200166</span>
          </div>

          {/* Jackpot Pool & Layout Controls */}
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-amber-500/50 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 px-3 py-1 text-right">
              <span className="block text-[9px] uppercase font-bold text-amber-300">
                Baajata Badhaasaa
              </span>
              <span className="font-mono text-sm sm:text-base font-black text-amber-400">
                {round?.totalPool.toFixed(2) || '0.00'} ETB
              </span>
            </div>

            {/* Layout Mode Toggle */}
            <div className="flex items-center rounded-xl border border-neutral-800 bg-neutral-950 p-1">
              <button
                onClick={() => setLayoutMode('tiktok')}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition ${
                  layoutMode === 'tiktok'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-neutral-950'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="TikTok Portrait (9:16)"
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">TikTok 9:16</span>
              </button>
              <button
                onClick={() => setLayoutMode('landscape')}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition ${
                  layoutMode === 'landscape'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-neutral-950'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="OBS Studio (16:9)"
              >
                <Monitor className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">OBS 16:9</span>
              </button>
            </div>

            {/* Audio Toggle */}
            <button
              onClick={toggleSound}
              className="rounded-xl border border-neutral-800 bg-neutral-950 p-2 text-neutral-300 hover:text-white"
              title={isMuted ? 'Sagalee Bani' : 'Sagalee Cufi'}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-amber-400" />}
            </button>
          </div>
        </div>

        {/* Mobile Bank Strip */}
        <div className="mt-1.5 flex md:hidden items-center justify-center gap-2 text-[10px] font-mono text-neutral-300 border-t border-neutral-800/60 pt-1.5 overflow-x-auto">
          <span className="text-amber-300 font-bold">CBE: 1000218818424</span>
          <span>•</span>
          <span className="text-emerald-400 font-bold">Awash: 01320561958100</span>
          <span>•</span>
          <span className="text-cyan-300 font-bold">Tele: 0929200166</span>
        </div>
      </header>

      {/* Floating Ticker Notification */}
      {recentNotification && (
        <div className="my-2 rounded-full border-2 border-amber-400 bg-amber-500/30 px-6 py-1.5 text-xs font-black text-amber-300 animate-bounce shadow-xl shadow-amber-500/40">
          <Sparkles className="inline h-4 w-4 mr-1 text-yellow-300 animate-spin" />
          {recentNotification}
        </div>
      )}

      {/* Main Streaming Stage */}
      <main
        className={`w-full mx-auto p-3 sm:p-4 pb-24 ${
          layoutMode === 'tiktok'
            ? 'max-w-xl flex flex-col items-center gap-6'
            : 'max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'
        }`}
      >
        {/* SECTION 1: THE BIG CASINO MACHINE */}
        <div
          className={`flex flex-col items-center justify-center ${
            layoutMode === 'tiktok' ? 'w-full' : 'lg:col-span-5'
          }`}
        >
          <SpinWheel
            winningNumber={winningNumber}
            isSpinning={isSpinning}
            spinKey={spinKey}
            claimedNumbers={claimedNumbers}
            selections={round?.selections || {}}
            winnerInfo={
              !isSpinning && revealedDrawStep
                ? {
                    number: revealedDrawStep.number,
                    userName: revealedDrawStep.userName,
                    userPhone: revealedDrawStep.userPhone,
                    rank: revealedDrawStep.rank,
                    prize: revealedDrawStep.prizeAmount,
                  }
                : !isSpinning && round?.winnerInfo
                ? round.winnerInfo
                : null
            }
            spinDuration={15000}
            onSpinEnd={handleSpinEnd}
          />

          {/* Sequential 3-Step Draw Controls & Status */}
          {drawPhase === 'SPINNING_1' && (
            <div className="w-full mt-3 rounded-2xl border-2 border-amber-400 bg-amber-500/20 py-2.5 px-4 text-center font-black text-amber-300 animate-pulse text-xs sm:text-sm">
              🎡 CARRAA 1FFAA (3,000 ETB) NAANNA'AA JIRA...
            </div>
          )}
          {drawPhase === 'WAITING_2' && (
            <div className="w-full mt-3 space-y-2">
              <div className="rounded-xl border border-amber-400/60 bg-amber-500/10 p-2 text-center text-xs font-bold text-amber-300">
                🥇 Carraa 1ffaa: #{revealedDrawStep?.number} ({revealedDrawStep?.userName}) - 3,000 ETB!
              </div>
              <button
                onClick={triggerStep2}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-yellow-400 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-3 px-4 font-black text-neutral-950 shadow-[0_0_30px_rgba(250,204,21,0.6)] animate-pulse hover:scale-[1.02] transition active:scale-95 text-xs sm:text-sm"
              >
                <span>▶ AMMA CARRAA 2FFAA NAANNESSI (500 ETB) {nextStepCountdown ? `(${nextStepCountdown}s)` : ''}</span>
              </button>
            </div>
          )}
          {drawPhase === 'SPINNING_2' && (
            <div className="w-full mt-3 rounded-2xl border-2 border-amber-400 bg-amber-500/20 py-2.5 px-4 text-center font-black text-amber-300 animate-pulse text-xs sm:text-sm">
              🎡 CARRAA 2FFAA (500 ETB) NAANNA'AA JIRA...
            </div>
          )}
          {drawPhase === 'WAITING_3' && (
            <div className="w-full mt-3 space-y-2">
              <div className="rounded-xl border border-amber-400/60 bg-amber-500/10 p-2 text-center text-xs font-bold text-amber-300">
                🥈 Carraa 2ffaa: #{revealedDrawStep?.number} ({revealedDrawStep?.userName}) - 500 ETB!
              </div>
              <button
                onClick={triggerStep3}
                className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-yellow-400 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-3 px-4 font-black text-neutral-950 shadow-[0_0_30px_rgba(250,204,21,0.6)] animate-pulse hover:scale-[1.02] transition active:scale-95 text-xs sm:text-sm"
              >
                <span>▶ AMMA CARRAA 3FFAA NAANNESSI (200 ETB) {nextStepCountdown ? `(${nextStepCountdown}s)` : ''}</span>
              </button>
            </div>
          )}
          {drawPhase === 'SPINNING_3' && (
            <div className="w-full mt-3 rounded-2xl border-2 border-amber-400 bg-amber-500/20 py-2.5 px-4 text-center font-black text-amber-300 animate-pulse text-xs sm:text-sm">
              🎡 CARRAA 3FFAA (200 ETB) NAANNA'AA JIRA...
            </div>
          )}
          {drawPhase === 'COMPLETED' && (
            <div className="w-full mt-3 rounded-2xl border-2 border-emerald-400 bg-emerald-500/20 py-2.5 px-4 text-center font-black text-emerald-300 text-xs sm:text-sm">
              🎉 MO'ATTOONNI 3NUU BA'ANIIRU!
            </div>
          )}

          {/* Quick Streamer Controls Directly Under Machine */}
          <div className="mt-4 flex w-full flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setAssignModalOpen(true)}
              className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-500 to-yellow-500 px-3 py-2.5 text-xs sm:text-sm font-black text-neutral-950 shadow-lg shadow-amber-500/30 hover:from-amber-400 hover:to-yellow-400 transition active:scale-95"
            >
              <UserPlus className="h-4 w-4" />
              <span>★ Lakk Qabi</span>
            </button>

            <button
              onClick={handleFill50}
              disabled={filling50}
              className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-emerald-500 bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2.5 text-xs sm:text-sm font-black text-white shadow-lg shadow-emerald-950/40 hover:brightness-110 transition active:scale-95 disabled:opacity-50"
              title="Lakkoofsota 50 Maqaa Dhugaatiin Qabi"
            >
              <Sparkles className="h-4 w-4 text-emerald-300" />
              <span>{filling50 ? 'Qabamaa...' : '50% Qabi'}</span>
            </button>

            <button
              onClick={handleFill100}
              disabled={filling100}
              className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-green-400 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 px-3 py-2.5 text-xs sm:text-sm font-black text-white shadow-lg shadow-green-950/40 hover:brightness-110 transition active:scale-95 disabled:opacity-50"
              title="Lakkoofsota Hunda (100/100) Guutumaatti Qabi"
            >
              <Crown className="h-4 w-4 text-yellow-300" />
              <span>{filling100 ? 'Guutamaa...' : '100% Qabi'}</span>
            </button>


            <button
              onClick={() => setVerificationModalOpen(true)}
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-cyan-500/60 bg-neutral-900 px-3 py-2.5 text-xs font-bold text-cyan-300 hover:bg-neutral-800 transition active:scale-95"
              title="Mirkaneessa Dhugaa Ilaali"
            >
              <ShieldCheck className="h-4 w-4 text-cyan-400" />
              <span className="hidden xs:inline">Mirkaneessi</span>
            </button>

            <button
              onClick={handleTriggerDraw}
              disabled={isDrawing || isSpinning}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 rounded-2xl border-2 border-red-500 bg-gradient-to-r from-red-600 via-rose-500 to-red-600 px-3.5 py-2.5 text-xs sm:text-sm font-black text-white shadow-lg shadow-red-500/40 hover:from-red-500 hover:to-rose-400 transition active:scale-95 disabled:opacity-50"
            >
              <Play className="h-4 w-4 fill-white" />
              <span>{isDrawing ? 'Baasaa Jira...' : 'Naannessi (SPIN)'}</span>
            </button>
          </div>
        </div>

        {/* SECTION 2: THE 1–100 HIGH-VISIBILITY BOARD */}
        <div
          className={`space-y-4 ${
            layoutMode === 'tiktok' ? 'w-full' : 'lg:col-span-7'
          }`}
        >
          {/* Board Container with Glowing Gold Border */}
          <div className="rounded-3xl border-2 border-amber-500/50 bg-neutral-900/95 p-3 sm:p-5 shadow-2xl backdrop-blur">
            {/* Board Header */}
            <div className="flex flex-wrap items-center justify-between border-b border-neutral-800 pb-3 mb-3 gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                  <Flame className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wide">
                    Gabatee Lakkoofsa 1–100 (Live Board)
                  </h3>
                  <span className="text-[10px] text-neutral-400">
                    Tikkeetii {claimedNumbers.length}/100 qabameera • Hafte: {100 - claimedNumbers.length}
                  </span>
                </div>
              </div>

              {/* Legend Badges */}
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <div className="flex items-center gap-1 rounded-full bg-neutral-950 border border-neutral-700 px-2 py-0.5 text-neutral-300">
                  <span className="h-2 w-2 rounded-full bg-neutral-600" />
                  <span>Banaa</span>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-rose-600 border border-rose-300 px-2 py-0.5 text-white shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-white" />
                  <span>Qabameera</span>
                </div>
              </div>
            </div>

            {/* 10 x 10 High-Contrast Grid */}
            <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
              {numbers.map((num) => {
                const selection = round?.selections[num];
                const isClaimed = !!selection || claimedNumbers.includes(num);
                const isWinner = isSpinning
                  ? revealedWinnersList.some((w) => w.number === num)
                  : revealedWinnersList.some((w) => w.number === num) ||
                    (round?.winners && round.winners.some((w) => w.number === num));

                let bgClass = 'border border-neutral-700/80 bg-neutral-950 text-white hover:border-amber-400 shadow-sm';
                let numClass = 'text-white font-black text-xs sm:text-sm';

                if (isWinner) {
                  bgClass = 'bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 border-2 border-white text-neutral-950 font-black shadow-lg shadow-yellow-500/50 scale-105 animate-pulse';
                  numClass = 'text-neutral-950 text-sm sm:text-base font-black';
                } else if (isClaimed) {
                  bgClass = 'bg-gradient-to-br from-rose-600 via-red-600 to-rose-700 border border-rose-300 text-white font-black shadow-md shadow-rose-950/40';
                  numClass = 'text-white text-xs sm:text-sm font-black drop-shadow';
                }

                return (
                  <button
                    key={num}
                    onClick={() => {
                      setAssignSlotNum(num.toString());
                      setAssignModalOpen(true);
                      sound.playClick();
                    }}
                    className={`relative flex min-h-[46px] sm:min-h-[54px] flex-col items-center justify-center rounded-xl p-0.5 transition-all duration-150 ${bgClass}`}
                    title={
                      isClaimed
                        ? `#${num}: ${selection?.userName || 'Qabameera'}`
                        : `#${num}: Banaa (Qabachuuf Cuqaasaa)`
                    }
                  >
                    {/* Big Ticket Number */}
                    <span className={`leading-none ${numClass}`}>
                      #{num}
                    </span>

                    {/* Owner Name or Status */}
                    {isWinner ? (
                      <span className="text-[7.5px] font-black uppercase text-neutral-950 tracking-tighter">
                        👑 MO'AA
                      </span>
                    ) : isClaimed ? (
                      <span className="w-full truncate text-center text-[8px] sm:text-[9px] font-black text-white leading-tight mt-0.5 px-0.5 drop-shadow-sm">
                        {selection?.userName ? selection.userName.split(' ')[0] : '★'}
                      </span>
                    ) : (
                      <span className="text-[7.5px] font-bold text-neutral-500 mt-0.5">
                        Banaa
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Prize breakdown summary banner: 1ffaa = 3000 ETB, 2ffaa = 500 ETB, 3ffaa = 200 ETB */}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center pt-2 border-t border-neutral-800">
              <div className="rounded-xl border border-yellow-500/60 bg-yellow-500/15 p-2 shadow-sm">
                <span className="block text-[9px] text-yellow-300 uppercase font-black">1ffaa (1st)</span>
                <span className="font-mono text-xs sm:text-sm font-black text-yellow-300">
                  3,000 ETB
                </span>
              </div>
              <div className="rounded-xl border border-neutral-700 bg-neutral-800/80 p-2">
                <span className="block text-[9px] text-neutral-300 uppercase font-bold">2ffaa (2nd)</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-neutral-200">
                  500 ETB
                </span>
              </div>
              <div className="rounded-xl border border-amber-700/50 bg-amber-900/30 p-2">
                <span className="block text-[9px] text-amber-400 uppercase font-bold">3ffaa (3rd)</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-amber-400">
                  200 ETB
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* STREAMER QUICK ASSIGN MODAL */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border-2 border-amber-500 bg-neutral-950 p-6 text-white shadow-2xl animate-in fade-in zoom-in duration-150">
            <button
              onClick={() => {
                setAssignModalOpen(false);
                setAssignError(null);
                setAssignSuccess(null);
              }}
              className="absolute top-4 right-4 rounded-full bg-neutral-900 p-2 text-neutral-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-neutral-800 pb-4 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-400">
                <UserPlus className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-amber-400">
                  ★ Lakkoofsa Namaaf Qabi
                </h3>
                <p className="text-xs text-neutral-400">
                  TikTok Live ykn bilbilaan nama kaffaleef lakkoofsa galchi
                </p>
              </div>
            </div>

            {assignError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{assignError}</span>
              </div>
            )}

            {assignSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{assignSuccess}</span>
              </div>
            )}

            <form onSubmit={handleQuickAssign} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">
                  Lakkoofsa Tikkeetii (1–100):
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={assignSlotNum}
                  onChange={(e) => setAssignSlotNum(e.target.value)}
                  placeholder="Fkn: 47"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 font-mono text-base font-black text-amber-300 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">
                  Maqaa Abbaa Tikkeetii:
                </label>
                <input
                  type="text"
                  required
                  value={assignName}
                  onChange={(e) => setAssignName(e.target.value)}
                  placeholder="Fkn: Caalaa Tolasaa"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">
                  Lakkoofsa Bilbilaa (Filannoo):
                </label>
                <input
                  type="tel"
                  value={assignPhone}
                  onChange={(e) => setAssignPhone(e.target.value)}
                  placeholder="Fkn: 0912345678"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-2.5 font-mono text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="rounded-xl border border-neutral-700 px-4 py-2.5 text-xs font-bold text-neutral-300 hover:bg-neutral-800"
                >
                  Dhiisi
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAssign}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-2.5 text-xs font-black text-neutral-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isSubmittingAssign ? 'Qabaa Jira...' : 'Mirkaneessi & Qabi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3-Step Spin & Winner Celebration Modal */}
      <DrawCelebrationModal
        currentStep={revealedDrawStep}
        grandWinners={grandWinners}
        roundNumber={grandRoundNum}
        onCloseGrand={() => setGrandWinners(null)}
      />

      {/* Authenticity Verification Proof Modal */}
      <AuthenticityVerificationModal
        isOpen={verificationModalOpen}
        onClose={() => setVerificationModalOpen(false)}
      />
    </div>
  );
};
