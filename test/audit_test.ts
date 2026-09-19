import assert from 'assert';
import { SafeMoney } from '../server/money';
import { AuthService } from '../server/auth';
import { WalletService } from '../server/wallet';
import { RoundService } from '../server/rounds';
import { DbService, normalizeEthiopianPhone, logAuditAction } from '../server/db';


async function runAuditTests() {
  console.log('--- STARTING AUDIT TESTS FOR SPIN ETHIOPIA ---');

  // Test 1: SafeMoney Arithmetic
  console.log('Test 1: SafeMoney Integer Arithmetic...');
  const a = 100.10;
  const b = 200.20;
  const sum = SafeMoney.add(a, b);
  assert.strictEqual(sum, 300.30, 'SafeMoney addition should be exact');
  assert.strictEqual(SafeMoney.toCents(sum), 30030, 'SafeMoney cents should be exact integer');

  // Percentage calculation: 75% of 5,000 ETB
  const pool = 5000;
  const firstPrize = SafeMoney.percentOf(pool, 75);
  assert.strictEqual(firstPrize, 3750, '75% of 5000 should be 3750 ETB');

  const secondPrize = SafeMoney.percentOf(pool, 7);
  assert.strictEqual(secondPrize, 350, '7% of 5000 should be 350 ETB');

  const thirdPrize = SafeMoney.percentOf(pool, 3);
  assert.strictEqual(thirdPrize, 150, '3% of 5000 should be 150 ETB');

  const platformShare = SafeMoney.percentOf(pool, 15);
  assert.strictEqual(platformShare, 750, '15% of 5000 should be 750 ETB');

  assert.strictEqual(
    SafeMoney.toCents(firstPrize) + SafeMoney.toCents(secondPrize) + SafeMoney.toCents(thirdPrize) + SafeMoney.toCents(platformShare),
    SafeMoney.toCents(pool),
    'Prizes + platform share must equal exact pool'
  );
  console.log('✓ SafeMoney Integer Arithmetic passed');

  // Test 2: Phone Normalization & Auth
  console.log('Test 2: Phone Normalization & User Registration...');
  assert.strictEqual(normalizeEthiopianPhone('0929200166'), '0929200166');
  assert.strictEqual(normalizeEthiopianPhone('+251929200166'), '0929200166');
  assert.strictEqual(normalizeEthiopianPhone('251929200166'), '0929200166');
  assert.strictEqual(normalizeEthiopianPhone('0712345678'), '0712345678');
  assert.strictEqual(normalizeEthiopianPhone('712345678'), '0712345678');

  // Test register user
  const testPhone = '0988776655';
  let regRes;
  try {
    regRes = await AuthService.register({
      firstName: 'Chala',
      lastName: 'Bekele',
      phone: testPhone,
      password: 'securePassword123',
      confirmPassword: 'securePassword123',
    });
  } catch {
    regRes = await AuthService.login({ phone: testPhone, password: 'securePassword123' });
  }

  const user = regRes.user;
  assert(user, 'User must exist');
  assert.strictEqual(user.phone, testPhone);

  const loginRes = await AuthService.login({ phone: testPhone, password: 'securePassword123' });
  assert(loginRes.token, 'Login must return session token');
  console.log('✓ Phone Normalization & Auth passed');

  // Test 3: Manual Deposit Submission & Idempotent Approval
  console.log('Test 3: Deposit & Idempotent Approval...');
  const deposit = await WalletService.submitDeposit({
    user,
    paymentMethodId: 'pm_cbe',
    amount: 500,
    transactionId: `FT_TEST_${Date.now()}`,
    receiptUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  });

  assert.strictEqual(deposit.status, 'PENDING');
  assert.strictEqual(deposit.amount, 500);

  const adminActor = { id: 'admin_1', phone: '0929200166' };

  // Approve deposit
  const { deposit: approved, userBalance: updatedBalance } = await WalletService.approveDeposit(deposit.id, adminActor);
  assert.strictEqual(approved.status, 'APPROVED');
  assert(updatedBalance >= 500, 'User balance must increase by deposit amount');

  // Attempt second approval (Idempotency test: verify it does not double credit!)
  const balanceBeforeSecond = updatedBalance;
  const { userBalance: balanceAfterSecond } = await WalletService.approveDeposit(deposit.id, adminActor);
  assert.strictEqual(balanceAfterSecond, balanceBeforeSecond, 'Double approval must not credit balance twice');
  console.log('✓ Deposit Idempotency passed');

  // Test 4: Withdrawal Request & Refund on Rejection
  console.log('Test 4: Withdrawal & Atomic Reservation...');
  const freshUser = await DbService.get((db) => db.users[user.id]);
  const initialBal = freshUser.walletBalance;

  const withdrawal = await WalletService.submitWithdrawal({
    user: freshUser,
    provider: 'Telebirr',
    accountName: 'Chala Bekele',
    accountNumber: '0988776655',
    amount: 200,
  });

  assert.strictEqual(withdrawal.status, 'PENDING');
  const userAfterWithdraw = await DbService.get((db) => db.users[user.id]);
  assert.strictEqual(
    userAfterWithdraw.walletBalance,
    SafeMoney.subtract(initialBal, 200),
    'Balance must be reserved atomically upon withdrawal request'
  );

  // Reject withdrawal and verify refund
  await WalletService.rejectWithdrawal(withdrawal.id, 'Test rejection', adminActor);
  const userAfterRefund = await DbService.get((db) => db.users[user.id]);
  assert.strictEqual(
    userAfterRefund.walletBalance,
    initialBal,
    'Reserved balance must be fully refunded upon withdrawal rejection'
  );
  console.log('✓ Withdrawal & Refund passed');

  // Test 5: Round Ticket Selection & Draw
  console.log('Test 5: Round Ticket Selection & Prize Distribution...');
  let round = await RoundService.getActiveRound();
  assert(round, 'Active round must exist');

  // Pick number 42
  const { round: selectedRound } = await RoundService.selectNumber({
    user: userAfterRefund,
    number: 42,
  });

  assert(selectedRound.selections[42], 'Slot 42 must be marked as selected');
  assert.strictEqual(selectedRound.selections[42].userId, user.id);

  // Prevent slot collisions
  let collisionError = false;
  try {
    await RoundService.selectNumber({
      user: userAfterRefund,
      number: 42,
    });
  } catch (e: any) {
    collisionError = true;
    assert(e.message.includes('qabameera'), 'Must reject duplicate slot selection');
  }
  assert(collisionError, 'Slot collision must be caught');

  // Admin draws winners
  const { round: completedRound } = await RoundService.drawWinners({
    admin: adminActor,
    manualWinners: { first: 42 },
  });
  assert.strictEqual(completedRound.status, 'COMPLETED');
  assert(completedRound.winners && completedRound.winners.length > 0);
  assert.strictEqual(completedRound.winners[0].number, 42);

  // Next round should be automatically initialized
  const nextRound = await RoundService.getActiveRound();
  assert(nextRound.roundNumber > completedRound.roundNumber, 'A new open round must be automatically prepared');
  console.log('✓ Round Ticket Selection & Prize Distribution passed');

  // Test 6: logAuditAction utility verification
  console.log('Test 6: logAuditAction Utility Verification...');
  const auditEntry = await logAuditAction({
    actorId: 'admin_audit_tester',
    actorPhone: '0929200166',
    action: 'TEST_BALANCE_IMPACT_AUDIT',
    targetType: 'WALLET',
    targetId: 'user_test_123',
    details: 'Verified balance audit recording into dedicated audit log system',
  });
  assert(auditEntry.id, 'Audit log entry must have an ID');
  assert.strictEqual(auditEntry.actorId, 'admin_audit_tester');
  assert.strictEqual(auditEntry.action, 'TEST_BALANCE_IMPACT_AUDIT');
  assert(auditEntry.createdAt, 'Audit log entry must have a timestamp');

  const inMemLogs = await DbService.get((db) => db.auditLogs);
  const found = inMemLogs.find((l) => l.id === auditEntry.id);
  assert(found, 'Audit log entry must be present in database auditLogs');
  console.log('✓ logAuditAction Utility passed');

  console.log('\n========================================');

  console.log('ALL AUDIT TESTS COMPLETED SUCCESSFULLY!');
  console.log('========================================\n');
  process.exit(0);
}

runAuditTests().catch((err) => {
  console.error('AUDIT TEST FAILED:', err);
  process.exit(1);
});
