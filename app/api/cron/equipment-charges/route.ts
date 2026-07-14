import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const lastDay = new Date(year, month, 0).getDate()

  if (now.getDate() !== lastDay) {
    return NextResponse.json({
      skipped: true,
      reason: `not last day of month (today=${now.getDate()}, last=${lastDay})`,
    })
  }

  const refMonth = `${year}-${String(month).padStart(2, '0')}`
  const monthLabel = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
  const daysInMonth = lastDay
  const supabase = createAdminClient()

  let equipGenerated = 0
  let pdvGenerated = 0

  // ── 1. Equipamentos de produtor → account_entries ──────────────

  const { data: activeRentals, error: rentalsErr } = await supabase
    .from('equipment_rentals')
    .select('id, producer_id, equipment_name, monthly_amount, billing_day')
    .eq('is_active', true)
    .eq('is_bonificada', false)

  if (rentalsErr) {
    console.error('[cron] Error fetching rentals:', rentalsErr)
    return NextResponse.json({ error: rentalsErr.message }, { status: 500 })
  }

  if (activeRentals && activeRentals.length > 0) {
    const { data: existingEquip } = await supabase
      .from('account_entries')
      .select('equipment_rental_id')
      .in('equipment_rental_id', activeRentals.map(r => r.id))
      .eq('reference_month', refMonth)

    const alreadyBilledEquip = new Set((existingEquip ?? []).map(e => e.equipment_rental_id))
    const toGenerateEquip = activeRentals.filter(r => !alreadyBilledEquip.has(r.id))

    if (toGenerateEquip.length > 0) {
      const equipEntries = toGenerateEquip.map(r => {
        const day = String(Math.min(r.billing_day, daysInMonth)).padStart(2, '0')
        return {
          producer_id: r.producer_id,
          equipment_rental_id: r.id,
          entry_type: 'debito' as const,
          category: 'aluguel_equipamento',
          description: `Aluguel — ${r.equipment_name} (${monthLabel})`,
          amount: r.monthly_amount,
          date: `${refMonth}-${day}`,
          reference_month: refMonth,
        }
      })
      const { error: equipErr } = await supabase.from('account_entries').insert(equipEntries)
      if (equipErr) {
        console.error('[cron] Error inserting equipment entries:', equipErr)
        return NextResponse.json({ error: equipErr.message }, { status: 500 })
      }
      equipGenerated = toGenerateEquip.length
    }
  }

  // ── 2. PDVs → platform_entries ─────────────────────────────────

  const { data: activePdvs, error: pdvsErr } = await supabase
    .from('pdv_locations')
    .select('id, name, store_name, monthly_cost, billing_day')
    .eq('is_active', true)
    .eq('is_bonificada', false)
    .gt('monthly_cost', 0)

  if (pdvsErr) {
    console.error('[cron] Error fetching PDVs:', pdvsErr)
    return NextResponse.json({ error: pdvsErr.message }, { status: 500 })
  }

  if (activePdvs && activePdvs.length > 0) {
    const { data: existingPdv } = await supabase
      .from('platform_entries')
      .select('pdv_location_id')
      .in('pdv_location_id', activePdvs.map(p => p.id))
      .eq('reference_month', refMonth)

    const alreadyBilledPdv = new Set((existingPdv ?? []).map(e => e.pdv_location_id))
    const toGeneratePdv = activePdvs.filter(p => !alreadyBilledPdv.has(p.id))

    if (toGeneratePdv.length > 0) {
      const pdvEntries = toGeneratePdv.map(p => {
        const day = String(Math.min(p.billing_day, daysInMonth)).padStart(2, '0')
        return {
          entry_type: 'despesa' as const,
          category: 'aluguel_pdv',
          description: `Aluguel PDV — ${p.name} · ${p.store_name} (${monthLabel})`,
          amount: p.monthly_cost,
          date: `${refMonth}-${day}`,
          pdv_location_id: p.id,
          reference_month: refMonth,
          event_id: null,
          producer_id: null,
        }
      })
      const { error: pdvErr } = await supabase.from('platform_entries').insert(pdvEntries)
      if (pdvErr) {
        console.error('[cron] Error inserting PDV entries:', pdvErr)
        return NextResponse.json({ error: pdvErr.message }, { status: 500 })
      }
      pdvGenerated = toGeneratePdv.length
    }
  }

  console.log(`[cron] ${refMonth}: ${equipGenerated} equipment + ${pdvGenerated} PDV charges generated`)
  return NextResponse.json({ month: refMonth, equipGenerated, pdvGenerated })
}
