import dotenv from 'dotenv';
dotenv.config();

import { DbService, loadDatabase } from './db';
import { RoundService } from './rounds';
import { checkPostgresStatus, flushStateToPostgres } from './postgres';
import { broadcastSSE } from './sse';


export interface WorkerStats {
  startedAt: string;
  uptimeSeconds: number;
  lastCheckAt: string;
  checksCompleted: number;
  dbSyncCount: number;
  errorsEncountered: number;
  activeRoundId: string;
  activeRoundNumber: number;
  activeRoundStatus: string;
  ticketsSold: number;
  totalPool: number;
  postgresConnected: boolean;
}

let workerInterval: NodeJS.Timeout | null = null;
let isCheckRunning = false;
let checksCompleted = 0;
let dbSyncCount = 0;
let errorsEncountered = 0;
const startedAt = new Date().toISOString();

export async function runWorkerCycle(): Promise<void> {
  if (isCheckRunning) return;
  isCheckRunning = true;

  try {
    // 1. Ensure DB hydration & check PostgreSQL status
    await DbService.init();
    const pgStatus = await checkPostgresStatus();

    // 2. Inspect active round state
    const round = await RoundService.getActiveRound();
    if (round) {
      const ticketsCount = Object.keys(round.selections || {}).length;

      // Check if auto-draw is configured when 100% full
      const autoDrawEnabled = process.env.AUTO_DRAW_WHEN_FULL === 'true';
      if (round.status === 'OPEN' && ticketsCount >= 100 && autoDrawEnabled) {
        console.log(`[24/7 Worker] Round #${round.roundNumber} reached 100 tickets. Auto-draw enabled: triggering cryptographic draw...`);
        try {
          const result = await RoundService.drawWinners({
            admin: { id: 'worker_daemon', phone: '0929200166' },
          });
          console.log(`[24/7 Worker] Draw completed successfully! 1st: #${result.winners[0]?.number}, 2nd: #${result.winners[1]?.number}, 3rd: #${result.winners[2]?.number}. Started Round #${result.nextRound.roundNumber}`);
          broadcastSSE('round_auto_drawn', {
            roundId: round.id,
            winners: result.winners,
            nextRound: result.nextRound,
          });
        } catch (drawErr) {
          console.error('[24/7 Worker] Error during auto-draw:', drawErr);
          errorsEncountered++;
        }
      }
    }

    // 3. Periodic PostgreSQL state verification & sync
    checksCompleted++;
    if (checksCompleted % 6 === 0) {
      // Every ~30 seconds, ensure all state is flushed to PostgreSQL
      if (pgStatus.connected) {
        await DbService.get(async (db) => {
          await flushStateToPostgres(db);
          dbSyncCount++;
        });
      }
    }

    // 4. SSE heartbeat broadcast to keep real-time listeners active
    broadcastSSE('worker_heartbeat', {
      timestamp: Date.now(),
      status: 'healthy',
      activeRound: round?.roundNumber || null,
      ticketsSold: round ? Object.keys(round.selections || {}).length : 0,
    });

  } catch (err: any) {
    errorsEncountered++;
    console.error('[24/7 Worker] Error in cycle:', err.message || err);
  } finally {
    isCheckRunning = false;
  }
}

export function getWorkerStats(): WorkerStats {
  const currentUptime = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  let roundInfo = { id: '', number: 0, status: 'UNKNOWN', tickets: 0, pool: 0 };

  try {
    const db = loadDatabase();
    const active = db?.rounds?.[db?.activeRoundId];
    if (active) {
      roundInfo = {
        id: active.id,
        number: active.roundNumber,
        status: active.status,
        tickets: Object.keys(active.selections || {}).length,
        pool: active.totalPool || 0,
      };
    }
  } catch {}


  return {
    startedAt,
    uptimeSeconds: currentUptime,
    lastCheckAt: new Date().toISOString(),
    checksCompleted,
    dbSyncCount,
    errorsEncountered,
    activeRoundId: roundInfo.id,
    activeRoundNumber: roundInfo.number,
    activeRoundStatus: roundInfo.status,
    ticketsSold: roundInfo.tickets,
    totalPool: roundInfo.pool,
    postgresConnected: true,
  };
}

export function startWorker(intervalMs = 5000): void {
  if (workerInterval) {
    console.log('[24/7 Worker] Already running.');
    return;
  }

  console.log(`[24/7 Worker] Initializing 24/7 Game & Background Service (interval: ${intervalMs}ms)...`);

  // Initial immediate run
  runWorkerCycle().catch((err) => console.error('[24/7 Worker] Initial cycle error:', err));

  // Recurring loop
  workerInterval = setInterval(() => {
    runWorkerCycle().catch((err) => console.error('[24/7 Worker] Scheduled cycle error:', err));
  }, intervalMs);

  if (workerInterval.unref) {
    workerInterval.unref();
  }

  console.log('[24/7 Worker] Background service is active and monitoring round operations 24/7.');
}

export function stopWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[24/7 Worker] Stopped.');
  }
}

// Process self-healing handlers
process.on('uncaughtException', (err) => {
  console.error('[24/7 Worker CRASH PREVENTED] Uncaught exception:', err);
  errorsEncountered++;
  // Do not exit; worker continues running
});

process.on('unhandledRejection', (reason) => {
  console.error('[24/7 Worker CRASH PREVENTED] Unhandled promise rejection:', reason);
  errorsEncountered++;
  // Do not exit; worker continues running
});

// Graceful termination
const handleGracefulShutdown = async (signal: string) => {
  console.log(`[24/7 Worker] Received ${signal}. Performing atomic shutdown flush...`);
  stopWorker();
  try {
    await DbService.get(async (db) => {
      await flushStateToPostgres(db);
    });
    console.log('[24/7 Worker] State saved to database successfully. Exiting.');
  } catch (err) {
    console.error('[24/7 Worker] Error during shutdown flush:', err);
  }
  process.exit(0);
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

// Standalone execution support
const isMainModule = typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('worker');
if (isMainModule) {
  console.log('=== SPIN ETHIOPIA 24/7 STANDALONE WORKER PROCESS STARTING ===');
  startWorker(5000);
}
