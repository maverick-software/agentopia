/*
  # Add years in business field to clients

  1. Changes
    - Add years_in_business column to clients table
    - Add validation to ensure non-negative values
    - Add index for performance
    - Add helpful comment
*/

-- Add years in business column with validation
ALTER TABLE clients 
ADD COLUMN years_in_business integer DEFAULT 0 CHECK (years_in_business >= 0);

-- Add comment to explain the field
COMMENT ON COLUMN clients.years_in_business IS 'Number of years the business has been operating';

-- Create index for potential filtering/sorting
CREATE INDEX clients_years_in_business_idx ON clients (years_in_business);