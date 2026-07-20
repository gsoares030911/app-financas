'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function getProducerIdMap(): Promise<Map<string, string>> {
  const supabase = createAdminClient()
  const pageSize = 1000
  let from = 0
  const allProducers: { id: string; full_name: string }[] = []

  while (true) {
    const { data, error } = await supabase
      .from('producers')
      .select('id, full_name')
      .range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    allProducers.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }

  return new Map(allProducers.map(p => [p.full_name.toLowerCase().trim(), p.id]))
}
