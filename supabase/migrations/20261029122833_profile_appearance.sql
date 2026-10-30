-- =====================================================================
-- Appearance preferences on the user's profile (additive, visual only):
-- colour theme and text size, editable by each user on their own row only
-- (existing profiles_update_self policy + column grant).
-- Target project: mig-inward-re (ref jltrtqwaxvsrnqmjemzc)
-- =====================================================================

alter table public.profiles
  add column if not exists ui_theme text not null default 'grey'
    check (ui_theme in ('grey', 'blue', 'green', 'orange')),
  add column if not exists ui_text_size text not null default 'normal'
    check (ui_text_size in ('normal', 'large'));

grant update (ui_theme, ui_text_size) on public.profiles to authenticated;
