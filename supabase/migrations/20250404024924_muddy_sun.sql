/*
  # Add similarity search configuration to datastores

  1. Changes
    - Add new columns to `datastores` table:
      - `similarity_metric` (text) - The similarity metric to use (cosine, euclidean, dot)
      - `similarity_threshold` (float) - Minimum similarity score threshold
      - `max_results` (integer) - Maximum number of results to return

  2. Security
    - Maintain existing RLS policies
*/

ALTER TABLE datastores
  ADD COLUMN IF NOT EXISTS similarity_metric text 
    CHECK (similarity_metric IN ('cosine', 'euclidean', 'dot')) 
    DEFAULT 'cosine',
  ADD COLUMN IF NOT EXISTS similarity_threshold float 
    CHECK (similarity_threshold >= 0 AND similarity_threshold <= 1) 
    DEFAULT 0.7,
  ADD COLUMN IF NOT EXISTS max_results integer 
    CHECK (max_results > 0) 
    DEFAULT 5;

-- Add helpful comment
COMMENT ON TABLE datastores IS 'Stores configuration for vector and knowledge graph datastores';

-- Add comments for the new columns
COMMENT ON COLUMN datastores.similarity_metric IS 'Similarity metric to use for vector search (cosine, euclidean, dot)';
COMMENT ON COLUMN datastores.similarity_threshold IS 'Minimum similarity score threshold (0-1)';
COMMENT ON COLUMN datastores.max_results IS 'Maximum number of results to return from similarity search';