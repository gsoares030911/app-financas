-- Adiciona status 'cancelado' à tabela de eventos
ALTER TABLE public.events
DROP CONSTRAINT IF EXISTS events_status_check;

ALTER TABLE public.events
ADD CONSTRAINT events_status_check
CHECK (status IN ('pending', 'settled', 'cancelado'));
