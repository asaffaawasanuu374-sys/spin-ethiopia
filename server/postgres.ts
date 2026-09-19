import pg from 'pg';
import crypto from 'crypto';
import {
  UserAuthRecord,
  SessionRecord,
  DatabaseSchema,
} from './db';
import {
  Deposit,
  Withdrawal,
  WalletTransaction,
  Round,
  TicketSelection,
  PaymentMethod,
  SystemSettings,
  AuditLog,
} from '../src/types/index';


const { Pool } = pg;

let pool: pg.Pool | null = null;
let isConnected = false;
let initPromise: Promise<boolean> | null = null;

export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_CONNECTION_STRING;
}

export function isPostgresConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}

export function getPgPool(): pg.Pool | null {
  if (pool) return pool;
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) return null;

  try {
    const isLocalhost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
    pool = new Pool({
      connectionString: dbUrl,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err);
      isConnected = false;
    });

    return pool;
  } catch (err) {
    console.error('Failed to initialize PostgreSQL pool:', err);
    return null;
  }
}

/**
 * Initializes tables in PostgreSQL if they do not already exist.
 */
export async function initPostgresSchema(): Promise<boolean> {
  const p = getPgPool();
  if (!p) return false;

  if (initPromise) return initPromise;

  initPromise = (async () => {
    const client = await p.connect();
    try {
      // 1. Extensions
      await client.query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        CREATE EXTENSION IF NOT EXISTS "pgcrypto";
      `);

      // 2. Users Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          phone VARCHAR(20) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          salt VARCHAR(64) NOT NULL,
          role VARCHAR(20) DEFAULT 'USER' NOT NULL,
          wallet_balance NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (wallet_balance >= 0),
          referral_code VARCHAR(32) UNIQUE NOT NULL,
          referred_by VARCHAR(64),
          is_active BOOLEAN DEFAULT true NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
        CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
      `);

      // 3. Sessions Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          token VARCHAR(128) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      `);

      // 4. Payment Methods Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS payment_methods (
          id VARCHAR(64) PRIMARY KEY,
          provider VARCHAR(100) NOT NULL,
          account_name VARCHAR(150) NOT NULL,
          account_number VARCHAR(100) NOT NULL,
          phone_number VARCHAR(20),
          instructions TEXT NOT NULL,
          min_amount NUMERIC(10, 2) DEFAULT 50.00 NOT NULL,
          max_amount NUMERIC(10, 2) DEFAULT 50000.00 NOT NULL,
          is_active BOOLEAN DEFAULT true NOT NULL,
          sort_order INT DEFAULT 0 NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);

      // 5. Deposits Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS deposits (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          user_name VARCHAR(150) NOT NULL,
          user_phone VARCHAR(20) NOT NULL,
          payment_method_id VARCHAR(64),
          provider VARCHAR(100) NOT NULL,
          account_name VARCHAR(150),
          account_number VARCHAR(100),
          amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
          transaction_id VARCHAR(100) NOT NULL,
          receipt_url TEXT NOT NULL,
          sender_phone VARCHAR(20),
          sender_name VARCHAR(100),
          status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
          admin_notes TEXT,
          reject_reason TEXT,
          reviewed_by VARCHAR(64),
          reviewed_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
          CONSTRAINT uq_deposit_tx_id UNIQUE (transaction_id)
        );
        CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
        CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
        CREATE INDEX IF NOT EXISTS idx_deposits_created_at ON deposits(created_at DESC);
      `);

      // 6. Withdrawals Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS withdrawals (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          user_name VARCHAR(150) NOT NULL,
          user_phone VARCHAR(20) NOT NULL,
          provider VARCHAR(100) NOT NULL,
          account_name VARCHAR(150) NOT NULL,
          account_number VARCHAR(100) NOT NULL,
          amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
          status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
          admin_notes TEXT,
          reject_reason TEXT,
          reviewed_by VARCHAR(64),
          reviewed_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
        CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
      `);

      // 7. Wallet Transactions Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS wallet_transactions (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(30) NOT NULL,
          amount NUMERIC(12, 2) NOT NULL,
          balance_before NUMERIC(12, 2) DEFAULT 0.00,
          balance_after NUMERIC(12, 2) NOT NULL,
          description TEXT NOT NULL,
          reference_id VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_id ON wallet_transactions(user_id);
        CREATE INDEX IF NOT EXISTS idx_wallet_tx_created_at ON wallet_transactions(created_at DESC);
      `);

      // 8. Rounds Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS rounds (
          id VARCHAR(64) PRIMARY KEY,
          round_number INT UNIQUE NOT NULL,
          status VARCHAR(20) DEFAULT 'OPEN' NOT NULL,
          ticket_price NUMERIC(10, 2) DEFAULT 50.00 NOT NULL,
          total_pool NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
          winning_number INT,
          first_prize_winner JSONB,
          second_prize_winner JSONB,
          third_prize_winner JSONB,
          completed_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_rounds_status ON rounds(status);
        CREATE INDEX IF NOT EXISTS idx_rounds_round_number ON rounds(round_number DESC);
      `);

      // 9. Round Tickets Table (1-100 slots per round)
      await client.query(`
        CREATE TABLE IF NOT EXISTS round_tickets (
          id VARCHAR(64) PRIMARY KEY,
          round_id VARCHAR(64) NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
          number INT NOT NULL CHECK (number >= 1 AND number <= 100),
          user_id VARCHAR(64) NOT NULL,
          user_name VARCHAR(100) NOT NULL,
          user_phone VARCHAR(20) NOT NULL,
          selected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
          CONSTRAINT uq_round_number UNIQUE (round_id, number)
        );
        CREATE INDEX IF NOT EXISTS idx_round_tickets_round_id ON round_tickets(round_id);
      `);

      // 10. Audit Logs Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id VARCHAR(64) PRIMARY KEY,
          actor_id VARCHAR(64) NOT NULL,
          actor_phone VARCHAR(20) NOT NULL,
          action VARCHAR(100) NOT NULL,
          target_type VARCHAR(100) NOT NULL,
          target_id VARCHAR(100) NOT NULL,
          details TEXT NOT NULL,
          ip_address VARCHAR(45),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
      `);

      // 11. System Settings Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS system_settings (
          id VARCHAR(32) PRIMARY KEY DEFAULT 'current',
          ticket_price NUMERIC(10, 2) DEFAULT 50.00 NOT NULL,
          first_prize_percent NUMERIC(5, 2) DEFAULT 75.00 NOT NULL,
          second_prize_percent NUMERIC(5, 2) DEFAULT 7.00 NOT NULL,
          third_prize_percent NUMERIC(5, 2) DEFAULT 3.00 NOT NULL,
          platform_percent NUMERIC(5, 2) DEFAULT 15.00 NOT NULL,
          min_deposit_amount NUMERIC(10, 2) DEFAULT 50.00 NOT NULL,
          min_withdrawal_amount NUMERIC(10, 2) DEFAULT 100.00 NOT NULL,
          referral_bonus_amount NUMERIC(10, 2) DEFAULT 25.00 NOT NULL,
          referral_min_deposit NUMERIC(10, 2) DEFAULT 100.00 NOT NULL,
          site_name VARCHAR(100) DEFAULT 'Spin Ethiopia' NOT NULL,
          maintenance_mode BOOLEAN DEFAULT false NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);

      // 12. Seed Payment Methods if empty
      await client.query(`
        INSERT INTO payment_methods (id, provider, account_name, account_number, phone_number, instructions, min_amount, max_amount, is_active, sort_order)
        VALUES
        ('pm_cbe', 'Commercial Bank of Ethiopia (CBE)', 'Asefa Wasenu Tadese', '1000218818424', NULL, 'Kaffaltii keessan herrega CBE (1000218818424 - Asefa Wasenu Tadese) irratti erga daddabarsitanii booda, lakk FT fi ragaa kaffaltii asitti ol-kaa''aa.', 50.00, 50000.00, true, 1),
        ('pm_awash', 'Awash Bank', 'Asefa Wasenu Tadese', '01320561958100', NULL, 'Kaffaltii Awash Baankii lakkoofsa (01320561958100 - Asefa Wasenu Tadese) irratti erga kaffaltanii booda ragaa kaffaltii fi lakk daddabarsaa asitti ergaa.', 50.00, 50000.00, true, 2),
        ('pm_telebirr', 'Telebirr', 'Gabre shifaraa hayilu', '0929200166', '0929200166', 'Kaffaltii Telebirr lakkoofsa bilbilaa 0929200166 (Maqaa: Gabre shifaraa hayilu) irratti ergaa, ragaa kaffaltii fi lakk daddabarsaa asitti guutaa.', 50.00, 25000.00, true, 3)
        ON CONFLICT (id) DO NOTHING;
      `);

      isConnected = true;
      console.log('✓ PostgreSQL schema initialized and verified successfully');
      return true;
    } catch (err) {
      console.error('Error initializing PostgreSQL schema:', err);
      isConnected = false;
      return false;
    } finally {
      client.release();
    }
  })();

  return initPromise;
}

/**
 * Checks connectivity to PostgreSQL
 */
export async function checkPostgresStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  database?: string;
  error?: string;
}> {
  const configured = isPostgresConfigured();
  if (!configured) {
    return { configured: false, connected: false };
  }

  const p = getPgPool();
  if (!p) {
    return { configured: true, connected: false, error: 'Could not create connection pool' };
  }

  try {
    const res = await p.query('SELECT current_database() as db, current_timestamp as now');
    isConnected = true;
    return {
      configured: true,
      connected: true,
      database: res.rows[0]?.db,
    };
  } catch (err: any) {
    isConnected = false;
    return {
      configured: true,
      connected: false,
      error: err.message || 'Connection failed',
    };
  }
}

/**
 * Loads the complete application state from PostgreSQL into the in-memory schema.
 */
export async function loadStateFromPostgres(): Promise<Partial<DatabaseSchema> | null> {
  const p = getPgPool();
  if (!p) return null;

  try {
    const ready = await initPostgresSchema();
    if (!ready) return null;

    const [
      usersRes,
      sessionsRes,
      depositsRes,
      withdrawalsRes,
      transactionsRes,
      roundsRes,
      ticketsRes,
      methodsRes,
      auditRes,
      settingsRes,
    ] = await Promise.all([
      p.query('SELECT * FROM users'),
      p.query('SELECT * FROM sessions WHERE expires_at > CURRENT_TIMESTAMP'),
      p.query('SELECT * FROM deposits ORDER BY created_at DESC'),
      p.query('SELECT * FROM withdrawals ORDER BY created_at DESC'),
      p.query('SELECT * FROM wallet_transactions ORDER BY created_at DESC'),
      p.query('SELECT * FROM rounds ORDER BY round_number DESC'),
      p.query('SELECT * FROM round_tickets'),
      p.query('SELECT * FROM payment_methods ORDER BY sort_order ASC'),
      p.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500'),
      p.query('SELECT * FROM system_settings LIMIT 1'),
    ]);

    const users: Record<string, UserAuthRecord> = {};
    const phoneToUserId: Record<string, string> = {};
    const referralCodeToUserId: Record<string, string> = {};

    for (const r of usersRes.rows) {
      const u: UserAuthRecord = {
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        phone: r.phone,
        role: r.role as any,
        walletBalance: Number(r.wallet_balance),
        referralCode: r.referral_code,
        referredBy: r.referred_by || undefined,
        createdAt: r.created_at?.toISOString?.() || r.created_at,
        passwordHash: r.password_hash,
        salt: r.salt,
      };
      users[u.id] = u;
      phoneToUserId[u.phone] = u.id;
      referralCodeToUserId[u.referralCode] = u.id;
    }

    const sessions: Record<string, SessionRecord> = {};
    for (const r of sessionsRes.rows) {
      sessions[r.token] = {
        token: r.token,
        userId: r.user_id,
        createdAt: r.created_at?.toISOString?.() || r.created_at,
        expiresAt: r.expires_at?.toISOString?.() || r.expires_at,
      };
    }

    const deposits: Record<string, Deposit> = {};
    const transactionIdToDepositId: Record<string, string> = {};
    for (const r of depositsRes.rows) {
      const d: Deposit = {
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        userPhone: r.user_phone,
        provider: r.provider,
        accountName: r.account_name,
        accountNumber: r.account_number,
        amount: Number(r.amount),
        transactionId: r.transaction_id,
        receiptUrl: r.receipt_url,
        status: r.status as any,
        rejectReason: r.reject_reason || undefined,
        reviewedBy: r.reviewed_by || undefined,
        reviewedAt: r.reviewed_at?.toISOString?.() || r.reviewed_at || undefined,
        createdAt: r.created_at?.toISOString?.() || r.created_at,
      };
      deposits[d.id] = d;
      if (d.transactionId) {
        transactionIdToDepositId[d.transactionId] = d.id;
      }
    }

    const withdrawals: Record<string, Withdrawal> = {};
    for (const r of withdrawalsRes.rows) {
      withdrawals[r.id] = {
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        userPhone: r.user_phone,
        provider: r.provider,
        accountName: r.account_name,
        accountNumber: r.account_number,
        amount: Number(r.amount),
        status: r.status as any,
        rejectReason: r.reject_reason || undefined,
        reviewedBy: r.reviewed_by || undefined,
        reviewedAt: r.reviewed_at?.toISOString?.() || r.reviewed_at || undefined,
        createdAt: r.created_at?.toISOString?.() || r.created_at,
      };
    }

    const transactions: Record<string, WalletTransaction> = {};
    const userTransactionIds: Record<string, string[]> = {};
    for (const r of transactionsRes.rows) {
      const tx: WalletTransaction = {
        id: r.id,
        userId: r.user_id,
        type: r.type as any,
        amount: Number(r.amount),
        balanceAfter: Number(r.balance_after),
        note: r.description,
        referenceId: r.reference_id || undefined,
        createdAt: r.created_at?.toISOString?.() || r.created_at,
      };
      transactions[tx.id] = tx;
      if (!userTransactionIds[tx.userId]) userTransactionIds[tx.userId] = [];
      userTransactionIds[tx.userId].push(tx.id);
    }

    // Tickets grouped by round
    const ticketsByRound: Record<string, Record<string, TicketSelection>> = {};
    for (const t of ticketsRes.rows) {
      if (!ticketsByRound[t.round_id]) ticketsByRound[t.round_id] = {};
      ticketsByRound[t.round_id][String(t.number)] = {
        number: Number(t.number),
        userId: t.user_id,
        userName: t.user_name,
        userPhone: t.user_phone,
        selectedAt: t.selected_at?.toISOString?.() || t.selected_at,
      };
    }

    const rounds: Record<string, Round> = {};
    let activeRoundId = '';
    for (const r of roundsRes.rows) {
      const rd: Round = {
        id: r.id,
        roundNumber: Number(r.round_number),
        status: r.status as any,
        ticketPrice: Number(r.ticket_price),
        totalPool: Number(r.total_pool),
        winners: [
          ...(r.first_prize_winner ? [r.first_prize_winner] : []),
          ...(r.second_prize_winner ? [r.second_prize_winner] : []),
          ...(r.third_prize_winner ? [r.third_prize_winner] : []),
        ],
        selections: ticketsByRound[r.id] || {},
        drawnAt: r.completed_at?.toISOString?.() || r.completed_at || undefined,
        createdAt: r.created_at?.toISOString?.() || r.created_at,
      };
      rounds[rd.id] = rd;

      if (rd.status === 'OPEN' && !activeRoundId) {
        activeRoundId = rd.id;
      }
    }

    const paymentMethods: Record<string, PaymentMethod> = {};
    for (const r of methodsRes.rows) {
      paymentMethods[r.id] = {
        id: r.id,
        provider: r.provider,
        accountName: r.account_name,
        accountNumber: r.account_number,
        phoneNumber: r.phone_number || undefined,
        instructions: r.instructions,
        minAmount: Number(r.min_amount),
        maxAmount: Number(r.max_amount),
        isActive: Boolean(r.is_active),
        sortOrder: Number(r.sort_order),
      };
    }

    const auditLogs: AuditLog[] = auditRes.rows.map((r) => ({
      id: r.id,
      actorId: r.actor_id,
      actorPhone: r.actor_phone,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      details: r.details,
      createdAt: r.created_at?.toISOString?.() || r.created_at,
    }));

    let settings: SystemSettings | undefined = undefined;
    if (settingsRes.rows.length > 0) {
      const s = settingsRes.rows[0];
      settings = {
        ticketPrice: Number(s.ticket_price),
        firstPrizePercent: Number(s.first_prize_percent),
        secondPrizePercent: Number(s.second_prize_percent),
        thirdPrizePercent: Number(s.third_prize_percent),
        platformPercent: Number(s.platform_percent),
        minDepositAmount: Number(s.min_deposit_amount),
        minWithdrawalAmount: Number(s.min_withdrawal_amount),
        referralBonusAmount: Number(s.referral_bonus_amount),
        referralMinDeposit: Number(s.referral_min_deposit),
        siteName: s.site_name,
        maintenanceMode: Boolean(s.maintenance_mode),
      };
    }

    return {
      users,
      phoneToUserId,
      referralCodeToUserId,
      sessions,
      deposits,
      transactionIdToDepositId,
      withdrawals,
      transactions,
      userTransactionIds,
      rounds,
      activeRoundId: activeRoundId || Object.keys(rounds)[0] || '',
      paymentMethods,
      auditLogs,
      ...(settings ? { settings } : {}),
    };
  } catch (err) {
    console.error('Failed to load state from PostgreSQL:', err);
    return null;
  }
}

/**
 * Synchronizes single mutated entities into PostgreSQL in the background
 */
export async function syncEntityToPostgres(type: string, entity: any): Promise<void> {
  const p = getPgPool();
  if (!p) return;

  try {
    if (type === 'user') {
      const u: UserAuthRecord = entity;
      await p.query(
        `INSERT INTO users (id, first_name, last_name, phone, password_hash, salt, role, wallet_balance, referral_code, referred_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           password_hash = EXCLUDED.password_hash,
           salt = EXCLUDED.salt,
           role = EXCLUDED.role,
           wallet_balance = EXCLUDED.wallet_balance,
           updated_at = CURRENT_TIMESTAMP`,
        [u.id, u.firstName, u.lastName, u.phone, u.passwordHash, u.salt, u.role, u.walletBalance, u.referralCode, u.referredBy || null, u.createdAt]
      );
    } else if (type === 'session') {
      const s: SessionRecord = entity;
      await p.query(
        `INSERT INTO sessions (token, user_id, created_at, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (token) DO NOTHING`,
        [s.token, s.userId, s.createdAt, s.expiresAt]
      );
    } else if (type === 'deposit') {
      const d: Deposit = entity;
      await p.query(
        `INSERT INTO deposits (id, user_id, user_name, user_phone, provider, account_name, account_number, amount, transaction_id, receipt_url, status, reject_reason, reviewed_by, reviewed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           reject_reason = EXCLUDED.reject_reason,
           reviewed_by = EXCLUDED.reviewed_by,
           reviewed_at = EXCLUDED.reviewed_at`,
        [d.id, d.userId, d.userName, d.userPhone, d.provider, d.accountName || null, d.accountNumber || null, d.amount, d.transactionId, d.receiptUrl, d.status, d.rejectReason || null, d.reviewedBy || null, d.reviewedAt || null, d.createdAt]
      );
    } else if (type === 'withdrawal') {
      const w: Withdrawal = entity;
      await p.query(
        `INSERT INTO withdrawals (id, user_id, user_name, user_phone, provider, account_name, account_number, amount, status, reject_reason, reviewed_by, reviewed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           reject_reason = EXCLUDED.reject_reason,
           reviewed_by = EXCLUDED.reviewed_by,
           reviewed_at = EXCLUDED.reviewed_at`,
        [w.id, w.userId, w.userName, w.userPhone, w.provider, w.accountName, w.accountNumber, w.amount, w.status, w.rejectReason || null, w.reviewedBy || null, w.reviewedAt || null, w.createdAt]
      );
    } else if (type === 'transaction') {
      const tx: WalletTransaction = entity;
      await p.query(
        `INSERT INTO wallet_transactions (id, user_id, type, amount, balance_after, description, reference_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [tx.id, tx.userId, tx.type, tx.amount, tx.balanceAfter, tx.note, tx.referenceId || null, tx.createdAt]
      );
    } else if (type === 'round') {
      const rd: Round = entity;
      const w1 = rd.winners?.find((w) => w.rank === 1) || null;
      const w2 = rd.winners?.find((w) => w.rank === 2) || null;
      const w3 = rd.winners?.find((w) => w.rank === 3) || null;

      await p.query(
        `INSERT INTO rounds (id, round_number, status, ticket_price, total_pool, winning_number, first_prize_winner, second_prize_winner, third_prize_winner, completed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           total_pool = EXCLUDED.total_pool,
           winning_number = EXCLUDED.winning_number,
           first_prize_winner = EXCLUDED.first_prize_winner,
           second_prize_winner = EXCLUDED.second_prize_winner,
           third_prize_winner = EXCLUDED.third_prize_winner,
           completed_at = EXCLUDED.completed_at`,
        [
          rd.id,
          rd.roundNumber,
          rd.status,
          rd.ticketPrice,
          rd.totalPool,
          w1?.number || null,
          w1 ? JSON.stringify(w1) : null,
          w2 ? JSON.stringify(w2) : null,
          w3 ? JSON.stringify(w3) : null,
          rd.drawnAt || null,
          rd.createdAt,
        ]

      );

      // Also upsert round tickets
      for (const [numStr, sel] of Object.entries(rd.selections || {})) {
        const ticketId = `${rd.id}_${numStr}`;
        await p.query(
          `INSERT INTO round_tickets (id, round_id, number, user_id, user_name, user_phone, selected_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (round_id, number) DO UPDATE SET
             user_id = EXCLUDED.user_id,
             user_name = EXCLUDED.user_name,
             user_phone = EXCLUDED.user_phone,
             selected_at = EXCLUDED.selected_at`,
          [ticketId, rd.id, Number(numStr), sel.userId, sel.userName, sel.userPhone, sel.selectedAt]
        );
      }
    } else if (type === 'audit') {
      const a: AuditLog = entity;
      await p.query(
        `INSERT INTO audit_logs (id, actor_id, actor_phone, action, target_type, target_id, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [a.id, a.actorId, a.actorPhone, a.action, a.targetType, a.targetId, a.details, a.createdAt]
      );
    }
  } catch (err) {
    console.error(`Error syncing ${type} to PostgreSQL:`, err);
  }
}

/**
 * Periodically or on mutation, synchronizes any dirty or new records into PostgreSQL.
 */
export async function flushStateToPostgres(db: DatabaseSchema): Promise<void> {
  const p = getPgPool();
  if (!p) return;

  try {
    await initPostgresSchema();

    // 1. Sync users
    for (const u of Object.values(db.users || {})) {
      await syncEntityToPostgres('user', u);
    }

    // 2. Sync sessions
    for (const s of Object.values(db.sessions || {})) {
      await syncEntityToPostgres('session', s);
    }

    // 3. Sync deposits
    for (const d of Object.values(db.deposits || {})) {
      await syncEntityToPostgres('deposit', d);
    }

    // 4. Sync withdrawals
    for (const w of Object.values(db.withdrawals || {})) {
      await syncEntityToPostgres('withdrawal', w);
    }

    // 5. Sync transactions
    for (const tx of Object.values(db.transactions || {})) {
      await syncEntityToPostgres('transaction', tx);
    }

    // 6. Sync rounds & tickets
    for (const rd of Object.values(db.rounds || {})) {
      await syncEntityToPostgres('round', rd);
    }

    // 7. Sync latest audit logs
    for (const a of (db.auditLogs || []).slice(0, 50)) {
      await syncEntityToPostgres('audit', a);
    }
  } catch (err) {
    console.error('Error in flushStateToPostgres:', err);
  }
}

/**
 * Directly records an audit log into the dedicated PostgreSQL audit_logs table,
 * capturing the actor ID, timestamp, target, and action description to ensure full platform traceability.
 */
export async function logAuditAction(params: {
  actorId: string;
  actorPhone?: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  ipAddress?: string;
}): Promise<AuditLog> {
  const log: AuditLog = {
    id: 'audit_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
    actorId: params.actorId,
    actorPhone: params.actorPhone || 'SYSTEM',
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    details: params.details,
    createdAt: new Date().toISOString(),
  };

  const p = getPgPool();
  if (p) {
    try {
      await p.query(
        `INSERT INTO audit_logs (id, actor_id, actor_phone, action, target_type, target_id, details, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          log.id,
          log.actorId,
          log.actorPhone,
          log.action,
          log.targetType,
          log.targetId,
          log.details,
          params.ipAddress || null,
          log.createdAt,
        ]
      );
    } catch (err) {
      console.error('Failed to insert audit log into PostgreSQL:', err);
    }
  }

  return log;
}

