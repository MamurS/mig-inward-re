-- Currency names in the UI language (screenshot review v2, item 4): the
-- currencies get name_ru / name_uz like countries and lines of business
-- already have. Additive and nullable; the UI falls back to the English name
-- when one is empty. Grants are table-level (select, insert, update, delete
-- to authenticated, 20261028110432_reference_data.sql), so the new columns
-- are covered as they are; RLS and the audit trigger are unchanged.
-- Reference data (real configuration, not demo): the 13 seeded currencies.

alter table public.currencies
  add column if not exists name_ru text,
  add column if not exists name_uz text;

comment on column public.currencies.name_ru is 'Name in Russian (empty → the English name)';
comment on column public.currencies.name_uz is 'Name in Uzbek, Latin script (empty → the English name)';

update public.currencies c
   set name_ru = v.name_ru,
       name_uz = v.name_uz
  from (values
    ('USD', 'Доллар США',             'AQSH dollari'),
    ('EUR', 'Евро',                   'Yevro'),
    ('GBP', 'Фунт стерлингов',        'Funt sterling'),
    ('UZS', 'Узбекский сум',          'Oʻzbek soʻmi'),
    ('AED', 'Дирхам ОАЭ',             'BAA dirhami'),
    ('KZT', 'Казахстанский тенге',    'Qozogʻiston tengesi'),
    ('TRY', 'Турецкая лира',          'Turk lirasi'),
    ('CHF', 'Швейцарский франк',      'Shveytsariya franki'),
    ('CNY', 'Китайский юань',         'Xitoy yuani'),
    ('INR', 'Индийская рупия',        'Hindiston rupiyasi'),
    ('SGD', 'Сингапурский доллар',    'Singapur dollari'),
    ('JPY', 'Японская иена',          'Yaponiya iyenasi'),
    ('RUB', 'Российский рубль',       'Rossiya rubli')
  ) as v (code, name_ru, name_uz)
 where c.code = v.code
   and c.name_ru is null
   and c.name_uz is null;

-- Uzbek names of countries and lines of business: the oʻ / gʻ letters with
-- ʻ (U+02BB), as everywhere else in the app (they were seeded with a straight
-- apostrophe). Only an apostrophe-like mark right after o / g changes.
update public.countries
   set name_uz = regexp_replace(name_uz, '([OoGg])[''‘’`ʼ]', '\1ʻ', 'g')
 where name_uz ~ '[OoGg][''‘’`ʼ]';
update public.lines_of_business
   set name_uz = regexp_replace(name_uz, '([OoGg])[''‘’`ʼ]', '\1ʻ', 'g')
 where name_uz ~ '[OoGg][''‘’`ʼ]';
