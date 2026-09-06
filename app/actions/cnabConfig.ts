'use server'

import { createClient } from '@/lib/supabase/server'
import type { EmpresaConfig } from '@/lib/utils/cnab240'

const CONFIG_ID = '00000000-0000-0000-0000-000000000001'

export async function getCnabConfig(): Promise<Partial<EmpresaConfig>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('cnab_config')
    .select('cnpj, nome, agencia, digito_agencia, conta, digito_conta, limite_diario')
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
    limiteDiario: data.limite_diario !== null && data.limite_diario !== undefined ? Number(data.limite_diario) : null,
  }
}

export async function saveCnabConfig(config: EmpresaConfig): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('cnab_config')
    .upsert({
      id:            CONFIG_ID,
      cnpj:          config.cnpj,
      nome:          config.nome,
      agencia:       config.agencia,
      digito_agencia: config.digitoAgencia,
      conta:         config.conta,
      digito_conta:  config.digitoConta,
      limite_diario: config.limiteDiario ?? null,
      updated_at:    new Date().toISOString(),
      updated_by:    user.id,
    })

  if (error) return { error: error.message }
  return {}
}
