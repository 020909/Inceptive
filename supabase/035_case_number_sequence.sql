-- 035_case_number_sequence.sql
-- Auto-generate case_number: INC-2024-XXXXX

create sequence if not exists public.case_number_seq start 1;

create or replace function public.generate_case_number()
returns text
language plpgsql
as $$
declare
  next_val bigint;
begin
  select nextval('public.case_number_seq') into next_val;
  return 'INC-2024-' || lpad(next_val::text, 5, '0');
end;
$$;

create or replace function public.set_case_number()
returns trigger
language plpgsql
as $$
begin
  if new.case_number is null or length(trim(new.case_number)) = 0 then
    new.case_number := public.generate_case_number();
  end if;
  return new;
end;
$$;

drop trigger if exists cases_set_case_number on public.cases;
create trigger cases_set_case_number
before insert on public.cases
for each row
execute function public.set_case_number();

