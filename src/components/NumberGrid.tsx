import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Lock,
  AlertCircle,
  Check,
  Crown,
  Wallet,
  ArrowRight,
  UserPlus,
  Search,
  Filter,
  UserCheck,
  Clock,
  User as UserIcon,
  Calendar,
  Tag,
  X,
  Smartphone,
  Info,
  CheckSquare,
  Square,
  Trash2,
  Layers,
  Trophy,
  ShieldCheck,
} from 'lucide-react';
import { User, TicketSelection } from '../types/index';
import { sound } from '../lib/sound';
import { AuthenticityVerificationModal } from './AuthenticityVerificationModal';

export interface RecentWinnerHighlight {
  number: number;
  rank?: number;
  userName?: string;
  prizeAmount?: number;
  roundNumber?: number;
}

interface NumberGridProps {
  selections: Record<number, TicketSelection>;
  onSelectNumber: (number: number) => Promise<void>;
  onAdminAssignSlot?: (number: number, userName: string, userPhone: string) => Promise<void>;
  onAdminReleaseSlot?: (number: number) => Promise<void>;
  onAdminBulkAssignSlots?: (numbers: number[], userName: string, userPhone: string) => Promise<void>;
  onAdminBulkReleaseSlots?: (numbers: number[]) => Promise<void>;
  onAdminFillSimulated?: (count: number) => Promise<void>;
  onAdminClearSimulated?: () => Promise<void>;
  user: User | null;
  ticketPrice: number;
  isRoundLocked: boolean;
  onOpenAuth: () => void;
  onOpenDeposit: () => void;
  winningNumbers?: number[];
  recentWinners?: RecentWinnerHighlight[];
}

export const NumberGrid: React.FC<NumberGridProps> = ({
  selections,
  onSelectNumber,
  onAdminAssignSlot,
  onAdminReleaseSlot,
  onAdminBulkAssignSlots,
  onAdminBulkReleaseSlots,
  onAdminFillSimulated,
  onAdminClearSimulated,
  user,
  ticketPrice,
  isRoundLocked,
  onOpenAuth,
  onOpenDeposit,
  winningNumbers = [],
  recentWinners = [],
}) => {
  const [selectedNumToConfirm, setSelectedNumToConfirm] = useState<number | null>(null);
  const [insufficientBalanceModalNum, setInsufficientBalanceModalNum] = useState<number | null>(null);
  const [adminManageSlotNum, setAdminManageSlotNum] = useState<number | null>(null);
  const [detailModalNum, setDetailModalNum] = useState<number | null>(null);
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'open' | 'taken' | 'mine' | 'winners'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authenticityModalOpen, setAuthenticityModalOpen] = useState(false);

  // Long-press detection for mobile touchscreens
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (num: number, e: React.TouchEvent) => {
    longPressTriggeredRef.current = false;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    // 450ms long-press threshold
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(50);
        } catch {
          // ignore
        }
      }
      sound.playClick();
      setDetailModalNum(num);
    }, 450);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    // If the finger scrolled/moved more than 10px, abort the long-press
    if (dx > 10 || dy > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  };

  // Admin slot assignment state
  const [isAdminAssignMode, setIsAdminAssignMode] = useState(false);
  const [assignCustomerName, setAssignCustomerName] = useState('');
  const [assignCustomerPhone, setAssignCustomerPhone] = useState('');

  // Admin Bulk Selection Mode ("Select Multiple")
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedBulkNumbers, setSelectedBulkNumbers] = useState<number[]>([]);
  const [bulkAssignModalOpen, setBulkAssignModalOpen] = useState(false);
  const [bulkAssignName, setBulkAssignName] = useState('');
  const [bulkAssignPhone, setBulkAssignPhone] = useState('');
  const [bulkReleaseConfirmOpen, setBulkReleaseConfirmOpen] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const toggleSelectNumber = (num: number) => {
    sound.playClick();
    setSelectedBulkNumbers((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num].sort((a, b) => a - b)
    );
  };

  const selectAllOpen = () => {
    const openNums = Array.from({ length: 100 }, (_, i) => i + 1).filter((n) => !selections[n]);
    setSelectedBulkNumbers(openNums);
  };

  const selectAllOccupied = () => {
    const occNums = Array.from({ length: 100 }, (_, i) => i + 1).filter((n) => !!selections[n]);
    setSelectedBulkNumbers(occNums);
  };

  const selectRange = (start: number, end: number) => {
    const rangeNums = Array.from({ length: 100 }, (_, i) => i + 1).filter((n) => n >= start && n <= end);
    setSelectedBulkNumbers((prev) => Array.from(new Set([...prev, ...rangeNums])).sort((a, b) => a - b));
  };

  const handleConfirmBulkAssign = async () => {
    if (!bulkAssignName.trim()) {
      setError('Mee dura maqaa galchaa (Please enter customer name)');
      return;
    }
    if (selectedBulkNumbers.length === 0) {
      setError('Lakkoofsi tokkollee hin filatamne');
      return;
    }
    setBulkActionLoading(true);
    sound.playClick();
    try {
      if (onAdminBulkAssignSlots) {
        await onAdminBulkAssignSlots(selectedBulkNumbers, bulkAssignName.trim(), bulkAssignPhone.trim());
      } else if (onAdminAssignSlot) {
        for (const num of selectedBulkNumbers) {
          await onAdminAssignSlot(num, bulkAssignName.trim(), bulkAssignPhone.trim());
        }
      }
      sound.playWin();
      setBulkAssignModalOpen(false);
      setSelectedBulkNumbers([]);
      setBulkAssignName('');
      setBulkAssignPhone('');
    } catch (err: any) {
      setError(err.message || 'Bakka tokkotti qabuun hin danda\'amne');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleConfirmBulkRelease = async () => {
    const occupiedNumbers = selectedBulkNumbers.filter((n) => !!selections[n]);
    if (occupiedNumbers.length === 0) {
      setError('Lakkoofsota filataman keessaa kan qabame hin jiru');
      return;
    }
    setBulkActionLoading(true);
    sound.playClick();
    try {
      if (onAdminBulkReleaseSlots) {
        await onAdminBulkReleaseSlots(occupiedNumbers);
      } else if (onAdminReleaseSlot) {
        for (const num of occupiedNumbers) {
          await onAdminReleaseSlot(num);
        }
      }
      sound.playClick();
      setBulkReleaseConfirmOpen(false);
      setSelectedBulkNumbers([]);
    } catch (err: any) {
      setError(err.message || 'Gad-dhiisuun hin danda\'amne');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleCellClick = (num: number) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    const isAdmin = user?.role === 'ADMIN' || user?.phone === '0929200166';

    if (bulkMode && isAdmin) {
      toggleSelectNumber(num);
      return;
    }

    sound.playClick();
    setError('');

    if (isRoundLocked) {
      setError('Marsaan kun yeroo ammaa cufameera (Round is locked)');
      return;
    }

    const selection = selections[num];

    if (selection) {
      if (isAdmin) {
        // Admin clicked an occupied slot: Open admin slot management dialog to clear/vacate or reassign!
        setAdminManageSlotNum(num);
        return;
      }

      if (selection.isSimulated) {
        // Slot was occupied by a simulated customer for demand/urgency:
        // Auto-yield! Allow the real user to claim it!
        if (!user) {
          onOpenAuth();
          return;
        }
        if (user.walletBalance < ticketPrice) {
          setInsufficientBalanceModalNum(num);
          return;
        }
        setIsAdminAssignMode(false);
        setAssignCustomerName('');
        setAssignCustomerPhone('');
        setSelectedNumToConfirm(num);
        return;
      }

      // Slot is taken by a customer: Open ticket details modal for touch & click users
      setDetailModalNum(num);
      return;
    }

    if (!user) {
      onOpenAuth();
      return;
    }

    // Check if user has insufficient balance (and is not an admin assigning for someone else)
    if (!isAdmin && user.walletBalance < ticketPrice) {
      // Prompt user clearly that they need to deposit first, and guide them directly to deposit!
      setInsufficientBalanceModalNum(num);
      return;
    }

    setIsAdminAssignMode(false);
    setAssignCustomerName('');
    setAssignCustomerPhone('');
    setSelectedNumToConfirm(num);
  };

  const handleAdminRelease = async (num: number) => {
    if (!onAdminReleaseSlot) return;
    setAdminActionLoading(true);
    sound.playClick();
    try {
      await onAdminReleaseSlot(num);
      setAdminManageSlotNum(null);
    } catch (err: any) {
      setError(err.message || 'Slot gad-dhiisuun hin danda\'amne');
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleConfirmPurchase = async () => {
    if (selectedNumToConfirm === null) return;
    setLoading(true);
    setError('');

    try {
      if (isAdminAssignMode && user?.role === 'ADMIN' && onAdminAssignSlot) {
        if (!assignCustomerName.trim() || !assignCustomerPhone.trim()) {
          throw new Error('Maqaa fi lakkoofsa bilbila namaa galchaa (Please enter customer name and phone)');
        }
        await onAdminAssignSlot(selectedNumToConfirm, assignCustomerName.trim(), assignCustomerPhone.trim());
      } else {
        await onSelectNumber(selectedNumToConfirm);
      }
      sound.playWin();
      setSelectedNumToConfirm(null);
    } catch (err: any) {
      setError(err.message || 'Tikkeetii qabachuun hin danda\'amne');
    } finally {
      setLoading(false);
    }
  };

  const numbers = Array.from({ length: 100 }, (_, i) => i + 1);

  // Calculate statistics
  const allSelections = Object.values(selections) as TicketSelection[];
  const takenCount = allSelections.length;
  const simulatedCount = allSelections.filter((s) => s.isSimulated).length;
  const realCount = takenCount - simulatedCount;
  const openCount = 100 - takenCount;
  const myCount = user
    ? allSelections.filter((s) => s.userId === user.id).length
    : 0;

  const winningNumbersList = [
    ...winningNumbers,
    ...(recentWinners ? recentWinners.map((w) => w.number) : []),
  ];
  const uniqueWinningNumbers = Array.from(new Set(winningNumbersList));
  const winningCount = uniqueWinningNumbers.length;

  // Filtered numbers
  const filteredNumbers = numbers.filter((num) => {
    const selection = selections[num];
    const isMine = user && selection && selection.userId === user.id;
    const isTaken = !!selection;

    if (filterMode === 'open' && isTaken) return false;
    if (filterMode === 'taken' && !isTaken) return false;
    if (filterMode === 'mine' && !isMine) return false;
    if (filterMode === 'winners' && !uniqueWinningNumbers.includes(num)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchNum = num.toString().includes(q);
      const matchName = selection?.userName?.toLowerCase().includes(q);
      const matchPhone = selection?.userPhone?.toLowerCase().includes(q);
      return matchNum || matchName || matchPhone;
    }

    return true;
  });

  const formatAcquisitionTime = (isoString?: string) => {
    if (!isoString) return 'Yeroo hin beekamne (Not available)';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  const getRelativeTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      if (diffMs < 0) return 'Amma qofa (Just now)';
      const diffSecs = Math.floor(diffMs / 1000);
      if (diffSecs < 60) return `${diffSecs}s dura (seconds ago)`;
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins}m dura (mins ago)`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h dura (hours ago)`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d dura (days ago)`;
    } catch {
      return '';
    }
  };

  return (
    <div className="w-full rounded-3xl border border-amber-500/30 bg-neutral-950/90 p-4 sm:p-6 shadow-2xl backdrop-blur">
      {/* Header & Controls */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <Sparkles className="h-4 w-4 text-amber-400" />
            </span>
            <h3 className="text-lg sm:text-xl font-black text-white">
              Lakkoofsa Caaraa Keessan Filadhaa (1–100)
            </h3>
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            Gatiin tikkeetii tokkoo <strong className="text-amber-300 font-bold">{ticketPrice} ETB</strong> dha. Lakkoofsa barbaaddan cuqaasuun maqaa keessaniin qabadhaa.
          </p>
        </div>

        {/* Filter Pills & Search */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-500" />
            <input
              type="text"
              placeholder="Lakk / Maqaa barbaadi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl border border-neutral-800 bg-neutral-900 py-1.5 pl-8 pr-3 text-xs text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center rounded-xl border border-neutral-800 bg-neutral-900 p-1">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                filterMode === 'all'
                  ? 'bg-amber-500 text-neutral-950 font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Hunda (100)
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('open')}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                filterMode === 'open'
                  ? 'bg-emerald-500 text-neutral-950 font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Banaa ({openCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('taken')}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                filterMode === 'taken'
                  ? 'bg-rose-600 text-white font-bold shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Qabame ({takenCount})
            </button>
            {user && (
              <button
                type="button"
                onClick={() => setFilterMode('mine')}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                  filterMode === 'mine'
                    ? 'bg-teal-500 text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Kan Koo ({myCount})
              </button>
            )}
            {winningCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterMode('winners')}
                className={`rounded-lg px-2.5 py-1 font-semibold transition flex items-center gap-1 ${
                  filterMode === 'winners'
                    ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-neutral-950 font-black shadow-md shadow-yellow-500/30'
                    : 'text-yellow-400 hover:text-white'
                }`}
                title="Lakkoofsa Mo'attootaa Qofa Mul'isi"
              >
                <Trophy className="h-3 w-3 fill-current" />
                <span>Mo'attoota ({winningCount})</span>
              </button>
            )}
          </div>

          {/* Authenticity Verification Proof Button */}
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setAuthenticityModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/60 bg-emerald-500/15 px-3 py-1.5 text-xs font-black text-emerald-300 hover:bg-emerald-500/25 transition shadow-sm"
            title="Mirkaneessa Dhugaa fi Haqaa (View Proof)"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>{takenCount === 50 ? '50% DHUGAA ✓' : 'Mirkaneessa Dhugaa'}</span>
          </button>

          {/* Admin Select Multiple Mode Toggle */}
          {(user?.role === 'ADMIN' || user?.phone === '0929200166') && (
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                const nextMode = !bulkMode;
                setBulkMode(nextMode);
                if (!nextMode) {
                  setSelectedBulkNumbers([]);
                }
              }}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-bold transition shadow-sm ${
                bulkMode
                  ? 'border-amber-400 bg-amber-500 text-neutral-950 shadow-amber-500/30'
                  : 'border-amber-500/50 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
              }`}
            >
              {bulkMode ? (
                <CheckSquare className="h-4 w-4 text-neutral-950 stroke-[2.5]" />
              ) : (
                <Square className="h-4 w-4 text-amber-400" />
              )}
              <span>Filannoo Baay'ee (Select Multiple)</span>
              {selectedBulkNumbers.length > 0 && (
                <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-[11px] font-black text-amber-400">
                  {selectedBulkNumbers.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ADMIN BULK SELECTION ACTION PANEL */}
      {bulkMode && (user?.role === 'ADMIN' || user?.phone === '0929200166') && (
        <div className="mb-4 rounded-3xl border-2 border-amber-500/60 bg-gradient-to-r from-neutral-900 via-amber-950/40 to-neutral-900 p-4 sm:p-5 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-white text-base">
                    Filannoo Baay'ee Admin (Bulk Slot Actions)
                  </h4>
                  <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-black text-neutral-950 shadow">
                    {selectedBulkNumbers.length} filatameera
                  </span>
                </div>
                <p className="text-xs text-neutral-300 mt-0.5">
                  Lakkoofsota gadii cuqaasuun filadhaa, sana booda maqaa tokkoon qabaa ykn bakka tokkotti gad-dhiisaa.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={selectedBulkNumbers.length === 0}
                onClick={() => {
                  sound.playClick();
                  setBulkAssignName('');
                  setBulkAssignPhone('');
                  setBulkAssignModalOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-emerald-500/30 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95"
              >
                <UserPlus className="h-4 w-4" />
                <span>Bakka Tokkotti Qabi ({selectedBulkNumbers.length})</span>
              </button>

              <button
                type="button"
                disabled={selectedBulkNumbers.filter((n) => !!selections[n]).length === 0}
                onClick={() => {
                  sound.playClick();
                  setBulkReleaseConfirmOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-rose-500/30 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95"
              >
                <Trash2 className="h-4 w-4" />
                <span>Bakka Tokkotti Gad-dhiisi ({selectedBulkNumbers.filter((n) => !!selections[n]).length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setSelectedBulkNumbers([]);
                }}
                className="rounded-xl border border-neutral-700 bg-neutral-800 px-3.5 py-2.5 text-xs font-bold text-neutral-300 hover:text-white hover:bg-neutral-700"
              >
                Haqi (Clear)
              </button>
            </div>
          </div>

          {/* Quick Selection Shortcuts */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-3 border-t border-neutral-800/80 text-xs">
            <span className="text-neutral-400 font-bold mr-1">Filannoo Saffisaa:</span>
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                selectAllOpen();
              }}
              className="rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-2.5 py-1 text-emerald-400 font-bold"
            >
              Banaa Hunda ({openCount})
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                selectAllOccupied();
              }}
              className="rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-2.5 py-1 text-rose-400 font-bold"
            >
              Qabame Hunda ({takenCount})
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                selectRange(1, 20);
              }}
              className="rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-2.5 py-1 text-amber-300 font-bold"
            >
              1–20
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                selectRange(21, 50);
              }}
              className="rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-2.5 py-1 text-amber-300 font-bold"
            >
              21–50
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                selectRange(51, 100);
              }}
              className="rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-2.5 py-1 text-amber-300 font-bold"
            >
              51–100
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setSelectedBulkNumbers(Array.from({ length: 100 }, (_, i) => i + 1));
              }}
              className="rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-2.5 py-1 text-white font-bold"
            >
              Hunda (1–100)
            </button>
          </div>
        </div>
      )}

      {/* Color Legend for High Visibility */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-800/80 bg-neutral-900/60 px-4 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-lg bg-neutral-800 border border-neutral-600 shadow-sm" />
            <span className="text-neutral-300">Banaa (Open)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 border border-emerald-300 shadow-sm" />
            <span className="text-emerald-300 font-bold">Kan Keessan (Your Ticket)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-lg bg-gradient-to-r from-rose-600 to-red-600 border border-rose-300 shadow-sm" />
            <span className="text-rose-400 font-bold">Qabameera + Maqaa (Taken + Name)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-lg bg-yellow-400 border border-yellow-200 shadow-sm animate-pulse" />
            <span className="text-yellow-300 font-bold">Mo'ataa (Winner)</span>
          </div>
        </div>

        {/* Mobile touch tip */}
        <div className="flex items-center gap-1.5 rounded-full bg-neutral-950 border border-neutral-800 px-3 py-1 text-[11px] text-neutral-300">
          <Smartphone className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span>Bilbilaan: Lakkoofsa <strong>gadi qabuun (long-press)</strong> ykn qabame <strong>cuqaasuun</strong> odeeffannoo ilaalaa</span>
        </div>

        {/* User Balance Reminder */}
        {user && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-400">Haftee Keessan:</span>
            <span className="font-mono font-black text-emerald-400">
              {user.walletBalance.toFixed(2)} ETB
            </span>
            {user.walletBalance < ticketPrice && (
              <button
                type="button"
                onClick={onOpenDeposit}
                className="ml-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 font-bold text-amber-300 border border-amber-500/40 hover:bg-amber-500 hover:text-neutral-950 transition"
              >
                + Qarshii Galfadhu
              </button>
            )}
          </div>
        )}
      </div>

      {isRoundLocked && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-300 shadow-md">
          <Lock className="h-4 w-4 shrink-0 text-amber-400" />
          <span>Marsaan kun yeroo ammaa cufameera! Bu'aa caaraa eegaa.</span>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 p-3.5 text-xs text-red-300 shadow-md">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Persistent Recent Round Winners Banner */}
      {recentWinners && recentWinners.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-yellow-500/40 bg-gradient-to-r from-yellow-500/15 via-neutral-900 to-amber-500/10 p-3.5 text-xs text-yellow-300 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 text-neutral-950 font-black shadow-md">
              <Trophy className="h-5 w-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-white text-xs sm:text-sm">
                  Mo'attoota Marsaa Dhiyoo (Recent Round Winners)
                </span>
                <span className="rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 px-2 py-0.5 text-[10px] font-black uppercase">
                  Mirkanaa'e
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {recentWinners.map((w) => (
                  <span
                    key={`${w.roundNumber || 0}-${w.rank || 0}-${w.number}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-yellow-400/60 bg-neutral-950/80 px-2.5 py-1 text-xs font-bold text-white shadow-sm"
                  >
                    <span className="font-mono font-black text-yellow-300 text-sm">#{w.number}</span>
                    <span className="text-[10px] text-yellow-400 font-semibold">({w.rank ? `${w.rank}ffaa` : 'Mo\'ataa'})</span>
                    {w.prizeAmount && (
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">
                        +{w.prizeAmount} ETB
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setFilterMode(filterMode === 'winners' ? 'all' : 'winners')}
            className="flex items-center gap-1.5 rounded-xl border border-yellow-400 bg-yellow-400 px-3 py-1.5 text-xs font-black text-neutral-950 hover:bg-yellow-300 transition shadow"
          >
            <Trophy className="h-3.5 w-3.5 fill-current" />
            <span>{filterMode === 'winners' ? 'Hunda Mul\'isi' : 'Mo\'attoota Qofa Mul\'isi'}</span>
          </button>
        </div>
      )}

      {/* 10x10 Beautiful High-Contrast Number Grid (1–100) */}
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10 sm:gap-2.5">
        {filteredNumbers.map((num) => {
          const selection = selections[num];
          const isMine = user && selection && selection.userId === user.id;
          const isTaken = !!selection;
          const isCurrentWinner = winningNumbers.includes(num);
          const recentWinnerInfo = recentWinners?.find((w) => w.number === num);
          const isRecentWinner = !!recentWinnerInfo;
          const isWinner = isCurrentWinner || isRecentWinner;
          const isSimulated = selection?.isSimulated;
          const isAdmin = user?.role === 'ADMIN';

          // Clickable rule:
          // Admin can click ANY slot (to assign, or manage/vacate/clear taken ones!)
          // Real players can click empty slots OR simulated demand slots (which yield and allow real purchase!)
          const isClickable = !isRoundLocked && (!isTaken || isAdmin || isSimulated);

          let cellClasses =
            'border-2 border-neutral-700 bg-neutral-900 text-white hover:border-amber-400 hover:bg-neutral-800 hover:scale-[1.04] shadow-md';
          let numberClasses = 'text-white text-base sm:text-xl font-black drop-shadow-sm';

          const isBulkSelected = bulkMode && isAdmin && selectedBulkNumbers.includes(num);

          if (isCurrentWinner) {
            cellClasses =
              'bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 text-neutral-950 border-4 border-white font-black shadow-2xl shadow-yellow-500/70 scale-105 animate-pulse z-20 ring-4 ring-yellow-400/50';
            numberClasses = 'text-neutral-950 text-lg sm:text-2xl font-black';
          } else if (isRecentWinner) {
            // Persistent visual highlight for winning number from recent rounds!
            if (isMine) {
              cellClasses =
                'bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-800 border-2 border-yellow-300 text-white font-black shadow-xl shadow-yellow-500/30 ring-2 ring-yellow-400';
              numberClasses = 'text-white text-base sm:text-xl font-black';
            } else if (isTaken) {
              cellClasses =
                'bg-gradient-to-br from-rose-600 via-red-600 to-rose-700 border-2 border-yellow-300 text-white font-black shadow-xl shadow-yellow-500/30 ring-2 ring-yellow-400 ' +
                (isClickable ? 'cursor-pointer hover:brightness-110 hover:scale-[1.02]' : 'cursor-not-allowed');
              numberClasses = 'text-white text-base sm:text-xl font-black drop-shadow';
            } else {
              cellClasses =
                'border-2 border-yellow-400 bg-gradient-to-br from-yellow-500/25 via-neutral-900 to-neutral-900 text-white shadow-xl shadow-yellow-500/30 ring-2 ring-yellow-400/60 hover:border-amber-300 hover:scale-[1.04]';
              numberClasses = 'text-yellow-300 text-base sm:text-xl font-black drop-shadow';
            }
          } else if (isMine) {
            cellClasses =
              'bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 border-2 border-white text-white font-black shadow-lg shadow-emerald-500/40 ring-2 ring-emerald-300';
            numberClasses = 'text-white text-base sm:text-xl font-black';
          } else if (isTaken) {
            // High-visibility Crimson / Rose Red badge with white bold text - unmistakable contrast ("lakk qabameef color biraa")
            cellClasses =
              'bg-gradient-to-br from-rose-600 via-red-600 to-rose-700 border-2 border-rose-300 text-white font-black shadow-lg shadow-rose-950/50 ' +
              (isClickable ? 'cursor-pointer hover:brightness-110 hover:scale-[1.02]' : 'cursor-not-allowed');
            numberClasses = 'text-white text-base sm:text-xl font-black drop-shadow';
          }

          if (isBulkSelected) {
            cellClasses += ' ring-4 ring-amber-400 border-amber-300 shadow-2xl shadow-amber-500/60 scale-[1.04] z-20 brightness-110';
          }

          const col10 = ((num - 1) % 10) + 1;
          const row10 = Math.ceil(num / 10);
          const isTopRow = row10 <= 2;
          const isLeftEdge = col10 <= 2;
          const isRightEdge = col10 >= 9;

          const alignClass = isLeftEdge
            ? 'left-0'
            : isRightEdge
            ? 'right-0'
            : 'left-1/2 -translate-x-1/2';

          return (
            <button
              key={num}
              type="button"
              disabled={isRoundLocked}
              onClick={() => handleCellClick(num)}
              onTouchStart={(e) => handleTouchStart(num, e)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              onContextMenu={(e) => {
                if (longPressTriggeredRef.current) {
                  e.preventDefault();
                }
              }}
              className={`group relative flex min-h-[66px] sm:min-h-[74px] flex-col items-center justify-center rounded-2xl border p-1 text-xs transition-all duration-150 hover:z-30 select-none ${cellClasses}`}
            >
              {/* Checkbox overlay for Admin Bulk Selection mode */}
              {bulkMode && isAdmin && (
                <div className="absolute top-1.5 left-1.5 z-20">
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-md border text-[11px] font-black transition ${
                      isBulkSelected
                        ? 'bg-amber-400 border-amber-200 text-neutral-950 shadow-md'
                        : 'bg-neutral-950/80 border-neutral-600 text-transparent'
                    }`}
                  >
                    ✓
                  </div>
                </div>
              )}

              {/* Corner badge for Recent Winner */}
              {isRecentWinner && !isCurrentWinner && (
                <div className="absolute -top-1.5 -right-1.5 z-20 flex items-center gap-0.5 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 px-1.5 py-0.2 text-[9px] font-black text-neutral-950 shadow-md">
                  <Trophy className="h-2.5 w-2.5 fill-current" />
                  <span>{recentWinnerInfo?.rank ? `${recentWinnerInfo.rank}ffaa` : 'Mo\'ataa'}</span>
                </div>
              )}

              {/* Top number in big bold display font */}
              <span className={`leading-none ${numberClasses}`}>
                #{num}
              </span>

              {/* Sub-label: Owner name or status */}
              {isCurrentWinner && (
                <div className="mt-1 flex items-center gap-0.5 rounded-full bg-neutral-950 px-2 py-0.5 text-[10px] font-black text-yellow-400 uppercase tracking-tight shadow">
                  <Crown className="h-3 w-3 text-yellow-400 fill-current" />
                  <span>Mo'ataa Ammaa</span>
                </div>
              )}

              {isRecentWinner && !isCurrentWinner && (
                <div className="mt-0.5 flex flex-col items-center w-full px-1">
                  <span className="w-full truncate text-center text-[10px] sm:text-xs font-black text-yellow-300 leading-tight">
                    {selection?.userName || `Mo'ataa (${recentWinnerInfo?.rank ? `${recentWinnerInfo.rank}ffaa` : 'Marsaa Duraa'})`}
                  </span>
                  <span className="rounded bg-yellow-400/20 border border-yellow-400/50 px-1 py-0.2 text-[8px] font-black text-yellow-300 mt-0.5">
                    ★ {recentWinnerInfo?.rank ? `${recentWinnerInfo.rank}ffaa` : 'Mo\'ataa'}
                  </span>
                </div>
              )}

              {isMine && !isCurrentWinner && !isRecentWinner && (
                <div className="mt-1 flex items-center gap-0.5 rounded-full bg-emerald-950/80 px-2 py-0.5 text-[10px] font-black text-emerald-100 border border-emerald-300/40">
                  <Check className="h-3 w-3 stroke-[3]" />
                  <span>Keessan</span>
                </div>
              )}

              {isTaken && !isMine && !isCurrentWinner && !isRecentWinner && (
                <div className="mt-0.5 flex flex-col items-center w-full px-1">
                  <span className="w-full truncate text-center text-[10px] sm:text-xs font-black text-white leading-tight drop-shadow-sm">
                    {selection.userName}
                  </span>
                  <span className="rounded bg-black/40 border border-rose-300/30 px-1.5 py-0.2 text-[8px] font-bold text-rose-100 mt-0.5">
                    Qabameera
                  </span>
                </div>
              )}

              {!isTaken && !isCurrentWinner && !isRecentWinner && (
                <span className="mt-1 rounded-full bg-neutral-800 px-2 py-0.5 text-[9px] font-bold text-neutral-300">
                  Banaa
                </span>
              )}

              {/* DETAILED HOVER TOOLTIP: HOLDER NAME & ACQUISITION TIME */}
              <div
                role="tooltip"
                className={`pointer-events-none absolute z-50 hidden w-60 sm:w-64 flex-col rounded-2xl border-2 border-amber-500/70 bg-neutral-950 p-3 text-left shadow-2xl shadow-black/95 backdrop-blur-md group-hover:flex ${
                  isTopRow ? 'top-full mt-2' : 'bottom-full mb-2'
                } ${alignClass} ${
                  (num - 1) % 5 === 0 ? 'max-sm:left-0 max-sm:translate-x-0' : ''
                } ${
                  (num - 1) % 5 === 4 ? 'max-sm:right-0 max-sm:left-auto max-sm:translate-x-0' : ''
                }`}
              >
                {/* Tooltip Header: Ticket Number & Status Pill */}
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-lg font-mono text-xs font-black shadow-sm ${
                        isWinner
                          ? 'bg-amber-400 text-neutral-950'
                          : isMine
                          ? 'bg-emerald-500 text-white'
                          : isTaken
                          ? 'bg-rose-600 text-white'
                          : 'bg-neutral-800 text-neutral-200 border border-neutral-700'
                      }`}
                    >
                      #{num}
                    </span>
                    <span className="text-xs font-black text-white">
                      Tikkeetii #{num}
                    </span>
                  </div>

                  {isWinner ? (
                    <span className="flex items-center gap-1 rounded-full bg-yellow-400 px-2 py-0.5 text-[9px] font-black text-neutral-950 uppercase shadow">
                      <Crown className="h-2.5 w-2.5" /> Mo'ataa
                    </span>
                  ) : isMine ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/25 border border-emerald-400/50 px-2 py-0.5 text-[9px] font-black text-emerald-300">
                      <Check className="h-2.5 w-2.5 stroke-[3]" /> Kan Keessan
                    </span>
                  ) : isTaken ? (
                    <span className="rounded-full bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 text-[9px] font-black text-rose-300">
                      Qabameera
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                      Banaa (Open)
                    </span>
                  )}
                </div>

                {/* Recent Winner Information in Tooltip */}
                {isRecentWinner && recentWinnerInfo && (
                  <div className="mb-2 rounded-xl bg-gradient-to-r from-yellow-500/20 to-amber-500/10 border border-yellow-400/50 p-2 text-xs text-yellow-300">
                    <div className="flex items-center gap-1.5 font-black text-yellow-200">
                      <Trophy className="h-3.5 w-3.5 text-yellow-400 fill-current" />
                      <span>Mo'ataa Marsaa #{recentWinnerInfo.roundNumber || ''} ({recentWinnerInfo.rank ? `${recentWinnerInfo.rank}ffaa` : 'Mo\'ataa'})</span>
                    </div>
                    {recentWinnerInfo.prizeAmount && (
                      <div className="mt-1 text-[11px] text-white">
                        Badhaasa: <span className="font-mono font-black text-emerald-400">+{recentWinnerInfo.prizeAmount} ETB</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Tooltip Body: Holder & Acquisition Time */}
                {isTaken && selection ? (
                  <div className="space-y-2 text-[11px]">
                    {/* Holder's Name */}
                    <div className="rounded-xl bg-neutral-900/90 border border-neutral-800 p-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                        <UserIcon className="h-3 w-3 text-amber-400 shrink-0" />
                        <span>Abbaa Tikkeetii (Holder)</span>
                      </div>
                      <div className="mt-0.5 text-xs font-black text-white truncate flex items-center justify-between">
                        <span className="truncate">{selection.userName}</span>
                        {isMine && (
                          <span className="ml-1 shrink-0 rounded bg-emerald-500/20 px-1 py-0.2 text-[9px] font-bold text-emerald-300">
                            Isin
                          </span>
                        )}
                      </div>
                      {selection.userPhone && (
                        <div className="mt-0.5 font-mono text-[10px] text-neutral-400">
                          Bilbila: {selection.userPhone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')}
                        </div>
                      )}
                    </div>

                    {/* Acquisition Time */}
                    <div className="rounded-xl bg-neutral-900/90 border border-neutral-800 p-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                        <Clock className="h-3 w-3 text-amber-400 shrink-0" />
                        <span>Yeroo Qabame (Acquisition Time)</span>
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] font-bold text-amber-300">
                        {formatAcquisitionTime(selection.selectedAt)}
                      </div>
                      {getRelativeTime(selection.selectedAt) && (
                        <div className="mt-0.5 text-[9px] text-neutral-400 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80" />
                          <span>{getRelativeTime(selection.selectedAt)}</span>
                        </div>
                      )}
                    </div>

                    {isAdmin && (
                      <div className="text-[9px] font-semibold text-neutral-400 italic">
                        Admin: Cuqaasuun jijjiiri ykn bakka duwwaa godhi
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 text-[11px]">
                    <div className="rounded-xl bg-neutral-900/90 border border-neutral-800 p-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        <UserIcon className="h-3 w-3 text-neutral-500 shrink-0" />
                        <span>Abbaa Tikkeetii (Holder)</span>
                      </div>
                      <div className="mt-0.5 text-xs font-bold text-neutral-300">
                        Homaa hin qabamne (Banaa dha)
                      </div>
                    </div>

                    <div className="rounded-xl bg-neutral-900/90 border border-neutral-800 p-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        <Clock className="h-3 w-3 text-neutral-500 shrink-0" />
                        <span>Haala Qophii (Status)</span>
                      </div>
                      <div className="mt-0.5 text-xs font-bold text-emerald-400">
                        Amma qophii dha • Gatiin {ticketPrice} ETB
                      </div>
                    </div>

                    <div className="text-[10px] font-black text-amber-400">
                      👉 Cuqaasaa maqaa keessaniin qabadhaa!
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {filteredNumbers.length === 0 && (
        <div className="my-8 text-center text-xs text-neutral-500">
          Lakkoofsi barbaaddan hin argamne. Mee jijjiiraa barbaadaa.
        </div>
      )}

      {/* ⚠️ MODAL: INSUFFICIENT BALANCE -> REDIRECT TO DEPOSIT ("yero qarshi male lakk qabachuf jedhan qatshi galfadhu jedhuu qaba akkasuma gara qarshi galchu demuu qabaa") */}
      {insufficientBalanceModalNum !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border-2 border-amber-500/50 bg-neutral-950 p-6 text-white shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 border-b border-neutral-800 pb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-400 shadow-inner">
                <Wallet className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-black text-amber-400">
                  Qarshii Dura Galfadhaa!
                </h4>
                <p className="text-xs text-neutral-400">
                  Baalaansiin herrega keessanii gahaa miti
                </p>
              </div>
            </div>

            <div className="my-5 space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 text-xs">
              <div className="flex items-center justify-between text-neutral-300">
                <span>Lakkoofsa Filatame:</span>
                <span className="font-mono text-base font-black text-amber-400">
                  #{insufficientBalanceModalNum}
                </span>
              </div>
              <div className="flex items-center justify-between text-neutral-300">
                <span>Gatii Tikkeetii:</span>
                <span className="font-bold text-white">{ticketPrice.toFixed(2)} ETB</span>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-800 pt-2 text-neutral-300">
                <span>Haftee Keessan Ammaa:</span>
                <span className="font-mono font-bold text-red-400">
                  {user?.walletBalance.toFixed(2)} ETB
                </span>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-200">
                Lakkoofsa #{insufficientBalanceModalNum} maqaa keessaniin qabachuuf, dura herrega keessanitti qarshii galchuun baalaansii keessan guutuu qabdu.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setInsufficientBalanceModalNum(null)}
                className="flex-1 rounded-2xl bg-neutral-900 py-3 text-xs font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-white"
              >
                Dhiisi (Cancel)
              </button>
              <button
                type="button"
                onClick={() => {
                  setInsufficientBalanceModalNum(null);
                  sound.playClick();
                  onOpenDeposit(); // DIRECTLY OPENS DEPOSIT MODAL!
                }}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-3 text-xs font-black text-neutral-950 shadow-lg shadow-amber-500/25 transition hover:brightness-110 active:scale-95"
              >
                <Wallet className="h-4 w-4" />
                <span>Qarshii Galfadhu (Go to Deposit)</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM TICKET PURCHASE MODAL (With Admin Customer Assignment Support: "ini bira admnin nama biratif lakk qabu akka danda'uu godhii") */}
      {selectedNumToConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border-2 border-amber-500/50 bg-neutral-950 p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h4 className="text-base sm:text-lg font-black text-amber-400">
                  {isAdminAssignMode
                    ? 'Nama Biraatiif Lakkoofsa Qabi (Assign Ticket)'
                    : 'Tikkeetii Mirkaneessi (Confirm Ticket)'}
                </h4>
                <p className="text-xs text-neutral-400">
                  {isAdminAssignMode
                    ? 'Odeeffannoo fayyadamaa kanaaf lakkoofsa qabi'
                    : 'Lakkoofsa caaraa kana qabachuuf mirkaneessaa'}
                </p>
              </div>

              {/* Admin Toggle Option */}
              {user?.role === 'ADMIN' && (
                <button
                  type="button"
                  onClick={() => setIsAdminAssignMode(!isAdminAssignMode)}
                  className={`rounded-xl border px-2.5 py-1 text-[11px] font-bold transition ${
                    isAdminAssignMode
                      ? 'border-amber-400 bg-amber-500 text-neutral-950'
                      : 'border-neutral-700 bg-neutral-900 text-amber-300 hover:bg-neutral-800'
                  }`}
                >
                  {isAdminAssignMode ? 'Ofiif Biti' : 'Nama Biraatiif'}
                </button>
              )}
            </div>

            {/* Selected Number Display */}
            <div className="my-4 flex flex-col items-center justify-center rounded-2xl border border-amber-500/30 bg-neutral-900/90 p-4">
              <span className="text-xs text-neutral-400">Lakkoofsa Filatame:</span>
              <span className="font-mono text-4xl font-black text-amber-300">
                #{selectedNumToConfirm}
              </span>

              {!isAdminAssignMode ? (
                <div className="mt-3 w-full space-y-1.5 border-t border-neutral-800 pt-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Maqaa Qabataa:</span>
                    <span className="font-bold text-white">
                      {user?.firstName} {user?.lastName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Gatiin:</span>
                    <span className="font-bold text-amber-300">{ticketPrice.toFixed(2)} ETB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Haftee Keessan:</span>
                    <span className="font-bold text-emerald-400">
                      {user?.walletBalance.toFixed(2)} ETB
                    </span>
                  </div>
                </div>
              ) : (
                /* Admin Assign Form Inputs */
                <div className="mt-4 w-full space-y-3 border-t border-neutral-800 pt-3 text-left">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                      Maqaa Fayyadamaa (Customer Full Name) *
                    </label>
                    <input
                      type="text"
                      placeholder="Fkn: Tolasaa Raggaasaa"
                      value={assignCustomerName}
                      onChange={(e) => setAssignCustomerName(e.target.value)}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white placeholder-neutral-500 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                      Bilbila Fayyadamaa (Customer Phone) *
                    </label>
                    <input
                      type="tel"
                      placeholder="0911000000"
                      value={assignCustomerPhone}
                      onChange={(e) => setAssignCustomerPhone(e.target.value)}
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white placeholder-neutral-500 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-2.5 text-xs text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSelectedNumToConfirm(null)}
                className="flex-1 rounded-2xl bg-neutral-900 py-3 text-xs font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-white"
              >
                Dhiisi (Cancel)
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmPurchase}
                className="flex-1 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-3 text-xs font-black text-neutral-950 shadow-lg shadow-amber-500/30 transition hover:brightness-110 disabled:opacity-50"
              >
                {loading
                  ? 'Qabaa jira...'
                  : isAdminAssignMode
                  ? 'Namaaf Qabi (Assign Now)'
                  : 'Eeyyee, Biti (Buy)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN MANAGE OCCUPIED SLOT MODAL ("kan ati zim jete maqa namotatin qabdee san bota duwaa akkan godhutii hojedhu") */}
      {adminManageSlotNum !== null && selections[adminManageSlotNum] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border-2 border-amber-500/60 bg-neutral-950 p-6 text-white shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-black text-sm">
                  #{adminManageSlotNum}
                </span>
                <div>
                  <h4 className="text-base font-black text-amber-400">
                    To'annoo Lakkoofsa #{adminManageSlotNum}
                  </h4>
                  <p className="text-xs text-neutral-400">
                    Slot kana bakka duwwaa godhaa ykn nama biraaf qabaa
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdminManageSlotNum(null)}
                className="rounded-xl border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-xs text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="my-4 space-y-2 rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-400">Maqaa Qabataa:</span>
                <span className="font-black text-white text-sm">
                  {selections[adminManageSlotNum].userName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Bilbila:</span>
                <span className="font-mono text-neutral-300">
                  {selections[adminManageSlotNum].userPhone || '—'}
                </span>
              </div>
              <div className="flex justify-between border-t border-neutral-800 pt-2">
                <span className="text-neutral-400">Gosa Qabannaa:</span>
                <span className={`font-bold ${selections[adminManageSlotNum].isSimulated ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {selections[adminManageSlotNum].isSimulated
                    ? '⚡ Fedhii Uumuu (Simulated Demand)'
                    : '👤 Fayyadamaa Dhugaa (Real Customer)'}
                </span>
              </div>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-2.5 text-xs text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              {/* Button 1: CLEAR / VACATE SLOT ("bota duwaa akkan godhutii hojedhu") */}
              <button
                type="button"
                disabled={adminActionLoading}
                onClick={() => handleAdminRelease(adminManageSlotNum)}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 py-3 text-xs font-black text-white shadow-lg shadow-red-600/30 hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                <span>🧹 Bakka Duwwaa Godhi (Make Slot Empty / Clear)</span>
              </button>

              {/* Button 2: Reassign for another customer */}
              <button
                type="button"
                onClick={() => {
                  setSelectedNumToConfirm(adminManageSlotNum);
                  setIsAdminAssignMode(true);
                  setAssignCustomerName('');
                  setAssignCustomerPhone('');
                  setAdminManageSlotNum(null);
                }}
                className="flex items-center justify-center gap-2 rounded-2xl border border-neutral-700 bg-neutral-900 py-2.5 text-xs font-bold text-neutral-300 hover:bg-neutral-800 hover:text-white"
              >
                <span>✏️ Nama Biraatiif Qabi (Reassign Slot)</span>
              </button>

              <button
                type="button"
                onClick={() => setAdminManageSlotNum(null)}
                className="rounded-2xl py-2 text-xs text-neutral-500 hover:text-neutral-300"
              >
                Cufi (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📱 TOUCH / MOBILE DETAILED TICKET INFO MODAL (Long-Press or Tap) */}
      {detailModalNum !== null && (() => {
        const detailSelection = selections[detailModalNum];
        const isDetailMine = user && detailSelection && detailSelection.userId === user.id;
        const isDetailTaken = !!detailSelection;
        const isDetailWinner = winningNumbers.includes(detailModalNum);
        const isAdmin = user?.role === 'ADMIN';

        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 p-0 sm:p-4 backdrop-blur-md animate-in fade-in duration-150"
            onClick={() => setDetailModalNum(null)}
          >
            <div
              className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border-t-2 sm:border-2 border-amber-500/60 bg-neutral-950 p-5 sm:p-6 text-white shadow-2xl animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl font-mono text-lg font-black shadow-lg ${
                      isDetailWinner
                        ? 'bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 text-neutral-950'
                        : isDetailMine
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                        : isDetailTaken
                        ? 'bg-gradient-to-br from-rose-600 to-red-700 text-white'
                        : 'bg-neutral-800 border border-neutral-700 text-neutral-200'
                    }`}
                  >
                    #{detailModalNum}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                      <span>Tikkeetii #{detailModalNum}</span>
                      {isDetailWinner && (
                        <span className="flex items-center gap-1 rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-black text-neutral-950 uppercase shadow">
                          <Crown className="h-3 w-3" /> Mo'ataa
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Odeeffannoo Guutuu Tikkeetii
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDetailModalNum(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Status Banner */}
              <div className="my-4">
                {isDetailWinner ? (
                  <div className="flex items-center gap-2.5 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-300">
                    <Crown className="h-5 w-5 text-yellow-400 shrink-0" />
                    <div>
                      <div className="font-black text-yellow-300">Tikkeetii Mo'ataa (Winning Number)!</div>
                      <div className="text-[11px] text-yellow-200/80">Lakkoofsi kun carraa kanaan badhaasa olaanaa mo'ateera.</div>
                    </div>
                  </div>
                ) : isDetailMine ? (
                  <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                    <Check className="h-5 w-5 text-emerald-400 shrink-0 stroke-[3]" />
                    <div>
                      <div className="font-black text-emerald-300">Tikkeetii Keessan (Your Ticket)</div>
                      <div className="text-[11px] text-emerald-200/80">Lakkoofsa kana maqaa keessaniin qabattaniittu. Bu'aa eegaa!</div>
                    </div>
                  </div>
                ) : isDetailTaken ? (
                  <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
                    <Lock className="h-5 w-5 text-rose-400 shrink-0" />
                    <div>
                      <div className="font-black text-rose-300">Qabameera (Claimed & Locked)</div>
                      <div className="text-[11px] text-rose-200/80">Lakkoofsi kun namoota biraatiin qabameera.</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                    <Sparkles className="h-5 w-5 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-black text-emerald-300">Banaa Dha (Available to Pick)</div>
                      <div className="text-[11px] text-emerald-200/80">Lakkoofsi kun ammallee duwwaa dha. Qabachuu dandeessu!</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Body details */}
              {isDetailTaken && detailSelection ? (
                <div className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 text-xs">
                  {/* Holder */}
                  <div className="flex items-start justify-between border-b border-neutral-800/80 pb-3">
                    <div className="flex items-center gap-2 text-neutral-400">
                      <UserIcon className="h-4 w-4 text-amber-400" />
                      <span className="font-bold">Abbaa Tikkeetii (Holder):</span>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-white text-sm">
                        {detailSelection.userName}
                      </div>
                      {detailSelection.userPhone && (
                        <div className="font-mono text-[11px] text-neutral-400 mt-0.5">
                          {detailSelection.userPhone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Acquisition Time */}
                  <div className="flex items-start justify-between border-b border-neutral-800/80 pb-3">
                    <div className="flex items-center gap-2 text-neutral-400">
                      <Clock className="h-4 w-4 text-amber-400" />
                      <span className="font-bold">Yeroo Qabame (Acquisition Time):</span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-amber-300 text-xs sm:text-sm">
                        {formatAcquisitionTime(detailSelection.selectedAt)}
                      </div>
                      {getRelativeTime(detailSelection.selectedAt) && (
                        <div className="text-[10px] text-neutral-400 italic mt-0.5">
                          {getRelativeTime(detailSelection.selectedAt)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="flex items-center justify-between text-neutral-400">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-amber-400" />
                      <span className="font-bold">Gatii Tikkeetii:</span>
                    </div>
                    <span className="font-bold text-white text-sm">
                      {ticketPrice.toFixed(2)} ETB
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 text-xs">
                  <div className="flex items-center justify-between text-neutral-300">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-amber-400" />
                      <span>Gatii Tikkeetii:</span>
                    </div>
                    <span className="font-black text-amber-300 text-sm">
                      {ticketPrice.toFixed(2)} ETB
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-neutral-400 text-[11px]">
                    <span>Haala:</span>
                    <span className="font-semibold text-emerald-400">Amma banaa fi qophii dha</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
                {!isDetailTaken && !isRoundLocked ? (
                  <button
                    type="button"
                    onClick={() => {
                      const numToPick = detailModalNum;
                      setDetailModalNum(null);
                      handleCellClick(numToPick);
                    }}
                    className="flex-1 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 py-3 text-center text-xs sm:text-sm font-black text-neutral-950 shadow-lg shadow-amber-500/30 hover:brightness-110 active:scale-95"
                  >
                    🎯 Lakkoofsa #{detailModalNum} Qabadhaa ({ticketPrice} ETB)
                  </button>
                ) : isAdmin ? (
                  <button
                    type="button"
                    onClick={() => {
                      const numToManage = detailModalNum;
                      setDetailModalNum(null);
                      setAdminManageSlotNum(numToManage);
                    }}
                    className="flex-1 rounded-2xl bg-amber-500 py-3 text-xs font-black text-neutral-950 shadow hover:bg-amber-400"
                  >
                    Admin: To'adhaa / Jijjiiraa
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setDetailModalNum(null)}
                  className="rounded-2xl border border-neutral-800 bg-neutral-900 py-3 px-6 text-xs font-bold text-neutral-300 hover:bg-neutral-800 hover:text-white"
                >
                  Cufaa (Close)
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ADMIN BULK ASSIGN MODAL */}
      {bulkAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-lg rounded-3xl border-2 border-emerald-500/60 bg-neutral-950 p-6 text-white shadow-2xl shadow-emerald-500/20 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setBulkAssignModalOpen(false)}
              className="absolute top-4 right-4 rounded-xl bg-neutral-900 p-2 text-neutral-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                <UserPlus className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  Bakka Tokkotti Qabi (Bulk Slot Assign)
                </h3>
                <p className="text-xs text-neutral-400">
                  Lakkoofsota filataman hunda maqaa tokkoon galmeessi.
                </p>
              </div>
            </div>

            {/* Selected Numbers Summary */}
            <div className="mb-4 rounded-2xl border border-neutral-800 bg-neutral-900/80 p-3.5">
              <div className="flex items-center justify-between text-xs font-bold mb-2">
                <span className="text-neutral-400">Lakkoofsota Filataman:</span>
                <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-xs font-black text-emerald-300">
                  {selectedBulkNumbers.length} Tikkeetii
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                {selectedBulkNumbers.map((num) => (
                  <span
                    key={num}
                    className="rounded-lg bg-neutral-800 border border-neutral-700 px-2 py-0.5 font-mono text-xs font-black text-amber-300"
                  >
                    #{num}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-neutral-800/80 pt-2 text-xs">
                <span className="text-neutral-400">Waliigala Gatii:</span>
                <span className="font-mono text-sm font-black text-amber-400">
                  {(selectedBulkNumbers.length * ticketPrice).toFixed(2)} ETB
                </span>
              </div>
            </div>

            {/* Form Inputs */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">
                  Maqaa Fayyadamaa (Customer / Guest Name) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Fkn: Ahmed Gemechu ykn Live Stream Guest"
                  value={bulkAssignName}
                  onChange={(e) => setBulkAssignName(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1">
                  Lakk Bilbilaa (Phone - Optional)
                </label>
                <input
                  type="tel"
                  placeholder="Fkn: 0911223344"
                  value={bulkAssignPhone}
                  onChange={(e) => setBulkAssignPhone(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Quick Name Presets */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setBulkAssignName('Live Stream Guest')}
                  className="rounded-lg bg-neutral-800 hover:bg-neutral-700 px-2 py-1 text-[11px] text-neutral-300"
                >
                  + Live Stream Guest
                </button>
                <button
                  type="button"
                  onClick={() => setBulkAssignName('TikTok Live Guest')}
                  className="rounded-lg bg-neutral-800 hover:bg-neutral-700 px-2 py-1 text-[11px] text-neutral-300"
                >
                  + TikTok Live Guest
                </button>
                <button
                  type="button"
                  onClick={() => setBulkAssignName('Telegram Player')}
                  className="rounded-lg bg-neutral-800 hover:bg-neutral-700 px-2 py-1 text-[11px] text-neutral-300"
                >
                  + Telegram Player
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-rose-500/50 bg-rose-500/10 p-2.5 text-xs font-bold text-rose-300">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                disabled={bulkActionLoading || !bulkAssignName.trim()}
                onClick={handleConfirmBulkAssign}
                className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-center text-xs font-black text-white shadow-lg shadow-emerald-500/30 hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                {bulkActionLoading
                  ? 'Galmeessaa jira...'
                  : `Mirkaneessi & Qabi (${selectedBulkNumbers.length} Tikkeetii)`}
              </button>
              <button
                type="button"
                disabled={bulkActionLoading}
                onClick={() => setBulkAssignModalOpen(false)}
                className="rounded-2xl border border-neutral-800 bg-neutral-900 px-5 py-3 text-xs font-bold text-neutral-400 hover:text-white"
              >
                Dhiisi (Cancel)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN BULK RELEASE CONFIRMATION MODAL */}
      {bulkReleaseConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border-2 border-rose-500/60 bg-neutral-950 p-6 text-white shadow-2xl shadow-rose-500/20">
            <button
              type="button"
              onClick={() => setBulkReleaseConfirmOpen(false)}
              className="absolute top-4 right-4 rounded-xl bg-neutral-900 p-2 text-neutral-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  Bakka Tokkotti Gad-dhiisi (Bulk Release)
                </h3>
                <p className="text-xs text-neutral-400">
                  Lakkoofsota filataman keessaa kan qabaman gad-dhiisaa.
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-3.5 text-xs text-rose-200">
              <div className="font-black text-rose-300 mb-1">
                Akeekkachiisa (Warning):
              </div>
              Lakkoofsota qabaman{' '}
              <strong className="text-white underline">
                {selectedBulkNumbers.filter((n) => !!selections[n]).length}
              </strong>{' '}
              gad-dhiisuuf jirtu. Tikkeetiin kun battalumatti deebi'ee banaa ta'a.
            </div>

            <div className="mb-4 max-h-28 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900/60 p-2.5 flex flex-wrap gap-1.5">
              {selectedBulkNumbers
                .filter((n) => !!selections[n])
                .map((num) => (
                  <span
                    key={num}
                    className="rounded-lg bg-rose-900/40 border border-rose-600/40 px-2 py-0.5 font-mono text-xs font-black text-rose-300"
                  >
                    #{num} ({selections[num]?.userName})
                  </span>
                ))}
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-rose-500/50 bg-rose-500/10 p-2.5 text-xs font-bold text-rose-300">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                disabled={bulkActionLoading}
                onClick={handleConfirmBulkRelease}
                className="flex-1 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 py-3 text-center text-xs font-black text-white shadow-lg shadow-rose-500/30 hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                {bulkActionLoading
                  ? 'Gad-dhiisaa jira...'
                  : `Eeyyee, Gad-dhiisi (${selectedBulkNumbers.filter((n) => !!selections[n]).length} Slots)`}
              </button>
              <button
                type="button"
                disabled={bulkActionLoading}
                onClick={() => setBulkReleaseConfirmOpen(false)}
                className="rounded-2xl border border-neutral-800 bg-neutral-900 px-5 py-3 text-xs font-bold text-neutral-400 hover:text-white"
              >
                Dhiisi (Cancel)
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Authenticity Verification Proof Modal */}
      <AuthenticityVerificationModal
        isOpen={authenticityModalOpen}
        onClose={() => setAuthenticityModalOpen(false)}
      />
    </div>
  );
};
