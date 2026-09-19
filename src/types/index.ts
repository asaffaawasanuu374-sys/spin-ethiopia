// Type definitions for Spin Ethiopia
export type UserRole = 'USER' | 'ADMIN';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  phone: string; // Normalized Ethiopian phone e.g. 0929200166
  role: UserRole;
  walletBalance: number; // In ETB, 2 decimal places
  referralCode: string;
  referredBy?: string; // User ID of referrer
  createdAt: string;
}

export type TransactionType =
  | 'DEPOSIT'
  | 'WITHDRAWAL_REQUEST'
  | 'WITHDRAWAL_REFUND'
  | 'TICKET_PURCHASE'
  | 'PRIZE_WIN'
  | 'REFERRAL_BONUS'
  | 'CASH_PAYOUT'
  | 'ADMIN_ADJUSTMENT';

export interface WalletTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number; // Positive ETB amount
  balanceAfter: number;
  referenceId?: string; // Deposit ID, Withdrawal ID, Round ID, etc.
  note?: string;
  createdAt: string;
}

export type DepositStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Deposit {
  id: string;
  userId: string;
  userPhone: string;
  userName: string;
  provider: string; // e.g. CBE, Awash, Telebirr
  accountName: string;
  accountNumber: string;
  amount: number;
  transactionId: string; // FT / Reference code
  receiptUrl: string; // Base64 or uploaded image URL
  status: DepositStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectReason?: string;
  createdAt: string;
}

export type WithdrawalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Withdrawal {
  id: string;
  userId: string;
  userPhone: string;
  userName: string;
  provider: string;
  accountName: string;
  accountNumber: string;
  amount: number;
  status: WithdrawalStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectReason?: string;
  createdAt: string;
}

export interface PaymentMethod {
  id: string;
  provider: string;
  accountName: string;
  accountNumber: string;
  phoneNumber?: string;
  instructions: string;
  minAmount: number;
  maxAmount: number;
  isActive: boolean;
  sortOrder: number;
}

export type RoundStatus = 'OPEN' | 'LOCKED' | 'DRAWING' | 'COMPLETED' | 'CANCELLED';

export interface TicketSelection {
  number: number; // 1 - 100
  userId: string;
  userName: string;
  userPhone: string;
  selectedAt: string;
  isSimulated?: boolean; // When auto-filled with customer names to create demand/urgency
}

export interface RoundWinner {
  rank: 1 | 2 | 3;
  number: number;
  userId: string;
  userName: string;
  userPhone: string;
  prizeAmount: number;
  percentage: number;
}

export interface Round {
  id: string;
  roundNumber: number;
  status: RoundStatus;
  ticketPrice: number; // e.g. 50 ETB
  selections: Record<number, TicketSelection>; // 1-100 mapped to selection
  totalPool: number;
  winners: RoundWinner[];
  drawnAt?: string;
  createdAt: string;
}

export interface SystemSettings {
  ticketPrice: number;
  firstPrizePercent: number; // e.g. 75%
  secondPrizePercent: number; // e.g. 7%
  thirdPrizePercent: number; // e.g. 3%
  platformPercent: number; // e.g. 15%
  minDepositAmount: number;
  minWithdrawalAmount: number;
  referralBonusAmount: number; // e.g. 25 ETB
  referralMinDeposit: number; // e.g. 100 ETB
  siteName: string;
  maintenanceMode: boolean;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorPhone: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt: string;
}

export interface LiveStreamState {
  currentRound: Round;
  recentWinners: RoundWinner[];
  activeUsersCount: number;
}
