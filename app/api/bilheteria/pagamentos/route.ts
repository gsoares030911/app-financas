import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const dtInicial = searchParams.get('dtInicial')
  const dtFinal   = searchParams.get('dtFinal')

  if (!dtInicial || !dtFinal) {
    return NextResponse.json({ error: 'Datas obrigatórias' }, { status: 400 })
  }

  // Valida formato de data (DD/MM/YYYY ou YYYY-MM-DD) para evitar injeção de parâmetros
  const DATE_RE = /^(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})$/
  if (!DATE_RE.test(dtInicial) || !DATE_RE.test(dtFinal)) {
    return NextResponse.json({ error: 'Formato de data inválido' }, { status: 400 })
  }

  const token = process.env.BILHETERIA_API_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'Token de API não configurado no servidor' }, { status: 500 })
  }

  try {
    const res = await fetch(
      `https://produtorwebapi.azurewebsites.net/api/Financeirov1/consultarpagamentos?dtInicial=${dtInicial}&dtFinal=${dtFinal}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
        },
        cache: 'no-store',
      }
    )

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `API retornou ${res.status}: ${text}` }, { status: res.status })
    }

    // Decodifica com windows-1252 (encoding legado do endpoint) para preservar
    // caracteres especiais como aspas tipográficas, acentos etc.
    const buf  = await res.arrayBuffer()
    const text = new TextDecoder('windows-1252').decode(buf)
    const data = JSON.parse(text)

    // Salva histórico no banco (não bloqueia a resposta em caso de erro)
    const admin = createAdminClient()
    await admin.from('bilheteria_api_imports').insert({
      user_id:          user.id,
      dt_inicial:       dtInicial,
      dt_final:         dtFinal,
      total_registros:  Array.isArray(data) ? data.length : 0,
      raw_data:         data,
    })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro ao conectar com a API externa' }, { status: 500 })
  }
}
