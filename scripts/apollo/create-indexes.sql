-- Database Performance Optimization for Apollo 80M+ dataset
-- Execute on the Apollo MySQL instance to enable instant sub-second filtering

-- 1. Contacts table indexes
CREATE INDEX IF NOT EXISTS idx_contacts_country ON contacts (country(50));
CREATE INDEX IF NOT EXISTS idx_contacts_state ON contacts (state(50));
CREATE INDEX IF NOT EXISTS idx_contacts_city ON contacts (city(50));
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts (company(100));
CREATE INDEX IF NOT EXISTS idx_contacts_jobTitle ON contacts (jobTitle(100));
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts (email(100));
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts (phone(30));
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts (status(20));
CREATE INDEX IF NOT EXISTS idx_contacts_role ON contacts (role(30));

-- 2. Accounts table indexes
CREATE INDEX IF NOT EXISTS idx_accounts_country ON accounts (billing_country(50));
CREATE INDEX IF NOT EXISTS idx_accounts_state ON accounts (billing_state(50));
CREATE INDEX IF NOT EXISTS idx_accounts_city ON accounts (billing_city(50));
CREATE INDEX IF NOT EXISTS idx_accounts_name ON accounts (name(100));

-- 3. Update table statistics for O(1) information_schema accuracy
ANALYZE TABLE contacts;
ANALYZE TABLE accounts;
