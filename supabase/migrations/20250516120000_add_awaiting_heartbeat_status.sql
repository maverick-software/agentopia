ALTER TYPE public.account_tool_environment_status_enum ADD VALUE 'awaiting_heartbeat';

COMMENT ON TYPE public.account_tool_environment_status_enum IS 'Adds awaiting_heartbeat status for when a toolbox is provisioned but first contact from DTMA is pending. Retains WBS v2.1 statuses and prior values.'; 