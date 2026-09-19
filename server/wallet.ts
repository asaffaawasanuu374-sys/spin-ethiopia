import crypto from 'crypto';
import { DbService, appendAuditLog } from './db';
import { SafeMoney } from './money';
import { broadcastSSE } from './sse';
import {
  Deposit,
  Withdrawal,
  WalletTransaction,
  User,
  PaymentMethod,
} from '../src/types/index';

export class WalletService {
  /**
   * Submits a manual deposit request with receipt and transaction ID.
   * Status will be PENDING. User's balance is NOT credited here.
   */
  static async submitDeposit(params: {
    user: User;
    paymentMethodId: string;
    amount: number;
    transactionId: string;
    receiptUrl: string;
  }): Promise<Deposit> {
    const { user, paymentMethodId, amount, transactionId, receiptUrl } = params;

    const cleanAmount = SafeMoney.fromCents(SafeMoney.toCents(amount));
    const cleanTxId = (transactionId || '').trim();

    if (!cleanTxId) {
      throw new Error('Lakkoofsi daddabarsaa (FT / Transaction ID) guutamuu qaba (Transaction ID is required)');
    }

    // Prepare valid receiptUrl - if image provided, use it. Otherwise generate a clean SVG receipt voucher badge
    let finalReceipt = (receiptUrl || '').trim();
    if (!finalReceipt || (!finalReceipt.startsWith('data:image/') && !finalReceipt.startsWith('http'))) {
      const dateStr = new Date().toLocaleString();
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="280" viewBox="0 0 500 280">
        <rect width="500" height="280" rx="16" fill="#09090b" stroke="#f59e0b" stroke-width="3"/>
        <text x="250" y="42" font-family="sans-serif" font-size="16" font-weight="900" fill="#fde047" text-anchor="middle">RAGAA KAFFALTII (PAYMENT VOUCHER)</text>
        <line x1="30" y1="60" x2="470" y2="60" stroke="#27272a" stroke-width="2"/>
        <text x="40" y="100" font-family="sans-serif" font-size="13" fill="#a1a1aa">Lakk FT / TxID:</text>
        <text x="180" y="100" font-family="monospace" font-size="15" font-weight="bold" fill="#fde047">${cleanTxId}</text>
        <text x="40" y="140" font-family="sans-serif" font-size="13" fill="#a1a1aa">Hanga Qarshii:</text>
        <text x="180" y="140" font-family="sans-serif" font-size="18" font-weight="900" fill="#4ade80">${cleanAmount} ETB</text>
        <text x="40" y="180" font-family="sans-serif" font-size="13" fill="#a1a1aa">Fayyadamaa:</text>
        <text x="180" y="180" font-family="sans-serif" font-size="13" font-weight="bold" fill="#ffffff">${user.firstName} ${user.lastName} (${user.phone})</text>
        <text x="40" y="220" font-family="sans-serif" font-size="12" fill="#71717a">Guyyaa:</text>
        <text x="180" y="220" font-family="sans-serif" font-size="12" fill="#d4d4d8">${dateStr}</text>
        <rect x="30" y="242" width="440" height="24" rx="6" fill="#18181b"/>
        <text x="250" y="258" font-family="sans-serif" font-size="11" font-weight="bold" fill="#f59e0b" text-anchor="middle">Spin Ethiopia • Galmee Kaffaltii Mirkanaa'uuf Qophii</text>
      </svg>`;
      finalReceipt = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }

    const submittedDeposit = await DbService.mutate(async (db) => {
      const paymentMethod = db.paymentMethods[paymentMethodId] || Object.values(db.paymentMethods)[0];
      if (!paymentMethod) {
        throw new Error('Malli kaffaltii filatame hin jiru ykn cufameera (Invalid or inactive payment method)');
      }

      if (cleanAmount < (paymentMethod.minAmount || 50)) {
        throw new Error(`Kaffaltiin xiqqaan ${paymentMethod.minAmount || 50} ETB dha (Minimum deposit is ${paymentMethod.minAmount || 50} ETB)`);
      }

      if (paymentMethod.maxAmount && cleanAmount > paymentMethod.maxAmount) {
        throw new Error(`Kaffaltiin guddaan ${paymentMethod.maxAmount} ETB dha (Maximum deposit is ${paymentMethod.maxAmount} ETB)`);
      }

      // Check for duplicate FT / transactionId only if existing is PENDING or APPROVED
      const existingDepId = db.transactionIdToDepositId[cleanTxId];
      if (existingDepId) {
        const existingDeposit = db.deposits[existingDepId];
        if (existingDeposit && existingDeposit.status !== 'REJECTED') {
          throw new Error(`Lakkoofsi FT (${cleanTxId}) kun duraan itti fayyadameera (This transaction ID has already been submitted as ${existingDeposit.status})`);
        }
      }

      const depositId = 'dep_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
      const deposit: Deposit = {
        id: depositId,
        userId: user.id,
        userPhone: user.phone,
        userName: `${user.firstName} ${user.lastName}`.trim(),
        provider: paymentMethod.provider,
        accountName: paymentMethod.accountName,
        accountNumber: paymentMethod.accountNumber,
        amount: cleanAmount,
        transactionId: cleanTxId,
        receiptUrl: finalReceipt,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };

      db.deposits[depositId] = deposit;
      db.transactionIdToDepositId[cleanTxId] = depositId;

      appendAuditLog(
        db,
        { id: user.id, phone: user.phone },
        'DEPOSIT_SUBMITTED',
        'DEPOSIT',
        depositId,
        `Submitted deposit request of ${cleanAmount} ETB via ${paymentMethod.provider} (FT: ${cleanTxId})`
      );

      return deposit;
    });

    // Notify all connected clients and alert Admin in real-time
    try {
      const pendingDepositsCount = await DbService.get((db) => {
        return Object.values(db.deposits).filter((d) => d.status === 'PENDING').length;
      });

      broadcastSSE('deposit_submitted', {
        deposit: submittedDeposit,
        depositId: submittedDeposit.id,
        userId: user.id,
        userPhone: submittedDeposit.userPhone,
        userName: submittedDeposit.userName,
        amount: submittedDeposit.amount,
        provider: submittedDeposit.provider,
        transactionId: submittedDeposit.transactionId,
        receiptUrl: submittedDeposit.receiptUrl,
        createdAt: submittedDeposit.createdAt,
        pendingDepositsCount,
      });
    } catch (e) {
      console.error('Failed to broadcast deposit_submitted SSE:', e);
    }

    return submittedDeposit;
  }

  /**
   * Approves a pending deposit. IDEMPOTENT: If clicked multiple times, money is credited only once!
   */
  static async approveDeposit(
    depositId: string,
    admin: { id: string; phone: string }
  ): Promise<{ deposit: Deposit; userBalance: number }> {
    const result = await DbService.mutate(async (db) => {
      const deposit = db.deposits[depositId];
      if (!deposit) {
        throw new Error('Galmee kaffaltii hin arganne (Deposit record not found)');
      }

      // Idempotency check: If already approved, return without crediting again!
      if (deposit.status === 'APPROVED') {
        const user = db.users[deposit.userId];
        return {
          deposit,
          userBalance: user ? user.walletBalance : 0,
          userId: deposit.userId,
          userPhone: deposit.userPhone,
          amount: deposit.amount,
        };
      }

      if (deposit.status === 'REJECTED') {
        throw new Error('Kaffaltiin kun duraan kuffifameera, mirkaneessuun hin danda\'amu (Deposit is already rejected)');
      }

      const user = db.users[deposit.userId];
      if (!user) {
        throw new Error('Hojjataa/Fayyaddamaa hin arganne (User not found)');
      }

      // Check if this deposit was already credited in transactions
      const existingTx = Object.values(db.transactions).find(
        (tx) => tx.referenceId === deposit.id && tx.type === 'DEPOSIT'
      );
      if (existingTx) {
        // Already credited!
        deposit.status = 'APPROVED';
        deposit.reviewedAt = deposit.reviewedAt || new Date().toISOString();
        deposit.reviewedBy = admin.phone;
        return {
          deposit,
          userBalance: user.walletBalance,
          userId: user.id,
          userPhone: user.phone,
          amount: deposit.amount,
        };
      }

      // Credit user's wallet safely using SafeMoney
      const oldBalance = user.walletBalance || 0;
      const newBalance = SafeMoney.add(oldBalance, deposit.amount);
      user.walletBalance = newBalance;

      // Create exactly one DEPOSIT transaction
      const txId = 'tx_dep_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
      const transaction: WalletTransaction = {
        id: txId,
        userId: user.id,
        type: 'DEPOSIT',
        amount: deposit.amount,
        balanceAfter: newBalance,
        referenceId: deposit.id,
        note: `Deposit approved via ${deposit.provider} (FT: ${deposit.transactionId})`,
        createdAt: new Date().toISOString(),
      };

      db.transactions[txId] = transaction;
      if (!db.userTransactionIds[user.id]) {
        db.userTransactionIds[user.id] = [];
      }
      db.userTransactionIds[user.id].unshift(txId);

      // Update deposit status
      deposit.status = 'APPROVED';
      deposit.reviewedAt = new Date().toISOString();
      deposit.reviewedBy = admin.phone;

      // Check referral bonus eligibility
      if (
        user.referredBy &&
        !db.processedReferralBonuses[user.id] &&
        deposit.amount >= db.settings.referralMinDeposit
      ) {
        const referrer = db.users[user.referredBy];
        if (referrer && referrer.id !== user.id) {
          const bonusAmount = db.settings.referralBonusAmount;
          referrer.walletBalance = SafeMoney.add(referrer.walletBalance || 0, bonusAmount);

          const refTxId = 'tx_ref_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
          const refTx: WalletTransaction = {
            id: refTxId,
            userId: referrer.id,
            type: 'REFERRAL_BONUS',
            amount: bonusAmount,
            balanceAfter: referrer.walletBalance,
            referenceId: user.id,
            note: `Badhaasa afeerraa (Referral bonus for qualifying user ${user.phone})`,
            createdAt: new Date().toISOString(),
          };
          db.transactions[refTxId] = refTx;
          if (!db.userTransactionIds[referrer.id]) {
            db.userTransactionIds[referrer.id] = [];
          }
          db.userTransactionIds[referrer.id].unshift(refTxId);

          db.processedReferralBonuses[user.id] = true;

          appendAuditLog(
            db,
            { id: admin.id, phone: admin.phone },
            'REFERRAL_BONUS_AWARDED',
            'USER',
            referrer.id,
            `Awarded ${bonusAmount} ETB referral bonus to referrer ${referrer.phone} for deposit by ${user.phone}`
          );
        }
      }

      appendAuditLog(
        db,
        { id: admin.id, phone: admin.phone },
        'DEPOSIT_APPROVED',
        'DEPOSIT',
        deposit.id,
        `Approved deposit of ${deposit.amount} ETB for user ${user.phone}. New balance: ${newBalance} ETB`
      );

      return {
        deposit,
        userBalance: newBalance,
        userId: user.id,
        userPhone: user.phone,
        amount: deposit.amount,
      };
    });

    // Broadcast deposit_approved to update the user's balance within seconds in real-time
    try {
      const pendingDepositsCount = await DbService.get((db) => {
        return Object.values(db.deposits).filter((d) => d.status === 'PENDING').length;
      });

      broadcastSSE('deposit_approved', {
        deposit: result.deposit,
        depositId: result.deposit.id,
        userId: result.userId,
        userPhone: result.userPhone,
        amount: result.amount,
        newBalance: result.userBalance,
        reviewedBy: result.deposit.reviewedBy,
        reviewedAt: result.deposit.reviewedAt,
        pendingDepositsCount,
        message: `Kaffaltiin ${result.amount} ETB mirkanaa'ee herrega keessanitti dabalameera!`,
      });
    } catch (e) {
      console.error('Failed to broadcast deposit_approved SSE:', e);
    }

    return { deposit: result.deposit, userBalance: result.userBalance };
  }

  /**
   * Rejects a pending deposit. IDEMPOTENT: No money deducted or credited.
   */
  static async rejectDeposit(
    depositId: string,
    reason: string,
    admin: { id: string; phone: string }
  ): Promise<Deposit> {
    const rejectedDeposit = await DbService.mutate(async (db) => {
      const deposit = db.deposits[depositId];
      if (!deposit) {
        throw new Error('Galmee kaffaltii hin arganne (Deposit record not found)');
      }

      if (deposit.status === 'APPROVED') {
        throw new Error('Kaffaltiin kun duraan mirkanaa\'ee jira, kuffisuun hin danda\'amu (Already approved deposit cannot be rejected)');
      }

      if (deposit.status === 'REJECTED') {
        return deposit; // Idempotent no-op
      }

      deposit.status = 'REJECTED';
      deposit.reviewedAt = new Date().toISOString();
      deposit.reviewedBy = admin.phone;
      deposit.rejectReason = reason || 'Kaffaltiin hin mirkanoofne (Payment not verified)';

      appendAuditLog(
        db,
        { id: admin.id, phone: admin.phone },
        'DEPOSIT_REJECTED',
        'DEPOSIT',
        deposit.id,
        `Rejected deposit of ${deposit.amount} ETB for user ${deposit.userPhone}. Reason: ${deposit.rejectReason}`
      );

      return deposit;
    });

    try {
      const pendingDepositsCount = await DbService.get((db) => {
        return Object.values(db.deposits).filter((d) => d.status === 'PENDING').length;
      });

      broadcastSSE('deposit_rejected', {
        deposit: rejectedDeposit,
        depositId: rejectedDeposit.id,
        userId: rejectedDeposit.userId,
        userPhone: rejectedDeposit.userPhone,
        reason: rejectedDeposit.rejectReason,
        pendingDepositsCount,
      });
    } catch (e) {
      console.error('Failed to broadcast deposit_rejected SSE:', e);
    }

    return rejectedDeposit;
  }

  /**
   * Submits a withdrawal request. Reserves amount immediately from user balance.
   */
  static async submitWithdrawal(params: {
    user: User;
    provider: string;
    accountName: string;
    accountNumber: string;
    amount: number;
  }): Promise<Withdrawal> {
    const { user, provider, accountName, accountNumber, amount } = params;

    const cleanAmount = SafeMoney.fromCents(SafeMoney.toCents(amount));

    if (!provider || !accountNumber || !accountName) {
      throw new Error('Odeeffannoo herrega baankii guutuu galchaa (Bank and account information required)');
    }

    return await DbService.mutate(async (db) => {
      const freshUser = db.users[user.id];
      if (!freshUser) {
        throw new Error('Fayyaddamaa hin arganne (User not found)');
      }

      if (cleanAmount < db.settings.minWithdrawalAmount) {
        throw new Error(`Baasiin xiqqaan ${db.settings.minWithdrawalAmount} ETB dha (Minimum withdrawal is ${db.settings.minWithdrawalAmount} ETB)`);
      }

      if ((freshUser.walletBalance || 0) < cleanAmount) {
        throw new Error(`Herrega keessan keessa qarshii gahaan hin jiru (Insufficient wallet balance: current ${freshUser.walletBalance} ETB)`);
      }

      // Reserve funds immediately
      const newBalance = SafeMoney.subtract(freshUser.walletBalance, cleanAmount);
      freshUser.walletBalance = newBalance;

      const withdrawalId = 'wdr_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
      const withdrawal: Withdrawal = {
        id: withdrawalId,
        userId: freshUser.id,
        userPhone: freshUser.phone,
        userName: `${freshUser.firstName} ${freshUser.lastName}`.trim(),
        provider,
        accountName,
        accountNumber,
        amount: cleanAmount,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };

      db.withdrawals[withdrawalId] = withdrawal;

      // Create WITHDRAWAL_REQUEST transaction
      const txId = 'tx_wdr_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
      const tx: WalletTransaction = {
        id: txId,
        userId: freshUser.id,
        type: 'WITHDRAWAL_REQUEST',
        amount: cleanAmount,
        balanceAfter: newBalance,
        referenceId: withdrawalId,
        note: `Withdrawal request to ${provider} (${accountNumber})`,
        createdAt: new Date().toISOString(),
      };

      db.transactions[txId] = tx;
      if (!db.userTransactionIds[freshUser.id]) {
        db.userTransactionIds[freshUser.id] = [];
      }
      db.userTransactionIds[freshUser.id].unshift(txId);

      appendAuditLog(
        db,
        { id: freshUser.id, phone: freshUser.phone },
        'WITHDRAWAL_REQUESTED',
        'WITHDRAWAL',
        withdrawalId,
        `Requested withdrawal of ${cleanAmount} ETB to ${provider} (${accountNumber}). New balance: ${newBalance} ETB`
      );

      return withdrawal;
    });
  }

  /**
   * Approves withdrawal.
   */
  static async approveWithdrawal(
    withdrawalId: string,
    admin: { id: string; phone: string }
  ): Promise<Withdrawal> {
    return await DbService.mutate(async (db) => {
      const withdrawal = db.withdrawals[withdrawalId];
      if (!withdrawal) {
        throw new Error('Galmee baasii hin arganne (Withdrawal not found)');
      }

      if (withdrawal.status === 'APPROVED') {
        return withdrawal; // Idempotent
      }

      if (withdrawal.status === 'REJECTED') {
        throw new Error('Baasiin kun duraan kuffifameera (Already rejected)');
      }

      withdrawal.status = 'APPROVED';
      withdrawal.reviewedAt = new Date().toISOString();
      withdrawal.reviewedBy = admin.phone;

      appendAuditLog(
        db,
        { id: admin.id, phone: admin.phone },
        'WITHDRAWAL_APPROVED',
        'WITHDRAWAL',
        withdrawalId,
        `Approved payout of ${withdrawal.amount} ETB to ${withdrawal.provider} (${withdrawal.accountNumber}) for ${withdrawal.userPhone}`
      );

      return withdrawal;
    });
  }

  /**
   * Rejects withdrawal and refunds reserved funds back to user's wallet balance.
   * IDEMPOTENT: repeated clicks will not refund twice!
   */
  static async rejectWithdrawal(
    withdrawalId: string,
    reason: string,
    admin: { id: string; phone: string }
  ): Promise<{ withdrawal: Withdrawal; refundedBalance: number }> {
    return await DbService.mutate(async (db) => {
      const withdrawal = db.withdrawals[withdrawalId];
      if (!withdrawal) {
        throw new Error('Galmee baasii hin arganne (Withdrawal not found)');
      }

      const user = db.users[withdrawal.userId];

      if (withdrawal.status === 'REJECTED') {
        return { withdrawal, refundedBalance: user ? user.walletBalance : 0 }; // Idempotent
      }

      if (withdrawal.status === 'APPROVED') {
        throw new Error('Baasiin kun duraan mirkanaa\'ee jira, kuffisuun hin danda\'amu (Cannot reject already approved withdrawal)');
      }

      if (!user) {
        throw new Error('Fayyaddamaa hin arganne (User not found)');
      }

      // Check if refund was already created
      const existingRefundTx = Object.values(db.transactions).find(
        (tx) => tx.referenceId === withdrawal.id && tx.type === 'WITHDRAWAL_REFUND'
      );

      let newBalance = user.walletBalance;
      if (!existingRefundTx) {
        newBalance = SafeMoney.add(user.walletBalance || 0, withdrawal.amount);
        user.walletBalance = newBalance;

        const txId = 'tx_wref_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
        const tx: WalletTransaction = {
          id: txId,
          userId: user.id,
          type: 'WITHDRAWAL_REFUND',
          amount: withdrawal.amount,
          balanceAfter: newBalance,
          referenceId: withdrawal.id,
          note: `Refund for rejected withdrawal: ${reason || 'Admin rejected'}`,
          createdAt: new Date().toISOString(),
        };

        db.transactions[txId] = tx;
        if (!db.userTransactionIds[user.id]) {
          db.userTransactionIds[user.id] = [];
        }
        db.userTransactionIds[user.id].unshift(txId);
      }

      withdrawal.status = 'REJECTED';
      withdrawal.reviewedAt = new Date().toISOString();
      withdrawal.reviewedBy = admin.phone;
      withdrawal.rejectReason = reason || 'Kaffaltiin baasii hin milkoofne (Withdrawal rejected)';

      appendAuditLog(
        db,
        { id: admin.id, phone: admin.phone },
        'WITHDRAWAL_REJECTED',
        'WITHDRAWAL',
        withdrawalId,
        `Rejected withdrawal of ${withdrawal.amount} ETB for ${user.phone}. Refunded back to wallet. New balance: ${newBalance} ETB`
      );

      return { withdrawal, refundedBalance: newBalance };
    });
  }

  /**
   * Retrieves transactions for a user.
   */
  static async getUserTransactions(userId: string): Promise<WalletTransaction[]> {
    return await DbService.get((db) => {
      const txIds = db.userTransactionIds[userId] || [];
      return txIds.map((id) => db.transactions[id]).filter(Boolean);
    });
  }

  /**
   * Allows admin to adjust a user's wallet balance (credit/deposit, debit, or set new balance)
   */
  static async adminAdjustBalance(params: {
    userId: string;
    action: 'add' | 'deduct' | 'set';
    amount: number;
    reason: string;
    admin: { id: string; phone: string };
  }): Promise<{ user: User; newBalance: number; transaction: WalletTransaction }> {
    const { userId, action, amount, reason, admin } = params;
    return await DbService.mutate(async (db) => {
      const targetUser = db.users[userId];
      if (!targetUser) {
        throw new Error('Fayyaddamaa hin arganne (User not found)');
      }

      const cleanAmount = SafeMoney.fromCents(SafeMoney.toCents(Math.abs(amount)));
      const oldBalance = targetUser.walletBalance || 0;
      let newBalance = oldBalance;
      let delta = 0;

      if (action === 'add') {
        newBalance = SafeMoney.add(oldBalance, cleanAmount);
        delta = cleanAmount;
      } else if (action === 'deduct') {
        newBalance = Math.max(0, SafeMoney.subtract(oldBalance, cleanAmount));
        delta = -cleanAmount;
      } else if (action === 'set') {
        newBalance = cleanAmount;
        delta = SafeMoney.subtract(newBalance, oldBalance);
      }

      targetUser.walletBalance = newBalance;

      const txId = 'tx_adj_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
      const tx: WalletTransaction = {
        id: txId,
        userId: targetUser.id,
        type: delta >= 0 ? 'DEPOSIT' : 'WITHDRAWAL_REQUEST',
        amount: Math.abs(delta),
        balanceAfter: newBalance,
        note: `Sirreeffama Admin (${admin.phone}): ${reason || 'Sirreeffama herregaa'}`,
        createdAt: new Date().toISOString(),
      };
      db.transactions[txId] = tx;
      if (!db.userTransactionIds[targetUser.id]) {
        db.userTransactionIds[targetUser.id] = [];
      }
      db.userTransactionIds[targetUser.id].unshift(txId);

      appendAuditLog(
        db,
        { id: admin.id, phone: admin.phone },
        'BALANCE_ADJUSTED',
        'USER',
        targetUser.id,
        `Admin (${admin.phone}) adjusted balance for ${targetUser.phone} (${targetUser.firstName} ${targetUser.lastName}) from ${oldBalance} ETB to ${newBalance} ETB. Delta: ${delta} ETB. Reason: ${reason || 'N/A'}`
      );

      return { user: targetUser, newBalance, transaction: tx };
    });
  }

  /**
   * Admin pays real money (Telebirr / CBE / Cash) directly to a winner or user.
   * Deducts the amount from user wallet balance, logs payout transaction & audit trail.
   */
  static async adminPayRealCash(params: {
    userId: string;
    amount: number;
    provider: string;
    transactionId?: string;
    note?: string;
    admin: { id: string; phone: string };
  }): Promise<{ user: User; newBalance: number; transaction: WalletTransaction }> {
    const { userId, amount, provider, transactionId, note, admin } = params;
    return await DbService.mutate(async (db) => {
      const targetUser = db.users[userId];
      if (!targetUser) {
        throw new Error('Fayyaddamaa hin arganne (User not found)');
      }

      const cleanAmount = SafeMoney.fromCents(SafeMoney.toCents(Math.abs(amount)));
      const oldBalance = targetUser.walletBalance || 0;
      const newBalance = Math.max(0, SafeMoney.subtract(oldBalance, cleanAmount));
      targetUser.walletBalance = newBalance;

      const txId = 'tx_payout_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
      const tx: WalletTransaction = {
        id: txId,
        userId: targetUser.id,
        type: 'CASH_PAYOUT',
        amount: cleanAmount,
        balanceAfter: newBalance,
        referenceId: transactionId || 'REAL_CASH_PAID',
        note: `Kaffaltii dhugaa ${provider || 'Telebirr'} tin kaffalame (FT: ${transactionId || 'Harkaatti'}). Sababa: ${note || 'Badhaasa Caaraa'}. Herrega irraa hir'ifame.`,
        createdAt: new Date().toISOString(),
      };

      db.transactions[txId] = tx;
      if (!db.userTransactionIds[targetUser.id]) {
        db.userTransactionIds[targetUser.id] = [];
      }
      db.userTransactionIds[targetUser.id].unshift(txId);

      appendAuditLog(
        db,
        { id: admin.id, phone: admin.phone },
        'REAL_CASH_PAID_OUT',
        'USER',
        targetUser.id,
        `Admin (${admin.phone}) paid real money ${cleanAmount} ETB via ${provider} to ${targetUser.phone} (${targetUser.firstName} ${targetUser.lastName}). FT: ${transactionId || 'None'}. Deducted from balance. Old: ${oldBalance} ETB -> New: ${newBalance} ETB.`
      );

      return { user: targetUser, newBalance, transaction: tx };
    });
  }
}

