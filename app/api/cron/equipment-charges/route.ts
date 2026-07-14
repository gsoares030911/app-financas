import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  // Vercel Cron Jobs send Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const lastDay = new Date(year, month, 0).getDate()

  // Only run on the last day of the month
  if (now.getDate() !== lastDay) {
    return NextResponse.json({
      skipped: true,
      reason: `not last day of month (today=${now.getDate()}, last=${lastDay})`,
    })
  }

  const refMonth = `${year}-${String(month).padStart(2, '0')}`
  const monthLabel = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

  const supabase = createAdminClient()

  // Fetch all active rentals
  const { data: activeRentals, error: rentalsErr } = await supabase
    .from('equipment_rentals')
    .select('id, producer_id, equipment_name, monthly_amount, billing_day')
    .eq('is_active', true)

  if (rentalsErr) {
    console.error('[cron/equipment-charges] Error fetching rentals:', rentalsErr)
    return NextResponse.json({ error: rentalsErr.message }, { status: 500 })
  }

  if (!activeRentals || activeRentals.length === 0) {
    return NextResponse.json({ generated: 0, message: 'No active rentals' })
  }

  // Check which ones are already billed this month
  const rentalIds = activeRentals.map(r => r.id)
  const { data: existing } = await supabase
    .from('account_entries')
    .select('equipment_rental_id')
    .in('equipment_rental_id', rentalIds)
    .eq('reference_month', refMonth)

  const alreadyBilled = new Set((existing ?? []).map(e => e.equipment_rental_id))
  const toGenerate = activeRentals.filter(r => !alreadyBilled.has(r.id))

  if (toGenerate.length === 0) {
    return NextResponse.json({ generated: 0, message: `All rentals already billed for ${refMonth}` })
  }

  const daysInMonth = lastDay
  const entries = toGenerate.map(r => {
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

  const { error: insertErr } = await supabase.from('account_entries').insert(entries)
  if (insertErr) {
    console.error('[cron/equipment-charges] Error inserting entries:', insertErr)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  console.log(`[cron/equipment-charges] Generated ${toGenerate.length} charges for ${refMonth}`)
  return NextResponse.json({ generated: toGenerate.length, month: refMonth })
}
