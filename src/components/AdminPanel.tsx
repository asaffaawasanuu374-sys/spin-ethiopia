import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  RotateCw,
  CreditCard,
  Settings,
  ShieldAlert,
  Users,
  Video,
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock,
  Unlock,
  Eye,
  RefreshCw,
  Trophy,
  FileSpreadsheet,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch, getLiveStreamUrl } from '../lib/api';
import {
  Deposit,
  Withdrawal,
  PaymentMethod,
  Round,
  SystemSettings,
  AuditLog,
} from '../types/index';
import { sound } from '../lib/sound';
import { AuthenticityVerificationModal } from './AuthenticityVerificationModal';

interface AdminPanelProps {
  isOpen: boolean;
  initialTab?: 'dashboard' | 'deposits' | 'withdrawals' | 'rounds' | 'payments' | 'settings' | 'audit' | 'users' | 'obs';
  onClose: () => void;
  onDataChanged: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  initialTab = 'dashboard',
  onClose,
  onDataChanged,
}) => {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'deposits' | 'withdrawals' | 'rounds' | 'payments' | 'settings' | 'audit' | 'users' | 'obs'
  >(initialTab);

  const [metrics, setMetrics] = useState<any>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [activeRound, setActiveRound] = useState<Round | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Deposit filters and search
  const [depositFilter, setDepositFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [depositSearch, setDepositSearch] = useState('');

  // Modals inside admin
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);
  const [rejectModalDepositId, setRejectModalDepositId] = useState<string | null>(null);
  const [rejectModalWithdrawalId, setRejectModalWithdrawalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Round manual draw inputs
  const [manualFirst, setManualFirst] = useState<string>('');
  const [manualSecond, setManualSecond] = useState<string>('');
  const [manualThird, setManualThird] = useState<string>('');

  // Streamer assign slot inputs
  const [assignSlotNum, setAssignSlotNum] = useState<string>('');
  const [assignSlotName, setAssignSlotName] = useState<string>('');
  const [assignSlotPhone, setAssignSlotPhone] = useState<string>('');

  // Release slot
  const [releaseSlotNum, setReleaseSlotNum] = useState<string>('');

  // User Balance Adjustment State
  const [adjustBalanceUser, setAdjustBalanceUser] = useState<any | null>(null);
  const [adjustAction, setAdjustAction] = useState<'add' | 'deduct' | 'set'>('add');
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustLoading, setAdjustLoading] = useState<boolean>(false);

  // User Direct Ticket Assignment State
  const [assignUserDirect, setAssignUserDirect] = useState<any | null>(null);
  const [assignDirectSlotNum, setAssignDirectSlotNum] = useState<string>('');
  const [assignDirectLoading, setAssignDirectLoading] = useState<boolean>(false);

  // Real Money Payout (Telebirr/CBE) State
  const [payoutModalUser, setPayoutModalUser] = useState<any | null>(null);
  const [payoutAmount, setPayoutAmount] = useState<string>('');
  const [payoutProvider, setPayoutProvider] = useState<string>('Telebirr');
  const [payoutTxId, setPayoutTxId] = useState<string>('');
  const [payoutNote, setPayoutNote] = useState<string>('Badhaasa Mo\'ataa');
  const [payoutLoading, setPayoutLoading] = useState<boolean>(false);

  // User Profile Edit State (Name, Phone, Role, Password, Balance)
  const [editUserModal, setEditUserModal] = useState<any | null>(null);
  const [editFirstName, setEditFirstName] = useState<string>('');
  const [editLastName, setEditLastName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editRole, setEditRole] = useState<'USER' | 'ADMIN'>('USER');
  const [editNewPassword, setEditNewPassword] = useState<string>('');
  const [editBalance, setEditBalance] = useState<string>('');
  const [editUserLoading, setEditUserLoading] = useState<boolean>(false);

  // Payment method form state
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod | null>(null);

  // CSV Export Loading State
  const [csvDownloading, setCsvDownloading] = useState<string | null>(null);

  // Authenticity Verification Modal State
  const [verificationModalOpen, setVerificationModalOpen] = useState<boolean>(false);

  // Deposits table container ref for auto-scrolling
  const depositsTableContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll deposits list when deposits update
  useEffect(() => {
    if (activeTab === 'deposits' && deposits.length > 0 && depositsTableContainerRef.current) {
      depositsTableContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [deposits.length, activeTab]);

  const handleDownloadCsv = async (endpoint: string, defaultFilename: string, key: string) => {
    setCsvDownloading(key);
    sound.playClick();
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('spin_ethiopia_token') : null;
      const res = await fetch(endpoint, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `CSV buufachuun hin danda'amne (${res.status})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setSuccessMsg(`${defaultFilename} milkaa'inaan buufameera!`);
    } catch (err: any) {
      setError(err.message || 'CSV buufachuun hin danda\'amne');
    } finally {
      setCsvDownloading(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      loadAllAdminData();
    }
  }, [isOpen, initialTab]);

  // Real-time SSE listener and polling fallback inside Admin Panel for instant deposit notifications
  useEffect(() => {
    if (!isOpen) return;

    loadAllAdminData();

    const es = new EventSource(getLiveStreamUrl());

    const handleEvent = (data: any) => {
      if (!data) return;
      if (data.type === 'deposit_submitted') {
        sound.playUrgentDepositAlert();
        setSuccessMsg(`🔔 Kaffaltiin haaraa dhufeera! ${data.amount} ETB (${data.userName || ''} - ${data.userPhone || ''}) FT: ${data.transactionId || ''}`);
        // Fetch deposits immediately
        apiFetch('/api/admin/deposits').then((res) => {
          if (res.deposits) setDeposits(res.deposits);
        }).catch(() => {});
        onDataChanged();
      } else if (data.type === 'deposit_approved' || data.type === 'deposit_rejected') {
        apiFetch('/api/admin/deposits').then((res) => {
          if (res.deposits) setDeposits(res.deposits);
        }).catch(() => {});
        onDataChanged();
      } else if (data.type === 'ticket_purchased' || data.type === 'withdrawal_submitted') {
        loadAllAdminData();
        onDataChanged();
      }
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleEvent(data);
      } catch {}
    };

    es.addEventListener('deposit_submitted', (event: any) => {
      try {
        const data = JSON.parse(event.data);
        handleEvent(data);
      } catch {}
    });

    // Auto-polling every 4 seconds to guarantee admin sees new deposits even if SSE connection resets
    const pollInterval = setInterval(() => {
      apiFetch('/api/admin/deposits')
        .then((res) => {
          if (res.deposits) setDeposits(res.deposits);
        })
        .catch(() => {});
    }, 4000);

    return () => {
      es.close();
      clearInterval(pollInterval);
    };
  }, [isOpen]);

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        apiFetch('/api/admin/metrics'),
        apiFetch('/api/admin/deposits'),
        apiFetch('/api/admin/withdrawals'),
        apiFetch('/api/round/active'),
        apiFetch('/api/admin/payment-methods'),
        apiFetch('/api/admin/settings'),
        apiFetch('/api/admin/audit-logs'),
        apiFetch('/api/admin/users'),
      ]);

      if (results[0].status === 'fulfilled' && results[0].value?.metrics) setMetrics(results[0].value.metrics);
      if (results[1].status === 'fulfilled' && results[1].value?.deposits) setDeposits(results[1].value.deposits);
      if (results[2].status === 'fulfilled' && results[2].value?.withdrawals) setWithdrawals(results[2].value.withdrawals);
      if (results[3].status === 'fulfilled' && results[3].value?.round) setActiveRound(results[3].value.round);
      if (results[4].status === 'fulfilled' && results[4].value?.methods) setPaymentMethods(results[4].value.methods);
      if (results[5].status === 'fulfilled' && results[5].value?.settings) setSettings(results[5].value.settings);
      if (results[6].status === 'fulfilled' && results[6].value?.logs) setAuditLogs(results[6].value.logs);
      if (results[7].status === 'fulfilled' && results[7].value?.users) setUsersList(results[7].value.users);
    } catch (err: any) {
      setError(err.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Deposit Actions (Idempotent)
  const handleApproveDeposit = async (depositId: string) => {
    sound.playClick();
    setError('');
    setSuccessMsg('');
    try {
      const res = await apiFetch('/api/admin/deposits/approve', {
        method: 'POST',
        body: JSON.stringify({ depositId }),
      });
      setSuccessMsg(res.message);
      sound.playWin();
      loadAllAdminData();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Deposit approval failed');
    }
  };

  const handleConfirmRejectDeposit = async () => {
    if (!rejectModalDepositId) return;
    sound.playClick();
    try {
      const res = await apiFetch('/api/admin/deposits/reject', {
        method: 'POST',
        body: JSON.stringify({ depositId: rejectModalDepositId, reason: rejectReason }),
      });
      setSuccessMsg(res.message);
      setRejectModalDepositId(null);
      setRejectReason('');
      loadAllAdminData();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Deposit rejection failed');
    }
  };

  // Withdrawal Actions
  const handleApproveWithdrawal = async (withdrawalId: string) => {
    sound.playClick();
    try {
      const res = await apiFetch('/api/admin/withdrawals/approve', {
        method: 'POST',
        body: JSON.stringify({ withdrawalId }),
      });
      setSuccessMsg(res.message);
      loadAllAdminData();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Withdrawal approval failed');
    }
  };

  const handleConfirmRejectWithdrawal = async () => {
    if (!rejectModalWithdrawalId) return;
    sound.playClick();
    try {
      const res = await apiFetch('/api/admin/withdrawals/reject', {
        method: 'POST',
        body: JSON.stringify({ withdrawalId: rejectModalWithdrawalId, reason: rejectReason }),
      });
      setSuccessMsg(res.message);
      setRejectModalWithdrawalId(null);
      setRejectReason('');
      loadAllAdminData();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Withdrawal rejection failed');
    }
  };

  // Round Controls
  const handleLockToggle = async (lock: boolean) => {
    sound.playClick();
    try {
      const endpoint = lock ? '/api/admin/rounds/lock' : '/api/admin/rounds/unlock';
      const res = await apiFetch(endpoint, { method: 'POST' });
      setActiveRound(res.round);
      setSuccessMsg(lock ? 'Round locked successfully' : 'Round unlocked successfully');
      loadAllAdminData();
      onDataChanged();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDrawWinners = async () => {
    sound.playClick();
    if (!window.confirm('Eeyyee, caaraa mo\'attootaa baasuu fi badhaasa qooduu barbaadduu? (Are you sure you want to draw winners and distribute prizes?)')) {
      return;
    }

    try {
      const manualWinners = {
        first: manualFirst ? Number(manualFirst) : undefined,
        second: manualSecond ? Number(manualSecond) : undefined,
        third: manualThird ? Number(manualThird) : undefined,
      };

      const res = await apiFetch('/api/admin/rounds/draw', {
        method: 'POST',
        body: JSON.stringify({ manualWinners }),
      });

      setSuccessMsg('Caaraan mo\'attootaa milkaa\'inaan jalqabeera! (15s draw started)');
      sound.playWin();
      setManualFirst('');
      setManualSecond('');
      setManualThird('');
      loadAllAdminData();
      onDataChanged();
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePayRealCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutModalUser || !payoutAmount || Number(payoutAmount) <= 0) {
      setError('Hamma qarshii sirrii galchaa');
      return;
    }
    setPayoutLoading(true);
    setError('');
    sound.playClick();
    try {
      const res = await apiFetch('/api/admin/users/payout-real-cash', {
        method: 'POST',
        body: JSON.stringify({
          userId: payoutModalUser.id,
          amount: Number(payoutAmount),
          provider: payoutProvider,
          transactionId: payoutTxId,
          note: payoutNote,
        }),
      });
      setSuccessMsg(res.message);
      sound.playWin();
      setPayoutModalUser(null);
      setPayoutAmount('');
      setPayoutTxId('');
      loadAllAdminData();
      onDataChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPayoutLoading(false);
    }
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserModal) return;
    setEditUserLoading(true);
    setError('');
    sound.playClick();
    try {
      const res = await apiFetch('/api/admin/users/update', {
        method: 'POST',
        body: JSON.stringify({
          userId: editUserModal.id,
          firstName: editFirstName,
          lastName: editLastName,
          phone: editPhone,
          role: editRole,
          newPassword: editNewPassword || undefined,
          walletBalance: editBalance !== '' ? Number(editBalance) : undefined,
        }),
      });
      setSuccessMsg(res.message);
      sound.playWin();
      setEditUserModal(null);
      loadAllAdminData();
      onDataChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEditUserLoading(false);
    }
  };

  const handleAssignSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    sound.playClick();
    try {
      const res = await apiFetch('/api/admin/rounds/assign-slot', {
        method: 'POST',
        body: JSON.stringify({
          number: Number(assignSlotNum),
          userName: assignSlotName,
          userPhone: assignSlotPhone,
        }),
      });
      setActiveRound(res.round);
      setSuccessMsg(`Slot #${assignSlotNum} assigned to ${assignSlotName}`);
      setAssignSlotNum('');
      setAssignSlotName('');
      setAssignSlotPhone('');
      loadAllAdminData();
      onDataChanged();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleReleaseSlot = async () => {
    if (!releaseSlotNum) return;
    sound.playClick();
    try {
      const res = await apiFetch('/api/admin/rounds/release-slot', {
        method: 'POST',
        body: JSON.stringify({ number: Number(releaseSlotNum) }),
      });
      setActiveRound(res.round);
      setSuccessMsg(`Slot #${releaseSlotNum} released back to open pool`);
      setReleaseSlotNum('');
      loadAllAdminData();
      onDataChanged();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFillSimulated = async (count: number) => {
    sound.playClick();
    try {
      const res = await apiFetch('/api/admin/rounds/fill-simulated', {
        method: 'POST',
        body: JSON.stringify({ count }),
      });
      if (res.round) setActiveRound(res.round);
      sound.playWin();
      setSuccessMsg(res.message || `Tikkeetota ${count} maqaa namootaan qabamaniiru`);
      loadAllAdminData();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Tikkeetota guutuun hin danda\'amne');
    }
  };

  const handleClearSimulated = async () => {
    sound.playClick();
    try {
      const res = await apiFetch('/api/admin/rounds/clear-simulated', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res.round) setActiveRound(res.round);
      sound.playClick();
      setSuccessMsg(res.message || 'Tikkeetoonni sossobaa hundi duwwaa ta\'aniiru');
      loadAllAdminData();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Duwwaa gochuun hin danda\'amne');
    }
  };

  const handleFillFiftyPercent = async () => {
    sound.playClick();
    try {
      const res = await apiFetch('/api/admin/rounds/fill-fifty-percent', {
        method: 'POST',
      });
      if (res.round) setActiveRound(res.round);
      sound.playWin();
      setSuccessMsg(res.message || 'Lakkoofsi 50% (50/100) mirkaneeffamee qabameera!');
      loadAllAdminData();
      onDataChanged();
    } catch (err: any) {
      setError(err.message || 'Lakkoofsa 50% qabuun hin danda\'amne');
    }
  };

  const handleConfirmAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustBalanceUser || !adjustAmount) return;
    const numAmount = parseFloat(adjustAmount);
    if (isNaN(numAmount) || numAmount < 0) {
      setError('Hanga qarshii sirrii galchaa');
      return;
    }
    setAdjustLoading(true);
    sound.playClick();
    try {
      const res = await apiFetch('/api/admin/users/adjust-balance', {
        method: 'POST',
        body: JSON.stringify({
          userId: adjustBalanceUser.id,
          action: adjustAction,
          amount: numAmount,
          reason: adjustReason || 'Sirreeffama Admin',
        }),
      });
      if (res.success) {
        sound.playCoin();
        setSuccessMsg(`Herregni ${adjustBalanceUser.firstName} milkaa'inaan sirreeffameera! Haftee haaraan: ${res.user.walletBalance} ETB`);
        setAdjustBalanceUser(null);
        setAdjustAmount('');
        setAdjustReason('');
        loadAllAdminData();
        onDataChanged();
      }
    } catch (err: any) {
      setError(err.message || 'Sirreeffamni herregaa hin milkoofne');
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleConfirmAssignUserDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignUserDirect || !assignDirectSlotNum) return;
    const slotNumber = parseInt(assignDirectSlotNum);
    if (isNaN(slotNumber) || slotNumber < 1 || slotNumber > 100) {
      setError('Lakkoofsi 1 hanga 100 gidduu ta\'uu qaba');
      return;
    }
    setAssignDirectLoading(true);
    sound.playClick();
    try {
      const res = await apiFetch('/api/admin/rounds/assign-slot', {
        method: 'POST',
        body: JSON.stringify({
          number: slotNumber,
          userName: `${assignUserDirect.firstName} ${assignUserDirect.lastName}`.trim(),
          userPhone: assignUserDirect.phone,
        }),
      });
      if (res.success) {
        sound.playWin();
        setSuccessMsg(`Lakkoofsi #${slotNumber} ${assignUserDirect.firstName} ${assignUserDirect.lastName}f qabameera!`);
        setAssignUserDirect(null);
        setAssignDirectSlotNum('');
        setActiveRound(res.round);
        loadAllAdminData();
        onDataChanged();
      }
    } catch (err: any) {
      setError(err.message || 'Lakkoofsa qabuun hin danda\'amne');
    } finally {
      setAssignDirectLoading(false);
    }
  };

  // Payment Method Save
  const handleSavePaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPaymentMethod) return;
    sound.playClick();
    try {
      await apiFetch('/api/admin/payment-methods', {
        method: 'POST',
        body: JSON.stringify(editingPaymentMethod),
      });
      setSuccessMsg('Payment destination configured successfully');
      setEditingPaymentMethod(null);
      loadAllAdminData();
      onDataChanged();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Settings Save
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    sound.playClick();
    try {
      await apiFetch('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify(settings),
      });
      setSuccessMsg('System settings saved successfully');
      loadAllAdminData();
      onDataChanged();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const liveUrl = typeof window !== 'undefined' ? `${window.location.origin}/live` : 'https://spinethiopia.com/live';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-md">
      <div className="relative flex h-[94vh] w-full max-w-6xl flex-col rounded-2xl border border-amber-500/40 bg-neutral-900 text-white shadow-2xl">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-neutral-950 font-bold">
              SP
            </div>
            <div>
              <h2 className="text-lg font-bold text-amber-400">
                Garee To'annoo Admin (Admin Dashboard)
              </h2>
              <p className="text-xs text-neutral-400">
                Spin Ethiopia - To'annoo Kaffaltii, Baasii, fi Caaraa
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadAllAdminData}
              className="flex items-center gap-1.5 rounded-lg bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700 hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Haromsu (Refresh)</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex flex-wrap border-b border-neutral-800 bg-neutral-950/70 px-4 text-xs font-semibold">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'deposits', label: `Galii (${metrics?.pendingDepositsCount || 0})`, icon: ArrowDownCircle },
            { id: 'withdrawals', label: `Baasii (${metrics?.pendingWithdrawalsCount || 0})`, icon: ArrowUpCircle },
            { id: 'rounds', label: 'Marsaa & Caaraa', icon: RotateCw },
            { id: 'payments', label: 'Malla Kaffaltii', icon: CreditCard },
            { id: 'settings', label: 'Sajoo (Settings)', icon: Settings },
            { id: 'users', label: 'Fayyadamtota', icon: Users },
            { id: 'audit', label: 'Galmee Audit', icon: ShieldAlert },
            { id: 'obs', label: 'OBS / TikTok Live', icon: Video },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setError('');
                  setSuccessMsg('');
                  sound.playClick();
                }}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 transition ${
                  isActive
                    ? 'border-amber-500 text-amber-400 bg-neutral-800/50'
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError('')} className="text-neutral-400 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
              <button onClick={() => setSuccessMsg('')} className="text-neutral-400 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && metrics && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                  <span className="text-xs text-neutral-400">Waliigala Fayyadamtoota</span>
                  <div className="mt-2 text-2xl font-bold text-white">{metrics.totalUsers}</div>
                  <span className="text-[11px] text-emerald-400">Galmaa'aniiru</span>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-neutral-950 p-4">
                  <span className="text-xs text-amber-400">Kaffaltii Eegaa Jiru (Pending Deposits)</span>
                  <div className="mt-2 text-2xl font-bold text-amber-400">
                    {metrics.pendingDepositsCount}
                  </div>
                  <span className="text-[11px] text-neutral-400">Mirkaneessuuf qophii</span>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                  <span className="text-xs text-neutral-400">Gaaffii Baasii Eegaa Jiru</span>
                  <div className="mt-2 text-2xl font-bold text-blue-400">
                    {metrics.pendingWithdrawalsCount}
                  </div>
                  <span className="text-[11px] text-neutral-400">Baasii herregaa</span>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                  <span className="text-xs text-neutral-400">Baajata Caaraa Ammaa (Pool)</span>
                  <div className="mt-2 font-mono text-2xl font-bold text-emerald-400">
                    {metrics.activeRoundPool.toFixed(2)} ETB
                  </div>
                  <span className="text-[11px] text-neutral-400">
                    Tikkeetii {metrics.activeRoundTicketsSold}/100
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
                  <h4 className="text-sm font-bold text-white mb-3">Waliigala Kaffaltii Mirkanaa'e (Deposits Volume)</h4>
                  <div className="font-mono text-3xl font-bold text-emerald-400">
                    {metrics.totalDepositVolume.toFixed(2)} ETB
                  </div>
                  <p className="mt-2 text-xs text-neutral-400">
                    Qarshii kaffaltii harkaan admin biratti mirkanaa'e
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
                  <h4 className="text-sm font-bold text-white mb-3">Waliigala Baasii Kaffalame (Payouts Volume)</h4>
                  <div className="font-mono text-3xl font-bold text-amber-400">
                    {metrics.totalWithdrawalVolume.toFixed(2)} ETB
                  </div>
                  <p className="mt-2 text-xs text-neutral-400">
                    Qarshii mo'attootaaf ykn fayyadamtootaaf baasii ta'e
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: DEPOSITS (Idempotent Approval & Rejection) */}
          {activeTab === 'deposits' && (() => {
            const pendingCount = deposits.filter((d) => d.status === 'PENDING').length;
            const approvedCount = deposits.filter((d) => d.status === 'APPROVED').length;
            const rejectedCount = deposits.filter((d) => d.status === 'REJECTED').length;

            const filteredDeposits = deposits.filter((dep) => {
              if (depositFilter !== 'ALL' && dep.status !== depositFilter) return false;
              if (depositSearch.trim()) {
                const q = depositSearch.toLowerCase();
                const matchPhone = dep.userPhone.toLowerCase().includes(q);
                const matchName = (dep.userName || '').toLowerCase().includes(q);
                const matchTx = (dep.transactionId || '').toLowerCase().includes(q);
                const matchProv = (dep.provider || '').toLowerCase().includes(q);
                if (!matchPhone && !matchName && !matchTx && !matchProv) return false;
              }
              return true;
            });

            return (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-amber-400">Galii Kaffaltii (Manual Deposits)</h3>
                      <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Live Real-Time
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400">
                      Kaffaltii fayyadamaan erge ragaa suuraa fi FT ilaaluun mirkaneessaa. Erga mirkaneessitanii sekondii keessatti herregatti ida'ama.
                    </p>
                  </div>
                  <button
                    onClick={loadAllAdminData}
                    className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:border-amber-500 hover:text-white transition"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>Haaromsi (Refresh)</span>
                  </button>
                </div>

                {/* Filter and Search Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setDepositFilter('PENDING')}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        depositFilter === 'PENDING'
                          ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                          : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      <span>Eegaa Jiran (Pending)</span>
                      {pendingCount > 0 && (
                        <span className="rounded-full bg-red-600 px-1.5 py-0.2 text-[10px] text-white font-extrabold animate-pulse">
                          {pendingCount}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => setDepositFilter('APPROVED')}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        depositFilter === 'APPROVED'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                          : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      <span>Mirkanaa'an (Approved)</span>
                      <span className="text-[10px] opacity-75">({approvedCount})</span>
                    </button>

                    <button
                      onClick={() => setDepositFilter('REJECTED')}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        depositFilter === 'REJECTED'
                          ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                          : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      <span>Kuffifaman (Rejected)</span>
                      <span className="text-[10px] opacity-75">({rejectedCount})</span>
                    </button>

                    <button
                      onClick={() => setDepositFilter('ALL')}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        depositFilter === 'ALL'
                          ? 'bg-neutral-700 text-white'
                          : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800'
                      }`}
                    >
                      <span>Hundumaa ({deposits.length})</span>
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Bilbila, Maqaa, ykn FT barbaadi..."
                      value={depositSearch}
                      onChange={(e) => setDepositSearch(e.target.value)}
                      className="w-full sm:w-64 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
                    />
                    {depositSearch && (
                      <button
                        onClick={() => setDepositSearch('')}
                        className="absolute right-2.5 top-1.5 text-xs text-neutral-400 hover:text-white"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {filteredDeposits.length === 0 ? (
                  <div className="py-12 text-center rounded-xl border border-neutral-800 bg-neutral-950/50">
                    <p className="text-neutral-400 text-sm font-semibold">Galmeen kaffaltii barbaaddan hin jiru</p>
                    {depositFilter === 'PENDING' && (
                      <p className="text-xs text-emerald-400 mt-1">Kaffaltiin eegaa jiru hin jiru (Yeroof qulqulluudha!)</p>
                    )}
                  </div>
                ) : (
                  <div ref={depositsTableContainerRef} className="overflow-x-auto rounded-xl border border-neutral-800 max-h-[600px] overflow-y-auto scroll-smooth">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-neutral-800 bg-neutral-950 text-neutral-400 uppercase font-semibold sticky top-0 z-10">
                        <tr>
                          <th className="p-3">Fayyaddamaa</th>
                          <th className="p-3">Malla / Baankii</th>
                          <th className="p-3">Hanga Qarshii</th>
                          <th className="p-3">FT / TxID</th>
                          <th className="p-3">Ragaa (Receipt)</th>
                          <th className="p-3">Haala (Status)</th>
                          <th className="p-3">Guyyaa</th>
                          <th className="p-3 text-right">Tarkaanfii (Action)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/60 bg-neutral-900/40">
                        {filteredDeposits.map((dep, idx) => (
                          <tr
                            key={dep.id}
                            className={`hover:bg-neutral-800/40 transition ${
                              dep.status === 'PENDING' && idx === 0
                                ? 'bg-amber-500/10 border-l-4 border-amber-400 shadow-inner'
                                : ''
                            }`}
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white">{dep.userName}</span>
                                {dep.status === 'PENDING' && idx === 0 && (
                                  <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider animate-pulse">
                                    Haaraa (New)
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-neutral-400">{dep.userPhone}</div>
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-neutral-200">{dep.provider}</div>
                              <div className="text-[11px] text-neutral-500">{dep.accountNumber}</div>
                            </td>
                            <td className="p-3 font-mono font-bold text-emerald-400 text-sm">
                              {dep.amount.toFixed(2)} ETB
                            </td>
                            <td className="p-3 font-mono font-bold text-amber-300">
                              {dep.transactionId}
                            </td>
                            <td className="p-3">
                              {dep.receiptUrl ? (
                                <button
                                  onClick={() => setPreviewReceiptUrl(dep.receiptUrl)}
                                  className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:border-amber-500 hover:text-white"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>Ilaali</span>
                                </button>
                              ) : (
                                <span className="text-neutral-500">Hin jiru</span>
                              )}
                            </td>
                            <td className="p-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  dep.status === 'APPROVED'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : dep.status === 'REJECTED'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-amber-500/20 text-amber-300 animate-pulse'
                                }`}
                              >
                                {dep.status}
                              </span>
                            </td>
                            <td className="p-3 text-[11px] text-neutral-400">
                              {new Date(dep.createdAt).toLocaleString()}
                            </td>
                            <td className="p-3 text-right">
                              {dep.status === 'PENDING' ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleApproveDeposit(dep.id)}
                                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20"
                                  >
                                    Mirkaneessi (Approve)
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRejectModalDepositId(dep.id);
                                      setRejectReason('');
                                    }}
                                    className="rounded-lg bg-neutral-800 px-2.5 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20"
                                  >
                                    Kuffisi (Reject)
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-neutral-500 font-mono">
                                  {dep.reviewedBy ? `By: ${dep.reviewedBy}` : 'Completed'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* TAB: WITHDRAWALS */}
          {activeTab === 'withdrawals' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-amber-400">Gaaffii Baasii (Withdrawal Requests)</h3>
                  <p className="text-xs text-neutral-400">
                    Fayyadamtoota qarshii baasuu gaafatan to'adhaa. Kuffisuun qarshii isaanii deebisa.
                  </p>
                </div>
              </div>

              {withdrawals.length === 0 ? (
                <div className="py-12 text-center text-neutral-500">Gaaffiin baasii hin jiru</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-neutral-800">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-neutral-800 bg-neutral-950 text-neutral-400 uppercase font-semibold">
                      <tr>
                        <th className="p-3">Fayyaddamaa</th>
                        <th className="p-3">Baankii/Telebirr</th>
                        <th className="p-3">Maqaa Herregaa</th>
                        <th className="p-3">Lakk Herregaa</th>
                        <th className="p-3">Hanga</th>
                        <th className="p-3">Haala</th>
                        <th className="p-3">Guyyaa</th>
                        <th className="p-3 text-right">Tarkaanfii</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 bg-neutral-900/40">
                      {withdrawals.map((wdr) => (
                        <tr key={wdr.id} className="hover:bg-neutral-800/40">
                          <td className="p-3">
                            <div className="font-bold text-white">{wdr.userName}</div>
                            <div className="font-mono text-neutral-400">{wdr.userPhone}</div>
                          </td>
                          <td className="p-3 font-semibold text-neutral-200">{wdr.provider}</td>
                          <td className="p-3 text-neutral-300">{wdr.accountName}</td>
                          <td className="p-3 font-mono font-bold text-amber-300">{wdr.accountNumber}</td>
                          <td className="p-3 font-mono font-bold text-emerald-400 text-sm">
                            {wdr.amount.toFixed(2)} ETB
                          </td>
                          <td className="p-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                wdr.status === 'APPROVED'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : wdr.status === 'REJECTED'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {wdr.status}
                            </span>
                          </td>
                          <td className="p-3 text-[11px] text-neutral-400">
                            {new Date(wdr.createdAt).toLocaleString()}
                          </td>
                          <td className="p-3 text-right">
                            {wdr.status === 'PENDING' ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleApproveWithdrawal(wdr.id)}
                                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500"
                                >
                                  Mirkaneessi
                                </button>
                                <button
                                  onClick={() => {
                                    setRejectModalWithdrawalId(wdr.id);
                                    setRejectReason('');
                                  }}
                                  className="rounded-lg bg-neutral-800 px-2.5 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20"
                                >
                                  Kuffisi & Deebisi
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-neutral-500 font-mono">
                                {wdr.reviewedBy ? `By: ${wdr.reviewedBy}` : 'Completed'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB: ROUNDS & LUCKY DRAW */}
          {activeTab === 'rounds' && activeRound && (
            <div className="space-y-6">
              {/* Active Round Summary Card */}
              <div className="rounded-xl border border-amber-500/30 bg-neutral-950 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-amber-400">
                      Marsaa #{activeRound.roundNumber} (Round Status)
                    </h3>
                    <div className="mt-1 flex items-center gap-3 text-xs text-neutral-400">
                      <span>Haala: <strong className="text-white uppercase">{activeRound.status}</strong></span>
                      <span>•</span>
                      <span>Baajata: <strong className="text-emerald-400 font-mono">{activeRound.totalPool.toFixed(2)} ETB</strong></span>
                      <span>•</span>
                      <span>Tikkeetii: <strong className="text-amber-300">{Object.keys(activeRound.selections).length}/100</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeRound.status === 'OPEN' ? (
                      <button
                        onClick={() => handleLockToggle(true)}
                        className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500"
                      >
                        <Lock className="h-4 w-4" />
                        <span>Marsaa Cufi (Lock Round)</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleLockToggle(false)}
                        className="flex items-center gap-1.5 rounded-xl bg-neutral-800 px-4 py-2 text-xs font-bold text-neutral-300 hover:bg-neutral-700"
                      >
                        <Unlock className="h-4 w-4" />
                        <span>Bani (Unlock)</span>
                      </button>
                    )}

                    <button
                      onClick={handleDrawWinners}
                      disabled={Object.keys(activeRound.selections).length === 0}
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-2 text-xs font-extrabold text-neutral-950 shadow-lg shadow-amber-500/30 hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50"
                    >
                      <RotateCw className="h-4 w-4" />
                      <span>Caaraa Baasi (Spin & Draw Winners!)</span>
                    </button>

                    <button
                      onClick={() =>
                        handleDownloadCsv(
                          '/api/admin/rounds/export-csv',
                          `spin_ethiopia_round_winners_${Date.now()}.csv`,
                          'winners'
                        )
                      }
                      disabled={csvDownloading === 'winners'}
                      className="flex items-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-bold text-yellow-300 hover:border-yellow-400 hover:text-white transition"
                      title="Mo'attoota Marsaalee CSV Buufadhu"
                    >
                      <Download className={`h-4 w-4 ${csvDownloading === 'winners' ? 'animate-bounce' : ''}`} />
                      <span className="hidden sm:inline">CSV Mo'attootaa</span>
                    </button>
                  </div>
                </div>

                {/* Optional Manual Winner Assignment */}
                <div className="mt-4 pt-2">
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                    Filannoo Mo'ataa Qopheessuu (Optional Manual Override Before Draw)
                  </h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                    <div>
                      <label className="block text-neutral-400 mb-1">1ffaa (3,000 ETB):</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="Random yoo duwwaa ta'e"
                        value={manualFirst}
                        onChange={(e) => setManualFirst(e.target.value)}
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">2ffaa (500 ETB):</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="Random"
                        value={manualSecond}
                        onChange={(e) => setManualSecond(e.target.value)}
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">3ffaa (200 ETB):</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="Random"
                        value={manualThird}
                        onChange={(e) => setManualThird(e.target.value)}
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Urgency / Demand Booster & Clear Simulated Slots ("lakk gimashin wan qabame jiruti maqaa namotaatiin qabi... yeroo namni dhufe duuwwaa tasisia") */}
              <div className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-950/30 via-neutral-900 to-neutral-950 p-4 sm:p-5 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 font-bold text-xs">
                        🔥
                      </span>
                      <h4 className="text-sm font-black text-white">
                        Fedhii Tikkeetii Uumuu & Duwwaa Gochuu (Urgency Demand & Reset)
                      </h4>
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">
                      Namoonni tikkeetiin dhumuuf jiraachuu arganii akka dafanii qabatan maqaa namootaan qabaa. Yeroo namoonni dhugaa dhufan immoo bakkasaa duwwaa godhaa.
                    </p>
                  </div>

                  {/* Status Pills */}
                  {activeRound && (
                    <div className="flex items-center gap-2 text-[11px] font-bold">
                      <span className="rounded-lg bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-1 text-emerald-300">
                        Dhugaa: {Object.values(activeRound.selections).filter((s: any) => !s.isSimulated).length}
                      </span>
                      <span className="rounded-lg bg-amber-950/80 border border-amber-500/40 px-2.5 py-1 text-amber-300">
                        Sossobaa: {Object.values(activeRound.selections).filter((s: any) => s.isSimulated).length}
                      </span>
                      <span className="rounded-lg bg-neutral-800 border border-neutral-700 px-2.5 py-1 text-neutral-300">
                        Banaa: {100 - Object.keys(activeRound.selections).length}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={handleFillFiftyPercent}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-emerald-500 bg-gradient-to-b from-emerald-500/30 via-emerald-950/40 to-neutral-950 p-3 text-center hover:border-emerald-400 hover:from-emerald-500/40 transition shadow-lg shadow-emerald-950/50"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-emerald-300">
                        ⚡ 50% Qabi (50/100 Ha Qabamu)
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-200/90 font-bold">
                      Maqaa Itoophiyaatiin 50 guutaa (2,500 ETB Pool)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVerificationModalOpen(true)}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-cyan-500/60 bg-gradient-to-b from-cyan-500/20 to-neutral-950 p-3 text-center hover:border-cyan-400 hover:bg-cyan-500/30 transition shadow"
                  >
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-cyan-400" />
                      <span className="text-sm font-black text-cyan-300">
                        Mirkaneessa Dhugaa (Verify 50%)
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-300 font-medium">
                      SHA-256 fi tarree tikkeetota 50 mirkaneessi
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFillSimulated(30)}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl border border-amber-500/40 bg-gradient-to-b from-amber-500/20 to-amber-950/40 p-3 text-center hover:border-amber-400 hover:from-amber-500/30 transition shadow"
                  >
                    <span className="text-sm font-black text-amber-300">
                      ⚡ +30 Qabi (Urgency Demand)
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      Tikkeetota 30 dabalataan guutaa
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearSimulated}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-red-500/50 bg-gradient-to-b from-red-500/20 to-neutral-900 p-3 text-center hover:border-red-400 hover:bg-red-500/30 transition shadow"
                  >
                    <span className="text-sm font-black text-red-300">
                      🧹 Bakka Duwwaa Godhi (Clear)
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      Kan maqaan qabame duwwaa taasisaa
                    </span>
                  </button>
                </div>
              </div>

              {/* Streamer Live Number Assignment Form */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <form
                  onSubmit={handleAssignSlot}
                  className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-3"
                >
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    TikTok / Streamer Number Assignment (Assign Slot to Live Guest)
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="block text-neutral-400 mb-1">Lakkoofsa (1-100):</label>
                      <input
                        type="number"
                        required
                        min="1"
                        max="100"
                        value={assignSlotNum}
                        onChange={(e) => setAssignSlotNum(e.target.value)}
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">Maqaa (Name):</label>
                      <input
                        type="text"
                        required
                        value={assignSlotName}
                        onChange={(e) => setAssignSlotName(e.target.value)}
                        placeholder="TikTok Guest"
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">Bilbila (Phone):</label>
                      <input
                        type="text"
                        value={assignSlotPhone}
                        onChange={(e) => setAssignSlotPhone(e.target.value)}
                        placeholder="09..."
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white font-mono"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-amber-500 py-2 text-xs font-bold text-neutral-950 hover:bg-amber-400"
                  >
                    Lakkoofsa Qabi (Assign Slot)
                  </button>
                </form>

                {/* Release Slot Form */}
                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-3">
                  <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">
                    Lakkoofsa Gad-Dhiisi (Release Slot)
                  </h4>
                  <p className="text-xs text-neutral-400">
                    Lakkoofsa kanaan dura qabame tokko deebisaa banaa taasisaa.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={releaseSlotNum}
                      onChange={(e) => setReleaseSlotNum(e.target.value)}
                      placeholder="Lakkoofsa (1-100)"
                      className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleReleaseSlot}
                      className="rounded-lg bg-red-600/80 px-4 py-2 text-xs font-bold text-white hover:bg-red-500"
                    >
                      Gad-Dhiisi (Release)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PAYMENT METHODS */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-amber-400">
                    Malla Kaffaltii To'adhaa (Payment Destinations)
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Odeeffannoo herrega CBE, Awash, fi Telebirr qindeessaa.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {paymentMethods.map((pm) => (
                  <div
                    key={pm.id}
                    className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-400">{pm.provider}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          pm.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {pm.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-300">
                      <div>Maqaa: <strong>{pm.accountName}</strong></div>
                      <div>Lakk: <strong className="font-mono text-amber-300">{pm.accountNumber}</strong></div>
                      {pm.phoneNumber && <div>Bilbila: <strong className="font-mono">{pm.phoneNumber}</strong></div>}
                      <div>Hanga: {pm.minAmount} - {pm.maxAmount} ETB</div>
                    </div>
                    <button
                      onClick={() => setEditingPaymentMethod({ ...pm })}
                      className="w-full mt-2 rounded-lg bg-neutral-800 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-700 hover:text-white"
                    >
                      Gulaali (Edit)
                    </button>
                  </div>
                ))}
              </div>

              {/* Edit Payment Method Form */}
              {editingPaymentMethod && (
                <form
                  onSubmit={handleSavePaymentMethod}
                  className="rounded-xl border border-amber-500/30 bg-neutral-950 p-5 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                    <h4 className="font-bold text-amber-400">
                      Gulaali: {editingPaymentMethod.provider}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setEditingPaymentMethod(null)}
                      className="text-neutral-400 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-neutral-400 mb-1">Maqaa Herregaa (Account Name):</label>
                      <input
                        type="text"
                        required
                        value={editingPaymentMethod.accountName}
                        onChange={(e) =>
                          setEditingPaymentMethod({
                            ...editingPaymentMethod,
                            accountName: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">Lakk Herregaa (Account Number):</label>
                      <input
                        type="text"
                        required
                        value={editingPaymentMethod.accountNumber}
                        onChange={(e) =>
                          setEditingPaymentMethod({
                            ...editingPaymentMethod,
                            accountNumber: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">Lakk Bilbilaa (Phone - Telebirr):</label>
                      <input
                        type="text"
                        value={editingPaymentMethod.phoneNumber || ''}
                        onChange={(e) =>
                          setEditingPaymentMethod({
                            ...editingPaymentMethod,
                            phoneNumber: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 mb-1">Qajeelfama (Instructions):</label>
                      <input
                        type="text"
                        value={editingPaymentMethod.instructions}
                        onChange={(e) =>
                          setEditingPaymentMethod({
                            ...editingPaymentMethod,
                            instructions: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingPaymentMethod.isActive}
                        onChange={(e) =>
                          setEditingPaymentMethod({
                            ...editingPaymentMethod,
                            isActive: e.target.checked,
                          })
                        }
                        className="rounded border-neutral-700"
                      />
                      <span>Active (Fayyadamtoonni akka argan eeyyami)</span>
                    </label>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingPaymentMethod(null)}
                      className="rounded-lg bg-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-300"
                    >
                      Dhiisi
                    </button>
                    <button
                      type="submit"
                      className="rounded-lg bg-amber-500 px-5 py-2 text-xs font-bold text-neutral-950 hover:bg-amber-400"
                    >
                      Ol-Kaa'i (Save Changes)
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB: SETTINGS & PRIZE DISTRIBUTION */}
          {activeTab === 'settings' && settings && (
            <form onSubmit={handleSaveSettings} className="max-w-2xl space-y-5">
              <h3 className="text-base font-bold text-amber-400">
                Sajoo Sirnichaa & Qoodinsa Badhaasaa (Settings & Prize Distribution)
              </h3>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-4">
                <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                  Qoodinsa Badhaasaa (Prizes must sum to exactly 100%)
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <div>
                    <label className="block text-neutral-400 mb-1">1ffaa (1st Place %):</label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      value={settings.firstPrizePercent}
                      onChange={(e) =>
                        setSettings({ ...settings, firstPrizePercent: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-400 mb-1">2ffaa (2nd Place %):</label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      value={settings.secondPrizePercent}
                      onChange={(e) =>
                        setSettings({ ...settings, secondPrizePercent: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-400 mb-1">3ffaa (3rd Place %):</label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      value={settings.thirdPrizePercent}
                      onChange={(e) =>
                        setSettings({ ...settings, thirdPrizePercent: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-400 mb-1">Sirna/Platform %:</label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      value={settings.platformPercent}
                      onChange={(e) =>
                        setSettings({ ...settings, platformPercent: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="text-neutral-400">Ida'ama (Total):</span>
                  <span
                    className={`font-mono text-sm ${
                      settings.firstPrizePercent +
                        settings.secondPrizePercent +
                        settings.thirdPrizePercent +
                        settings.platformPercent ===
                      100
                        ? 'text-emerald-400'
                        : 'text-red-400'
                    }`}
                  >
                    {settings.firstPrizePercent +
                      settings.secondPrizePercent +
                      settings.thirdPrizePercent +
                      settings.platformPercent}
                    %
                  </span>
                  {settings.firstPrizePercent +
                    settings.secondPrizePercent +
                    settings.thirdPrizePercent +
                    settings.platformPercent !==
                    100 && (
                    <span className="text-red-400 text-[11px]">
                      (Dirqama 100% ta'uu qaba!)
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-4">
                <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                  Gatii Tikkeetii fi Afeerraa (Tickets & Referrals)
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                  <div>
                    <label className="block text-neutral-400 mb-1">Gatii Tikkeetii (ETB):</label>
                    <input
                      type="number"
                      required
                      value={settings.ticketPrice}
                      onChange={(e) =>
                        setSettings({ ...settings, ticketPrice: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-400 mb-1">Badhaasa Afeerraa (ETB):</label>
                    <input
                      type="number"
                      required
                      value={settings.referralBonusAmount}
                      onChange={(e) =>
                        setSettings({ ...settings, referralBonusAmount: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-400 mb-1">Kaffaltii Xiqqaa Afeerraa (ETB):</label>
                    <input
                      type="number"
                      required
                      value={settings.referralMinDeposit}
                      onChange={(e) =>
                        setSettings({ ...settings, referralMinDeposit: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-6 py-3 text-sm font-bold text-neutral-950 hover:from-amber-400 hover:to-yellow-400 shadow-lg shadow-amber-500/20"
              >
                Sajoo Ol-Kaa'i (Save Settings)
              </button>
            </form>
          )}

          {/* TAB: USERS */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-amber-400">
                Fayyadamtoota Galmaa'an ({usersList.length})
              </h3>
              <div className="overflow-x-auto rounded-xl border border-neutral-800">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-neutral-800 bg-neutral-950 text-neutral-400 uppercase font-semibold">
                    <tr>
                      <th className="p-3">Maqaa</th>
                      <th className="p-3">Bilbila</th>
                      <th className="p-3">Gahee (Role)</th>
                      <th className="p-3">Qarshii Herregaa</th>
                      <th className="p-3">Koodii Afeerraa</th>
                      <th className="p-3">Guyyaa Galmee</th>
                      <th className="p-3 text-right">Gocha (Action)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60 bg-neutral-900/40">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-neutral-800/40">
                        <td className="p-3 font-bold text-white">
                          {u.firstName} {u.lastName}
                        </td>
                        <td className="p-3 font-mono text-neutral-300">{u.phone}</td>
                        <td className="p-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              u.role === 'ADMIN'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-neutral-800 text-neutral-400'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-400">
                          {u.walletBalance.toFixed(2)} ETB
                        </td>
                        <td className="p-3 font-mono text-neutral-400">{u.referralCode}</td>
                        <td className="p-3 text-[11px] text-neutral-500">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-right whitespace-nowrap space-x-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setPayoutModalUser(u);
                              setPayoutAmount(u.walletBalance > 0 ? String(u.walletBalance) : '');
                              setPayoutProvider('Telebirr');
                              setPayoutTxId('');
                              setPayoutNote('Kaffaltii Mo\'ataa / Badhaasa');
                            }}
                            className="rounded-lg bg-teal-500/20 border border-teal-500/40 px-2.5 py-1 text-[11px] font-bold text-teal-300 hover:bg-teal-500 hover:text-neutral-950 transition shadow-sm"
                            title="Qarshii dhugaa kaffali (Telebirr/CBE) fi system irraa hir'isi"
                          >
                            💸 Qarshii Kaffali
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditUserModal(u);
                              setEditFirstName(u.firstName);
                              setEditLastName(u.lastName);
                              setEditPhone(u.phone);
                              setEditRole(u.role);
                              setEditNewPassword('');
                              setEditBalance(String(u.walletBalance));
                            }}
                            className="rounded-lg bg-blue-500/20 border border-blue-500/40 px-2.5 py-1 text-[11px] font-bold text-blue-300 hover:bg-blue-500 hover:text-white transition shadow-sm"
                            title="Akkaawuntii fayyadamaa gulaali / jijjiiri"
                          >
                            ✏️ Gulaali
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustBalanceUser(u);
                              setAdjustAction('add');
                              setAdjustAmount('');
                              setAdjustReason('Kaffaltii mirkaneessuu');
                            }}
                            className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500 hover:text-neutral-950 transition"
                            title="Herrega fayyadamaa sirreessi"
                          >
                            ± Herrega Sirreessi
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAssignUserDirect(u);
                              setAssignDirectSlotNum('');
                            }}
                            className="rounded-lg bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500 hover:text-neutral-950 transition"
                            title="Tikkeetii caaraa qabiif"
                          >
                            ★ Lakk Qabiif
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: AUDIT LOGS & CSV EXPORT CENTER */}
          {activeTab === 'audit' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-amber-400">Galmee Audit & Buufata CSV (Export Center)</h3>
                <p className="text-xs text-neutral-400">
                  Mo'attoota marsaalee darban hunda, seenaa kaffaltiiwwanii fi baasii, akkasumas galmee gochaalee admin CSV dhaan buufadhaa.
                </p>
              </div>

              {/* 3 Dedicated CSV Export Action Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* 1. Round Winners CSV */}
                <div className="rounded-2xl border border-yellow-500/40 bg-gradient-to-b from-yellow-500/10 via-neutral-900/60 to-neutral-950 p-4 flex flex-col justify-between shadow-lg shadow-yellow-500/10">
                  <div>
                    <div className="flex items-center gap-2 text-yellow-400">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                        <Trophy className="h-4 w-4" />
                      </div>
                      <h4 className="font-bold text-sm text-white">Mo'attoota Marsaalee</h4>
                    </div>
                    <p className="mt-2 text-xs text-neutral-400 leading-relaxed">
                      Galmee mo'attoota 1ffaa, 2ffaa, 3ffaa marsaalee hunda: lakkoofsa mo'ate, maqaa, bilbila, badhaasa qarshii (ETB) fi yeroo.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      handleDownloadCsv(
                        '/api/admin/rounds/export-csv',
                        `spin_ethiopia_round_winners_${Date.now()}.csv`,
                        'winners'
                      )
                    }
                    disabled={csvDownloading === 'winners'}
                    className="mt-4 flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 px-3.5 py-2.5 text-xs font-black text-neutral-950 shadow-md hover:from-yellow-400 hover:to-amber-400 disabled:opacity-50 transition active:scale-95"
                  >
                    <Download className={`h-4 w-4 ${csvDownloading === 'winners' ? 'animate-bounce' : ''}`} />
                    <span>
                      {csvDownloading === 'winners' ? 'Qophaa\'aa Jira...' : 'Mo\'attoota CSV Buufadhu'}
                    </span>
                  </button>
                </div>

                {/* 2. Transaction History CSV */}
                <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-500/10 via-neutral-900/60 to-neutral-950 p-4 flex flex-col justify-between shadow-lg shadow-emerald-500/10">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-400">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <ArrowDownCircle className="h-4 w-4" />
                      </div>
                      <h4 className="font-bold text-sm text-white">Seenaa Kaffaltii & Baasii</h4>
                    </div>
                    <p className="mt-2 text-xs text-neutral-400 leading-relaxed">
                      Galmee kaffaltiiwwan (deposits), baasii (withdrawals), lakkoofsa FT/TxID, baankii, fi sochii herregaa hunda.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      handleDownloadCsv(
                        '/api/admin/transactions/export-csv',
                        `spin_ethiopia_transactions_${Date.now()}.csv`,
                        'transactions'
                      )
                    }
                    disabled={csvDownloading === 'transactions'}
                    className="mt-4 flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3.5 py-2.5 text-xs font-black text-white shadow-md hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 transition active:scale-95"
                  >
                    <Download className={`h-4 w-4 ${csvDownloading === 'transactions' ? 'animate-bounce' : ''}`} />
                    <span>
                      {csvDownloading === 'transactions' ? 'Qophaa\'aa Jira...' : 'Sochii Herregaa CSV Buufadhu'}
                    </span>
                  </button>
                </div>

                {/* 3. System Audit Logs CSV */}
                <div className="rounded-2xl border border-neutral-700 bg-gradient-to-b from-neutral-800/40 via-neutral-900/60 to-neutral-950 p-4 flex flex-col justify-between shadow-lg">
                  <div>
                    <div className="flex items-center gap-2 text-neutral-300">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-800 text-amber-400 border border-neutral-700">
                        <ShieldAlert className="h-4 w-4" />
                      </div>
                      <h4 className="font-bold text-sm text-white">Galmee Hojii Admin (Audit)</h4>
                    </div>
                    <p className="mt-2 text-xs text-neutral-400 leading-relaxed">
                      Galmee tarkaanfiiwwan admin hunda: caaraa baasuu, jijjiirama sajoo, fi eeyyama herregaa yeroo waliin.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      handleDownloadCsv(
                        '/api/admin/audit-logs/export-csv',
                        `spin_ethiopia_audit_logs_${Date.now()}.csv`,
                        'audit'
                      )
                    }
                    disabled={csvDownloading === 'audit'}
                    className="mt-4 flex items-center justify-center gap-2 w-full rounded-xl bg-neutral-800 px-3.5 py-2.5 text-xs font-bold text-neutral-200 hover:bg-neutral-700 hover:text-white disabled:opacity-50 transition active:scale-95"
                  >
                    <Download className={`h-4 w-4 ${csvDownloading === 'audit' ? 'animate-bounce' : ''}`} />
                    <span>
                      {csvDownloading === 'audit' ? 'Qophaa\'aa Jira...' : 'Galmee Audit CSV Buufadhu'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Table of Recent Audit Events */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                    Gochaalee Dhiyoo (Recent Audit Activity Logs)
                  </h4>
                  <span className="text-[11px] text-neutral-500 font-mono">
                    Waliigala: {auditLogs.length}
                  </span>
                </div>

              <div className="overflow-x-auto rounded-xl border border-neutral-800">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-neutral-800 bg-neutral-950 text-neutral-400 uppercase font-semibold">
                    <tr>
                      <th className="p-3">Yeroo</th>
                      <th className="p-3">Raawwataa</th>
                      <th className="p-3">Gocha (Action)</th>
                      <th className="p-3">Bal'ina (Details)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60 bg-neutral-900/40">
                    {auditLogs.slice(0, 50).map((log) => (
                      <tr key={log.id} className="hover:bg-neutral-800/40">
                        <td className="p-3 text-[11px] text-neutral-400 font-mono whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3 font-mono text-amber-400 font-semibold">
                          {log.actorPhone}
                        </td>
                        <td className="p-3">
                          <span className="rounded bg-neutral-800 px-2 py-0.5 font-mono text-[10px] text-neutral-300">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 text-neutral-300">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          )}

          {/* TAB: OBS / TIKTOK LIVE SETUP */}
          {activeTab === 'obs' && (
            <div className="max-w-2xl space-y-4">
              <h3 className="text-base font-bold text-amber-400">
                OBS & TikTok LIVE Browser Source Setup
              </h3>
              <p className="text-xs text-neutral-400">
                Fuulli <code className="text-amber-300 font-mono">/live</code> addatti waltajjii OBS Studio ykn TikTok Live Studio irratti akka Browser Source ta'ee fayyadamuuf qophaa'e.
              </p>

              <div className="rounded-xl border border-amber-500/30 bg-neutral-950 p-4 space-y-3">
                <span className="text-xs font-semibold text-neutral-300">
                  Browser Source URL (OBS / TikTok):
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={liveUrl}
                    className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs font-mono text-amber-300 select-all"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(liveUrl);
                      setSuccessMsg('Live URL copied to clipboard!');
                    }}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-neutral-950 hover:bg-amber-400"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-xs text-neutral-300">
                <h4 className="font-bold text-white">Akkaataa Itti Fayyadamaa:</h4>
                <ol className="list-decimal pl-5 space-y-1 text-neutral-400">
                  <li>OBS ykn TikTok Live Studio keessatti <strong>Browser Source</strong> dabalaa.</li>
                  <li>URL olii kana as-keessatti kaa'aa.</li>
                  <li>Bal'ina (Width) fi Dheerina (Height): <strong>1080 x 1920</strong> (mobile/portrait) ykn <strong>1920 x 1080</strong> (landscape) godhaa.</li>
                  <li>Fuulli live kun herrega keessan dhoksee, mashina caaraa fi lakkoofsa mo'attootaa qofa agarsiisa.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Modal: Receipt Image Preview */}
        {previewReceiptUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
            <div className="relative max-h-[90vh] max-w-2xl overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-950 p-4">
              <button
                onClick={() => setPreviewReceiptUrl(null)}
                className="absolute right-3 top-3 rounded-lg bg-neutral-800 p-2 text-neutral-300 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
              <h4 className="mb-3 text-sm font-bold text-amber-400">Ragaa Kaffaltii (Payment Receipt)</h4>
              <img
                src={previewReceiptUrl}
                alt="Receipt Full View"
                className="max-h-[75vh] w-auto rounded-lg object-contain mx-auto"
              />
            </div>
          </div>
        )}

        {/* Modal: Confirm Reject Deposit */}
        {rejectModalDepositId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-red-500/40 bg-neutral-900 p-6 text-white shadow-2xl">
              <h4 className="text-base font-bold text-red-400">
                Kaffaltii Kuffisuu (Reject Deposit)
              </h4>
              <p className="mt-1 text-xs text-neutral-400">
                Kaffaltiin kun kuffifama. Herregni fayyaddamaa hin dabalamu.
              </p>
              <div className="my-4">
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Sababa Kuffisuu (Reason):
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Fkn: Ragaan kaffaltii sobaadha ykn FT hin argamne"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-800 p-3 text-xs text-white focus:border-red-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRejectModalDepositId(null)}
                  className="flex-1 rounded-xl bg-neutral-800 py-2.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-700"
                >
                  Dhiisi
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRejectDeposit}
                  className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-500"
                >
                  Kuffisi (Reject)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Confirm Reject Withdrawal */}
        {rejectModalWithdrawalId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-red-500/40 bg-neutral-900 p-6 text-white shadow-2xl">
              <h4 className="text-base font-bold text-red-400">
                Gaaffii Baasii Kuffisuu & Deebisuu (Reject & Refund Withdrawal)
              </h4>
              <p className="mt-1 text-xs text-neutral-400">
                Gaaffiin baasii kun kuffifama. Qarshiin qabamee ture battalumatti herrega fayyaddamaatti deebi'a!
              </p>
              <div className="my-4">
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Sababa (Reason):
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Fkn: Lakkoofsi herregaa dogoggora"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-800 p-3 text-xs text-white focus:border-red-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRejectModalWithdrawalId(null)}
                  className="flex-1 rounded-xl bg-neutral-800 py-2.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-700"
                >
                  Dhiisi
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRejectWithdrawal}
                  className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-500"
                >
                  Kuffisi & Qarshii Deebisi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Adjust User Balance ("akkasuma namoni gize birii galchan accuontii issaani ad,mnin akka siressuu danda'uu tasisii") */}
        {adjustBalanceUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border-2 border-emerald-500/50 bg-neutral-950 p-6 text-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <h4 className="text-base font-bold text-emerald-400">
                  Herrega Fayyadamaa Sirreessi (Adjust Balance)
                </h4>
                <button
                  type="button"
                  onClick={() => setAdjustBalanceUser(null)}
                  className="text-neutral-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="my-3 rounded-2xl border border-neutral-800 bg-neutral-900/80 p-3.5 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Fayyadamaa:</span>
                  <span className="font-bold text-white">
                    {adjustBalanceUser.firstName} {adjustBalanceUser.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Bilbila:</span>
                  <span className="font-mono text-neutral-300">{adjustBalanceUser.phone}</span>
                </div>
                <div className="flex justify-between border-t border-neutral-800 pt-1">
                  <span className="text-neutral-400">Haftee Ammaa (Current Balance):</span>
                  <span className="font-mono font-bold text-amber-400">
                    {adjustBalanceUser.walletBalance.toFixed(2)} ETB
                  </span>
                </div>
              </div>

              <form onSubmit={handleConfirmAdjustBalance} className="space-y-3.5">
                {/* Action selector */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Gosa Gochaa (Action):
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setAdjustAction('add')}
                      className={`rounded-xl py-2 font-bold border transition ${
                        adjustAction === 'add'
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                          : 'border-neutral-800 bg-neutral-900 text-neutral-400'
                      }`}
                    >
                      + Qarshii Dabali
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustAction('deduct')}
                      className={`rounded-xl py-2 font-bold border transition ${
                        adjustAction === 'deduct'
                          ? 'border-red-500 bg-red-500/20 text-red-300'
                          : 'border-neutral-800 bg-neutral-900 text-neutral-400'
                      }`}
                    >
                      - Hir'isi
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustAction('set')}
                      className={`rounded-xl py-2 font-bold border transition ${
                        adjustAction === 'set'
                          ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                          : 'border-neutral-800 bg-neutral-900 text-neutral-400'
                      }`}
                    >
                      = Haftee Teessisi
                    </button>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Hanga Qarshii (Amount in ETB) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="Fkn: 200"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-xs text-white font-mono placeholder-neutral-500 focus:border-emerald-400 focus:outline-none"
                  />
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Sababa Sirreeffamaa (Reason / Note)
                  </label>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Fkn: Kaffaltii Baankii Telebirr mirkanaa'e"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:border-emerald-400 focus:outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setAdjustBalanceUser(null)}
                    className="flex-1 rounded-2xl bg-neutral-900 py-3 text-xs font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-white"
                  >
                    Dhiisi (Cancel)
                  </button>
                  <button
                    type="submit"
                    disabled={adjustLoading}
                    className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-xs font-black text-neutral-950 shadow-lg shadow-emerald-500/30 hover:brightness-110 disabled:opacity-50"
                  >
                    {adjustLoading ? 'Sirreessaa jira...' : 'Mirkaneessi & Sirreessi'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Direct Ticket Assignment for Specific User ("ini bira admnin nama biratif lakk qabu akka danda'uu godhii") */}
        {assignUserDirect && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border-2 border-amber-500/50 bg-neutral-950 p-6 text-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <h4 className="text-base font-bold text-amber-400">
                  Nama Kanaaf Lakkoofsa Qabi (Assign Lucky Number)
                </h4>
                <button
                  type="button"
                  onClick={() => setAssignUserDirect(null)}
                  className="text-neutral-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="my-3 rounded-2xl border border-neutral-800 bg-neutral-900/80 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Fayyadamaa:</span>
                  <span className="font-bold text-white">
                    {assignUserDirect.firstName} {assignUserDirect.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Bilbila:</span>
                  <span className="font-mono text-neutral-300">{assignUserDirect.phone}</span>
                </div>
              </div>

              <form onSubmit={handleConfirmAssignUserDirect} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Lakkoofsa Caaraa Filadhaa (1 hanga 100) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={assignDirectSlotNum}
                    onChange={(e) => setAssignDirectSlotNum(e.target.value)}
                    placeholder="1-100"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-xs text-white font-mono placeholder-neutral-500 focus:border-amber-400 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-neutral-400">
                    Lakkoofsi kun battalumatti maqaa nama kanaan qabamee mashina irratti barreeffama.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setAssignUserDirect(null)}
                    className="flex-1 rounded-2xl bg-neutral-900 py-3 text-xs font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-white"
                  >
                    Dhiisi (Cancel)
                  </button>
                  <button
                    type="submit"
                    disabled={assignDirectLoading}
                    className="flex-1 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 py-3 text-xs font-black text-neutral-950 shadow-lg shadow-amber-500/30 hover:brightness-110 disabled:opacity-50"
                  >
                    {assignDirectLoading ? 'Qabaa jira...' : 'Lakkoofsa Qabi'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Real Money Payout (Telebirr / CBE) */}
        {payoutModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border-2 border-teal-500/50 bg-neutral-950 p-6 text-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <h4 className="text-base font-bold text-teal-400 flex items-center gap-2">
                  <span>💸</span> Qarshii Dhugaa Kaffali (Real Money Payout)
                </h4>
                <button
                  type="button"
                  onClick={() => setPayoutModalUser(null)}
                  className="text-neutral-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="my-3 rounded-2xl border border-neutral-800 bg-neutral-900/80 p-3.5 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Abbaa Carraa / Fayyadamaa:</span>
                  <span className="font-bold text-white">
                    {payoutModalUser.firstName} {payoutModalUser.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Lakkoofsa Bilbilaa:</span>
                  <span className="font-mono text-teal-300 font-bold">{payoutModalUser.phone}</span>
                </div>
                <div className="flex justify-between border-t border-neutral-800 pt-1">
                  <span className="text-neutral-400">Haftee Systemii (Current Balance):</span>
                  <span className="font-mono font-bold text-amber-400">
                    {payoutModalUser.walletBalance.toFixed(2)} ETB
                  </span>
                </div>
              </div>

              <form onSubmit={handlePayRealCash} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Karaa Kaffaltii (Payment Method) *
                  </label>
                  <select
                    value={payoutProvider}
                    onChange={(e) => setPayoutProvider(e.target.value)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-xs text-white focus:border-teal-400 focus:outline-none"
                  >
                    <option value="Telebirr">Telebirr (Ethio Telecom)</option>
                    <option value="CBE Birr">CBE Birr (Commercial Bank of Ethiopia)</option>
                    <option value="Awash Bank">Awash Bank</option>
                    <option value="Baankii Dhaabbataa">Baankii Dhaabbataa (Bank Transfer)</option>
                    <option value="Cash">Harkatti (Cash in Hand)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Hamma Qarshii Kaffalame (Amount in ETB) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="any"
                    required
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    placeholder="Fkn: 3000, 500, 200"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-xs text-white font-mono font-bold focus:border-teal-400 focus:outline-none"
                  />
                  <div className="flex gap-2 mt-1.5">
                    {[200, 500, 3000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setPayoutAmount(String(amt))}
                        className="rounded-lg bg-neutral-800 px-2.5 py-1 text-[10px] font-bold text-teal-300 hover:bg-neutral-700"
                      >
                        {amt} ETB
                      </button>
                    ))}
                    {payoutModalUser.walletBalance > 0 && (
                      <button
                        type="button"
                        onClick={() => setPayoutAmount(String(payoutModalUser.walletBalance))}
                        className="rounded-lg bg-teal-500/20 border border-teal-500/40 px-2.5 py-1 text-[10px] font-bold text-teal-300 hover:bg-teal-500 hover:text-neutral-950"
                      >
                        Haftee Hunda ({payoutModalUser.walletBalance.toFixed(0)} ETB)
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Koodii Kaffaltii / FT Number (Transaction ID)
                  </label>
                  <input
                    type="text"
                    value={payoutTxId}
                    onChange={(e) => setPayoutTxId(e.target.value)}
                    placeholder="Fkn: FT26254FG25GH"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-xs text-white font-mono placeholder-neutral-500 focus:border-teal-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Yaada / Ibsa (Note)
                  </label>
                  <input
                    type="text"
                    value={payoutNote}
                    onChange={(e) => setPayoutNote(e.target.value)}
                    placeholder="Fkn: Badhaasa Mo'ataa 1ffaa"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:border-teal-400 focus:outline-none"
                  />
                </div>

                <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-2.5 text-[11px] text-teal-200">
                  ℹ️ Akkaawuntii kana irraa qarshiin kaffalame battalumatti hir'ifamee galmee kaffaltii dhugaa irratti mirkanaa'a.
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setPayoutModalUser(null)}
                    className="flex-1 rounded-2xl bg-neutral-900 py-3 text-xs font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-white"
                  >
                    Dhiisi (Cancel)
                  </button>
                  <button
                    type="submit"
                    disabled={payoutLoading}
                    className="flex-1 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 py-3 text-xs font-black text-neutral-950 shadow-lg shadow-teal-500/30 hover:brightness-110 disabled:opacity-50"
                  >
                    {payoutLoading ? 'Kaffalaa jira...' : 'Kaffaltii Mirkaneessi'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit User Profile (Name, Phone, Role, Password, Balance) */}
        {editUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-3xl border-2 border-blue-500/50 bg-neutral-950 p-6 text-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <h4 className="text-base font-bold text-blue-400 flex items-center gap-2">
                  <span>✏️</span> Akkaawuntii Fayyadamaa Gulaali (Edit User)
                </h4>
                <button
                  type="button"
                  onClick={() => setEditUserModal(null)}
                  className="text-neutral-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveUserEdit} className="my-4 space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Maqaa Duraa (First Name) *
                    </label>
                    <input
                      type="text"
                      required
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Maqaa Abbaa (Last Name) *
                    </label>
                    <input
                      type="text"
                      required
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Lakkoofsa Bilbilaa (Phone Number) *
                    </label>
                    <input
                      type="text"
                      required
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-xs text-white font-mono focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Gahee (Role)
                    </label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as any)}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-xs text-white focus:border-blue-400 focus:outline-none"
                    >
                      <option value="USER">USER (Fayyadamaa)</option>
                      <option value="ADMIN">ADMIN (To'ataa)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Haftee Qarshii (Wallet Balance ETB)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={editBalance}
                      onChange={(e) => setEditBalance(e.target.value)}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-xs text-white font-mono font-bold focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">
                      Jecha Darbii Haaraa (New Password)
                    </label>
                    <input
                      type="password"
                      value={editNewPassword}
                      onChange={(e) => setEditNewPassword(e.target.value)}
                      placeholder="Kan jiru jijjiiruu yoo barbaadde qofa"
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditUserModal(null)}
                    className="flex-1 rounded-2xl bg-neutral-900 py-3 text-xs font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-white"
                  >
                    Dhiisi (Cancel)
                  </button>
                  <button
                    type="submit"
                    disabled={editUserLoading}
                    className="flex-1 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 py-3 text-xs font-black text-white shadow-lg shadow-blue-500/30 hover:brightness-110 disabled:opacity-50"
                  >
                    {editUserLoading ? 'Olkaa\'aa jira...' : 'Jijjiirama Olkaa\'i'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Authenticity Verification Modal */}
        <AuthenticityVerificationModal
          isOpen={verificationModalOpen}
          onClose={() => setVerificationModalOpen(false)}
        />
      </div>
    </div>
  );
};
