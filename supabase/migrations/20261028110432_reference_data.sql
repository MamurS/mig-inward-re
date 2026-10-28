-- =====================================================================
-- Phase 0 / Step 2a: reference data
-- Target project: mig-inward-re (ref jltrtqwaxvsrnqmjemzc)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Shared audit-column helper: fills created_by / updated_by / updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_audit_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Currencies (ISO 4217)
-- ---------------------------------------------------------------------
create table public.currencies (
  code       char(3) primary key check (code ~ '^[A-Z]{3}$'),
  name       text not null,
  active     boolean not null default true,
  sort_order int not null default 100
);

-- ---------------------------------------------------------------------
-- Countries (ISO 3166-1 alpha-2)
-- ---------------------------------------------------------------------
create table public.countries (
  code    char(2) primary key check (code ~ '^[A-Z]{2}$'),
  name    text not null,
  name_ru text,
  name_uz text,
  active  boolean not null default true
);

-- ---------------------------------------------------------------------
-- Lines of business
-- ---------------------------------------------------------------------
create table public.lines_of_business (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  name_ru    text,
  name_uz    text,
  active     boolean not null default true,
  sort_order int not null default 100
);

-- ---------------------------------------------------------------------
-- Counterparties: MGAs, brokers, cedents
-- ---------------------------------------------------------------------
create type public.counterparty_type as enum ('mga', 'broker', 'cedent');

create table public.counterparties (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) > 0),
  type         public.counterparty_type not null,
  country_code char(2) references public.countries (code),
  -- [{ "name": "", "role": "", "email": "", "phone": "" }, ...]
  contacts     jsonb not null default '[]'::jsonb check (jsonb_typeof(contacts) = 'array'),
  notes        text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles (id),
  unique (name, type)
);

create index counterparties_type_idx on public.counterparties (type) where active;

create trigger counterparties_audit_columns
before insert or update on public.counterparties
for each row execute function public.set_audit_columns();

-- ---------------------------------------------------------------------
-- FX rates: 1 unit of currency = rate_to_usd USD
-- (precision beyond numeric(18,2) needed for e.g. UZS ≈ 0.0000785)
-- ---------------------------------------------------------------------
create table public.fx_rates (
  currency    char(3) not null references public.currencies (code),
  rate_date   date not null,
  rate_to_usd numeric(20, 10) not null check (rate_to_usd > 0),
  source      text,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) default auth.uid(),
  primary key (currency, rate_date)
);

-- Rate for a currency on a date: latest rate on/before the date,
-- otherwise the earliest rate after it. USD is always 1. NULL if no rate exists.
create or replace function public.fx_rate_to_usd(p_currency char(3), p_date date)
returns numeric
language sql
stable
set search_path = ''
as $$
  select case
    when p_currency = 'USD' then 1::numeric
    else coalesce(
      (select r.rate_to_usd from public.fx_rates r
        where r.currency = p_currency and r.rate_date <= p_date
        order by r.rate_date desc limit 1),
      (select r.rate_to_usd from public.fx_rates r
        where r.currency = p_currency and r.rate_date > p_date
        order by r.rate_date asc limit 1)
    )
  end
$$;

-- ---------------------------------------------------------------------
-- Settings (key/value)
-- ---------------------------------------------------------------------
create table public.settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id)
);

create or replace function public.set_settings_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger settings_audit_columns
before insert or update on public.settings
for each row execute function public.set_settings_audit();

-- Typed accessor used by DB functions
create or replace function public.setting_int(p_key text, p_default int)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (s.value #>> '{}')::int from public.settings s where s.key = p_key), p_default)
$$;

create or replace function public.setting_bool(p_key text, p_default boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select (s.value #>> '{}')::boolean from public.settings s where s.key = p_key), p_default)
$$;

-- ---------------------------------------------------------------------
-- RLS: every app user reads; only admin writes
-- ---------------------------------------------------------------------
alter table public.currencies        enable row level security;
alter table public.countries         enable row level security;
alter table public.lines_of_business enable row level security;
alter table public.counterparties    enable row level security;
alter table public.fx_rates          enable row level security;
alter table public.settings          enable row level security;

create policy currencies_select on public.currencies for select to authenticated using (public.is_app_user());
create policy currencies_admin  on public.currencies for all    to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy countries_select on public.countries for select to authenticated using (public.is_app_user());
create policy countries_admin  on public.countries for all    to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy lob_select on public.lines_of_business for select to authenticated using (public.is_app_user());
create policy lob_admin  on public.lines_of_business for all    to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy counterparties_select on public.counterparties for select to authenticated using (public.is_app_user());
create policy counterparties_admin  on public.counterparties for all    to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy fx_rates_select on public.fx_rates for select to authenticated using (public.is_app_user());
create policy fx_rates_admin  on public.fx_rates for all    to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy settings_select on public.settings for select to authenticated using (public.is_app_user());
create policy settings_admin  on public.settings for all    to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

-- ---------------------------------------------------------------------
-- Grants (RLS above decides which rows / which role)
-- ---------------------------------------------------------------------
revoke all on public.currencies, public.countries, public.lines_of_business,
              public.counterparties, public.fx_rates, public.settings from anon, authenticated;

grant select, insert, update, delete on public.currencies        to authenticated;
grant select, insert, update, delete on public.countries         to authenticated;
grant select, insert, update, delete on public.lines_of_business to authenticated;
grant select, insert, update, delete on public.fx_rates          to authenticated;
grant select, insert, update, delete on public.settings          to authenticated;
grant select, delete on public.counterparties to authenticated;
grant insert (name, type, country_code, contacts, notes, active) on public.counterparties to authenticated;
grant update (name, type, country_code, contacts, notes, active) on public.counterparties to authenticated;

grant usage on type public.counterparty_type to authenticated;

revoke execute on function public.set_audit_columns()  from public, anon, authenticated;
revoke execute on function public.set_settings_audit() from public, anon, authenticated;
revoke execute on function public.fx_rate_to_usd(char, date) from public, anon;
revoke execute on function public.setting_int(text, int)      from public, anon, authenticated;
revoke execute on function public.setting_bool(text, boolean) from public, anon, authenticated;
grant execute on function public.fx_rate_to_usd(char, date) to authenticated;

-- ---------------------------------------------------------------------
-- Base reference data (real configuration, not demo)
-- ---------------------------------------------------------------------
insert into public.currencies (code, name, sort_order) values
  ('USD', 'US Dollar', 1),
  ('EUR', 'Euro', 2),
  ('GBP', 'Pound Sterling', 3),
  ('UZS', 'Uzbek Sum', 4),
  ('AED', 'UAE Dirham', 10),
  ('KZT', 'Kazakhstani Tenge', 11),
  ('TRY', 'Turkish Lira', 12),
  ('CHF', 'Swiss Franc', 13),
  ('CNY', 'Chinese Yuan', 14),
  ('INR', 'Indian Rupee', 15),
  ('SGD', 'Singapore Dollar', 16),
  ('JPY', 'Japanese Yen', 17),
  ('RUB', 'Russian Ruble', 18);

insert into public.countries (code, name, name_ru, name_uz) values
  ('UZ', 'Uzbekistan', 'Узбекистан', 'O''zbekiston'),
  ('KZ', 'Kazakhstan', 'Казахстан', 'Qozog''iston'),
  ('KG', 'Kyrgyzstan', 'Кыргызстан', 'Qirg''iziston'),
  ('TJ', 'Tajikistan', 'Таджикистан', 'Tojikiston'),
  ('TM', 'Turkmenistan', 'Туркменистан', 'Turkmaniston'),
  ('AZ', 'Azerbaijan', 'Азербайджан', 'Ozarbayjon'),
  ('GE', 'Georgia', 'Грузия', 'Gruziya'),
  ('AM', 'Armenia', 'Армения', 'Armaniston'),
  ('MN', 'Mongolia', 'Монголия', 'Mo''g''uliston'),
  ('RU', 'Russia', 'Россия', 'Rossiya'),
  ('TR', 'Turkey', 'Турция', 'Turkiya'),
  ('AE', 'United Arab Emirates', 'ОАЭ', 'BAA'),
  ('SA', 'Saudi Arabia', 'Саудовская Аравия', 'Saudiya Arabistoni'),
  ('QA', 'Qatar', 'Катар', 'Qatar'),
  ('KW', 'Kuwait', 'Кувейт', 'Quvayt'),
  ('OM', 'Oman', 'Оман', 'Ummon'),
  ('BH', 'Bahrain', 'Бахрейн', 'Bahrayn'),
  ('EG', 'Egypt', 'Египет', 'Misr'),
  ('IN', 'India', 'Индия', 'Hindiston'),
  ('PK', 'Pakistan', 'Пакистан', 'Pokiston'),
  ('CN', 'China', 'Китай', 'Xitoy'),
  ('SG', 'Singapore', 'Сингапур', 'Singapur'),
  ('MY', 'Malaysia', 'Малайзия', 'Malayziya'),
  ('ID', 'Indonesia', 'Индонезия', 'Indoneziya'),
  ('VN', 'Vietnam', 'Вьетнам', 'Vyetnam'),
  ('JP', 'Japan', 'Япония', 'Yaponiya'),
  ('KR', 'South Korea', 'Южная Корея', 'Janubiy Koreya'),
  ('GB', 'United Kingdom', 'Великобритания', 'Buyuk Britaniya'),
  ('DE', 'Germany', 'Германия', 'Germaniya'),
  ('FR', 'France', 'Франция', 'Fransiya'),
  ('CH', 'Switzerland', 'Швейцария', 'Shveytsariya'),
  ('NL', 'Netherlands', 'Нидерланды', 'Niderlandiya'),
  ('IT', 'Italy', 'Италия', 'Italiya'),
  ('ES', 'Spain', 'Испания', 'Ispaniya'),
  ('PL', 'Poland', 'Польша', 'Polsha'),
  ('CY', 'Cyprus', 'Кипр', 'Kipr'),
  ('MT', 'Malta', 'Мальта', 'Malta'),
  ('IE', 'Ireland', 'Ирландия', 'Irlandiya'),
  ('LU', 'Luxembourg', 'Люксембург', 'Lyuksemburg'),
  ('BM', 'Bermuda', 'Бермуды', 'Bermuda'),
  ('US', 'United States', 'США', 'AQSH'),
  ('CA', 'Canada', 'Канада', 'Kanada'),
  ('BR', 'Brazil', 'Бразилия', 'Braziliya'),
  ('MX', 'Mexico', 'Мексика', 'Meksika'),
  ('ZA', 'South Africa', 'ЮАР', 'Janubiy Afrika'),
  ('NG', 'Nigeria', 'Нигерия', 'Nigeriya'),
  ('KE', 'Kenya', 'Кения', 'Keniya'),
  ('AU', 'Australia', 'Австралия', 'Avstraliya');

insert into public.lines_of_business (code, name, name_ru, name_uz, sort_order) values
  ('PROP',  'Property',                          'Имущество',                          'Mulk',                                10),
  ('ENG',   'Engineering & Construction',        'Строительно-монтажные риски',        'Muhandislik va qurilish',             20),
  ('ENER',  'Energy',                            'Энергетика',                         'Energetika',                          30),
  ('CARGO', 'Marine Cargo',                      'Грузы',                              'Yuklar',                              40),
  ('HULL',  'Marine Hull',                       'Каско судов',                        'Kema kaskosi',                        50),
  ('AVIA',  'Aviation',                          'Авиация',                            'Aviatsiya',                           60),
  ('PVT',   'Political Violence & Terrorism',    'Политическое насилие и терроризм',   'Siyosiy zo''ravonlik va terrorizm',   70),
  ('PRI',   'Political Risk',                    'Политические риски',                 'Siyosiy xavflar',                     80),
  ('CRED',  'Credit & Surety',                   'Кредит и поручительство',            'Kredit va kafillik',                  90),
  ('LIAB',  'General Liability',                 'Общая ответственность',              'Umumiy javobgarlik',                 100),
  ('FINL',  'Financial Lines (D&O, PI, FI)',     'Финансовые риски (D&O, PI, FI)',     'Moliyaviy xavflar (D&O, PI, FI)',    110),
  ('CYBER', 'Cyber',                             'Кибер-риски',                        'Kiber xavflar',                      120),
  ('AH',    'Accident & Health',                 'НС и медицина',                      'Baxtsiz hodisa va tibbiyot',         130),
  ('AGRI',  'Agriculture',                       'Сельское хозяйство',                 'Qishloq xo''jaligi',                 140),
  ('SPEC',  'Specie & Fine Art',                 'Ценности и предметы искусства',      'Qimmatbaho buyumlar va san''at',     150);

insert into public.settings (key, value, description) values
  ('follow_up_first_days',     '7'::jsonb,     'Days after an offer until the first "request update" follow-up'),
  ('follow_up_repeat_days',    '7'::jsonb,     'Days between repeat follow-ups on open offers'),
  ('auto_no_response_enabled', 'false'::jsonb, 'Automatically move old offers to "no response"'),
  ('auto_no_response_days',    '30'::jsonb,    'Age of an offer (days) before it is moved to "no response"');
