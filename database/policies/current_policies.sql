
ALTER TABLE ONLY "public"."workspaces" FORCE ROW LEVEL SECURITY;
    -- Check if user is the owner of the workspace (owners should implicitly be members for RLS checks)
ALTER TABLE ONLY "public"."chat_channels" FORCE ROW LEVEL SECURITY;
ALTER TABLE ONLY "public"."agents" FORCE ROW LEVEL SECURITY;
ALTER TABLE ONLY "public"."user_secrets" FORCE ROW LEVEL SECURITY;
ALTER TABLE ONLY "public"."workspace_members" FORCE ROW LEVEL SECURITY;
ALTER TABLE "auth"."audit_log_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth"."flow_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth"."identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth"."instances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth"."mfa_amr_claims" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth"."mfa_challenges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth"."mfa_factors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth"."one_time_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth"."refresh_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth"."saml_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth"."saml_relay_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth"."schema_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth"."sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth"."sso_domains" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth"."sso_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth"."users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can create account tool instances" ON "public"."account_tool_instances" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
CREATE POLICY "Admin can delete account tool instances" ON "public"."account_tool_instances" FOR DELETE USING ((EXISTS ( SELECT 1
CREATE POLICY "Admin can update all account tool instances" ON "public"."account_tool_instances" FOR UPDATE USING ((EXISTS ( SELECT 1
CREATE POLICY "Admin can view all account tool environments" ON "public"."account_tool_environments" FOR SELECT USING ((EXISTS ( SELECT 1
CREATE POLICY "Admin can view all account tool instances" ON "public"."account_tool_instances" FOR SELECT USING ((EXISTS ( SELECT 1
CREATE POLICY "Admin users can insert operation logs" ON "public"."admin_operation_logs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
CREATE POLICY "Admin users can view all operation logs" ON "public"."admin_operation_logs" FOR SELECT USING ((EXISTS ( SELECT 1
CREATE POLICY "Admins can create tool catalog entries" ON "public"."tool_catalog" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
CREATE POLICY "Admins can update tool catalog entries" ON "public"."tool_catalog" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "Admins can view all tool catalog entries" ON "public"."tool_catalog" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "Allow agent messages to be inserted" ON "public"."chat_messages" FOR INSERT WITH CHECK ((("sender_agent_id" IS NOT NULL) AND 
("sender_user_id" IS NULL)));
CREATE POLICY "Allow authenticated read access" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Allow authenticated read access" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Allow authenticated read access to teams" ON "public"."teams" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));
CREATE POLICY "Allow authenticated users to create teams" ON "public"."teams" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));
CREATE POLICY "Allow delete access for team owners/admins" ON "public"."team_members" FOR DELETE USING (("public"."user_has_role"("auth"."uid"(), 
'admin'::"text") OR "public"."is_team_owner"("team_id", "auth"."uid"())));
CREATE POLICY "Allow delete for owner only" ON "public"."workspaces" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "owner_user_id"));
CREATE POLICY "Allow delete for workspace managers" ON "public"."workspace_members" FOR DELETE TO "authenticated" USING 
("public"."can_manage_workspace_members"("workspace_id", "auth"."uid"()));
CREATE POLICY "Allow individual user CRUD access" ON "public"."user_profiles" TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK 
(("auth"."uid"() = "id"));
CREATE POLICY "Allow individual user read access" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Allow individual user select access" ON "public"."user_secrets" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Allow individual user update access" ON "public"."user_secrets" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK 
(("auth"."uid"() = "user_id"));
CREATE POLICY "Allow insert access for team owners/admins" ON "public"."team_members" FOR INSERT WITH CHECK 
(("public"."user_has_role"("auth"."uid"(), 'admin'::"text") OR "public"."is_team_owner"("team_id", "auth"."uid"())));
CREATE POLICY "Allow insert for authenticated users" ON "public"."workspaces" FOR INSERT TO "authenticated" WITH CHECK (true);
CREATE POLICY "Allow insert for workspace managers" ON "public"."workspace_members" FOR INSERT TO "authenticated" WITH CHECK 
("public"."can_manage_workspace_members"("workspace_id", "auth"."uid"()));
CREATE POLICY "Allow members read access on chat_rooms" ON "public"."workspaces" FOR SELECT USING ("public"."is_room_member"("id", "auth"."uid"()));
CREATE POLICY "Allow modify access to own agents" ON "public"."agents" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK 
(("auth"."uid"() = "user_id"));
CREATE POLICY "Allow owner full access on chat_rooms" ON "public"."workspaces" USING (("auth"."uid"() = "owner_user_id")) WITH CHECK 
(("auth"."uid"() = "owner_user_id"));
CREATE POLICY "Allow owner or global admin to delete teams" ON "public"."teams" FOR DELETE USING ((("auth"."uid"() = "owner_user_id") OR 
"public"."is_global_admin"("auth"."uid"())));
CREATE POLICY "Allow owner to update their teams" ON "public"."teams" FOR UPDATE USING (("auth"."uid"() = "owner_user_id")) WITH CHECK 
(("auth"."uid"() = "owner_user_id"));
CREATE POLICY "Allow owner to update workspace" ON "public"."workspaces" FOR UPDATE USING (("auth"."uid"() = "owner_user_id")) WITH CHECK 
(("auth"."uid"() = "owner_user_id"));
CREATE POLICY "Allow read access to own agents or if admin" ON "public"."agents" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") 
OR "public"."user_has_role"("auth"."uid"(), 'admin'::"text")));
CREATE POLICY "Allow read access to team members" ON "public"."team_members" FOR SELECT USING (("public"."user_has_role"("auth"."uid"(), 
'admin'::"text") OR "public"."is_team_owner"("team_id", "auth"."uid"()) OR "public"."is_team_member"("team_id", "auth"."uid"())));
CREATE POLICY "Allow select for owner or member" ON "public"."workspaces" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "owner_user_id") 
OR "public"."is_chat_room_member"("id", "auth"."uid"())));
CREATE POLICY "Allow select for workspace members" ON "public"."workspace_members" FOR SELECT TO "authenticated" USING 
("public"."is_workspace_member"("workspace_id", "auth"."uid"()));
CREATE POLICY "Allow update access for team owners/admins" ON "public"."team_members" FOR UPDATE USING (("public"."user_has_role"("auth"."uid"(), 
'admin'::"text") OR "public"."is_team_owner"("team_id", "auth"."uid"()))) WITH CHECK (("public"."user_has_role"("auth"."uid"(), 'admin'::"text") OR 
"public"."is_team_owner"("team_id", "auth"."uid"())));
CREATE POLICY "Allow update for owner only" ON "public"."workspaces" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "owner_user_id")) WITH 
CHECK (("auth"."uid"() = "owner_user_id"));
CREATE POLICY "Allow update for workspace managers" ON "public"."workspace_members" FOR UPDATE TO "authenticated" USING 
("public"."can_manage_workspace_members"("workspace_id", "auth"."uid"())) WITH CHECK ("public"."can_manage_workspace_members"("workspace_id", 
"auth"."uid"()));
CREATE POLICY "Allow users to add themselves to teams" ON "public"."user_team_memberships" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Allow users to insert their own messages" ON "public"."chat_messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "sender_user_id") 
AND ("sender_agent_id" IS NULL)));
CREATE POLICY "Allow users to manage their own gmail configurations" ON "public"."gmail_configurations" USING (("auth"."uid"() = ( SELECT 
"user_oauth_connections"."user_id"
COMMENT ON POLICY "Allow users to manage their own gmail configurations" ON "public"."gmail_configurations" IS 'Users can manage their own Gmail 
configurations based on the ownership of the related OAuth connection.';
CREATE POLICY "Allow users to read their own messages and agent messages" ON "public"."chat_messages" FOR SELECT USING ((("auth"."uid"() = 
"sender_user_id") OR ("sender_agent_id" IS NOT NULL)));
CREATE POLICY "Allow users to remove themselves from teams" ON "public"."user_team_memberships" FOR DELETE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Allow users to view own memberships" ON "public"."user_team_memberships" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Allow workspace members INSERT" ON "public"."chat_channels" FOR INSERT TO "authenticated" WITH CHECK 
("public"."is_workspace_member"("workspace_id", "auth"."uid"()));
CREATE POLICY "Allow workspace members SELECT" ON "public"."chat_channels" FOR SELECT TO "authenticated" USING 
("public"."is_workspace_member"("workspace_id", "auth"."uid"()));
CREATE POLICY "Allow workspace members to insert messages" ON "public"."chat_messages" FOR INSERT WITH CHECK 
(("public"."is_workspace_member"("public"."get_workspace_id_for_channel"("channel_id"), "auth"."uid"()) AND ((("sender_user_id" IS NOT NULL) AND 
("sender_user_id" = "auth"."uid"())) OR ("sender_agent_id" IS NOT NULL))));
CREATE POLICY "Allow workspace members to read messages" ON "public"."chat_messages" FOR SELECT USING 
("public"."is_workspace_member"("public"."get_workspace_id_for_channel"("channel_id"), "auth"."uid"()));
CREATE POLICY "Allow workspace owner DELETE" ON "public"."chat_channels" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "Allow workspace owner UPDATE" ON "public"."chat_channels" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "Allow workspace owner to delete messages" ON "public"."chat_messages" FOR DELETE USING 
("public"."is_workspace_owner"("public"."get_workspace_id_for_channel"("channel_id"), "auth"."uid"()));
CREATE POLICY "Anyone can view enabled OAuth providers" ON "public"."oauth_providers" FOR SELECT USING (("is_enabled" = true));
CREATE POLICY "Authenticated users can view tool catalog" ON "public"."tool_catalog" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Disallow updates to channel messages" ON "public"."chat_messages" FOR UPDATE USING (false);
CREATE POLICY "Disallow updates to chat messages" ON "public"."chat_messages" FOR UPDATE USING (false);
CREATE POLICY "Integration categories are readable by everyone" ON "public"."integration_categories" FOR SELECT USING (true);
CREATE POLICY "Integrations are readable by everyone" ON "public"."integrations" FOR SELECT USING (true);
CREATE POLICY "OAuth providers are readable by authenticated users" ON "public"."oauth_providers" FOR SELECT TO "authenticated" USING 
(("is_enabled" = true));
CREATE POLICY "Only service role can modify OAuth providers" ON "public"."oauth_providers" TO "service_role" USING (true);
CREATE POLICY "Only service role can modify web search providers" ON "public"."web_search_providers" TO "service_role" USING (true);
CREATE POLICY "Organization admins can manage API keys" ON "public"."organization_api_keys" USING (("organization_id" IN ( SELECT 
"organization_memberships"."organization_id"
CREATE POLICY "Organization admins can manage invitations" ON "public"."organization_invitations" USING (("organization_id" IN ( SELECT 
"organization_memberships"."organization_id"
CREATE POLICY "Organization admins can manage memberships" ON "public"."organization_memberships" USING (("organization_id" IN ( SELECT 
"organization_memberships_1"."organization_id"
CREATE POLICY "Organization owners can update their organizations" ON "public"."organizations" FOR UPDATE USING (("id" IN ( SELECT 
"organization_memberships"."organization_id"
CREATE POLICY "Service role can insert operation logs" ON "public"."web_search_operation_logs" FOR INSERT TO "service_role" WITH CHECK (true);
CREATE POLICY "Service role can manage all SSH keys" ON "public"."user_ssh_keys" USING (("auth"."role"() = 'service_role'::"text"));
CREATE POLICY "Service role can manage all tool execution logs" ON "public"."tool_execution_logs" USING (("auth"."role"() = 
'service_role'::"text"));
CREATE POLICY "Service role full access to integration_categories" ON "public"."integration_categories" TO "service_role" USING (true);
CREATE POLICY "Service role full access to integrations" ON "public"."integrations" TO "service_role" USING (true);
CREATE POLICY "Service role has full access to gmail operation logs" ON "public"."gmail_operation_logs" TO "service_role" USING (true) WITH CHECK 
(true);
CREATE POLICY "Service roles can access all account tool environments" ON "public"."account_tool_environments" USING 
(("public"."get_my_claim"('role'::"text") = 'service_role'::"text")) WITH CHECK (("public"."get_my_claim"('role'::"text") = 
'service_role'::"text"));
CREATE POLICY "Service roles can access all account tool instances" ON "public"."account_tool_instances" USING 
(("public"."get_my_claim"('role'::"text") = 'service_role'::"text")) WITH CHECK (("public"."get_my_claim"('role'::"text") = 
'service_role'::"text"));
CREATE POLICY "Service roles can access all agent tool capability permissions" ON "public"."agent_tool_capability_permissions" USING 
(("public"."get_my_claim"('role'::"text") = 'service_role'::"text")) WITH CHECK (("public"."get_my_claim"('role'::"text") = 
'service_role'::"text"));
CREATE POLICY "Service roles can access all agent tool credentials" ON "public"."agent_tool_credentials" USING 
(("public"."get_my_claim"('role'::"text") = 'service_role'::"text")) WITH CHECK (("public"."get_my_claim"('role'::"text") = 
'service_role'::"text"));
CREATE POLICY "Service roles can access all agent toolbelt items" ON "public"."agent_toolbelt_items" USING 
(("public"."get_my_claim"('role'::"text") = 'service_role'::"text")) WITH CHECK (("public"."get_my_claim"('role'::"text") = 
'service_role'::"text"));
CREATE POLICY "Service roles can access all agent toolbox access" ON "public"."agent_toolbox_access" USING 
(("public"."get_my_claim"('role'::"text") = 'service_role'::"text")) WITH CHECK (("public"."get_my_claim"('role'::"text") = 
'service_role'::"text"));
CREATE POLICY "Service roles can manage tool catalog" ON "public"."tool_catalog" TO "service_role" USING (true) WITH CHECK (true);
CREATE POLICY "System can manage task executions" ON "public"."agent_task_executions" USING (true);
CREATE POLICY "Users can create datastores" ON "public"."datastores" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can create organizations" ON "public"."organizations" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));
CREATE POLICY "Users can create tasks for their own agents" ON "public"."agent_tasks" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND 
(EXISTS ( SELECT 1
CREATE POLICY "Users can create their own OAuth connections" ON "public"."user_oauth_connections" FOR INSERT TO "authenticated" WITH CHECK 
(("user_id" = "auth"."uid"()));
CREATE POLICY "Users can create their own web search keys" ON "public"."user_web_search_keys" FOR INSERT TO "authenticated" WITH CHECK (("user_id" 
= "auth"."uid"()));
CREATE POLICY "Users can delete own SSH keys" ON "public"."user_ssh_keys" FOR DELETE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can delete own datastores" ON "public"."datastores" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can delete their own OAuth connections" ON "public"."user_oauth_connections" FOR DELETE TO "authenticated" USING (("user_id" = 
"auth"."uid"()));
CREATE POLICY "Users can delete their own agent tasks" ON "public"."agent_tasks" FOR DELETE USING (("user_id" = "auth"."uid"()));
CREATE POLICY "Users can delete their own web search keys" ON "public"."user_web_search_keys" FOR DELETE TO "authenticated" USING (("user_id" = 
"auth"."uid"()));
CREATE POLICY "Users can insert own SSH keys" ON "public"."user_ssh_keys" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can insert own gmail operation logs" ON "public"."gmail_operation_logs" FOR INSERT TO "authenticated" WITH CHECK 
(("auth"."uid"() = "user_id"));
CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));
CREATE POLICY "Users can manage credentials for their agents toolbelt items" ON "public"."agent_tool_credentials" USING (("auth"."uid"() = ( SELECT 
"a"."user_id"
CREATE POLICY "Users can manage instances on their own account environments" ON "public"."account_tool_instances" USING (("auth"."uid"() = ( SELECT 
"ate"."user_id"
CREATE POLICY "Users can manage own agent datastores" ON "public"."agent_datastores" TO "authenticated" USING ((EXISTS ( SELECT 1
CREATE POLICY "Users can manage permissions for their agents toolbelt items" ON "public"."agent_tool_capability_permissions" USING (("auth"."uid"() 
= ( SELECT "a"."user_id"
CREATE POLICY "Users can manage their agents' OAuth permissions" ON "public"."agent_oauth_permissions" USING ((EXISTS ( SELECT 1
CREATE POLICY "Users can manage their own OAuth connections" ON "public"."user_oauth_connections" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "Users can manage their own account tool environment" ON "public"."account_tool_environments" USING (("auth"."uid"() = "user_id")) 
WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can manage their own task event triggers" ON "public"."agent_task_event_triggers" USING ((EXISTS ( SELECT 1
CREATE POLICY "Users can manage toolbelt items for their agents" ON "public"."agent_toolbelt_items" USING (("auth"."uid"() = ( SELECT 
"agents"."user_id"
CREATE POLICY "Users can manage toolbox access for their agents on their toolb" ON "public"."agent_toolbox_access" USING ((("auth"."uid"() = ( 
SELECT "agents"."user_id"
CREATE POLICY "Users can manage web search permissions for their agents" ON "public"."agent_web_search_permissions" TO "authenticated" USING 
(("user_id" = "auth"."uid"()));
CREATE POLICY "Users can only access their own integration connections" ON "public"."user_integrations" TO "authenticated" USING (("user_id" = 
"auth"."uid"()));
CREATE POLICY "Users can read own datastores" ON "public"."datastores" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update own SSH keys" ON "public"."user_ssh_keys" FOR UPDATE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update own datastores" ON "public"."datastores" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH 
CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update their own OAuth connections" ON "public"."user_oauth_connections" FOR UPDATE TO "authenticated" USING (("user_id" = 
"auth"."uid"()));
CREATE POLICY "Users can update their own agent tasks" ON "public"."agent_tasks" FOR UPDATE USING (("user_id" = "auth"."uid"()));
CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK 
(("auth"."uid"() = "id"));
CREATE POLICY "Users can update their own web search keys" ON "public"."user_web_search_keys" FOR UPDATE TO "authenticated" USING (("user_id" = 
"auth"."uid"()));
CREATE POLICY "Users can view logs for their agents" ON "public"."web_search_operation_logs" FOR SELECT TO "authenticated" USING (("user_id" = 
"auth"."uid"()));
CREATE POLICY "Users can view memberships in their organizations" ON "public"."organization_memberships" FOR SELECT USING ((("user_id" = 
"auth"."uid"()) OR ("organization_id" IN ( SELECT "organization_memberships_1"."organization_id"
CREATE POLICY "Users can view organizations they are members of" ON "public"."organizations" FOR SELECT USING (("id" IN ( SELECT 
"organization_memberships"."organization_id"
CREATE POLICY "Users can view own SSH keys" ON "public"."user_ssh_keys" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can view own gmail operation logs" ON "public"."gmail_operation_logs" FOR SELECT TO "authenticated" USING (("auth"."uid"() = 
"user_id"));
CREATE POLICY "Users can view their own OAuth connections" ON "public"."user_oauth_connections" FOR SELECT TO "authenticated" USING (("user_id" = 
"auth"."uid"()));
CREATE POLICY "Users can view their own agent tasks" ON "public"."agent_tasks" FOR SELECT USING (("user_id" = "auth"."uid"()));
CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));
CREATE POLICY "Users can view their own task event triggers" ON "public"."agent_task_event_triggers" FOR SELECT USING ((EXISTS ( SELECT 1
CREATE POLICY "Users can view their own task executions" ON "public"."agent_task_executions" FOR SELECT USING ((EXISTS ( SELECT 1
CREATE POLICY "Users can view their own tool execution logs" ON "public"."tool_execution_logs" FOR SELECT USING (("user_id" = "auth"."uid"()));
CREATE POLICY "Users can view their own web search keys" ON "public"."user_web_search_keys" FOR SELECT TO "authenticated" USING (("user_id" = 
"auth"."uid"()));
CREATE POLICY "Users can view web search permissions for their agents" ON "public"."agent_web_search_permissions" FOR SELECT TO "authenticated" 
USING (("user_id" = "auth"."uid"()));
CREATE POLICY "Web search providers are readable by authenticated users" ON "public"."web_search_providers" FOR SELECT TO "authenticated" USING 
(("is_enabled" = true));
ALTER TABLE "public"."account_tool_environments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."account_tool_instances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."admin_operation_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."agent_datastores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."agent_oauth_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."agent_task_event_triggers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."agent_task_executions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."agent_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."agent_tool_capability_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."agent_tool_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."agent_toolbelt_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."agent_toolbox_access" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."agent_web_search_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."chat_channels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."datastores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."gmail_configurations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."gmail_operation_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."integration_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."oauth_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."organization_api_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."organization_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."organization_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tool_catalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tool_execution_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_oauth_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_secrets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_ssh_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_team_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_web_search_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."web_search_operation_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."web_search_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspace_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;


