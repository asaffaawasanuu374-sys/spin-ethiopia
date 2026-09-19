import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  User,
  WalletTransaction,
  Deposit,
  Withdrawal,
  PaymentMethod,
  Round,
  SystemSettings,
  AuditLog,
  RoundWinner,
} from '../src/types/index';
import { SafeMoney } from './money';
import seedDbData from '../data/spin_ethiopia.json';
import {
  isPostgresConfigured,
  loadStateFromPostgres,
  flushStateToPostgres,
  syncEntityToPostgres,
  logAuditAction as pgLogAuditAction,
} from './postgres';


export interface UserAuthRecord extends User {
  passwordHash: string;
  salt: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface DatabaseSchema {
  users: Record<string, UserAuthRecord>; // Keyed by userId
  phoneToUserId: Record<string, string>; // Normalized phone to userId
  referralCodeToUserId: Record<string, string>; // Referral code to userId
  sessions: Record<string, SessionRecord>; // Keyed by token
  transactions: Record<string, WalletTransaction>; // Keyed by txId
  userTransactionIds: Record<string, string[]>; // Keyed by userId -> list of txIds
  deposits: Record<string, Deposit>; // Keyed by depositId
  transactionIdToDepositId: Record<string, string>; // Unique FT / TxID index to prevent duplicate deposits
  withdrawals: Record<string, Withdrawal>; // Keyed by withdrawalId
  paymentMethods: Record<string, PaymentMethod>; // Keyed by methodId
  rounds: Record<string, Round>; // Keyed by roundId
  activeRoundId: string;
  settings: SystemSettings;
  auditLogs: AuditLog[];
  processedReferralBonuses: Record<string, boolean>; // Keyed by referredUserId
}

const isServerless = Boolean(process.env.VERCEL || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME);
const BASE_SEED_PATH = path.resolve(process.cwd(), 'data', 'spin_ethiopia.json');
const DB_FILE_PATH = isServerless ? path.join('/tmp', 'spin_ethiopia.json') : BASE_SEED_PATH;

// Memory mutex for concurrent safe updates
let writeMutex = Promise.resolve();

export function runInLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const result = writeMutex.then(async () => {
    return await fn();
  });
  // Keep chain going even if fn rejects
  writeMutex = result.then(
    () => {},
    () => {}
  );
  return result;
}

// Global cached in-memory DB
let cachedDb: DatabaseSchema | null = null;

// Helper to hash passwords securely using crypto.scryptSync
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, useSalt, 64).toString('hex');
  return { hash, salt: useSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const calculatedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(calculatedHash, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

// Ethiopian phone normalizer
export function normalizeEthiopianPhone(input: string): string {
  if (!input) return '';
  let cleaned = input.trim().replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+251')) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('251')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('9') && cleaned.length === 9) {
    cleaned = '0' + cleaned;
  } else if (cleaned.startsWith('7') && cleaned.length === 9) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

export function isValidEthiopianPhone(phone: string): boolean {
  const normalized = normalizeEthiopianPhone(phone);
  // Ethiopian mobile numbers are 10 digits starting with 09 or 07
  return /^(09|07)[0-9]{8}$/.test(normalized);
}

function getInitialDatabase(): DatabaseSchema {
  try {
    if (seedDbData && (seedDbData as any).rounds && (seedDbData as any).users) {
      return JSON.parse(JSON.stringify(seedDbData)) as DatabaseSchema;
    }
  } catch {}

  const defaultAdminPass = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@SpinEth2026!';
  const { hash: adminHash, salt: adminSalt } = hashPassword(defaultAdminPass);

  const adminUser: UserAuthRecord = {
    id: 'user_admin_0929200166',
    firstName: 'Admin',
    lastName: 'Gabre',
    phone: '0929200166',
    role: 'ADMIN',
    walletBalance: 100000.0,
    referralCode: 'ADMIN2026',
    createdAt: new Date().toISOString(),
    passwordHash: adminHash,
    salt: adminSalt,
  };

  const initialRound: Round = {
    id: 'round_1',
    roundNumber: 1,
    status: 'OPEN',
    ticketPrice: 50.0,
    selections: {},
    totalPool: 0.0,
    winners: [],
    createdAt: new Date().toISOString(),
  };

  const cbeMethod: PaymentMethod = {
    id: 'pm_cbe',
    provider: 'Commercial Bank of Ethiopia (CBE)',
    accountName: 'Asefa Wasenu Tadese',
    accountNumber: '1000218818424',
    instructions:
      'Kaffaltii keessan lakkoofsa herregaa CBE (1000218818424 - Asefa Wasenu Tadese) irratti erga daddabarsitanii booda, lakk FT/Transaction ID fi suuraa ragaa kaffaltii (receipt) asitti ol-kaa\'aa.',
    minAmount: 50.0,
    maxAmount: 50000.0,
    isActive: true,
    sortOrder: 1,
  };

  const awashMethod: PaymentMethod = {
    id: 'pm_awash',
    provider: 'Awash Bank',
    accountName: 'Asefa Wasenu Tadese',
    accountNumber: '01320561958100',
    instructions:
      'Kaffaltii Awash Baankii lakkoofsa (01320561958100 - Asefa Wasenu Tadese) irratti erga kaffaltanii booda ragaa kaffaltii fi lakk daddabarsaa asitti ergaa.',
    minAmount: 50.0,
    maxAmount: 50000.0,
    isActive: true,
    sortOrder: 2,
  };

  const telebirrMethod: PaymentMethod = {
    id: 'pm_telebirr',
    provider: 'Telebirr',
    accountName: 'Gabre shifaraa hayilu',
    accountNumber: '0929200166',
    phoneNumber: '0929200166',
    instructions:
      'Kaffaltii Telebirr lakkoofsa bilbilaa 0929200166 (Maqaa: Gabre shifaraa hayilu) irratti ergaa, ragaa kaffaltii (receipt) fi lakk daddabarsaa asitti guutaa.',
    minAmount: 50.0,
    maxAmount: 25000.0,
    isActive: true,
    sortOrder: 3,
  };

  const settings: SystemSettings = {
    ticketPrice: 50.0,
    firstPrizePercent: 60.0,
    secondPrizePercent: 10.0,
    thirdPrizePercent: 4.0,
    platformPercent: 26.0,
    minDepositAmount: 50.0,
    minWithdrawalAmount: 100.0,
    referralBonusAmount: 25.0,
    referralMinDeposit: 100.0,
    siteName: 'Spin Ethiopia',
    maintenanceMode: false,
  };

  return {
    users: {
      [adminUser.id]: adminUser,
    },
    phoneToUserId: {
      [adminUser.phone]: adminUser.id,
    },
    referralCodeToUserId: {
      [adminUser.referralCode]: adminUser.id,
    },
    sessions: {},
    transactions: {},
    userTransactionIds: {},
    deposits: {},
    transactionIdToDepositId: {},
    withdrawals: {},
    paymentMethods: {
      [cbeMethod.id]: cbeMethod,
      [awashMethod.id]: awashMethod,
      [telebirrMethod.id]: telebirrMethod,
    },
    rounds: {
      [initialRound.id]: initialRound,
    },
    activeRoundId: initialRound.id,
    settings,
    auditLogs: [
      {
        id: 'audit_init',
        actorId: adminUser.id,
        actorPhone: adminUser.phone,
        action: 'SYSTEM_INITIALIZED',
        targetType: 'SYSTEM',
        targetId: 'INIT',
        details: 'Spin Ethiopia production database initialized with official payment destinations.',
        createdAt: new Date().toISOString(),
      },
    ],
    processedReferralBonuses: {},
  };
}

export function loadDatabase(): DatabaseSchema {
  if (cachedDb) {
    return cachedDb;
  }

  try {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {}
    }

    // On serverless, seed /tmp with initial state from BASE_SEED_PATH if available
    if (isServerless && !fs.existsSync(DB_FILE_PATH) && fs.existsSync(BASE_SEED_PATH)) {
      try {
        const seedRaw = fs.readFileSync(BASE_SEED_PATH, 'utf-8');
        fs.writeFileSync(DB_FILE_PATH, seedRaw, 'utf-8');
      } catch (err) {
        console.warn('Could not copy seed to /tmp:', err);
      }
    }

    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      // Validate schema completeness
      if (parsed && parsed.users && parsed.rounds && parsed.paymentMethods) {
        cachedDb = parsed;
        return cachedDb!;
      }
    } else if (fs.existsSync(BASE_SEED_PATH)) {
      const raw = fs.readFileSync(BASE_SEED_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.users && parsed.rounds && parsed.paymentMethods) {
        cachedDb = parsed;
        saveDatabaseSync(parsed);
        return cachedDb!;
      }
    }
  } catch (err) {
    console.warn('Could not read existing database from disk:', err);
  }

  // Guaranteed fallback to compiled seed data
  const initial = getInitialDatabase();
  saveDatabaseSync(initial);
  cachedDb = initial;
  return cachedDb;
}

export function saveDatabaseSync(db: DatabaseSchema): void {
  try {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {}
    }
    const tempFile = `${DB_FILE_PATH}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE_PATH);
    cachedDb = db;
  } catch (err) {
    console.error('Failed to atomically save database to disk (keeping in memory):', err);
    // In serverless / read-only environment fallback: keep cachedDb updated in memory
    cachedDb = db;
  }
}

// Database helper functions with lock guarantees
export function appendAuditLog(
  db: DatabaseSchema,
  actor: { id: string; phone: string },
  action: string,
  targetType: string,
  targetId: string,
  details: string
): AuditLog {
  const log: AuditLog = {
    id: 'audit_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
    actorId: actor.id,
    actorPhone: actor.phone,
    action,
    targetType,
    targetId,
    details,
    createdAt: new Date().toISOString(),
  };
  db.auditLogs.unshift(log);
  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500);
  }
  // Immediately sync to dedicated audit_logs table in PostgreSQL if available
  syncEntityToPostgres('audit', log).catch(() => {});
  return log;
}

/**
 * Utility function that records balance-impacting events directly into the dedicated PostgreSQL audit_logs table,
 * capturing the actor ID, timestamp, and action description to ensure full platform traceability.
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
  const log = await pgLogAuditAction(params);
  try {
    await DbService.mutate(async (db) => {
      db.auditLogs.unshift(log);
      if (db.auditLogs.length > 500) {
        db.auditLogs = db.auditLogs.slice(0, 500);
      }
      return log;
    });
  } catch (err) {
    // Memory sync is best-effort; database record is already safely written
  }
  return log;
}


export class DbService {
  private static pgInitialized = false;

  static async init(): Promise<void> {
    if (this.pgInitialized) return;
    this.pgInitialized = true;
    if (isPostgresConfigured()) {
      try {
        console.log('Connecting and hydrating from PostgreSQL (DATABASE_URL)...');
        const pgState = await loadStateFromPostgres();
        if (pgState && Object.keys(pgState.users || {}).length > 0) {
          const current = loadDatabase();
          cachedDb = {
            ...current,
            ...pgState,
            users: { ...current.users, ...(pgState.users || {}) },
            phoneToUserId: { ...current.phoneToUserId, ...(pgState.phoneToUserId || {}) },
            referralCodeToUserId: { ...current.referralCodeToUserId, ...(pgState.referralCodeToUserId || {}) },
            deposits: { ...current.deposits, ...(pgState.deposits || {}) },
            withdrawals: { ...current.withdrawals, ...(pgState.withdrawals || {}) },
            transactions: { ...current.transactions, ...(pgState.transactions || {}) },
            rounds: { ...current.rounds, ...(pgState.rounds || {}) },
            paymentMethods: { ...current.paymentMethods, ...(pgState.paymentMethods || {}) },
            auditLogs: pgState.auditLogs && pgState.auditLogs.length > 0 ? pgState.auditLogs : current.auditLogs,
          };
          saveDatabaseSync(cachedDb);
          console.log(`✓ Hydrated from PostgreSQL: ${Object.keys(cachedDb.users).length} users, ${Object.keys(cachedDb.rounds).length} rounds, ${Object.keys(cachedDb.deposits).length} deposits`);
        } else {
          // If PostgreSQL is empty, seed it with initial database!
          const current = loadDatabase();
          console.log('PostgreSQL database is currently empty. Initializing and seeding official data...');
          await flushStateToPostgres(current);
          console.log('✓ Seeded PostgreSQL with official accounts and initial state.');
        }
      } catch (err) {
        console.error('Failed during PostgreSQL hydration:', err);
      }
    }
  }

  static async get<T>(fn: (db: DatabaseSchema) => T): Promise<T> {
    await this.init();
    const db = loadDatabase();
    return fn(db);
  }

  static async mutate<T>(fn: (db: DatabaseSchema) => T | Promise<T>): Promise<T> {
    await this.init();
    return runInLock(async () => {
      const db = loadDatabase();
      const result = await fn(db);
      saveDatabaseSync(db);
      if (isPostgresConfigured()) {
        flushStateToPostgres(db).catch((err) => {
          console.error('PostgreSQL background sync error:', err);
        });
      }
      return result;
    });
  }

  static async logAudit(
    actor: { id: string; phone: string },
    action: string,
    targetType: string,
    targetId: string,
    details: string
  ): Promise<AuditLog> {
    return await DbService.mutate((db) => {
      return appendAuditLog(db, actor, action, targetType, targetId, details);
    });
  }
}

