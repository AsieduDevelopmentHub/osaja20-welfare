-- OSAJA'20 Welfare Platform — PostgreSQL Schema
-- Enforces voting duplicate protection via UNIQUE(member_id, vote_id)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Roles enum
CREATE TYPE user_role AS ENUM ('administrator', 'executive', 'member');
CREATE TYPE member_status AS ENUM ('active', 'inactive', 'archived', 'pending');
CREATE TYPE welfare_status AS ENUM (
  'created', 'executive_review', 'approved',
  'support_allocated', 'resolved', 'archived'
);
CREATE TYPE vote_type AS ENUM ('election', 'decision', 'multi_choice');
CREATE TYPE vote_lifecycle AS ENUM (
  'draft', 'review', 'published', 'open',
  'closed', 'verified', 'result_published', 'archived'
);
CREATE TYPE notification_type AS ENUM (
  'meeting', 'welfare', 'announcement',
  'contribution', 'celebration', 'voting'
);

-- Members
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(200) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  date_of_birth DATE NOT NULL,
  membership_id VARCHAR(50) UNIQUE NOT NULL,
  batch INTEGER NOT NULL DEFAULT 2020,
  registration_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status member_status NOT NULL DEFAULT 'pending',
  role user_role NOT NULL DEFAULT 'member',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  auth_user_id UUID,
  password_hash VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_batch ON members(batch);
CREATE INDEX idx_members_name_trgm ON members USING gin(full_name gin_trgm_ops);

-- Welfare cases
CREATE TABLE welfare_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id),
  title VARCHAR(300) NOT NULL,
  description TEXT NOT NULL,
  status welfare_status NOT NULL DEFAULT 'created',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE welfare_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES welfare_cases(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES members(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contributions ledger
CREATE TABLE contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  type VARCHAR(50) NOT NULL DEFAULT 'dues',
  reference VARCHAR(100) NOT NULL,
  created_by UUID NOT NULL REFERENCES members(id),
  verified_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contributions_member ON contributions(member_id);
CREATE INDEX idx_contributions_created_at ON contributions(created_at);

-- Voting
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(300) NOT NULL,
  description TEXT,
  vote_type vote_type NOT NULL,
  status vote_lifecycle NOT NULL DEFAULT 'draft',
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL,
  require_email_verified BOOLEAN NOT NULL DEFAULT TRUE,
  minimum_contribution DECIMAL(12, 2),
  executive_only BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vote_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vote_id UUID NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
  label VARCHAR(200) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE vote_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vote_id UUID NOT NULL REFERENCES votes(id),
  member_id UUID NOT NULL REFERENCES members(id),
  option_id UUID NOT NULL REFERENCES vote_options(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(member_id, vote_id)
);

CREATE TABLE vote_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vote_id UUID NOT NULL REFERENCES votes(id),
  option_id UUID NOT NULL REFERENCES vote_options(id),
  vote_count INTEGER NOT NULL DEFAULT 0,
  percentage DECIMAL(5, 2) NOT NULL DEFAULT 0,
  UNIQUE(vote_id, option_id)
);

CREATE TABLE vote_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vote_id UUID NOT NULL REFERENCES votes(id),
  member_id UUID NOT NULL REFERENCES members(id),
  action VARCHAR(100) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id),
  type notification_type NOT NULL,
  title VARCHAR(300) NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_member ON notifications(member_id);
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_at) WHERE scheduled_at IS NOT NULL;

-- Announcements
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(300) NOT NULL,
  content TEXT NOT NULL,
  target_audience JSONB NOT NULL DEFAULT '["all"]',
  published_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Activity logs
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES members(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_actor ON activity_logs(actor_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

-- Organization settings
CREATE TABLE organization_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
