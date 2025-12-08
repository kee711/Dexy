alter table api_key_usage
  alter column amount type numeric(18,3),
  alter column amount set default 0,
  alter column amount set not null;

-- Backfill existing rows by rounding to 3 decimals if needed
update api_key_usage
set amount = round(amount::numeric, 3)
where amount is not null;
