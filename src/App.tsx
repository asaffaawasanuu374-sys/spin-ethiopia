import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Wallet,
  ShieldCheck,
  Trophy,
  User as UserIcon,
  LogOut,
  Gift,
  HelpCircle,
  Video,
  Volume2,
  VolumeX,
  CreditCard,
  Crown,
  ChevronRight,
  Flame,
  PlusCircle,
  Bell,
  RefreshCw,
  X,
  CheckCircle2,
  Radio,
  Send,
} from 'lucide-react';
import { User, Round, RoundWinner, TicketSelection } from './types/index';
import { apiFetch, getStoredToken, removeStoredToken, getLiveStreamUrl } from './lib/api';
import { sound } from './lib/sound';
import { SpinWheel } from './components/SpinWheel';
import { NumberGrid, RecentWinnerHighlight } from './components/NumberGrid';
import { AuthModal } from './components/AuthModal';
import { WalletModal } from './components/WalletModal';
import { AdminPanel } from './components/AdminPanel';
import { AdminAccessModal } from './components/AdminAccessModal';
import { ReferralModal } from './components/ReferralModal';
import { HelpModal } from './components/HelpModal';
import { PreviousWinners } from './components/PreviousWinners';
import { TopWinners } from './components/TopWinners';
import { LiveBroadcastView } from './components/LiveBroadcastView';
import { DrawCelebrationModal } from './components/DrawCelebrationModal';

export default function App() {
  const [isLiveMode, setIsLiveMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return (
        window.location.pathname === '/live' ||
        params.get('live') === 'true' ||
        window.location.hash === '#live'
      );
    }
    return false;
  });

  const [user, setUser] = useState<User | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [tickerMessage, setTickerMessage] = useState<string>('');
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [winningNumber, setWinningNumber] = useState<number | null>(null);

  // Modals
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletInitialTab, setWalletInitialTab] = useState<'deposit' | 'withdraw' | 'history'>('deposit');
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminAccessOpen, setAdminAccessOpen] = useState(false);
  const [adminInitialTab, setAdminInitialTab] = useState<
    'dashboard' | 'deposits' | 'withdrawals' | 'rounds' | 'payments' | 'settings' | 'audit' | 'users' | 'obs'
  >('deposits');
  const [referralOpen, setReferralOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [referralCodeFromUrl, setReferralCodeFromUrl] = useState<string>('');

  // Real-time notifications
  const [pendingDepositsCount, setPendingDepositsCount] = useState<number>(0);
  const [adminNotificationsList, setAdminNotificationsList] = useState<Array<{
    id: string;
    userName: string;
    userPhone: string;
    amount: number;
    provider: string;
    transactionId: string;
    receiptUrl?: string;
    time: string;
  }>>([]);
  const [showAdminNotifsDropdown, setShowAdminNotifsDropdown] = useState(false);
  const [adminDepositNotification, setAdminDepositNotification] = useState<{
    id: string;
    userName: string;
    userPhone: string;
    amount: number;
    provider: string;
    transactionId: string;
    receiptUrl?: string;
    time: string;
  } | null>(null);
  const [userCreditedNotification, setUserCreditedNotification] = useState<{
    amount: number;
    newBalance: number;
    provider?: string;
  } | null>(null);

  // 3-step draw celebration state
  const [revealedDrawStep, setRevealedDrawStep] = useState<{
    rank: 1 | 2 | 3;
    number: number;
    userName: string;
    userPhone?: string;
    prizeAmount: number;
  } | null>(null);
  const [grandWinners, setGrandWinners] = useState<RoundWinner[] | null>(null);
  const [grandRoundNum, setGrandRoundNum] = useState<number>(1);
  const [isDrawingProcess, setIsDrawingProcess] = useState(false);
  const [recentWinners, setRecentWinners] = useState<RecentWinnerHighlight[]>([]);
  const [revealedWinnersList, setRevealedWinnersList] = useState<RecentWinnerHighlight[]>([]);

  // Sequential Draw Phases:
  // IDLE -> SPINNING_1 -> WAITING_2 -> SPINNING_2 -> WAITING_3 -> SPINNING_3 -> COMPLETED
  const [drawPhase, setDrawPhase] = useState<
    'IDLE' | 'SPINNING_1' | 'WAITING_2' | 'SPINNING_2' | 'WAITING_3' | 'SPINNING_3' | 'COMPLETED'
  >('IDLE');
  const [pendingDrawWinners, setPendingDrawWinners] = useState<RoundWinner[] | null>(null);
  const [completedRoundRef, setCompletedRoundRef] = useState<any>(null);
  const [spinKey, setSpinKey] = useState<number>(1);
  const [nextStepCountdown, setNextStepCountdown] = useState<number | null>(null);

  const startDrawSequence = (winners: RoundWinner[], completedRound: any) => {
    if (!winners || winners.length === 0) return;
    setIsDrawingProcess(true);
    setPendingDrawWinners(winners);
    setCompletedRoundRef(completedRound);
    // Clear previously revealed winners so nothing is shown before the wheel finishes spinning
    setRevealedWinnersList([]);
    setRecentWinners([]);
    setRevealedDrawStep(null);

    // Step 1: 1ffaa (3,000 ETB)
    const w1 = winners.find((w) => w.rank === 1) || winners[0];
    setDrawPhase('SPINNING_1');
    setWinningNumber(w1.number);
    setSpinKey(Date.now());
    setIsSpinning(true);
  };

  const triggerStep2 = () => {
    if (!pendingDrawWinners || isSpinning) return;
    setNextStepCountdown(null);
    const w2 = pendingDrawWinners.find((w) => w.rank === 2) || pendingDrawWinners[1] || pendingDrawWinners[0];
    setDrawPhase('SPINNING_2');
    setRevealedDrawStep(null);
    setWinningNumber(w2.number);
    setSpinKey(Date.now());
    setIsSpinning(true);
    sound.playClick();
  };

  const triggerStep3 = () => {
    if (!pendingDrawWinners || isSpinning) return;
    setNextStepCountdown(null);
    const w3 = pendingDrawWinners.find((w) => w.rank === 3) || pendingDrawWinners[2] || pendingDrawWinners[1] || pendingDrawWinners[0];
    setDrawPhase('SPINNING_3');
    setRevealedDrawStep(null);
    setWinningNumber(w3.number);
    setSpinKey(Date.now());
    setIsSpinning(true);
    sound.playClick();
  };

  const handleSpinEnd = (finalNumber: number) => {
    setIsSpinning(false);
    if (!pendingDrawWinners) return;

    if (drawPhase === 'SPINNING_1') {
      const w1 = pendingDrawWinners.find((w) => w.rank === 1) || pendingDrawWinners[0];
      const win1Highlight: RecentWinnerHighlight = {
        number: w1.number,
        rank: 1,
        userName: w1.userName,
        prizeAmount: w1.prizeAmount || 3000,
        roundNumber: completedRoundRef?.roundNumber || round?.roundNumber || 1,
      };
      setRevealedWinnersList([win1Highlight]);
      setRecentWinners([win1Highlight]);
      setRevealedDrawStep({
        rank: 1,
        number: w1.number,
        userName: w1.userName,
        userPhone: w1.userPhone,
        prizeAmount: w1.prizeAmount || 3000,
      });
      setDrawPhase('WAITING_2');
      sound.playWin();
      setNextStepCountdown(6);
    } else if (drawPhase === 'SPINNING_2') {
      const w2 = pendingDrawWinners.find((w) => w.rank === 2) || pendingDrawWinners[1] || pendingDrawWinners[0];
      const win2Highlight: RecentWinnerHighlight = {
        number: w2.number,
        rank: 2,
        userName: w2.userName,
        prizeAmount: w2.prizeAmount || 500,
        roundNumber: completedRoundRef?.roundNumber || round?.roundNumber || 1,
      };
      setRevealedWinnersList((prev) => [...prev, win2Highlight]);
      setRecentWinners((prev) => [...prev, win2Highlight]);
      setRevealedDrawStep({
        rank: 2,
        number: w2.number,
        userName: w2.userName,
        userPhone: w2.userPhone,
        prizeAmount: w2.prizeAmount || 500,
      });
      setDrawPhase('WAITING_3');
      sound.playWin();
      setNextStepCountdown(6);
    } else if (drawPhase === 'SPINNING_3') {
      const w3 = pendingDrawWinners.find((w) => w.rank === 3) || pendingDrawWinners[2] || pendingDrawWinners[1] || pendingDrawWinners[0];
      const win3Highlight: RecentWinnerHighlight = {
        number: w3.number,
        rank: 3,
        userName: w3.userName,
        prizeAmount: w3.prizeAmount || 200,
        roundNumber: completedRoundRef?.roundNumber || round?.roundNumber || 1,
      };
      setRevealedWinnersList((prev) => [...prev, win3Highlight]);
      setRecentWinners((prev) => [...prev, win3Highlight]);
      setRevealedDrawStep({
        rank: 3,
        number: w3.number,
        userName: w3.userName,
        userPhone: w3.userPhone,
        prizeAmount: w3.prizeAmount || 200,
      });
      setDrawPhase('COMPLETED');
      sound.playWin();
      setTimeout(() => {
        setIsDrawingProcess(false);
        setDrawPhase('IDLE');
        setRevealedDrawStep(null);
        setGrandWinners(pendingDrawWinners);
        setGrandRoundNum(completedRoundRef?.roundNumber || round?.roundNumber || 1);
        loadActiveRound();
        loadCurrentUser();
      }, 3500);
    }
  };

  // Auto-countdown ticker to advance to next prize if not clicked manually
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

  const userRef = useRef<User | null>(null);

  useEffect(() => {
    userRef.current = user;
    if (user && (user.role === 'ADMIN' || user.phone === '0929200166')) {
      fetchAdminMetrics();
    }
  }, [user]);

  const fetchAdminMetrics = async () => {
    try {
      const res = await apiFetch('/api/admin/metrics');
      if (res.metrics?.pendingDeposits !== undefined) {
        setPendingDepositsCount(res.metrics.pendingDeposits);
      }
    } catch {}
  };

  useEffect(() => {
    // Check URL parameters for referral code or auth prompt
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (ref) {
        setReferralCodeFromUrl(ref);
        setAuthMode('register');
        setAuthOpen(true);
      }
      if (params.get('login') === 'true') {
        setAuthMode('login');
        setAuthOpen(true);
      }
      if (params.get('admin') === 'true' || window.location.hash === '#admin' || window.location.pathname === '/admin') {
        setAdminAccessOpen(true);
      }
    }

    loadCurrentUser();
    loadActiveRound();

    // Fetch initial pending deposits count and latest pending deposit
    const loadInitialStats = async () => {
      try {
        const pmRes = await apiFetch('/api/payment-methods');
        if (pmRes.pendingDepositsCount !== undefined) {
          setPendingDepositsCount(pmRes.pendingDepositsCount);
        }
        if (pmRes.latestPendingDeposit) {
          setAdminDepositNotification(pmRes.latestPendingDeposit);
          setAdminNotificationsList([pmRes.latestPendingDeposit]);
        }
      } catch {}
    };
    loadInitialStats();

    // Polling fallback every 4 seconds to guarantee admin is notified even if SSE drops
    const pollInterval = setInterval(async () => {
      try {
        const pmRes = await apiFetch('/api/payment-methods');
        if (pmRes.pendingDepositsCount !== undefined) {
          setPendingDepositsCount((prev) => {
            if (pmRes.pendingDepositsCount > prev && pmRes.pendingDepositsCount > 0) {
              sound.playUrgentDepositAlert();
              if (pmRes.latestPendingDeposit) {
                setAdminDepositNotification(pmRes.latestPendingDeposit);
                setAdminNotificationsList((list) => [pmRes.latestPendingDeposit, ...list.filter((d) => d.id !== pmRes.latestPendingDeposit.id)].slice(0, 10));
              }
            }
            return pmRes.pendingDepositsCount;
          });
        }
      } catch {}
    }, 4000);

    // SSE connection for live draws, tickets, and instant deposit alerts
    const eventSource = new EventSource(getLiveStreamUrl());

    const handleSseMessage = (data: any) => {
      if (!data) return;

      if (data.pendingDepositsCount !== undefined) {
        setPendingDepositsCount(data.pendingDepositsCount);
      }

      if (data.type === 'round_updated') {
        setRound(data.round);
      } else if (data.type === 'ticket_purchased') {
        sound.playClick();
        setTickerMessage(`Tikkeetii #${data.number} qabameera (${data.userName})`);
        setTimeout(() => setTickerMessage(''), 4000);
        loadActiveRound();
      } else if (data.type === 'spin_started') {
        setWinningNumber(data.winningNumber || null);
        setIsSpinning(true);
      } else if (data.type === 'winner_revealed') {
        sound.playWin();
        if (data.winners && data.winners.length > 0) {
          startDrawSequence(data.winners, data.completedRound || { roundNumber: round?.roundNumber || 1 });
        } else {
          loadActiveRound();
          loadCurrentUser();
        }
      } else if (data.type === 'deposit_submitted') {
        // Real-time notification: Always alert & display floating card so admin or manager sees it instantly!
        if (data.pendingDepositsCount !== undefined) {
          setPendingDepositsCount(data.pendingDepositsCount);
        } else {
          setPendingDepositsCount((prev) => prev + 1);
        }

        const newNotifItem = {
          id: data.depositId || Date.now().toString(),
          userName: data.userName || 'Fayyadamaa',
          userPhone: data.userPhone || '',
          amount: data.amount,
          provider: data.provider || 'Baankii',
          transactionId: data.transactionId || '',
          receiptUrl: data.receiptUrl,
          time: new Date().toLocaleTimeString(),
        };

        setAdminNotificationsList((prev) => [newNotifItem, ...prev.filter((d) => d.id !== newNotifItem.id)].slice(0, 10));
        sound.playUrgentDepositAlert();
        setAdminDepositNotification(newNotifItem);

        // Browser Push Notification
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'granted') {
            try {
              const notif = new Notification(`🔔 Kaffaltii Haaraa: ${data.amount} ETB!`, {
                body: `${data.userName || 'Fayyadamaa'} (${data.userPhone || ''}) FT: ${data.transactionId || ''}. Mirkaneessuuf tuqaa!`,
                icon: '/favicon.ico',
              });
              notif.onclick = () => {
                window.focus();
                setAdminInitialTab('deposits');
                setAdminOpen(true);
              };
            } catch {}
          }
        }
      } else if (data.type === 'deposit_approved') {
        const current = userRef.current;
        if (data.pendingDepositsCount !== undefined) {
          setPendingDepositsCount(data.pendingDepositsCount);
        } else {
          setPendingDepositsCount((prev) => Math.max(0, prev - 1));
        }

        setAdminNotificationsList((prev) => prev.filter((d) => d.id !== data.depositId));
        setAdminDepositNotification((prev) => (prev && prev.id === data.depositId ? null : prev));

        // User wallet credited immediately within seconds!
        if (current && (current.id === data.userId || current.phone === data.userPhone)) {
          setUser((prev) => (prev ? { ...prev, walletBalance: data.newBalance } : null));
          sound.playCoin();
          setUserCreditedNotification({
            amount: data.amount,
            newBalance: data.newBalance,
            provider: data.deposit?.provider || 'Baankii',
          });
          setTimeout(() => {
            setUserCreditedNotification(null);
          }, 9000);
        }
      } else if (data.type === 'deposit_rejected') {
        const current = userRef.current;
        if (data.pendingDepositsCount !== undefined) {
          setPendingDepositsCount(data.pendingDepositsCount);
        } else {
          setPendingDepositsCount((prev) => Math.max(0, prev - 1));
        }

        setAdminNotificationsList((prev) => prev.filter((d) => d.id !== data.depositId));
        setAdminDepositNotification((prev) => (prev && prev.id === data.depositId ? null : prev));

        if (current && (current.id === data.userId || current.phone === data.userPhone)) {
          setTickerMessage(`Kaffaltiin keessan kuffifameera: ${data.reason || 'Ragaan hin mirkanoofne'}`);
          setTimeout(() => setTickerMessage(''), 7000);
        }
      }
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSseMessage(data);
      } catch {}
    };

    eventSource.addEventListener('deposit_submitted', (event: any) => {
      try {
        const data = JSON.parse(event.data);
        handleSseMessage(data);
      } catch {}
    });

    eventSource.addEventListener('deposit_approved', (event: any) => {
      try {
        const data = JSON.parse(event.data);
        handleSseMessage(data);
      } catch {}
    });

    const handleLocalDepositSubmitted = (event: any) => {
      const data = event.detail;
      if (data) {
        handleSseMessage({
          type: 'deposit_submitted',
          ...data,
          depositId: data.id || data.depositId,
        });
      }
    };
    window.addEventListener('spin_deposit_submitted', handleLocalDepositSubmitted);

    return () => {
      eventSource.close();
      clearInterval(pollInterval);
      window.removeEventListener('spin_deposit_submitted', handleLocalDepositSubmitted);
    };
  }, []);

  const loadCurrentUser = async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.user) {
        setUser(res.user);
      } else {
        removeStoredToken();
        setUser(null);
      }
    } catch {
      removeStoredToken();
      setUser(null);
    }
  };

  const loadActiveRound = async () => {
    try {
      const res = await apiFetch('/api/round/active');
      if (res.round) {
        setRound(res.round);
      }
      // Populate recent winners for persistent highlights in NumberGrid
      const histRes = await apiFetch('/api/round/history').catch(() => null);
      if (histRes?.history && histRes.history.length > 0) {
        const latestCompleted = histRes.history[0];
        if (latestCompleted?.winners && latestCompleted.winners.length > 0) {
          setRecentWinners(
            latestCompleted.winners.map((w: any) => ({
              number: w.number,
              rank: w.rank,
              userName: w.userName,
              prizeAmount: w.prizeAmount,
              roundNumber: latestCompleted.roundNumber,
            }))
          );
        }
      }
    } catch {}
  };

  const handleQuickApproveDeposit = async (depositId: string) => {
    try {
      sound.playClick();
      const res = await apiFetch('/api/admin/deposits/approve', {
        method: 'POST',
        body: JSON.stringify({ depositId }),
      });
      if (res.success) {
        sound.playCoin();
        setAdminDepositNotification(null);
        setAdminNotificationsList((prev) => prev.filter((d) => d.id !== depositId));
        setPendingDepositsCount((prev) => Math.max(0, prev - 1));
        fetchAdminMetrics();
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('Admin') || err.message.includes('Authentication') || err.message.includes('seensaa') || err.message.includes('Hayyama'))) {
        setAdminAccessOpen(true);
      } else {
        alert(err.message || "Mirkaneessi hin danda'amne");
      }
    }
  };

  const handleSelectNumber = async (number: number) => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    const res = await apiFetch('/api/round/select-ticket', {
      method: 'POST',
      body: JSON.stringify({ number }),
    });
    setRound(res.round);
    loadCurrentUser();
  };

  const handleAdminAssignSlot = async (number: number, userName: string, userPhone: string) => {
    const res = await apiFetch('/api/admin/rounds/assign-slot', {
      method: 'POST',
      body: JSON.stringify({ number, userName, userPhone }),
    });
    if (res.success && res.round) {
      setRound(res.round);
      loadActiveRound();
      loadCurrentUser();
    }
  };

  const handleAdminReleaseSlot = async (number: number) => {
    sound.playClick();
    const res = await apiFetch('/api/admin/rounds/release-slot', {
      method: 'POST',
      body: JSON.stringify({ number }),
    });
    if (res.success && res.round) {
      setRound(res.round);
      loadActiveRound();
    }
  };

  const handleAdminBulkAssignSlots = async (numbers: number[], userName: string, userPhone: string) => {
    sound.playClick();
    const res = await apiFetch('/api/admin/rounds/bulk-assign', {
      method: 'POST',
      body: JSON.stringify({ numbers, userName, userPhone }),
    });
    if (res.success && res.round) {
      sound.playWin();
      setRound(res.round);
      loadActiveRound();
    }
  };

  const handleAdminBulkReleaseSlots = async (numbers: number[]) => {
    sound.playClick();
    const res = await apiFetch('/api/admin/rounds/bulk-release', {
      method: 'POST',
      body: JSON.stringify({ numbers }),
    });
    if (res.success && res.round) {
      setRound(res.round);
      loadActiveRound();
    }
  };

  const handleAdminFillSimulated = async (count: number) => {
    sound.playClick();
    const res = await apiFetch('/api/admin/rounds/fill-simulated', {
      method: 'POST',
      body: JSON.stringify({ count }),
    });
    if (res.success && res.round) {
      sound.playWin();
      setRound(res.round);
      loadActiveRound();
    }
  };

  const handleAdminClearSimulated = async () => {
    sound.playClick();
    const res = await apiFetch('/api/admin/rounds/clear-simulated', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (res.success && res.round) {
      setRound(res.round);
      loadActiveRound();
    }
  };

  const handleAdminTriggerDraw = async () => {
    setIsDrawingProcess(true);
    sound.playClick();
    try {
      const res = await apiFetch('/api/admin/rounds/draw', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res.success && res.winners && res.winners.length > 0) {
        sound.playWin();
        startDrawSequence(res.winners, res.completedRound || { roundNumber: round?.roundNumber || 1 });
      } else {
        setIsDrawingProcess(false);
        loadActiveRound();
      }
    } catch (err: any) {
      setIsDrawingProcess(false);
      if (err.message && (err.message.includes('Admin') || err.message.includes('Authentication') || err.message.includes('seensaa') || err.message.includes('Hayyama'))) {
        setAdminAccessOpen(true);
      } else {
        alert(err.message || "Dogoggorri uumameera");
      }
    }
  };

  const handleLogout = () => {
    removeStoredToken();
    setUser(null);
    sound.playClick();
  };

  const toggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const claimedNumbers = round
    ? Object.keys(round.selections).map((k) => Number(k))
    : [];

  const userTickets = user && round
    ? (Object.entries(round.selections) as [string, TicketSelection][])
        .filter(([_, sel]) => sel.userId === user.id)
        .map(([num]) => Number(num))
    : [];

  const winningNumbers = isSpinning
    ? revealedWinnersList.map((w) => w.number)
    : Array.from(
        new Set([
          ...revealedWinnersList.map((w) => w.number),
          ...(round?.winners ? round.winners.map((w) => w.number) : []),
        ])
      );

  if (isLiveMode) {
    return <LiveBroadcastView onExit={() => setIsLiveMode(false)} onLogout={user ? handleLogout : undefined} />;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-amber-500 selection:text-neutral-950">
      {/* Top Navigation Bar */}
      <nav className="sticky top-0 z-40 border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 font-black text-neutral-950 shadow-lg shadow-amber-500/25">
              SP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-white sm:text-xl">
                  SPIN <span className="text-amber-400">ETHIOPIA</span>
                </span>
                <span className="hidden rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300 sm:inline-block">
                  1–100 LUCKY DRAW
                </span>
              </div>
              <p className="text-[10px] text-neutral-400">
                Caaraa fi Badhaasa Guddaa Itoophiyaa
              </p>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Telegram Channel Join Link */}
            <a
              href="https://t.me/+FL3pQRdAyCBmN2M8"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-sky-500/60 bg-gradient-to-r from-sky-600/25 to-blue-600/25 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-black text-sky-300 hover:bg-sky-600/35 shadow-md shadow-sky-500/20 transition active:scale-95"
              title="Garee Telegram Keenya Seenaa"
            >
              <Send className="h-4 w-4 text-sky-400" />
              <span className="hidden xs:inline">Telegram</span>
            </a>

            {/* TikTok Live Stream Button & Logout Button beside it */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setIsLiveMode(true);
                  sound.playClick();
                }}
                className="flex items-center gap-1.5 rounded-xl border border-red-500/60 bg-gradient-to-r from-red-600/25 to-rose-600/25 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-black text-red-300 hover:bg-red-600/35 shadow-md shadow-red-500/20 transition active:scale-95"
                title="TikTok Live Mode (Streamer & Big Screen View)"
              >
                <Radio className="h-4 w-4 text-red-400 animate-pulse" />
                <span className="hidden xs:inline">TikTok Live</span>
              </button>
              {user && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 rounded-xl border border-neutral-800 bg-neutral-900/90 px-2 sm:px-2.5 py-1.5 sm:py-2 text-xs font-semibold text-neutral-400 hover:text-red-400 hover:border-red-500/40 transition"
                  title="Ba'i (Logout)"
                >
                  <LogOut className="h-3.5 w-3.5 text-red-400" />
                  <span className="hidden sm:inline text-[11px]">Ba'i</span>
                </button>
              )}
            </div>

            {/* Sound Toggle */}
            <button
              onClick={toggleSound}
              className="rounded-xl border border-neutral-800 bg-neutral-900 p-2 text-neutral-400 hover:text-white"
              title={isMuted ? 'Sagalee Bani' : 'Sagalee Cufi'}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-amber-400" />}
            </button>

            {/* Help Button */}
            <button
              onClick={() => {
                setHelpOpen(true);
                sound.playClick();
              }}
              className="rounded-xl border border-neutral-800 bg-neutral-900 p-2 text-neutral-400 hover:text-white"
              title="Akkaataa Taphichaa"
            >
              <HelpCircle className="h-4 w-4" />
            </button>

            {/* If Logged In */}
            {user ? (
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Balance & Deposit Button */}
                <div className="flex items-center rounded-xl border border-amber-500/40 bg-neutral-900 px-3 py-1.5 shadow-sm">
                  <div className="mr-2 text-right">
                    <span className="block text-[9px] uppercase font-bold text-neutral-400">Haftee</span>
                    <span className="font-mono text-sm font-black text-emerald-400">
                      {user.walletBalance.toFixed(2)} ETB
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setWalletInitialTab('deposit');
                      setWalletOpen(true);
                      sound.playClick();
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-neutral-950 font-bold hover:bg-amber-400 transition"
                    title="Galii (Deposit)"
                  >
                    <PlusCircle className="h-4 w-4" />
                  </button>
                </div>

                {/* Referral Button */}
                <button
                  onClick={() => {
                    setReferralOpen(true);
                    sound.playClick();
                  }}
                  className="hidden items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20 md:flex"
                >
                  <Gift className="h-4 w-4" />
                  <span>Afeerraa (+25 ETB)</span>
                </button>

                {/* Admin Button if Logged In as Admin */}
                {(user.role === 'ADMIN' || user.phone === '0929200166') ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setAdminInitialTab('deposits');
                        setAdminOpen(true);
                        sound.playClick();
                      }}
                      className="relative flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-black text-neutral-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-yellow-400"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>Admin Panel</span>
                      {pendingDepositsCount > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white ring-2 ring-neutral-950 animate-bounce">
                          {pendingDepositsCount}
                        </span>
                      )}
                    </button>

                    {/* Admin Quick Notification Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setShowAdminNotifsDropdown(!showAdminNotifsDropdown)}
                        className="relative rounded-xl border border-amber-500/30 bg-neutral-900 p-2 text-neutral-300 hover:text-amber-300"
                        title="Beeksisa Kaffaltii"
                      >
                        <Bell className="h-4 w-4" />
                        {pendingDepositsCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-black text-white ring-2 ring-neutral-950 animate-pulse">
                            {pendingDepositsCount}
                          </span>
                        )}
                      </button>

                      {showAdminNotifsDropdown && (
                        <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-amber-500/30 bg-neutral-950 p-3 text-white shadow-2xl z-50">
                          <div className="flex items-center justify-between border-b border-neutral-800 pb-2 mb-2">
                            <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                              <Bell className="h-3.5 w-3.5" />
                              Kaffaltiiwwan Eegaa Jiran ({pendingDepositsCount})
                            </span>
                            <button
                              onClick={() => setShowAdminNotifsDropdown(false)}
                              className="text-neutral-500 hover:text-white text-xs"
                            >
                              ✕
                            </button>
                          </div>
                          {adminNotificationsList.length === 0 && pendingDepositsCount === 0 ? (
                            <p className="py-4 text-center text-xs text-neutral-500">
                              Kaffaltiin eegaa jiru hin jiru
                            </p>
                          ) : (
                            <div className="max-h-64 overflow-y-auto space-y-2">
                              {adminNotificationsList.map((item) => (
                                <div
                                  key={item.id}
                                  className="rounded-xl border border-neutral-800 bg-neutral-900/90 p-2.5 text-xs"
                                >
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="font-bold text-white">{item.userName} ({item.userPhone})</p>
                                      <p className="text-[11px] text-neutral-400 font-mono">FT: {item.transactionId} • {item.provider}</p>
                                    </div>
                                    <span className="font-mono font-black text-emerald-400">{item.amount} ETB</span>
                                  </div>
                                  <div className="mt-2 flex gap-1.5">
                                    <button
                                      onClick={() => handleQuickApproveDeposit(item.id)}
                                      className="flex-1 rounded-lg bg-emerald-600 py-1 text-[11px] font-bold text-white hover:bg-emerald-500"
                                    >
                                      Mirkaneessi
                                    </button>
                                    <button
                                      onClick={() => {
                                        setAdminInitialTab('deposits');
                                        setAdminOpen(true);
                                        setShowAdminNotifsDropdown(false);
                                      }}
                                      className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1 text-[11px] font-semibold text-neutral-300 hover:text-white"
                                    >
                                      Ilaali
                                    </button>
                                  </div>
                                </div>
                              ))}
                              <button
                                onClick={() => {
                                  setAdminInitialTab('deposits');
                                  setAdminOpen(true);
                                  setShowAdminNotifsDropdown(false);
                                }}
                                className="w-full mt-2 rounded-xl bg-amber-500/10 border border-amber-500/30 py-1.5 text-center text-xs font-bold text-amber-300 hover:bg-amber-500/20"
                              >
                                Galmee Kaffaltii Hunda Bani →
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setAdminAccessOpen(true);
                      sound.playClick();
                    }}
                    className="relative flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-neutral-900 px-3 py-1.5 text-xs font-bold text-neutral-300 hover:text-amber-400 hover:border-amber-400 transition"
                    title="Seensa Admin"
                  >
                    <ShieldCheck className="h-4 w-4 text-amber-400" />
                    <span className="hidden sm:inline">Admin</span>
                    {pendingDepositsCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white ring-2 ring-neutral-950 animate-bounce">
                        {pendingDepositsCount}
                      </span>
                    )}
                  </button>
                )}
              </div>
            ) : (
              /* If Not Logged In - Clean player buttons + Admin Quick Access */
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => {
                    setAdminAccessOpen(true);
                    sound.playClick();
                  }}
                  className="relative flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-neutral-900/90 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-bold text-amber-400 hover:border-amber-400 hover:bg-neutral-800"
                  title="Qondaala (Admin Portal)"
                >
                  <ShieldCheck className="h-4 w-4 text-amber-400" />
                  <span className="hidden sm:inline">Admin</span>
                  {pendingDepositsCount > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white ring-1 ring-neutral-950 animate-bounce">
                      {pendingDepositsCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => {
                    setAuthMode('login');
                    setAuthOpen(true);
                    sound.playClick();
                  }}
                  className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-neutral-300 hover:border-amber-500 hover:text-white"
                >
                  Seeni
                </button>
                <button
                  onClick={() => {
                    setAuthMode('register');
                    setAuthOpen(true);
                    sound.playClick();
                  }}
                  className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-bold text-neutral-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-yellow-400"
                >
                  Galmaa'i
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Live Activity & Notifications Ticker */}
      {tickerMessage && (
        <div className="bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border-b border-amber-500/30 py-1.5 px-4 text-center text-xs font-bold text-amber-300 flex items-center justify-center gap-2 animate-pulse">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span>{tickerMessage}</span>
        </div>
      )}

      {/* Official Payment Accounts Notice Banner */}
      <section className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
        <div className="rounded-2xl border border-amber-500/30 bg-neutral-900/80 p-4 shadow-lg backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Herregawwan Kaffaltii Mirkanaa'an (Official Payment Destinations)
                </h4>
                <p className="text-[11px] text-neutral-400">
                  Kaffaltiin kamiyyuu gara herregawwan kanaatti kaffalamee ragaan (receipt) Admin biratti ilaallamee mirkanaa'a.
                </p>
              </div>
            </div>

            {/* 3 Main Destinations + Telegram Channel */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <a
                href="https://t.me/+FL3pQRdAyCBmN2M8"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-sky-500/50 bg-sky-500/20 px-3 py-1.5 font-bold text-sky-300 hover:bg-sky-500/30 flex items-center gap-1.5 transition"
                title="Garee Telegram Keenya Seenaa"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Telegram Keenya Seenaa</span>
              </a>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-1.5">
                <span className="text-[10px] text-neutral-500 block">Baankii CBE:</span>
                <span className="font-mono font-bold text-amber-300">1000218818424</span>
                <span className="text-[10px] text-neutral-400 block truncate">Asefa Wasenu Tadese</span>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-1.5">
                <span className="text-[10px] text-neutral-500 block">Baankii Awash:</span>
                <span className="font-mono font-bold text-amber-300">01320561958100</span>
                <span className="text-[10px] text-neutral-400 block truncate">Asefa Wasenu Tadese</span>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-1.5">
                <span className="text-[10px] text-neutral-500 block">Telebirr:</span>
                <span className="font-mono font-bold text-amber-300">0929200166</span>
                <span className="text-[10px] text-neutral-400 block truncate">Gabre shifaraa hayilu</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Machine & Number Grid Layout - Snug and tightly coupled ("debelayiti fi mashinin wan iraa aka hin fagane") */}
      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 space-y-4">
        {/* Section 1: The Pure Machine & Prizes (3000, 500, 200 ETB) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* Wheel Machine - Centered, Large, with Radiant Perimeter Lights */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center">
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
              userTickets={userTickets}
              spinDuration={15000}
              onSpinEnd={handleSpinEnd}
            />

            {/* Sequential 3-Step Draw Controls & Status directly under machine */}
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
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-yellow-400 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-3.5 px-4 font-black text-neutral-950 shadow-[0_0_30px_rgba(250,204,21,0.6)] animate-pulse hover:scale-[1.02] transition active:scale-95 text-xs sm:text-sm cursor-pointer"
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
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-yellow-400 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-3.5 px-4 font-black text-neutral-950 shadow-[0_0_30px_rgba(250,204,21,0.6)] animate-pulse hover:scale-[1.02] transition active:scale-95 text-xs sm:text-sm cursor-pointer"
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
          </div>

          {/* Active Round Info & Fixed Prize Pool (1ffaa = 3000, 2ffaa = 500, 3ffaa = 200) */}
          <div className="lg:col-span-6 space-y-3">
            <div className="rounded-3xl border border-amber-500/30 bg-neutral-900/90 p-5 sm:p-6 shadow-xl relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 h-36 w-36 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />

              {/* Eye-catching, highly legible concise banner beside the machine ("mashini cinatii ... caaraa kee yaali") */}
              <div className="mb-4 flex items-center justify-between rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 p-3.5 text-neutral-950 shadow-[0_0_30px_rgba(245,158,11,0.5)]">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-950 text-xl font-black text-amber-400 shadow-md">
                    🎯
                  </span>
                  <div>
                    <h3 className="text-base sm:text-lg font-black uppercase tracking-wider text-neutral-950 leading-tight">
                      CARRAA KEE YAALI!
                    </h3>
                    <p className="text-xs font-black text-neutral-900 leading-tight">
                      Lakkoofsa 1–100 Filadhu • Badhaasa 3,000 ETB
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="rounded-xl border border-neutral-950/20 bg-neutral-950 px-3 py-1.5 font-mono text-xs font-black text-yellow-300 shadow">
                    50 ETB
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-300">
                    Marsaa Ammaa #{round?.roundNumber || 1}
                  </span>
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                    BANAADHA
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-neutral-400">Tikkeetii:</span>
                  <div className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 font-mono font-bold text-rose-300 text-xs sm:text-sm">
                    {claimedNumbers.length}/100 Qabameera
                  </div>
                </div>
              </div>

              {/* Fixed Prize Hierarchy: 1ffaa = 3000, 2ffaa = 500, 3ffaa = 200 */}
              <div className="grid grid-cols-3 gap-2.5 pt-2">
                <div className="rounded-2xl border-2 border-yellow-400/80 bg-gradient-to-b from-yellow-500/15 to-neutral-950 p-3 text-center shadow-lg shadow-yellow-500/10">
                  <Crown className="mx-auto h-5 w-5 text-yellow-400 mb-1" />
                  <span className="block text-[10px] uppercase font-black text-yellow-300">1ffaa (1st)</span>
                  <span className="font-mono text-base sm:text-lg font-black text-yellow-300">
                    3,000 ETB
                  </span>
                </div>
                <div className="rounded-2xl border border-neutral-700 bg-neutral-950 p-3 text-center">
                  <Trophy className="mx-auto h-5 w-5 text-neutral-300 mb-1" />
                  <span className="block text-[10px] uppercase font-bold text-neutral-300">2ffaa (2nd)</span>
                  <span className="font-mono text-base sm:text-lg font-bold text-neutral-200">
                    500 ETB
                  </span>
                </div>
                <div className="rounded-2xl border border-amber-800/60 bg-neutral-950 p-3 text-center">
                  <Trophy className="mx-auto h-5 w-5 text-amber-500 mb-1" />
                  <span className="block text-[10px] uppercase font-bold text-amber-400">3ffaa (3rd)</span>
                  <span className="font-mono text-base sm:text-lg font-bold text-amber-400">
                    200 ETB
                  </span>
                </div>
              </div>

              {/* Full 100-ticket Trigger Banner: Admin Spin or Player Prompt */}
              {claimedNumbers.length >= 100 ? (
                <button
                  id="btn-spin-100-full"
                  onClick={() => {
                    if (user && (user.role === 'ADMIN' || user.phone === '0929200166')) {
                      handleAdminTriggerDraw();
                    } else {
                      setAdminAccessOpen(true);
                      sound.playClick();
                    }
                  }}
                  disabled={isDrawingProcess || isSpinning}
                  className="w-full mt-4 flex items-center justify-center gap-2 rounded-2xl border-2 border-yellow-400 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-3.5 px-4 text-sm sm:text-base font-black text-neutral-950 shadow-[0_0_35px_rgba(250,204,21,0.6)] animate-pulse hover:scale-[1.02] transition active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                  <Sparkles className="h-5 w-5 fill-neutral-950" />
                  <span>
                    {isSpinning
                      ? '🎡 MASHINIIN NAANNA\'AA JIRA (SPINNING...)'
                      : user && (user.role === 'ADMIN' || user.phone === '0929200166')
                      ? '★ TIKKEETIIN 100 GUUTAMEERA! AMMA NAANNESSI (SPIN WHEEL) ★'
                      : '★ TIKKEETIIN 100 GUUTAMEERA! ADMINIIN NAANNESSAA (PIN SEENSI) ★'}
                  </span>
                </button>
              ) : null}

              {/* Admin Manual Spin Control */}
              {user && (user.role === 'ADMIN' || user.phone === '0929200166') && claimedNumbers.length < 100 && (
                <button
                  onClick={handleAdminTriggerDraw}
                  disabled={isDrawingProcess || isSpinning}
                  className="w-full mt-3 rounded-xl border border-red-500/60 bg-red-600/20 py-2 px-3 text-xs font-bold text-red-300 hover:bg-red-600/30 transition flex items-center justify-center gap-2 active:scale-95"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Admin: Naannessi & Mo'attoota Baasi (Spin & Draw)</span>
                </button>
              )}

              {/* Action row */}
              <div className="mt-4 flex flex-wrap gap-2.5">
                {!user ? (
                  <button
                    onClick={() => {
                      setAuthMode('register');
                      setAuthOpen(true);
                      sound.playClick();
                    }}
                    className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 py-2.5 text-center text-xs sm:text-sm font-black text-neutral-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-yellow-400"
                  >
                    🎯 Carraa Kee Yaali (Galmaa'aa)
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setWalletInitialTab('deposit');
                      setWalletOpen(true);
                      sound.playClick();
                    }}
                    className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 py-2.5 text-center text-xs sm:text-sm font-bold text-neutral-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-yellow-400 flex items-center justify-center gap-2"
                  >
                    <PlusCircle className="h-4 w-4" />
                    <span>Qarshii Dabali (Deposit)</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setHelpOpen(true);
                    sound.playClick();
                  }}
                  className="rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-700 hover:text-white"
                >
                  Qajeelfama
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Numbers 1–100 directly UNDER the machine ("iran mashini jalatii lakk caaraa") */}
        <section>
          <NumberGrid
            selections={round?.selections || {}}
            onSelectNumber={handleSelectNumber}
            onAdminAssignSlot={handleAdminAssignSlot}
            onAdminReleaseSlot={handleAdminReleaseSlot}
            onAdminBulkAssignSlots={handleAdminBulkAssignSlots}
            onAdminBulkReleaseSlots={handleAdminBulkReleaseSlots}
            onAdminFillSimulated={handleAdminFillSimulated}
            onAdminClearSimulated={handleAdminClearSimulated}
            user={user}
            ticketPrice={round?.ticketPrice || 50}
            isRoundLocked={round?.status === 'LOCKED' || round?.status === 'DRAWING'}
            onOpenAuth={() => setAuthOpen(true)}
            onOpenDeposit={() => {
              setWalletInitialTab('deposit');
              setWalletOpen(true);
            }}
            winningNumbers={winningNumbers}
            recentWinners={recentWinners}
          />
        </section>

        {/* Section 3: Gamified Top Winners Leaderboard & Previous Round Winners */}
        <section className="space-y-6">
          <TopWinners />
          <PreviousWinners />
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-neutral-900 bg-neutral-950 py-8 px-4 text-center text-xs text-neutral-500">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-bold text-white">SPIN ETHIOPIA</span> • Sirna Caaraa 1–100 Mirkanaa'e
          </div>
          <div className="flex flex-wrap items-center gap-4 text-neutral-400">
            <button onClick={() => setHelpOpen(true)} className="hover:underline">
              Akkaataa Taphichaa
            </button>
            <span>•</span>
            <a href="/live" target="_blank" rel="noreferrer" className="hover:underline">
              OBS Live Stream
            </a>
            <span>•</span>
            <button
              onClick={() => {
                if (user && (user.role === 'ADMIN' || user.phone === '0929200166')) {
                  setAdminInitialTab('deposits');
                  setAdminOpen(true);
                } else {
                  setAdminAccessOpen(true);
                }
              }}
              className="font-semibold text-neutral-400 hover:text-amber-400"
            >
              Seensa Qondaalaa (Admin Portal)
            </button>
          </div>
        </div>
      </footer>

      {/* Mobile Sticky Quick Admin Portal Button */}
      <div className="fixed bottom-4 right-4 z-40 sm:hidden">
        <button
          onClick={() => {
            if (user && (user.role === 'ADMIN' || user.phone === '0929200166')) {
              setAdminInitialTab('deposits');
              setAdminOpen(true);
            } else {
              setAdminAccessOpen(true);
            }
            sound.playClick();
          }}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 px-3.5 py-2 text-xs font-black text-neutral-950 shadow-2xl shadow-amber-500/40 border-2 border-amber-300 active:scale-95 transition"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Admin</span>
          {pendingDepositsCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white animate-bounce ring-1 ring-white">
              {pendingDepositsCount}
            </span>
          )}
        </button>
      </div>

      {/* Floating Instant Deposit Notification for Admin */}
      {adminDepositNotification && (
        <div className="fixed bottom-6 right-4 sm:right-6 z-50 max-w-md w-full animate-bounce sm:animate-none">
          <div className="rounded-2xl border-2 border-amber-500 bg-neutral-950 p-4 shadow-2xl shadow-amber-500/30">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 rounded-full bg-red-500 animate-ping" />
                <span className="text-xs font-black uppercase tracking-wide text-amber-400">
                  🔔 Kaffaltii Haaraa Dhufeera!
                </span>
              </div>
              <button
                onClick={() => setAdminDepositNotification(null)}
                className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex gap-3 items-center">
              {adminDepositNotification.receiptUrl ? (
                <div
                  onClick={() => {
                    setAdminInitialTab('deposits');
                    setAdminOpen(true);
                    setAdminDepositNotification(null);
                  }}
                  className="group relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-amber-500/40 bg-neutral-900"
                  title="Ragaa (Receipt) guddisii ilaali"
                >
                  <img
                    src={adminDepositNotification.receiptUrl}
                    alt="Receipt"
                    className="h-full w-full object-cover group-hover:scale-110 transition"
                  />
                  <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[9px] font-bold text-center text-amber-300 py-0.5">
                    Ragaa
                  </span>
                </div>
              ) : null}

              <div className="flex-1 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Maqaa:</span>
                  <span className="font-bold text-white">
                    {adminDepositNotification.userName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Bilbila:</span>
                  <span className="font-mono font-bold text-amber-200">
                    {adminDepositNotification.userPhone}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Baankii:</span>
                  <span className="font-semibold text-neutral-300">{adminDepositNotification.provider}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">FT / TxID:</span>
                  <span className="font-mono font-bold text-amber-300">{adminDepositNotification.transactionId}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-neutral-800/80">
                  <span className="text-neutral-400">Hanga:</span>
                  <span className="font-mono text-base font-black text-emerald-400">
                    {adminDepositNotification.amount.toFixed(2)} ETB
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => handleQuickApproveDeposit(adminDepositNotification.id)}
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-center text-xs font-black text-white shadow-lg shadow-emerald-600/30 hover:from-emerald-500 hover:to-teal-500 transition active:scale-95"
              >
                Mirkaneessi (Approve Now)
              </button>
              <button
                onClick={() => {
                  setAdminInitialTab('deposits');
                  setAdminOpen(true);
                  setAdminDepositNotification(null);
                  sound.playClick();
                }}
                className="rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-xs font-bold text-neutral-200 hover:bg-neutral-800"
              >
                Ragaa Ilaali
              </button>
              <button
                onClick={() => setAdminDepositNotification(null)}
                className="rounded-xl border border-neutral-800 bg-neutral-900 px-2.5 py-2.5 text-xs font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Instant User Balance Credited Notification */}
      {userCreditedNotification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full px-4 animate-in fade-in slide-in-from-top duration-300">
          <div className="rounded-2xl border-2 border-emerald-500 bg-neutral-950 p-4 shadow-2xl shadow-emerald-500/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="h-7 w-7 animate-bounce" />
              </div>
              <div>
                <h4 className="text-sm font-black text-emerald-400">
                  Kaffaltiin Keessan Mirkanaa'eera! 🎉
                </h4>
                <p className="text-xs text-neutral-300">
                  <span className="font-mono font-bold text-emerald-300">+{userCreditedNotification.amount.toFixed(2)} ETB</span> herrega keessanitti dabalameera!
                </p>
                <p className="text-[11px] text-neutral-400">
                  Haftee Ammaa: <span className="font-mono font-bold text-white">{userCreditedNotification.newBalance.toFixed(2)} ETB</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setUserCreditedNotification(null)}
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <AuthModal
        isOpen={authOpen}
        initialMode={authMode}
        onClose={() => setAuthOpen(false)}
        onSuccess={(u) => {
          setUser(u);
          loadActiveRound();
          if (u.role === 'ADMIN' || u.phone === '0929200166') {
            fetchAdminMetrics();
          }
        }}
        initialReferralCode={referralCodeFromUrl}
      />

      <AdminAccessModal
        isOpen={adminAccessOpen}
        onClose={() => setAdminAccessOpen(false)}
        onSuccess={(u) => {
          setUser(u);
          loadActiveRound();
          fetchAdminMetrics();
          setAdminInitialTab('deposits');
          setAdminOpen(true);
        }}
      />

      {user && (
        <WalletModal
          isOpen={walletOpen}
          initialTab={walletInitialTab}
          onClose={() => setWalletOpen(false)}
          user={user}
          onBalanceUpdated={() => {
            loadCurrentUser();
            loadActiveRound();
          }}
        />
      )}

      {user && (user.role === 'ADMIN' || user.phone === '0929200166') && (
        <AdminPanel
          isOpen={adminOpen}
          initialTab={adminInitialTab}
          onClose={() => setAdminOpen(false)}
          onDataChanged={() => {
            loadCurrentUser();
            loadActiveRound();
            fetchAdminMetrics();
          }}
        />
      )}

      {user && (
        <ReferralModal
          isOpen={referralOpen}
          onClose={() => setReferralOpen(false)}
          user={user}
        />
      )}

      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* 3-Step Draw & Winner Celebration Announcements */}
      <DrawCelebrationModal
        currentStep={revealedDrawStep}
        grandWinners={grandWinners}
        roundNumber={grandRoundNum}
        onCloseGrand={() => setGrandWinners(null)}
      />
    </div>
  );
}
