-- Prime Soldagem: banco de dados no Supabase
-- Como usar: Supabase > SQL Editor > New query > cole este arquivo inteiro > Run.
-- Pode rodar de novo sem problema: tudo usa "if not exists" / "or replace".

-- ============================================================
-- 1. Administradores do painel
-- ============================================================
create table if not exists public.admins (
  email text primary key
);
alter table public.admins enable row level security;
-- ninguém lê ou altera esta tabela pelo site; só pelo SQL Editor

-- verdadeiro quando quem está logado é administrador
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ============================================================
-- 2. Clientes (cadastro do site)
-- ============================================================
create table if not exists public.clientes (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 80),
  telefone text check (char_length(telefone) <= 20),
  cidade text check (char_length(cidade) <= 60),
  email text,
  aceite_lgpd_em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);
alter table public.clientes enable row level security;

drop policy if exists "cliente le o proprio cadastro" on public.clientes;
create policy "cliente le o proprio cadastro" on public.clientes
  for select using (id = auth.uid() or public.is_admin());
drop policy if exists "cliente cria o proprio cadastro" on public.clientes;
create policy "cliente cria o proprio cadastro" on public.clientes
  for insert with check (id = auth.uid());
drop policy if exists "cliente edita o proprio cadastro" on public.clientes;
create policy "cliente edita o proprio cadastro" on public.clientes
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
drop policy if exists "admin apaga cliente" on public.clientes;
create policy "admin apaga cliente" on public.clientes
  for delete using (public.is_admin());

-- cria o cadastro automaticamente quando a pessoa confirma a conta
create or replace function public.novo_cliente()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.clientes (id, nome, telefone, cidade, email)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1)), 80),
    left(new.raw_user_meta_data ->> 'telefone', 20),
    left(new.raw_user_meta_data ->> 'cidade', 60),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.novo_cliente();
-- só o próprio banco dispara esta função; ninguém chama pela API
revoke execute on function public.novo_cliente() from public, anon, authenticated;

-- ============================================================
-- 3. Orçamentos
-- ============================================================
create table if not exists public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes (id) on delete set null,
  cliente text not null check (char_length(cliente) between 2 and 80),
  telefone text check (char_length(telefone) <= 20),
  cidade text check (char_length(cidade) <= 60),
  servico text not null check (char_length(servico) <= 60),
  material text check (char_length(material) <= 40),
  descricao text check (char_length(descricao) <= 1200),
  valor numeric(12,2) check (valor >= 0),
  status text not null default 'novo' check (status in ('novo','enviado','aprovado','recusado')),
  data date not null default current_date,
  origem text not null default 'painel' check (origem in ('site','painel')),
  pedido_id uuid,
  criado_em timestamptz not null default now()
);
alter table public.orcamentos enable row level security;

-- visitantes e clientes podem PEDIR orçamento pelo site, sem valor e sempre como "novo"
drop policy if exists "site envia orcamento" on public.orcamentos;
create policy "site envia orcamento" on public.orcamentos
  for insert to anon, authenticated
  with check (
    public.is_admin()
    or (
      status = 'novo' and valor is null and pedido_id is null and origem = 'site'
      and (cliente_id is null or cliente_id = auth.uid())
    )
  );
drop policy if exists "cliente ve os proprios orcamentos" on public.orcamentos;
create policy "cliente ve os proprios orcamentos" on public.orcamentos
  for select using (public.is_admin() or (cliente_id is not null and cliente_id = auth.uid()));
drop policy if exists "admin altera orcamentos" on public.orcamentos;
create policy "admin altera orcamentos" on public.orcamentos
  for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin apaga orcamentos" on public.orcamentos;
create policy "admin apaga orcamentos" on public.orcamentos
  for delete using (public.is_admin());

-- ============================================================
-- 4. Pedidos
-- ============================================================
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes (id) on delete set null,
  orcamento_id uuid references public.orcamentos (id) on delete set null,
  cliente text not null check (char_length(cliente) between 2 and 80),
  telefone text check (char_length(telefone) <= 20),
  servico text not null check (char_length(servico) <= 60),
  descricao text check (char_length(descricao) <= 1200),
  valor numeric(12,2) check (valor >= 0),
  status text not null default 'producao' check (status in ('producao','pronto','entregue')),
  prazo date,
  entregue_em date,
  criado_em timestamptz not null default now()
);
alter table public.pedidos enable row level security;

drop policy if exists "cliente ve os proprios pedidos" on public.pedidos;
create policy "cliente ve os proprios pedidos" on public.pedidos
  for select using (public.is_admin() or (cliente_id is not null and cliente_id = auth.uid()));
drop policy if exists "admin gerencia pedidos" on public.pedidos;
create policy "admin gerencia pedidos" on public.pedidos
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 5. Fotos da galeria
-- ============================================================
create table if not exists public.fotos (
  id uuid primary key default gen_random_uuid(),
  caminho text not null,              -- "img/..." (arquivo do site) ou caminho no Storage
  titulo text check (char_length(titulo) <= 60),
  no_site boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
alter table public.fotos enable row level security;

drop policy if exists "todos veem fotos do site" on public.fotos;
create policy "todos veem fotos do site" on public.fotos
  for select using (no_site or public.is_admin());
drop policy if exists "admin gerencia fotos" on public.fotos;
create policy "admin gerencia fotos" on public.fotos
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 6. Informações do site (uma linha só)
-- ============================================================
create table if not exists public.config (
  id int primary key default 1 check (id = 1),
  whatsapp text, cidade text, instagram text, horario text,
  hero_titulo text, hero_sub text, sobre text,
  atualizado_em timestamptz not null default now()
);
alter table public.config enable row level security;

drop policy if exists "todos leem config" on public.config;
create policy "todos leem config" on public.config for select using (true);
drop policy if exists "admin altera config" on public.config;
create policy "admin altera config" on public.config
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 7. Pasta de fotos (Storage)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 10485760, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "admin envia fotos" on storage.objects;
create policy "admin envia fotos" on storage.objects
  for insert to authenticated with check (bucket_id = 'fotos' and public.is_admin());
drop policy if exists "admin apaga fotos" on storage.objects;
create policy "admin apaga fotos" on storage.objects
  for delete to authenticated using (bucket_id = 'fotos' and public.is_admin());

-- ============================================================
-- 8. Dados iniciais
-- ============================================================
insert into public.config (id, whatsapp, cidade, instagram, horario, hero_titulo, hero_sub, sobre)
values (1, '(16) 99427-5750', 'Ribeirão Preto · SP', '@primesoldagem', '',
  'Soldagem com precisão, qualidade e confiança.',
  'Serviços especializados em inox, alumínio, aço e soldas especiais, com acabamento de alto padrão e atendimento personalizado para cada projeto.',
  'A Prime Soldagem é especializada na fabricação e montagem de estruturas metálicas, caldeiraria e serralheria. Atuamos com qualidade, segurança e compromisso, entregando soluções sob medida para obras, indústrias, comércios e residências.')
on conflict (id) do nothing;

insert into public.fotos (caminho, titulo, ordem)
select * from (values
  ('img/suportes.jpg', 'Suportes · 250 peças', 1),
  ('img/bancada.jpg', 'Bancada industrial', 2),
  ('img/w_cacamba.jpg', 'Caçamba', 3),
  ('img/w_caldeiraria.jpg', 'Caldeiraria', 4),
  ('img/g_aco.jpg', 'Guarda-corpo em aço', 5),
  ('img/escada.jpg', 'Escada retrátil', 6),
  ('img/g_inox.jpg', 'Guarda-corpo em inox', 7),
  ('img/w_precisao.jpg', 'Soldagem de precisão', 8)
) as v(caminho, titulo, ordem)
where not exists (select 1 from public.fotos);

-- ============================================================
-- 9. TROQUE PELO E-MAIL DE QUEM VAI USAR O PAINEL e rode de novo
-- ============================================================
-- insert into public.admins (email) values ('seu-email@exemplo.com') on conflict do nothing;
