import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const pageSize = 1000
  let from = 0
  const pairs: [string, string][] = []

  while (true) {
    const { data, error } = await admin
      .from('producers')
      .select('id, full_name')
      .range(from, from + pageSize - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    for (const p of data) pairs.push([p.full_name.toLowerCase().trim(), p.id])
    if (data.length < pageSize) break
    from += pageSize
  }

  return NextResponse.json(pairs)
}
