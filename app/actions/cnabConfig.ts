'use server'

import { createClient } from '@/lib/supabase/server'
import type { EmpresaConfig } from '@/lib/utils/cnab240'

const CONFIG_ID = '00000000-0000-0000-0000-000000000001'

export async function getCnabConfig(): Promise<Partial<EmpresaConfig>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('cnab_config')
    .select('cnpj, nome, agencia, digito_agencia, conta, digito_conta')
    .eq('id', CONFIG_ID)
    .single()
  if (!data) return {}
  return {
    cnpj:         data.cnpj         ?? '',
    nome:         data.nome         ?? '',
    agencia:      data.agencia      ?? '',
    digitoAgencia: data.digito_agencia ?? '',
    conta:        data.conta        ?? '',
    digitoConta:  data.digito_conta ?? '',
  }
}

export async function saveCnabConfig(config: EmpresaConfig): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('cnab_config')
    .update({
      cnpj:          config.cnpj,
      nome:          config.nome,
      agencia:       config.agencia,
      digito_agencia: config.digitoAgencia,
      conta:         config.conta,
      digito_conta:  config.digitoConta,
      updated_at:    new Date().toISOString(),
      updated_by:    user.id,
    })
    .eq('id', CONFIG_ID)

  if (error) return { error: error.message }
  return {}
}
