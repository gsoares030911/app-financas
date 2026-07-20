import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  // Verificação de sessão via cookie de autenticação do Supabase
  const cookieHeader = request.headers.get('cookie') ?? ''
  if (!cookieHeader.includes('sb-')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const pageSize = 1000
    let from = 0
    const pairs: [string, string][] = []

    while (true) {
      const { data, error } = await admin
        .from('producers')
        .select('id, full_name')
        .range(from, from + pageSize - 1)

      if (error) throw new Error(error.message)
      if (!data || data.length === 0) break
      for (const p of data) pairs.push([p.full_name.toLowerCase().trim(), p.id])
      if (data.length < pageSize) break
      from += pageSize
    }

    return NextResponse.json(pairs)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
