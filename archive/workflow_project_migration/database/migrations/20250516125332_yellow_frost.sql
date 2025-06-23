/*
  # Add business metrics to clients table
  
  1. New Fields
    - `annual_revenue` (numeric) - Client's annual revenue
    - `employee_count` (integer) - Number of employees/staff
  
  2. Changes
    - Add new columns with appropriate constraints
    - Set default values to ensure data consistency
    - Add check constraints to prevent invalid values
*/

-- Add annual revenue column with validation
ALTER TABLE clients 
ADD COLUMN annual_revenue numeric DEFAULT 0 CHECK (annual_revenue >= 0);

-- Add employee count column with validation
ALTER TABLE clients 
ADD COLUMN employee_count integer DEFAULT 0 CHECK (employee_count >= 0);

-- Add comment to explain the fields
COMMENT ON COLUMN clients.annual_revenue IS 'Annual revenue in USD';
COMMENT ON COLUMN clients.employee_count IS 'Total number of employees/staff';

-- Create index for potential filtering/sorting
CREATE INDEX clients_annual_revenue_idx ON clients (annual_revenue);
CREATE INDEX clients_employee_count_idx ON clients (employee_count);