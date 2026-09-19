-- ==========================================================
-- SPIN ETHIOPIA — PRODUCTION POSTGRESQL DATABASE SCHEMA
-- Compatible with Supabase, Neon, AWS RDS, Railway, Render Postgres
-- ==========================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('USER', 'ADMIN', 'MODERATOR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE deposit_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE withdrawal_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE round_status AS ENUM ('OPEN', 'SPINNING', 'COMPLETED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM (
      'DEPOSIT',
      'WITHDRAWAL',
      'TICKET_PURCHASE',
      'PRIZE_WIN',
      'REFERRAL_BONUS',
      'ADMIN_ADJUSTMENT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    role user_role DEFAULT 'USER' NOT NULL,
    wallet_balance NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (wallet_balance >= 0),
    referral_code VARCHAR(32) UNIQUE NOT NULL,
    referred_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- 4. SESSIONS TABLE
CREATE TABLE IF NOT EXISTS sessions (
    token VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- 5. PAYMENT METHODS TABLE (CBE, Awash, Telebirr)
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

-- 6. DEPOSITS TABLE (With Receipt Upload & Admin Audit)
CREATE TABLE IF NOT EXISTS deposits (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_method_id VARCHAR(64) NOT NULL REFERENCES payment_methods(id),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    transaction_id VARCHAR(100) NOT NULL, -- FT / Reference ID
    receipt_url TEXT NOT NULL,            -- Base64 or Cloud Storage URL
    sender_phone VARCHAR(20),
    sender_name VARCHAR(100),
    status deposit_status DEFAULT 'PENDING' NOT NULL,
    admin_notes TEXT,
    reviewed_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_deposit_tx_id UNIQUE (transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_created_at ON deposits(created_at DESC);

-- 7. WITHDRAWALS TABLE
CREATE TABLE IF NOT EXISTS withdrawals (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(100) NOT NULL,
    account_name VARCHAR(150) NOT NULL,
    account_number VARCHAR(100) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    status withdrawal_status DEFAULT 'PENDING' NOT NULL,
    admin_notes TEXT,
    reviewed_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

-- 8. WALLET TRANSACTIONS TABLE (Audit Trail for every cent)
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type transaction_type NOT NULL,
    amount NUMERIC(12, 2) NOT NULL, -- positive for credit, negative for debit
    balance_before NUMERIC(12, 2) NOT NULL,
    balance_after NUMERIC(12, 2) NOT NULL,
    description TEXT NOT NULL,
    reference_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created_at ON wallet_transactions(created_at DESC);

-- 9. ROUNDS (SPIN GAMES) TABLE
CREATE TABLE IF NOT EXISTS rounds (
    id VARCHAR(64) PRIMARY KEY,
    round_number INT UNIQUE NOT NULL,
    status round_status DEFAULT 'OPEN' NOT NULL,
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

-- 10. TICKET PARTICIPANTS (1-100 SLOTS PER ROUND)
CREATE TABLE IF NOT EXISTS round_tickets (
    id VARCHAR(64) PRIMARY KEY,
    round_id VARCHAR(64) NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    number INT NOT NULL CHECK (number >= 1 AND number <= 100),
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_name VARCHAR(100) NOT NULL,
    user_phone VARCHAR(20) NOT NULL,
    selected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_round_number UNIQUE (round_id, number)
);

CREATE INDEX IF NOT EXISTS idx_round_tickets_round_id ON round_tickets(round_id);
CREATE INDEX IF NOT EXISTS idx_round_tickets_user_id ON round_tickets(user_id);

-- 11. AUDIT LOGS TABLE
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
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);

-- 12. INITIAL SEED DATA (Official Payment Accounts)
INSERT INTO payment_methods (id, provider, account_name, account_number, phone_number, instructions, min_amount, max_amount, is_active, sort_order)
VALUES
('pm_cbe', 'Commercial Bank of Ethiopia (CBE)', 'Asefa Wasenu Tadese', '1000218818424', NULL, 'Kaffaltii keessan herrega CBE (1000218818424 - Asefa Wasenu Tadese) irratti erga daddabarsitanii booda, lakk FT fi ragaa kaffaltii asitti ol-kaa''aa.', 50.00, 50000.00, true, 1),
('pm_awash', 'Awash Bank', 'Asefa Wasenu Tadese', '01320561958100', NULL, 'Kaffaltii Awash Baankii lakkoofsa (01320561958100 - Asefa Wasenu Tadese) irratti erga kaffaltanii booda ragaa kaffaltii fi lakk daddabarsaa asitti ergaa.', 50.00, 50000.00, true, 2),
('pm_telebirr', 'Telebirr', 'Gabre shifaraa hayilu', '0929200166', '0929200166', 'Kaffaltii Telebirr lakkoofsa bilbilaa 0929200166 (Maqaa: Gabre shifaraa hayilu) irratti ergaa, ragaa kaffaltii fi lakk daddabarsaa asitti guutaa.', 50.00, 25000.00, true, 3)
ON CONFLICT (id) DO NOTHING;
