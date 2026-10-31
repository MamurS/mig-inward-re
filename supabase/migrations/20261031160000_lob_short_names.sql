-- Short names of the lines of business (backlog item 2, screenshot review v3):
-- long names were cut in the register («Строительно…», «Финансовые …»).
-- Tables, chips, charts and compact lists show the short name; forms, detail
-- pages, quick views and tooltips keep the full one. Additive and nullable:
-- the UI falls back to the English short name, then to the full name.
-- Grants are table-level (select, insert, update, delete to authenticated,
-- 20261028110432_reference_data.sql), so the new columns are covered as they
-- are; RLS (lob_select / lob_admin) and the audit trigger are unchanged.
-- Reference data (real configuration, not demo): the 15 seeded lines.

alter table public.lines_of_business
  add column if not exists short_name    text,
  add column if not exists short_name_ru text,
  add column if not exists short_name_uz text;

comment on column public.lines_of_business.short_name    is 'Short English name for tables, chips and charts (empty → the full name)';
comment on column public.lines_of_business.short_name_ru is 'Short Russian name (empty → the English short name, then the full name)';
comment on column public.lines_of_business.short_name_uz is 'Short Uzbek name, Latin script (empty → the English short name, then the full name)';

update public.lines_of_business l
   set short_name    = v.short_name,
       short_name_ru = v.short_name_ru,
       short_name_uz = v.short_name_uz
  from (values
    ('PROP',  'Property',          'Имущество',               'Mulk'),
    ('ENG',   'Engineering',       'Строительство',           'Qurilish'),
    ('ENER',  'Energy',            'Энергетика',              'Energetika'),
    ('CARGO', 'Cargo',             'Грузы',                   'Yuklar'),
    ('HULL',  'Hull',              'Каско судов',             'Kema kaskosi'),
    ('AVIA',  'Aviation',          'Авиация',                 'Aviatsiya'),
    ('PVT',   'PV & Terrorism',    'PV и терроризм',          'PV va terrorizm'),
    ('PRI',   'Political Risk',    'Полит. риски',            'Siyosiy xavflar'),
    ('CRED',  'Credit & Surety',   'Кредит и поруч.',         'Kredit va kafillik'),
    ('LIAB',  'Liability',         'Общая отв.',              'Javobgarlik'),
    ('FINL',  'Financial Lines',   'Финансовые риски',        'Moliyaviy xavflar'),
    ('CYBER', 'Cyber',             'Кибер-риски',             'Kiber xavflar'),
    ('AH',    'A&H',               'НС и медицина',           'BH va tibbiyot'),
    ('AGRI',  'Agriculture',       'Сельхоз',                 'Qishloq xoʻjaligi'),
    ('SPEC',  'Specie & Fine Art', 'Ценности',                'Qimmatbaholar')
  ) as v (code, short_name, short_name_ru, short_name_uz)
 where l.code = v.code
   and l.short_name is null;
