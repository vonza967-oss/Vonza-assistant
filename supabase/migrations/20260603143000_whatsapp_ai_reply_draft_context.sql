alter table public.connected_app_inbound_events
  add column if not exists normalized_message_text text;

alter table public.connected_app_inbound_events
  drop constraint if exists connected_app_inbound_events_normalized_message_text_check;

alter table public.connected_app_inbound_events
  add constraint connected_app_inbound_events_normalized_message_text_check
    check (
      normalized_message_text is null
      or (
        provider = 'whatsapp'
        and provider_event_type = 'message'
        and event_direction = 'inbound'
        and event_status = 'received'
        and normalized_message_text = btrim(normalized_message_text)
        and length(normalized_message_text) between 1 and 1500
        and normalized_message_text !~* '(https?://|www[.])'
        and normalized_message_text !~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}'
        and normalized_message_text !~* '([+]?[0-9][0-9[:space:]().-]{6,}[0-9])'
        and normalized_message_text !~* '((sk|sk-proj|rk|whsec|sbp|sb_secret)_[A-Za-z0-9._-]{10,}|EAA[A-Za-z0-9_-]{20,})'
        and normalized_message_text !~* 'eyJ[A-Za-z0-9_-]{10,}[.][A-Za-z0-9_-]{10,}[.][A-Za-z0-9_-]{10,}'
      )
    );

create index if not exists connected_app_inbound_events_thread_message_context_idx
  on public.connected_app_inbound_events (owner_user_id, thread_id, created_at desc)
  where normalized_message_text is not null;
