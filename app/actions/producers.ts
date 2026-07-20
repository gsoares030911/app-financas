'use server'

import { createAdminClient } from '@/lib/supabase/admin'

// Retorna array de pares [normalizedName, id] — Map não é serializável em JSON
export async function getProducerIdPairs(): Promise<[string, string][]> {
  const supabase = createAdminClient()
  const pageSize = 1000
  let from = 0
  const pairs: [string, string][] = []

  while (true) {
    const { data, error } = await supabase
      .from('producers')
      .select('id, full_name')
      .range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    for (const p of data) pairs.push([p.full_name.toLowerCase().trim(), p.id])
    if (data.length < pageSize) break
    from += pageSize
  }

  return pairs
}
