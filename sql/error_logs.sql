-- Tabla error_logs para DocuTrans
-- Correr en Supabase → SQL Editor

create table if not exists error_logs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  user_id     uuid references auth.users(id) on delete set null,
  user_email  text,
  message     text not null,
  stack       text,
  pantalla    text,
  user_agent  text,
  app_version text
);

alter table error_logs enable row level security;

-- Cualquier usuario autenticado puede insertar (el logger usa la sesión activa)
create policy "insert propio" on error_logs
  for insert
  with check (auth.uid() = user_id OR user_id is null);

-- Solo admins pueden leer
create policy "admin read" on error_logs
  for select
  using (
    exists (
      select 1 from usuarios
      where id = auth.uid() and rol = 'admin'
    )
  );
