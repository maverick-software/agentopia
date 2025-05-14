BEGIN;

ALTER TABLE public.account_tool_environments
ADD CONSTRAINT account_tool_environments_dtma_bearer_token_key UNIQUE (dtma_bearer_token);

COMMENT ON CONSTRAINT account_tool_environments_dtma_bearer_token_key ON public.account_tool_environments IS 'Ensures dtma_bearer_token is unique across all tool environments for secure lookup.';

COMMIT; 