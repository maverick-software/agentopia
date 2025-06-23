/*
  # Add Business Metrics Fields

  1. New Fields
    - `annual_revenue` (numeric) - Annual revenue in USD
    - `employee_count` (integer) - Number of employees
    - `years_in_business` (integer) - Years company has been operating

  2. Constraints
    - All fields have default value of 0
    - All fields must be non-negative
    - All fields are nullable

  3. Performance
    - Added indexes for efficient querying
*/

-- Add annual revenue column with validation
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS annual_revenue numeric DEFAULT 0 CHECK (annual_revenue >= 0);

-- Add employee count column with validation
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS employee_count integer DEFAULT 0 CHECK (employee_count >= 0);

-- Add years in business column with validation
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS years_in_business integer DEFAULT 0 CHECK (years_in_business >= 0);

-- Add comments to explain the fields
COMMENT ON COLUMN clients.annual_revenue IS 'Annual revenue in USD';
COMMENT ON COLUMN clients.employee_count IS 'Total number of employees/staff';
COMMENT ON COLUMN clients.years_in_business IS 'Number of years the business has been operating';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS clients_annual_revenue_idx ON clients (annual_revenue);
CREATE INDEX IF NOT EXISTS clients_employee_count_idx ON clients (employee_count);
CREATE INDEX IF NOT EXISTS clients_years_in_business_idx ON clients (years_in_business);