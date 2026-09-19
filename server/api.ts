import express, { Request, Response, NextFunction } from 'express';
import { AuthService, requireAuth, requireAdmin, AuthenticatedRequest } from './auth';
import { WalletService } from './wallet';
import { RoundService } from './rounds';
import { DbService } from './db';
import { checkPostgresStatus } from './postgres';
import { addSSEClient, getActiveClientsCount } from './sse';
import { PaymentMethod } from '../src/types/index';
import { getWorkerStats } from './worker';

const router = express.Router();


// CORS & Preflight handling for all API requests
router.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin || '*';
  const frontendUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/+$/, '') : null;
  const allowedOrigin = frontendUrl || origin;

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});


// Body parser configuration for base64 receipts up to 10MB
router.use(express.json({ limit: '10mb' }));
router.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
router.get('/health', async (req: Request, res: Response) => {
  const pgStatus = await checkPostgresStatus();
  res.json({
    status: 'ok',
    app: 'Spin Ethiopia',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      type: pgStatus.configured ? 'postgresql' : 'json_fallback',
      postgresConfigured: pgStatus.configured,
      postgresConnected: pgStatus.connected,
      databaseName: pgStatus.database || null,
      error: pgStatus.error || null,
    },
    paymentMethodsReady: true,
  });
});

// 24/7 Always-On Worker Status
router.get('/worker/status', async (req: Request, res: Response) => {
  const stats = getWorkerStats();
  const pgStatus = await checkPostgresStatus();
  res.json({
    status: 'ok',
    worker: {
      ...stats,
      postgresConfigured: pgStatus.configured,
      postgresConnected: pgStatus.connected,
    },
    serverTime: new Date().toISOString(),
  });
});



// --- AUTHENTICATION ---
router.post('/auth/register', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, phone, password, confirmPassword, referralCode } = req.body;
    const result = await AuthService.register({
      firstName,
      lastName,
      phone,
      password,
      confirmPassword,
      referralCode,
    });
    res.json({ success: true, user: result.user, token: result.token });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;
    const result = await AuthService.login({ phone, password });
    res.json({ success: true, user: result.user, token: result.token });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Login failed' });
  }
});

router.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, user: req.user });
});

router.post('/auth/logout', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || (req.headers['x-session-token'] as string);
  let token = '';
  if (authHeader) {
    token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  }
  await AuthService.logout(token);
  res.json({ success: true, message: 'Logged out successfully' });
});

// --- PUBLIC & ACTIVE PAYMENT METHODS ---
// NO EXTERNAL PAYMENT API. These return official admin-configured payment destinations
router.get('/payment-methods', async (req: Request, res: Response) => {
  try {
    const data = await DbService.get((db) => {
      const methods = Object.values(db.paymentMethods)
        .filter((pm) => pm.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const pendingDeposits = Object.values(db.deposits)
        .filter((d) => d.status === 'PENDING')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const pendingDepositsCount = pendingDeposits.length;
      const latestPending = pendingDeposits[0] ? {
        id: pendingDeposits[0].id,
        userName: pendingDeposits[0].userName,
        userPhone: pendingDeposits[0].userPhone,
        amount: pendingDeposits[0].amount,
        provider: pendingDeposits[0].provider,
        transactionId: pendingDeposits[0].transactionId,
        receiptUrl: pendingDeposits[0].receiptUrl,
        time: new Date(pendingDeposits[0].createdAt).toLocaleTimeString(),
      } : null;
      return { methods, pendingDepositsCount, latestPending };
    });
    res.json({
      success: true,
      methods: data.methods,
      pendingDepositsCount: data.pendingDepositsCount,
      latestPendingDeposit: data.latestPending,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- USER WALLET & DEPOSITS ---
router.post('/wallet/deposit', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { paymentMethodId, amount, transactionId, receiptUrl } = req.body;
    const deposit = await WalletService.submitDeposit({
      user: req.user!,
      paymentMethodId,
      amount: Number(amount),
      transactionId,
      receiptUrl,
    });
    res.json({
      success: true,
      message: 'Kaffaltiin keessan ergameera. Admin mirkaneessuun herrega keessanitti dabala (Deposit submitted, pending admin review)',
      deposit,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to submit deposit' });
  }
});

router.post('/wallet/withdraw', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { provider, accountName, accountNumber, amount } = req.body;
    const withdrawal = await WalletService.submitWithdrawal({
      user: req.user!,
      provider,
      accountName,
      accountNumber,
      amount: Number(amount),
    });
    res.json({
      success: true,
      message: 'Gaaffiin baasii ergameera, admin mirkaneessee isiniif erga (Withdrawal submitted, pending processing)',
      withdrawal,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to submit withdrawal' });
  }
});

router.get('/wallet/transactions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const transactions = await WalletService.getUserTransactions(req.user!.id);
    res.json({ success: true, transactions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- REFERRALS ---
router.get('/referrals/stats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const stats = await DbService.get((db) => {
      const user = db.users[userId];
      const referredUsers = Object.values(db.users).filter((u) => u.referredBy === userId);
      const referralTx = Object.values(db.transactions).filter(
        (tx) => tx.userId === userId && tx.type === 'REFERRAL_BONUS'
      );
      const totalEarned = referralTx.reduce((sum, tx) => sum + tx.amount, 0);

      return {
        referralCode: user?.referralCode || '',
        referredCount: referredUsers.length,
        totalEarned,
        referredUsers: referredUsers.map((u) => ({
          phone: u.phone.slice(0, 4) + '****' + u.phone.slice(-2),
          joinedAt: u.createdAt,
          hasQualified: !!db.processedReferralBonuses[u.id],
        })),
      };
    });
    res.json({ success: true, ...stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- ROUND & LUCKY DRAW (1-100) ---
const handleGetActiveRound = async (req: Request, res: Response) => {
  try {
    const round = await RoundService.getActiveRound();
    const settings = await DbService.get((db) => db.settings);
    res.json({ success: true, round, settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
router.get('/round/active', handleGetActiveRound);
router.get('/rounds/active', handleGetActiveRound);

// Public Verification & Proof Endpoint ("wan dhugaa ta'uu issaa mirkaneessii")
router.get('/rounds/verify-authenticity', async (req: Request, res: Response) => {
  try {
    const proof = await RoundService.verifyRoundAuthenticity();
    res.json({ success: true, proof });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const handleSelectTicket = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { number } = req.body;
    const result = await RoundService.selectNumber({
      user: req.user!,
      number: Number(number),
    });
    res.json({
      success: true,
      message: `Lakkoofsi #${number} milkaa'inaan filatameera (Number #${number} successfully selected)`,
      round: result.round,
      userBalance: result.userBalance,
      selection: result.selection,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to select number' });
  }
};
router.post('/round/select', requireAuth, handleSelectTicket);
router.post('/round/select-ticket', requireAuth, handleSelectTicket);
router.post('/rounds/select', requireAuth, handleSelectTicket);
router.post('/rounds/select-ticket', requireAuth, handleSelectTicket);

const handlePreviousWinners = async (req: Request, res: Response) => {
  try {
    const winners = await RoundService.getPreviousWinners(15);
    res.json({ success: true, winners, history: winners });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
router.get('/round/previous-winners', handlePreviousWinners);
router.get('/rounds/previous-winners', handlePreviousWinners);
router.get('/round/winners', handlePreviousWinners);
router.get('/rounds/winners', handlePreviousWinners);
router.get('/round/history', handlePreviousWinners);
router.get('/rounds/history', handlePreviousWinners);

const handleTopWinners = async (req: Request, res: Response) => {
  try {
    const rounds = await RoundService.getPreviousWinners(50);
    const map = new Map<string, {
      userId: string;
      userName: string;
      userPhone: string;
      totalWins: number;
      firstPlaceWins: number;
      totalPrizes: number;
      lastRoundWon: number;
    }>();

    for (const r of rounds) {
      for (const w of r.winners || []) {
        const key = w.userPhone || w.userId || w.userName;
        const current = map.get(key) || {
          userId: w.userId,
          userName: w.userName,
          userPhone: w.userPhone,
          totalWins: 0,
          firstPlaceWins: 0,
          totalPrizes: 0,
          lastRoundWon: r.roundNumber,
        };
        current.totalWins += 1;
        if (w.rank === 1) {
          current.firstPlaceWins += 1;
        }
        current.totalPrizes += w.prizeAmount;
        map.set(key, current);
      }
    }

    const defaultTop = [
      { userId: 'top_1', userName: 'Chala Bekele', userPhone: '0988***55', totalWins: 6, firstPlaceWins: 4, totalPrizes: 7500, lastRoundWon: 2 },
      { userId: 'top_2', userName: 'Asefa Wasenu', userPhone: '0921***10', totalWins: 5, firstPlaceWins: 3, totalPrizes: 5600, lastRoundWon: 2 },
      { userId: 'top_3', userName: 'Tolera Bekele', userPhone: '0911***42', totalWins: 4, firstPlaceWins: 2, totalPrizes: 4200, lastRoundWon: 1 },
      { userId: 'top_4', userName: 'Gemechu B.', userPhone: '0912***34', totalWins: 3, firstPlaceWins: 2, totalPrizes: 3100, lastRoundWon: 1 },
      { userId: 'top_5', userName: 'Bontu G.', userPhone: '0933***15', totalWins: 3, firstPlaceWins: 1, totalPrizes: 2500, lastRoundWon: 1 },
    ];

    const combined = Array.from(map.values());
    for (const d of defaultTop) {
      if (!combined.some(c => c.userName.toLowerCase() === d.userName.toLowerCase())) {
        combined.push(d);
      }
    }

    combined.sort((a, b) => {
      if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
      return b.totalPrizes - a.totalPrizes;
    });

    const topWinners = combined.slice(0, 5).map((player, idx) => ({
      rank: idx + 1,
      ...player,
    }));

    res.json({ success: true, topWinners });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
router.get('/round/top-winners', handleTopWinners);
router.get('/rounds/top-winners', handleTopWinners);

router.get('/round/stats', async (req: Request, res: Response) => {
  try {
    const stats = await RoundService.getLuckyStats();
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- REAL-TIME LIVE SSE STREAM ---
const handleLiveStream = (req: Request, res: Response) => {
  const clientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const cleanup = addSSEClient(clientId, res);
  req.on('close', cleanup);
};

router.get('/live/stream', handleLiveStream);
router.get('/live-stream', handleLiveStream);
router.get('/stream', handleLiveStream);

// --- ADMIN API ROUTES (ADMIN ONLY) ---

router.get('/admin/metrics', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const metrics = await DbService.get((db) => {
      const deposits = Object.values(db.deposits);
      const withdrawals = Object.values(db.withdrawals);
      const rounds = Object.values(db.rounds);
      const activeRound = db.rounds[db.activeRoundId];

      const pendingDeposits = deposits.filter((d) => d.status === 'PENDING');
      const pendingWithdrawals = withdrawals.filter((w) => w.status === 'PENDING');
      const totalDepositVolume = deposits
        .filter((d) => d.status === 'APPROVED')
        .reduce((sum, d) => sum + d.amount, 0);
      const totalWithdrawalVolume = withdrawals
        .filter((w) => w.status === 'APPROVED')
        .reduce((sum, w) => sum + w.amount, 0);

      return {
        totalUsers: Object.keys(db.users).length,
        pendingDeposits: pendingDeposits.length,
        pendingDepositsCount: pendingDeposits.length,
        pendingWithdrawals: pendingWithdrawals.length,
        pendingWithdrawalsCount: pendingWithdrawals.length,
        totalDepositVolume,
        totalWithdrawalVolume,
        activeRoundPool: activeRound ? activeRound.totalPool : 0,
        activeRoundTicketsSold: activeRound ? Object.keys(activeRound.selections).length : 0,
        totalRoundsCompleted: rounds.filter((r) => r.status === 'COMPLETED').length,
        liveConnections: getActiveClientsCount(),
      };
    });

    res.json({ success: true, metrics });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/users', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await DbService.get((db) => {
      return Object.values(db.users).map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        role: u.role,
        walletBalance: u.walletBalance,
        referralCode: u.referralCode,
        createdAt: u.createdAt,
      }));
    });
    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/users/adjust-balance', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, action, amount, reason } = req.body;
    if (!userId || !action || typeof amount !== 'number') {
      return res.status(400).json({ error: 'Odeeffannoo herrega sirreessuu guutuu galchaa' });
    }

    const result = await WalletService.adminAdjustBalance({
      userId,
      action,
      amount: Number(amount),
      reason: reason || 'Sirreeffama Admin',
      admin: { id: req.user!.id, phone: req.user!.phone },
    });

    res.json({
      success: true,
      message: 'Herregni fayyadamaa milkaa\'inaan sirreeffameera',
      user: {
        id: result.user.id,
        phone: result.user.phone,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        walletBalance: result.newBalance,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin updates user profile (Name, Phone, Role, Password, Balance)
router.post('/admin/users/update', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, firstName, lastName, phone, role, newPassword, walletBalance } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const updatedUser = await AuthService.adminUpdateUser({
      userId,
      firstName,
      lastName,
      phone,
      role,
      newPassword,
      walletBalance: typeof walletBalance === 'number' ? walletBalance : undefined,
      admin: { id: req.user!.id, phone: req.user!.phone },
    });

    res.json({
      success: true,
      message: 'Accountiin fayyadamaa milkaa\'inaan haaromfameera (User account updated)',
      user: updatedUser,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin pays real money (Telebirr/CBE) to winner/user -> deducts from system balance
router.post('/admin/users/payout-real-cash', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, amount, provider = 'Telebirr', transactionId, note } = req.body;
    if (!userId || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'UserId fi hamma qarshii sirrii galchaa' });
    }

    const result = await WalletService.adminPayRealCash({
      userId,
      amount: Number(amount),
      provider,
      transactionId,
      note,
      admin: { id: req.user!.id, phone: req.user!.phone },
    });

    res.json({
      success: true,
      message: `Qarshiin ${amount} ETB ${provider} tiin kaffalamee herrega irraa hir'ifameera!`,
      user: {
        id: result.user.id,
        phone: result.user.phone,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        walletBalance: result.newBalance,
      },
      transaction: result.transaction,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/admin/deposits', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deposits = await DbService.get((db) => {
      return Object.values(db.deposits).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
    res.json({ success: true, deposits });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/deposits/approve', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { depositId } = req.body;
    if (!depositId) throw new Error('Deposit ID is required');

    const result = await WalletService.approveDeposit(depositId, {
      id: req.user!.id,
      phone: req.user!.phone,
    });

    res.json({
      success: true,
      message: 'Kaffaltiin mirkanaa\'eera, herregni dabaleera (Deposit approved, wallet credited)',
      deposit: result.deposit,
      userBalance: result.userBalance,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to approve deposit' });
  }
});

router.post('/admin/deposits/reject', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { depositId, reason } = req.body;
    if (!depositId) throw new Error('Deposit ID is required');

    const deposit = await WalletService.rejectDeposit(depositId, reason, {
      id: req.user!.id,
      phone: req.user!.phone,
    });

    res.json({
      success: true,
      message: 'Kaffaltiin kuffifameera (Deposit rejected)',
      deposit,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to reject deposit' });
  }
});

router.get('/admin/withdrawals', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const withdrawals = await DbService.get((db) => {
      return Object.values(db.withdrawals).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
    res.json({ success: true, withdrawals });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/withdrawals/approve', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { withdrawalId } = req.body;
    if (!withdrawalId) throw new Error('Withdrawal ID is required');

    const withdrawal = await WalletService.approveWithdrawal(withdrawalId, {
      id: req.user!.id,
      phone: req.user!.phone,
    });

    res.json({
      success: true,
      message: 'Baasiin mirkanaa\'eera (Withdrawal approved)',
      withdrawal,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to approve withdrawal' });
  }
});

router.post('/admin/withdrawals/reject', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { withdrawalId, reason } = req.body;
    if (!withdrawalId) throw new Error('Withdrawal ID is required');

    const result = await WalletService.rejectWithdrawal(withdrawalId, reason, {
      id: req.user!.id,
      phone: req.user!.phone,
    });

    res.json({
      success: true,
      message: 'Baasiin kuffifameera, qarshiin deebifameera (Withdrawal rejected and refunded)',
      withdrawal: result.withdrawal,
      refundedBalance: result.refundedBalance,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to reject withdrawal' });
  }
});

// Admin Round Controls
router.post('/admin/rounds/lock', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const round = await RoundService.lockRound({ id: req.user!.id, phone: req.user!.phone });
    res.json({ success: true, round });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/admin/rounds/unlock', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const round = await RoundService.unlockRound({ id: req.user!.id, phone: req.user!.phone });
    res.json({ success: true, round });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/admin/rounds/assign-slot', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { number, userName, userPhone } = req.body;
    const round = await RoundService.assignSlot({
      number: Number(number),
      userName,
      userPhone,
      admin: { id: req.user!.id, phone: req.user!.phone },
    });
    res.json({ success: true, round });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/admin/rounds/release-slot', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { number } = req.body;
    const round = await RoundService.releaseSlot(Number(number), {
      id: req.user!.id,
      phone: req.user!.phone,
    });
    res.json({ success: true, round });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/admin/rounds/bulk-assign', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { numbers, userName, userPhone } = req.body;
    const round = await RoundService.bulkAssignSlots({
      numbers: (numbers || []).map(Number),
      userName,
      userPhone,
      admin: { id: req.user!.id, phone: req.user!.phone },
    });
    res.json({ success: true, round });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/admin/rounds/bulk-release', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { numbers } = req.body;
    const round = await RoundService.bulkReleaseSlots({
      numbers: (numbers || []).map(Number),
      admin: { id: req.user!.id, phone: req.user!.phone },
    });
    res.json({ success: true, round });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/admin/rounds/fill-simulated', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { count = 30 } = req.body;
    const result = await RoundService.fillSimulatedSlots({
      count: Number(count),
      admin: { id: req.user!.id, phone: req.user!.phone },
    });
    res.json({
      success: true,
      message: `Tikkeetoota ${result.filledCount} maqaa namootaan qabamaniiru (Urgency demand created)`,
      round: result.round,
      filledCount: result.filledCount,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin endpoint: Set 50% numbers claimed with authentic Ethiopian profiles & proof
router.post('/admin/rounds/fill-fifty-percent', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await RoundService.fillFiftyPercentGenuine({
      id: req.user!.id,
      phone: req.user!.phone,
    });
    res.json({
      success: true,
      message: `Lakkoofsi 50% (50/100) mirkaneeffamee qabameera! Baajanni waligalaa: ${result.totalPool.toFixed(2)} ETB`,
      round: result.round,
      totalClaimed: result.totalClaimed,
      claimedPercent: result.claimedPercent,
      totalPool: result.totalPool,
      provableFairHash: result.provableFairHash,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin endpoint: Set ALL 100% numbers claimed (1-100) ("lakk hundii akka qabamani jiranitii hojedhu")
router.post(['/admin/rounds/fill-hundred-percent', '/admin/rounds/fill-all-tickets'], requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await RoundService.fillAllSlotsGenuine({
      id: req.user!.id,
      phone: req.user!.phone,
    });
    res.json({
      success: true,
      message: `Lakkoofsi hundi (100/100) guutameera! Baajanni waligalaa: ${result.totalPool.toFixed(2)} ETB`,
      round: result.round,
      totalClaimed: result.totalClaimed,
      claimedPercent: 100,
      totalPool: result.totalPool,
      provableFairHash: result.provableFairHash,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});


router.post('/admin/rounds/clear-simulated', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await RoundService.clearSimulatedSlots({
      id: req.user!.id,
      phone: req.user!.phone,
    });
    res.json({
      success: true,
      message: `Bakki tikkeetii sossobaa ${result.clearedCount} duwwaa ta'eera (Slots cleared and made open for real players)`,
      round: result.round,
      clearedCount: result.clearedCount,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/admin/rounds/draw', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { manualWinners } = req.body;
    const result = await RoundService.drawWinners({
      admin: { id: req.user!.id, phone: req.user!.phone },
      manualWinners,
    });
    res.json({
      success: true,
      message: 'Mo\'attoonni milkaa\'inaan ba\'aniiru, badhaasni qoodameera (Winners drawn and prizes distributed)',
      completedRound: result.round,
      winners: result.winners,
      nextRound: result.nextRound,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Payment Methods Configuration
router.get('/admin/payment-methods', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const methods = await DbService.get((db) => Object.values(db.paymentMethods));
    res.json({ success: true, methods });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/payment-methods', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const methodData: PaymentMethod = req.body;
    if (!methodData.id || !methodData.provider || !methodData.accountNumber) {
      throw new Error('Provider and account number are required');
    }

    await DbService.mutate((db) => {
      db.paymentMethods[methodData.id] = methodData;
    });

    await DbService.logAudit(
      { id: req.user!.id, phone: req.user!.phone },
      'PAYMENT_METHOD_UPDATED',
      'PAYMENT_METHOD',
      methodData.id,
      `Configured payment destination ${methodData.provider} (${methodData.accountNumber})`
    );

    res.json({ success: true, method: methodData });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Settings
router.get('/admin/settings', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const settings = await DbService.get((db) => db.settings);
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/settings', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const newSettings = req.body;
    const { firstPrizePercent, secondPrizePercent, thirdPrizePercent, platformPercent } =
      newSettings;

    const total =
      Number(firstPrizePercent) +
      Number(secondPrizePercent) +
      Number(thirdPrizePercent) +
      Number(platformPercent);
    if (Math.abs(total - 100) > 0.01) {
      throw new Error(
        `Qoodinsi badhaasaa 100% ta'uu qaba! Amma: ${total}% (${firstPrizePercent}% + ${secondPrizePercent}% + ${thirdPrizePercent}% + ${platformPercent}%)`
      );
    }

    await DbService.mutate((db) => {
      db.settings = { ...db.settings, ...newSettings };
    });

    await DbService.logAudit(
      { id: req.user!.id, phone: req.user!.phone },
      'SETTINGS_UPDATED',
      'SETTINGS',
      'MAIN',
      'Updated system settings & prize distribution'
    );

    res.json({ success: true, settings: newSettings });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Admin Audit Logs & CSV Export
router.get('/admin/audit-logs', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await DbService.get((db) => db.auditLogs);
    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/audit-logs/export-csv', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await DbService.get((db) => db.auditLogs);
    let csv = 'ID,Timestamp,Actor Phone,Action,Target Type,Target ID,Details\n';
    for (const log of logs) {
      const line = [
        `"${log.id}"`,
        `"${log.createdAt}"`,
        `"${log.actorPhone}"`,
        `"${log.action}"`,
        `"${log.targetType}"`,
        `"${log.targetId}"`,
        `"${(log.details || '').replace(/"/g, '""')}"`,
      ].join(',');
      csv += line + '\n';
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="spin_ethiopia_audit_${Date.now()}.csv"`
    );
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Round Winners CSV Export
router.get('/admin/rounds/export-csv', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rounds = await DbService.get((db) => Object.values(db.rounds));
    rounds.sort((a, b) => b.roundNumber - a.roundNumber);

    let csv = 'Round Number,Round ID,Status,Ticket Price (ETB),Total Pool (ETB),Completed At,Winner Rank,Winner Place,Winning Number,Winner Name,Winner Phone,Prize Amount (ETB)\n';
    for (const rnd of rounds) {
      const winners = rnd.winners && rnd.winners.length > 0 ? rnd.winners : [];
      if (winners.length > 0) {
        for (const w of winners) {
          const row = [
            `"${rnd.roundNumber}"`,
            `"${rnd.id}"`,
            `"${rnd.status}"`,
            `"${rnd.ticketPrice}"`,
            `"${rnd.totalPool.toFixed(2)}"`,
            `"${rnd.drawnAt || rnd.createdAt || ''}"`,
            `"${w.rank}"`,
            `"${w.rank}ffaa"`,
            `"${w.number}"`,
            `"${(w.userName || '').replace(/"/g, '""')}"`,
            `"${w.userPhone || ''}"`,
            `"${w.prizeAmount.toFixed(2)}"`,
          ].join(',');
          csv += row + '\n';
        }
      } else {
        const row = [
          `"${rnd.roundNumber}"`,
          `"${rnd.id}"`,
          `"${rnd.status}"`,
          `"${rnd.ticketPrice}"`,
          `"${rnd.totalPool.toFixed(2)}"`,
          `"${rnd.drawnAt || rnd.createdAt || ''}"`,
          `""`,
          `""`,
          `""`,
          `""`,
          `""`,
          `"0.00"`,
        ].join(',');
        csv += row + '\n';
      }
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="spin_ethiopia_round_winners_${Date.now()}.csv"`
    );
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Transaction History CSV Export (Deposits, Withdrawals, Wallet Transactions)
router.get('/admin/transactions/export-csv', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { deposits, withdrawals, transactions, users } = await DbService.get((db) => ({
      deposits: Object.values(db.deposits),
      withdrawals: Object.values(db.withdrawals),
      transactions: Object.values(db.transactions),
      users: db.users,
    }));

    interface UnifiedTx {
      id: string;
      category: 'DEPOSIT' | 'WITHDRAWAL' | 'WALLET_TX';
      type: string;
      userName: string;
      userPhone: string;
      amount: number;
      method: string;
      refNumber: string;
      status: string;
      createdAt: string;
      processedAt: string;
      notes: string;
    }

    const unifiedList: UnifiedTx[] = [];

    for (const dep of deposits) {
      unifiedList.push({
        id: dep.id,
        category: 'DEPOSIT',
        type: 'MANUAL_DEPOSIT',
        userName: dep.userName || '',
        userPhone: dep.userPhone || '',
        amount: dep.amount,
        method: dep.provider || '',
        refNumber: dep.transactionId || '',
        status: dep.status,
        createdAt: dep.createdAt || '',
        processedAt: dep.reviewedAt || '',
        notes: dep.rejectReason || '',
      });
    }

    for (const w of withdrawals) {
      unifiedList.push({
        id: w.id,
        category: 'WITHDRAWAL',
        type: 'PAYOUT_WITHDRAWAL',
        userName: w.userName || w.accountName || '',
        userPhone: w.userPhone || '',
        amount: w.amount,
        method: w.provider || '',
        refNumber: w.accountNumber || '',
        status: w.status,
        createdAt: w.createdAt || '',
        processedAt: w.reviewedAt || '',
        notes: w.rejectReason || '',
      });
    }

    for (const tx of transactions) {
      const u = users[tx.userId];
      unifiedList.push({
        id: tx.id,
        category: 'WALLET_TX',
        type: tx.type,
        userName: u ? `${u.firstName} ${u.lastName}`.trim() : tx.userId,
        userPhone: u?.phone || '',
        amount: tx.amount,
        method: 'INTERNAL_BALANCE',
        refNumber: tx.referenceId || '',
        status: 'COMPLETED',
        createdAt: tx.createdAt || '',
        processedAt: tx.createdAt || '',
        notes: tx.note || '',
      });
    }

    // Sort by createdAt descending
    unifiedList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    let csv = 'Transaction ID,Category,Type,User Name,User Phone,Amount (ETB),Method / Provider,Account / FT / Ref,Status,Created At,Processed At,Notes\n';
    for (const item of unifiedList) {
      const row = [
        `"${item.id}"`,
        `"${item.category}"`,
        `"${item.type}"`,
        `"${(item.userName || '').replace(/"/g, '""')}"`,
        `"${item.userPhone || ''}"`,
        `"${item.amount.toFixed(2)}"`,
        `"${(item.method || '').replace(/"/g, '""')}"`,
        `"${(item.refNumber || '').replace(/"/g, '""')}"`,
        `"${item.status}"`,
        `"${item.createdAt}"`,
        `"${item.processedAt}"`,
        `"${(item.notes || '').replace(/"/g, '""')}"`,
      ].join(',');
      csv += row + '\n';
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="spin_ethiopia_transactions_${Date.now()}.csv"`
    );
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
