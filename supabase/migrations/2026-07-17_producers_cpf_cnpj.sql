-- Adiciona CPF/CNPJ do favorecido na tabela de produtores
-- Obrigatório para geração do arquivo CNAB 240 (Segmento B PIX e Segmento A TED)

ALTER TABLE producers
  ADD COLUMN IF NOT EXISTS cpf_cnpj text;
