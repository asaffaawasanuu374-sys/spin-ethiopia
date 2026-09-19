import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  Copy,
  Check,
  Upload,
  AlertCircle,
  ShieldCheck,
  FileText,
  Clock,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Building2,
  Smartphone,
} from 'lucide-react';
import { PaymentMethod, WalletTransaction, User } from '../types/index';
import { apiFetch } from '../lib/api';
import { sound } from '../lib/sound';

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'pm_telebirr',
    provider: 'Telebirr',
    accountName: 'Gabre shifaraa hayilu',
    accountNumber: '0929200166',
    phoneNumber: '0929200166',
    instructions:
      'Kaffaltii keessan Telebirr lakkoofsa 0929200166 (Maqaa: Gabre shifaraa hayilu) irratti erga ergitan booda lakk FT asitti galchaa.',
    minAmount: 25.0,
    maxAmount: 25000.0,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'pm_cbe',
    provider: 'Commercial Bank of Ethiopia (CBE)',
    accountName: 'Asefa Wasenu Tadese',
    accountNumber: '1000218818424',
    instructions:
      'Kaffaltii keessan herrega Baankii Daldala Itoophiyaa CBE (1000218818424 - Asefa Wasenu Tadese) irratti daddabarsitanii ragaa suuraa fi lakk FT asitti galchaa.',
    minAmount: 50.0,
    maxAmount: 50000.0,
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'pm_awash',
    provider: 'Awash Bank',
    accountName: 'Asefa Wasenu Tadese',
    accountNumber: '01320561958100',
    instructions:
      'Kaffaltii keessan herrega Baankii Awash (01320561958100 - Asefa Wasenu Tadese) irratti daddabarsitanii ragaa suuraa fi lakk FT asitti galchaa.',
    minAmount: 50.0,
    maxAmount: 50000.0,
    isActive: true,
    sortOrder: 3,
  },
];

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onBalanceUpdated: () => void;
  initialTab?: 'deposit' | 'withdraw' | 'history';
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  onClose,
  user,
  onBalanceUpdated,
  initialTab = 'deposit',
}) => {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'history'>(initialTab);
  const [methods, setMethods] = useState<PaymentMethod[]>(DEFAULT_PAYMENT_METHODS);
  const [selectedMethodId, setSelectedMethodId] = useState<string>('pm_telebirr');
  const [depositStep, setDepositStep] = useState<1 | 2 | 3>(1);
  const [amount, setAmount] = useState<string>('100');
  const [transactionId, setTransactionId] = useState<string>('');
  const [receiptBase64, setReceiptBase64] = useState<string>('');
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Withdrawal state
  const [withdrawProvider, setWithdrawProvider] = useState<string>('Telebirr');
  const [withdrawAccountName, setWithdrawAccountName] = useState<string>(
    `${user.firstName} ${user.lastName}`.trim()
  );
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState<string>(user.phone);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('100');

  // Transactions state
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadPaymentMethods();
      loadTransactions();
      setError('');
      setSuccessMsg('');
      setDepositStep(1);
    }
  }, [isOpen]);

  const loadPaymentMethods = async () => {
    try {
      const res = await apiFetch('/api/payment-methods');
      if (res.methods && res.methods.length > 0) {
        // Sort with Telebirr 1st, CBE 2nd, Awash 3rd
        const sorted = [...res.methods].sort((a: PaymentMethod, b: PaymentMethod) => {
          const aIsTele = a.provider.toLowerCase().includes('telebirr');
          const bIsTele = b.provider.toLowerCase().includes('telebirr');
          if (aIsTele && !bIsTele) return -1;
          if (!aIsTele && bIsTele) return 1;
          const aIsCbe = a.provider.toLowerCase().includes('cbe') || a.provider.toLowerCase().includes('commercial');
          const bIsCbe = b.provider.toLowerCase().includes('cbe') || b.provider.toLowerCase().includes('commercial');
          if (aIsCbe && !bIsCbe) return -1;
          if (!aIsCbe && bIsCbe) return 1;
          return a.sortOrder - b.sortOrder;
        });
        setMethods(sorted);
        if (!selectedMethodId || !sorted.some((m) => m.id === selectedMethodId)) {
          setSelectedMethodId(sorted[0].id);
        }
      }
    } catch {
      // Fallback already in place with DEFAULT_PAYMENT_METHODS
    }
  };

  const loadTransactions = async () => {
    try {
      const res = await apiFetch('/api/wallet/transactions');
      if (res.transactions) {
        setTransactions(res.transactions);
      }
    } catch {}
  };

  if (!isOpen) return null;

  const displayMethods = methods && methods.length >= 3 ? methods : DEFAULT_PAYMENT_METHODS;
  const activeMethod = displayMethods.find((m) => m.id === selectedMethodId) || displayMethods[0];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    sound.playClick();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type: JPG, JPEG, PNG, WEBP
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setError('Gosa faayilaa hin eeyyamamne! JPG, JPEG, PNG, ykn WEBP qofa filadhaa (Only JPG, PNG, WEBP images allowed)');
      return;
    }

    // Validate size: max 6MB
    if (file.size > 6 * 1024 * 1024) {
      setError("Hammi suuraa 6MB caaluu hin danda'u (Max file size is 6MB)");
      return;
    }

    setReceiptFileName(file.name);
    setError('');

    const reader = new FileReader();
    reader.onload = () => {
      setReceiptBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!selectedMethodId) {
      setError('Malla kaffaltii filadhaa (Please select a payment method)');
      return;
    }

    if (!transactionId.trim()) {
      setError('Lakkoofsa FT / Transaction ID guutaa (Please enter transaction ID / FT code)');
      return;
    }

    setLoading(true);
    sound.playClick();

    try {
      const res = await apiFetch('/api/wallet/deposit', {
        method: 'POST',
        body: JSON.stringify({
          paymentMethodId: selectedMethodId,
          amount: Number(amount),
          transactionId: transactionId.trim(),
          receiptUrl: receiptBase64 || '',
        }),
      });

      sound.playWin();
      setSuccessMsg(`✅ Kaffaltiin milkaa'inaan ergameera! FT: ${transactionId.trim().toUpperCase()} (${amount} ETB). Admin biratti daqiiqaa muraasa keessatti mirkanaa'a.`);
      setTransactionId('');
      setReceiptBase64('');
      setReceiptFileName('');
      setDepositStep(1);
      loadTransactions();
      onBalanceUpdated();
    } catch (err: any) {
      setError(err.message || "Kaffaltiin hin danda'amne");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    sound.playClick();

    try {
      const res = await apiFetch('/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({
          provider: withdrawProvider,
          accountName: withdrawAccountName,
          accountNumber: withdrawAccountNumber,
          amount: Number(withdrawAmount),
        }),
      });

      setSuccessMsg(res.message);
      loadTransactions();
      onBalanceUpdated();
    } catch (err: any) {
      setError(err.message || "Gaaffiin baasii hin danda'amne");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-amber-500/30 bg-neutral-900 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 p-5">
          <div>
            <h2 className="text-xl font-bold text-amber-400">Herrega Keessan (Wallet)</h2>
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span>Hanga Qarshii Ammaa:</span>
              <span className="font-mono text-sm font-bold text-emerald-400">
                {user.walletBalance.toFixed(2)} ETB
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/50 p-2">
          <button
            onClick={() => {
              setActiveTab('deposit');
              setDepositStep(1);
              setError('');
              setSuccessMsg('');
              sound.playClick();
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${
              activeTab === 'deposit'
                ? 'bg-amber-500 text-neutral-950 shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <ArrowDownCircle className="h-4 w-4" />
            <span>Galii (Deposit)</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('withdraw');
              setError('');
              setSuccessMsg('');
              sound.playClick();
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${
              activeTab === 'withdraw'
                ? 'bg-amber-500 text-neutral-950 shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <ArrowUpCircle className="h-4 w-4" />
            <span>Baasii (Withdraw)</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              setError('');
              setSuccessMsg('');
              loadTransactions();
              sound.playClick();
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${
              activeTab === 'history'
                ? 'bg-amber-500 text-neutral-950 shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <History className="h-4 w-4" />
            <span>Seenaa (History)</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: PROGRESSIVE 3-STEP DEPOSIT */}
          {activeTab === 'deposit' && (
            <form onSubmit={handleDepositSubmit} className="space-y-4">
              {/* Progressive 3-Step Wizard Progress Bar */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-3">
                <div className="flex items-center justify-between">
                  {/* Step 1: Bank/Provider */}
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setDepositStep(1);
                      sound.playClick();
                    }}
                    className={`flex items-center gap-2 text-left transition ${
                      depositStep === 1
                        ? 'text-amber-400 font-bold'
                        : depositStep > 1
                        ? 'text-emerald-400 hover:text-emerald-300'
                        : 'text-neutral-500'
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black transition ${
                        depositStep === 1
                          ? 'bg-amber-400 text-neutral-950 shadow-md shadow-amber-400/30 ring-2 ring-amber-400/50'
                          : depositStep > 1
                          ? 'bg-emerald-500 text-white'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {depositStep > 1 ? <Check className="h-4 w-4 stroke-[3]" /> : '1'}
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] uppercase text-neutral-400 leading-none">Sadarkaa 1</div>
                      <div className="text-xs font-bold leading-tight">Mala Kaffaltii</div>
                    </div>
                  </button>

                  <div
                    className={`h-0.5 flex-1 mx-2 transition-colors ${
                      depositStep > 1 ? 'bg-emerald-500/60' : 'bg-neutral-800'
                    }`}
                  />

                  {/* Step 2: Amount */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedMethodId) {
                        setError('Dura mala kaffaltii filadhaa');
                        return;
                      }
                      setError('');
                      setDepositStep(2);
                      sound.playClick();
                    }}
                    className={`flex items-center gap-2 text-left transition ${
                      depositStep === 2
                        ? 'text-amber-400 font-bold'
                        : depositStep > 2
                        ? 'text-emerald-400 hover:text-emerald-300'
                        : 'text-neutral-500'
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black transition ${
                        depositStep === 2
                          ? 'bg-amber-400 text-neutral-950 shadow-md shadow-amber-400/30 ring-2 ring-amber-400/50'
                          : depositStep > 2
                          ? 'bg-emerald-500 text-white'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {depositStep > 2 ? <Check className="h-4 w-4 stroke-[3]" /> : '2'}
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] uppercase text-neutral-400 leading-none">Sadarkaa 2</div>
                      <div className="text-xs font-bold leading-tight">Hamma Qarshii</div>
                    </div>
                  </button>

                  <div
                    className={`h-0.5 flex-1 mx-2 transition-colors ${
                      depositStep > 2 ? 'bg-emerald-500/60' : 'bg-neutral-800'
                    }`}
                  />

                  {/* Step 3: Receipt & FT Code */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedMethodId) {
                        setError('Dura mala kaffaltii filadhaa');
                        return;
                      }
                      const num = Number(amount);
                      if (!num || num <= 0) {
                        setError('Dura hamma qarshii galchaa');
                        return;
                      }
                      setError('');
                      setDepositStep(3);
                      sound.playClick();
                    }}
                    className={`flex items-center gap-2 text-left transition ${
                      depositStep === 3
                        ? 'text-amber-400 font-bold'
                        : 'text-neutral-500'
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black transition ${
                        depositStep === 3
                          ? 'bg-amber-400 text-neutral-950 shadow-md shadow-amber-400/30 ring-2 ring-amber-400/50'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      3
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] uppercase text-neutral-400 leading-none">Sadarkaa 3</div>
                      <div className="text-xs font-bold leading-tight">Nagahee & FT</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* STEP 1: SELECT PAYMENT METHOD (Telebirr, CBE, Awash) */}
              {depositStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-black uppercase tracking-wider text-amber-400">
                        1. Baankii Ykn App Kaffaltii Filadhaa (Telebirr, CBE, Awash)
                      </label>
                      <span className="text-[11px] text-neutral-400">Filadhaa</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {displayMethods.map((pm) => {
                        const isTelebirr = pm.provider.toLowerCase().includes('telebirr');
                        const isCbe =
                          pm.provider.toLowerCase().includes('cbe') ||
                          pm.provider.toLowerCase().includes('commercial');
                        const isAwash = pm.provider.toLowerCase().includes('awash');
                        const isSelected = selectedMethodId === pm.id;

                        return (
                          <button
                            key={pm.id}
                            type="button"
                            onClick={() => {
                              setSelectedMethodId(pm.id);
                              setError('');
                              sound.playClick();
                            }}
                            className={`flex flex-col items-start rounded-2xl border-2 p-3.5 text-left transition relative overflow-hidden cursor-pointer ${
                              isSelected
                                ? isTelebirr
                                  ? 'border-cyan-400 bg-cyan-950/40 shadow-lg shadow-cyan-500/20 ring-2 ring-cyan-400/50'
                                  : isCbe
                                  ? 'border-purple-400 bg-purple-950/40 shadow-lg shadow-purple-500/20 ring-2 ring-purple-400/50'
                                  : 'border-emerald-400 bg-emerald-950/40 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-400/50'
                                : 'border-neutral-800 bg-neutral-950/80 hover:border-neutral-700 hover:bg-neutral-900/80'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full mb-2">
                              <div
                                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                                  isTelebirr
                                    ? 'bg-cyan-500/25 text-cyan-300 ring-1 ring-cyan-400/40'
                                    : isCbe
                                    ? 'bg-purple-500/25 text-purple-300 ring-1 ring-purple-400/40'
                                    : 'bg-emerald-500/25 text-emerald-300 ring-1 ring-emerald-400/40'
                                }`}
                              >
                                {isTelebirr ? (
                                  <Smartphone className="h-5 w-5 stroke-[2.5]" />
                                ) : (
                                  <Building2 className="h-5 w-5 stroke-[2.5]" />
                                )}
                              </div>
                              <span
                                className={`flex h-6 w-6 items-center justify-center rounded-full border transition ${
                                  isSelected
                                    ? isTelebirr
                                      ? 'bg-cyan-400 border-cyan-300 text-neutral-950 font-black'
                                      : isCbe
                                      ? 'bg-purple-400 border-purple-300 text-neutral-950 font-black'
                                      : 'bg-emerald-400 border-emerald-300 text-neutral-950 font-black'
                                    : 'border-neutral-700 bg-neutral-900 text-transparent'
                                }`}
                              >
                                {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                              </span>
                            </div>

                            <span className="font-black text-sm text-white leading-tight">
                              {isTelebirr
                                ? 'Telebirr (0929200166)'
                                : isCbe
                                ? 'CBE (1000218818424)'
                                : 'Awash (01320561958100)'}
                            </span>
                            <span className="mt-1 text-[11px] text-neutral-300 font-medium truncate w-full">
                              {pm.accountName}
                            </span>
                            <span
                              className={`mt-2 inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isSelected
                                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                                  : 'bg-neutral-800 text-neutral-400'
                              }`}
                            >
                              {isSelected ? 'Filatameera (Selected)' : 'Filachuuf Cuqaasaa'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Destination Card with copy */}
                  {activeMethod && (
                    <div className="rounded-2xl border border-amber-500/30 bg-neutral-950 p-4 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                        <span className="text-xs font-bold text-amber-400">
                          Odeeffannoo Herrega Kaffaltii ({activeMethod.provider})
                        </span>
                        <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          Qophii Dha (Active)
                        </span>
                      </div>

                      <div className="space-y-2 text-xs sm:text-sm">
                        <div className="flex justify-between border-b border-neutral-800/80 py-1">
                          <span className="text-neutral-400">Baankii:</span>
                          <span className="font-bold text-white">{activeMethod.provider}</span>
                        </div>
                        <div className="flex justify-between border-b border-neutral-800/80 py-1">
                          <span className="text-neutral-400">Maqaa Herregaa:</span>
                          <span className="font-bold text-amber-200">{activeMethod.accountName}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-neutral-800/80 py-1">
                          <span className="text-neutral-400">Lakk Herregaa:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm sm:text-base font-black text-amber-400">
                              {activeMethod.accountNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(activeMethod.accountNumber)}
                              className="flex items-center gap-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1 text-xs text-neutral-200 border border-neutral-700 transition"
                            >
                              {copied ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              <span>{copied ? 'Koppii!' : 'Copy'}</span>
                            </button>
                          </div>
                        </div>
                        {activeMethod.phoneNumber && (
                          <div className="flex justify-between border-b border-neutral-800/80 py-1">
                            <span className="text-neutral-400">Bilbila Telebirr:</span>
                            <span className="font-mono font-bold text-cyan-300">
                              {activeMethod.phoneNumber}
                            </span>
                          </div>
                        )}
                        <div className="pt-1 text-[11px] text-neutral-400">
                          <span className="font-bold text-neutral-300">Qajeelfama: </span>
                          <span>{activeMethod.instructions}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedMethodId) {
                        setError('Malla kaffaltii filadhaa (Please select a bank/provider)');
                        return;
                      }
                      setError('');
                      setDepositStep(2);
                      sound.playClick();
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 py-3.5 text-sm font-bold text-neutral-950 transition hover:from-amber-400 hover:to-yellow-400 shadow-lg shadow-amber-500/20"
                  >
                    <span>Itti Fufi: Hamma Qarshii Filadhaa (Next)</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* STEP 2: SELECT DEPOSIT AMOUNT */}
              {depositStep === 2 && (
                <div className="space-y-4">
                  {/* Selected Bank Banner */}
                  <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[10px] text-neutral-400 uppercase">Baankii Filatame:</div>
                        <div className="text-xs font-bold text-white">
                          {activeMethod?.provider} •{' '}
                          <span className="font-mono text-amber-400">{activeMethod?.accountNumber}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDepositStep(1);
                        sound.playClick();
                      }}
                      className="text-xs font-semibold text-amber-400 hover:underline"
                    >
                      Jijjiiri (Change)
                    </button>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-wider text-amber-400">
                      2. Hanga Qarshii Galchan Filadhaa (Deposit Amount ETB)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        min={activeMethod?.minAmount || 50}
                        max={activeMethod?.maxAmount || 50000}
                        step="1"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="100"
                        className="w-full rounded-2xl border border-neutral-700 bg-neutral-800 py-3.5 pl-4 pr-16 text-xl font-black text-white focus:border-amber-500 focus:outline-none font-mono"
                      />
                      <span className="absolute right-4 top-4 font-black text-amber-400 text-sm">
                        ETB
                      </span>
                    </div>

                    {/* Quick amount chips */}
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {[50, 100, 200, 250, 500, 1000, 2000].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => {
                            setAmount(val.toString());
                            sound.playClick();
                          }}
                          className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                            amount === val.toString()
                              ? 'border-amber-400 bg-amber-400 text-neutral-950 shadow-md'
                              : 'border-neutral-800 bg-neutral-800/80 text-neutral-300 hover:border-neutral-700 hover:text-white'
                          }`}
                        >
                          +{val} ETB
                        </button>
                      ))}
                    </div>

                    <div className="mt-2 flex justify-between text-[11px] text-neutral-400">
                      <span>Xiqqaa: {activeMethod?.minAmount || 50} ETB</span>
                      <span>Guddaa: {(activeMethod?.maxAmount || 50000).toLocaleString()} ETB</span>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setDepositStep(1);
                        sound.playClick();
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-800 py-3 text-sm font-bold text-neutral-300 hover:bg-neutral-700 hover:text-white transition"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>Duubatti (Back)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const num = Number(amount);
                        const min = activeMethod?.minAmount || 50;
                        const max = activeMethod?.maxAmount || 50000;
                        if (!num || num < min) {
                          setError(`Hammi kaffaltii xiqqaan ${min} ETB dha`);
                          return;
                        }
                        if (num > max) {
                          setError(`Hammi kaffaltii guddaan ${max} ETB dha`);
                          return;
                        }
                        setError('');
                        setDepositStep(3);
                        sound.playClick();
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 py-3 text-sm font-bold text-neutral-950 hover:from-amber-400 hover:to-yellow-400 shadow-lg shadow-amber-500/20 transition"
                    >
                      <span>Itti Fufi: Nagahee & FT (Next)</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: TRANSACTION FT CODE & RECEIPT UPLOAD */}
              {depositStep === 3 && (
                <div className="space-y-4">
                  {/* Summary of Step 1 & 2 */}
                  <div className="rounded-2xl border border-amber-500/30 bg-neutral-950 p-3.5 space-y-1.5 text-xs">
                    <div className="flex justify-between text-neutral-400">
                      <span>Baankii:</span>
                      <span className="font-bold text-white">{activeMethod?.provider}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Lakk Herregaa:</span>
                      <span className="font-mono font-bold text-amber-400">
                        {activeMethod?.accountNumber}
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-400 border-t border-neutral-800 pt-1.5">
                      <span>Hamma Qarshii:</span>
                      <span className="font-mono text-sm font-black text-emerald-400">
                        {amount} ETB
                      </span>
                    </div>
                  </div>

                  {/* Transaction ID / FT Code */}
                  <div>
                    <label className="mb-1 block text-xs font-black uppercase tracking-wider text-amber-400">
                      3. Lakkoofsa FT Codi / Transaction ID (Dirqama)
                    </label>
                    <input
                      type="text"
                      required
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="Fkn: FT260718902 ykn TXN892019"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm font-mono uppercase text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* Receipt Image Upload */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-black uppercase tracking-wider text-amber-400">
                        4. Suuraa Nagahee / Upload Receipt Screenshot
                      </label>
                      <span className="text-[10px] text-neutral-400">
                        (Filannoo - Optional yoo FT qabaattan)
                      </span>
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 transition ${
                        receiptBase64
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-neutral-700 bg-neutral-800/50 hover:border-amber-500 hover:bg-neutral-800'
                      }`}
                    >
                      {receiptBase64 ? (
                        <div className="flex flex-col items-center gap-2">
                          <img
                            src={receiptBase64}
                            alt="Receipt preview"
                            className="h-28 max-w-full rounded-xl object-contain border border-neutral-700 shadow-md"
                          />
                          <span className="text-xs font-semibold text-emerald-400">
                            {receiptFileName || 'Nagaheen filatameera'} (Jijjiiruuf cuqaasaa)
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-neutral-400 py-2">
                          <Upload className="h-8 w-8 text-amber-400" />
                          <span className="text-xs font-semibold text-neutral-200">
                            Suuraa Nagahee Kaffaltii ol-fe'aa (Tap to choose photo / take picture)
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            JPG, PNG, WEBP ykn Suuraa Bilbilaa
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Security notice */}
                  <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-300 border border-amber-500/20">
                    <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                    <span>
                      <strong>Qajeelfama:</strong> Nagahee fi FT Code ergame Admin biratti daqiiqaa muraasa keessatti ilaallamee herrega keessanitti dabalama.
                    </span>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setDepositStep(2);
                        sound.playClick();
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-neutral-700 bg-neutral-800 py-3.5 text-sm font-bold text-neutral-300 hover:bg-neutral-700 hover:text-white transition"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>Duubatti (Back)</span>
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 py-3.5 text-sm font-black text-neutral-950 transition hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                    >
                      {loading ? 'Kaffaltiin ergamaa jira...' : 'Kaffaltii Ergi (Submit Deposit)'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}

          {/* TAB 2: WITHDRAW */}
          {activeTab === 'withdraw' && (
            <form onSubmit={handleWithdrawSubmit} className="space-y-4">
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Qarshii Baasuu Dandeessan:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {user.walletBalance.toFixed(2)} ETB
                  </span>
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  Baasiin xiqqaan 100.00 ETB dha.
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Malli Baasii (Provider)
                </label>
                <select
                  value={withdrawProvider}
                  onChange={(e) => setWithdrawProvider(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="Telebirr">Telebirr (Mobile Money)</option>
                  <option value="Commercial Bank of Ethiopia (CBE)">Commercial Bank of Ethiopia (CBE)</option>
                  <option value="Awash Bank">Awash Bank</option>
                  <option value="Bank of Abyssinia">Bank of Abyssinia</option>
                  <option value="Cooperative Bank of Oromia">Cooperative Bank of Oromia</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Maqaa Herregaa Guutuu (Full Account Name)
                </label>
                <input
                  type="text"
                  required
                  value={withdrawAccountName}
                  onChange={(e) => setWithdrawAccountName(e.target.value)}
                  placeholder="Maqaa keessan guutuu"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Lakkoofsa Herregaa / Bilbilaa (Account Number / Phone)
                </label>
                <input
                  type="text"
                  required
                  value={withdrawAccountNumber}
                  onChange={(e) => setWithdrawAccountNumber(e.target.value)}
                  placeholder="1000... ykn 09..."
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Hanga Qarshii Baasuuf Barbaaddan (Withdrawal Amount)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min={100}
                    max={user.walletBalance}
                    step="1"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-800 py-3 pl-4 pr-16 text-lg font-bold text-white focus:border-amber-500 focus:outline-none font-mono"
                  />
                  <span className="absolute right-4 top-3.5 font-bold text-neutral-400">
                    ETB
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || user.walletBalance < 100}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 py-3.5 text-sm font-bold text-neutral-950 transition hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50 shadow-lg shadow-amber-500/20"
              >
                {loading ? 'Gaaffiin ergamaa jira...' : 'Qarshii Baasi (Request Withdrawal)'}
              </button>
            </form>
          )}

          {/* TAB 3: TRANSACTION HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {transactions.length === 0 ? (
                <div className="py-12 text-center text-neutral-500">
                  <FileText className="mx-auto mb-2 h-10 w-10 opacity-30" />
                  <p className="text-sm">Seenaan kaffaltii hin jiru (No transactions yet)</p>
                </div>
              ) : (
                transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950/70 p-3.5"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          tx.type === 'DEPOSIT' ||
                          tx.type === 'PRIZE_WIN' ||
                          tx.type === 'REFERRAL_BONUS'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : tx.type === 'WITHDRAWAL_REFUND'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {tx.type === 'DEPOSIT' && <ArrowDownCircle className="h-5 w-5" />}
                        {tx.type === 'WITHDRAWAL_REQUEST' && <ArrowUpCircle className="h-5 w-5" />}
                        {tx.type === 'WITHDRAWAL_REFUND' && <CheckCircle className="h-5 w-5" />}
                        {tx.type === 'TICKET_PURCHASE' && <Clock className="h-5 w-5" />}
                        {tx.type === 'PRIZE_WIN' && <CheckCircle className="h-5 w-5" />}
                        {tx.type === 'REFERRAL_BONUS' && <CheckCircle className="h-5 w-5" />}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {tx.type === 'DEPOSIT' && 'Galii Kaffaltii (Deposit)'}
                          {tx.type === 'WITHDRAWAL_REQUEST' && 'Gaaffii Baasii (Withdrawal)'}
                          {tx.type === 'WITHDRAWAL_REFUND' && 'Qarshii Deebifame (Refund)'}
                          {tx.type === 'TICKET_PURCHASE' && 'Bittaa Tikkeetii (Ticket)'}
                          {tx.type === 'PRIZE_WIN' && 'Badhaasa Caaraa (Prize Win!)'}
                          {tx.type === 'REFERRAL_BONUS' && 'Badhaasa Afeerraa (Referral Bonus)'}
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {new Date(tx.createdAt).toLocaleString()}
                          {tx.note && ` • ${tx.note}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-mono text-sm font-bold ${
                          tx.type === 'DEPOSIT' ||
                          tx.type === 'PRIZE_WIN' ||
                          tx.type === 'REFERRAL_BONUS' ||
                          tx.type === 'WITHDRAWAL_REFUND'
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {tx.type === 'DEPOSIT' ||
                        tx.type === 'PRIZE_WIN' ||
                        tx.type === 'REFERRAL_BONUS' ||
                        tx.type === 'WITHDRAWAL_REFUND'
                          ? '+'
                          : '-'}
                        {tx.amount.toFixed(2)} ETB
                      </div>
                      <div className="text-[10px] text-neutral-500 font-mono">
                        Haftee: {tx.balanceAfter.toFixed(2)} ETB
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
