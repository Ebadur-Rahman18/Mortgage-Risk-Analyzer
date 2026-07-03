-- ─────────────────────────────────────────────────────────────────────────────
-- M2 / M2b: Relational conversation threading for AI agents
-- Replaces the flat ai_chat_threads.messages JSONB anti-pattern with proper
-- agent_conversations + agent_messages tables.
-- Also creates the user_agent_personalizations table (M3 prerequisite).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── agent_conversations ───────────────────────────────────────────────────────
create table if not exists public.agent_conversations (
  id                uuid        primary key default gen_random_uuid(),
  agent_id          uuid        not null references public.ai_agents(id) on delete cascade,
  user_id           uuid        not null references auth.users(id) on delete cascade,
  title             text,
  message_count     int         not null default 0,
  last_message_at   timestamptz,
  metadata          jsonb       not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists agent_conversations_user_id_idx    on public.agent_conversations(user_id);
create index if not exists agent_conversations_agent_id_idx   on public.agent_conversations(agent_id);
create index if not exists agent_conversations_created_at_idx on public.agent_conversations(created_at desc);

-- ── agent_messages ────────────────────────────────────────────────────────────
create table if not exists public.agent_messages (
  id                uuid        primary key default gen_random_uuid(),
  conversation_id   uuid        not null references public.agent_conversations(id) on delete cascade,
  role              text        not null check (role in ('system','user','assistant','tool')),
  content           text        not null,
  model_used        text,
  latency_ms        int,
  token_metrics     jsonb,
  metadata          jsonb       not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists agent_messages_conversation_id_idx on public.agent_messages(conversation_id);
create index if not exists agent_messages_created_at_idx      on public.agent_messages(created_at);

-- ── user_agent_personalizations ───────────────────────────────────────────────
create table if not exists public.user_agent_personalizations (
  id                    uuid    primary key default gen_random_uuid(),
  agent_id              uuid    not null references public.ai_agents(id) on delete cascade,
  user_id               uuid    not null references auth.users(id) on delete cascade,
  additional_prompt     text,
  tone_preference       text,
  communication_style   text,
  metadata              jsonb   not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (agent_id, user_id)
);

create index if not exists user_agent_personalizations_user_id_idx on public.user_agent_personalizations(user_id);

-- ── RLS policies ──────────────────────────────────────────────────────────────

alter table public.agent_conversations enable row level security;
alter table public.agent_messages      enable row level security;
alter table public.user_agent_personalizations enable row level security;

-- agent_conversations: users see their own; admins see all
create policy "users_own_conversations"
  on public.agent_conversations
  for all
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role in ('admin','moderator')
    )
  );

-- agent_messages: visible through conversation ownership
create policy "users_own_messages"
  on public.agent_messages
  for all
  using (
    exists (
      select 1 from public.agent_conversations c
      where c.id = conversation_id
      and (
        c.user_id = auth.uid()
        or exists (
          select 1 from public.user_roles
          where user_id = auth.uid() and role in ('admin','moderator')
        )
      )
    )
  );

-- user_agent_personalizations: users manage their own; admins see all
create policy "users_own_personalizations"
  on public.user_agent_personalizations
  for all
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role in ('admin','moderator')
    )
  );

-- ── Trigger: update conversation stats on new message ─────────────────────────
create or replace function public.update_conversation_stats()
returns trigger language plpgsql security definer as $$
begin
  update public.agent_conversations
  set
    message_count   = message_count + 1,
    last_message_at = new.created_at,
    updated_at      = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_update_conversation_stats on public.agent_messages;
create trigger trg_update_conversation_stats
  after insert on public.agent_messages
  for each row execute function public.update_conversation_stats();

-- ── Trigger: auto-generate conversation title from first user message ─────────
create or replace function public.generate_conversation_title()
returns trigger language plpgsql security definer as $$
declare
  v_msg_count int;
begin
  -- Only set title from first user message when title is still null
  if new.role = 'user' then
    select message_count into v_msg_count
    from public.agent_conversations
    where id = new.conversation_id;

    -- title will be set from the first user turn (message_count is 0 before this insert triggers stats)
    if v_msg_count = 0 then
      update public.agent_conversations
      set title = left(new.content, 80)
      where id = new.conversation_id and title is null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_generate_conversation_title on public.agent_messages;
create trigger trg_generate_conversation_title
  before insert on public.agent_messages
  for each row execute function public.generate_conversation_title();
