alter table public.businesses enable row level security;
alter table public.website_content enable row level security;
alter table public.agents enable row level security;
alter table public.widget_configs enable row level security;
alter table public.messages enable row level security;
alter table public.user_dashboard_preferences enable row level security;
alter table public.agent_action_queue_statuses enable row level security;
alter table public.agent_follow_up_workflows enable row level security;
alter table public.agent_contact_leads enable row level security;
alter table public.agent_knowledge_fix_workflows enable row level security;
alter table public.product_events enable row level security;
alter table public.agent_installations enable row level security;
alter table public.agent_widget_events enable row level security;
alter table public.agent_visitor_reply_feedback enable row level security;
alter table public.agent_conversion_outcomes enable row level security;
alter table public.google_oauth_states enable row level security;
alter table public.google_connected_accounts enable row level security;
alter table public.operator_contacts enable row level security;
alter table public.operator_contact_identities enable row level security;
alter table public.operator_inbox_threads enable row level security;
alter table public.operator_inbox_messages enable row level security;
alter table public.operator_calendar_events enable row level security;
alter table public.operator_campaigns enable row level security;
alter table public.operator_campaign_steps enable row level security;
alter table public.operator_campaign_recipients enable row level security;
alter table public.operator_tasks enable row level security;
alter table public.operator_workspace_activations enable row level security;
alter table public.operator_business_profiles enable row level security;
alter table public.agent_copilot_proposal_states enable row level security;
alter table public.operator_audit_logs enable row level security;
alter table public.owner_billing_accounts enable row level security;
alter table public.owner_ai_usage_ledger enable row level security;

drop policy if exists "Owners can read their dashboard preferences." on public.user_dashboard_preferences;
create policy "Owners can read their dashboard preferences."
  on public.user_dashboard_preferences
  for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = owner_user_id);

drop policy if exists "Owners can insert their dashboard preferences." on public.user_dashboard_preferences;
create policy "Owners can insert their dashboard preferences."
  on public.user_dashboard_preferences
  for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = owner_user_id);

drop policy if exists "Owners can update their dashboard preferences." on public.user_dashboard_preferences;
create policy "Owners can update their dashboard preferences."
  on public.user_dashboard_preferences
  for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = owner_user_id);

drop policy if exists "Owners can manage their agents." on public.agents;
create policy "Owners can manage their agents."
  on public.agents
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can read businesses for their agents." on public.businesses;
create policy "Owners can read businesses for their agents."
  on public.businesses
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.business_id = businesses.id
        and agents.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can read website content for their agents." on public.website_content;
create policy "Owners can read website content for their agents."
  on public.website_content
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.business_id = website_content.business_id
        and agents.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can manage widget configs for their agents." on public.widget_configs;
create policy "Owners can manage widget configs for their agents."
  on public.widget_configs
  for all
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.id = widget_configs.agent_id
        and agents.owner_user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.id = widget_configs.agent_id
        and agents.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can read messages for their agents." on public.messages;
create policy "Owners can read messages for their agents."
  on public.messages
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.id = messages.agent_id
        and agents.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can read widget events for their agents." on public.agent_widget_events;
create policy "Owners can read widget events for their agents."
  on public.agent_widget_events
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.id = agent_widget_events.agent_id
        and agents.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can read installations for their agents." on public.agent_installations;
create policy "Owners can read installations for their agents."
  on public.agent_installations
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.id = agent_installations.agent_id
        and agents.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can read reply feedback for their agents." on public.agent_visitor_reply_feedback;
create policy "Owners can read reply feedback for their agents."
  on public.agent_visitor_reply_feedback
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.agents
      where agents.id = agent_visitor_reply_feedback.agent_id
        and agents.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can manage action queue statuses." on public.agent_action_queue_statuses;
create policy "Owners can manage action queue statuses."
  on public.agent_action_queue_statuses
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can manage follow-up workflows." on public.agent_follow_up_workflows;
create policy "Owners can manage follow-up workflows."
  on public.agent_follow_up_workflows
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can manage contact leads." on public.agent_contact_leads;
create policy "Owners can manage contact leads."
  on public.agent_contact_leads
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can manage knowledge fix workflows." on public.agent_knowledge_fix_workflows;
create policy "Owners can manage knowledge fix workflows."
  on public.agent_knowledge_fix_workflows
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can manage conversion outcomes." on public.agent_conversion_outcomes;
create policy "Owners can manage conversion outcomes."
  on public.agent_conversion_outcomes
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can manage operator contacts." on public.operator_contacts;
create policy "Owners can manage operator contacts."
  on public.operator_contacts
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can manage operator contact identities." on public.operator_contact_identities;
create policy "Owners can manage operator contact identities."
  on public.operator_contact_identities
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can manage operator tasks." on public.operator_tasks;
create policy "Owners can manage operator tasks."
  on public.operator_tasks
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can manage operator business profiles." on public.operator_business_profiles;
create policy "Owners can manage operator business profiles."
  on public.operator_business_profiles
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can manage copilot proposal states." on public.agent_copilot_proposal_states;
create policy "Owners can manage copilot proposal states."
  on public.agent_copilot_proposal_states
  for all
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can read their billing account." on public.owner_billing_accounts;
create policy "Owners can read their billing account."
  on public.owner_billing_accounts
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));

drop policy if exists "Owners can read their AI usage ledger." on public.owner_ai_usage_ledger;
create policy "Owners can read their AI usage ledger."
  on public.owner_ai_usage_ledger
  for select
  to authenticated
  using ((select auth.uid()) is not null and owner_user_id = (select auth.uid()));
