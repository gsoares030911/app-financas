'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Wrench, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/format'
import { toast } from 'sonner'

interface PendingCharge {
  rentalId: string
  producerId: string
  producerName: string
  equipmentName: string
  monthlyAmount: number
  referenceMonth: string
}

export default function RecurringChargeAlert() {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<PendingCharge[]>([])
  const [generating, setGenerating] = useState<string | null>(null)

  useEffect(() => {
    checkPending()
  }, [])

  async function checkPending() {
    const now = new Date()
    const today = now.getDate()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const todayStr = now.toISOString().split('T')[0]

    // Get active rentals whose billing day has passed this month
    const { data: rentals } = await supabase
      .from('equipment_rentals')
      .select('id, equipment_name, monthly_amount, billing_day, producer_id, producers(full_name)')
      .eq('is_active', true)
      .lte('billing_day', today)
      .lte('start_date', todayStr)

    if (!rentals || rentals.length === 0) return

    const rentalIds = rentals.map(r => r.id)

    // Check which were already billed this month
    const { data: billed } = await supabase
      .from('account_entries')
      .select('equipment_rental_id')
      .eq('reference_month', currentMonth)
      .eq('category', 'aluguel_equipamento')
      .in('equipment_rental_id', rentalIds)

    const billedIds = new Set((billed ?? []).map(b => b.equipment_rental_id))

    const charges: PendingCharge[] = rentals
      .filter(r => !billedIds.has(r.id))
      .map(r => ({
        rentalId: r.id,
        producerId: r.producer_id,
        producerName: (r.producers as unknown as { full_name: string } | null)?.full_name ?? 'Produtor',
        equipmentName: r.equipment_name,
        monthlyAmount: r.monthly_amount,
        referenceMonth: currentMonth,
      }))

    if (charges.length > 0) {
      setPending(charges)
      setOpen(true)
    }
  }

  async function generate(charge: PendingCharge) {
    setGenerating(charge.rentalId)
    try {
      const now = new Date()
      const dateStr = now.toISOString().split('T')[0]
      const [year, month] = charge.referenceMonth.split('-')
      const monthName = new Date(Number(year), Number(month) - 1).toLocaleString('pt-BR', {
        month: 'long',
        year: 'numeric',
      })

      const { error } = await supabase.from('account_entries').insert({
        producer_id: charge.producerId,
        equipment_rental_id: charge.rentalId,
        entry_type: 'debito',
        category: 'aluguel_equipamento',
        description: `Aluguel — ${charge.equipmentName} (${monthName})`,
        amount: charge.monthlyAmount,
        date: dateStr,
        reference_month: charge.referenceMonth,
      })
      if (error) throw error

      toast.success(`Cobrança gerada: ${charge.equipmentName}`)
      const remaining = pending.filter(p => p.rentalId !== charge.rentalId)
      setPending(remaining)
      if (remaining.length === 0) setOpen(false)
      router.refresh()
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Erro ao gerar cobrança')
    } finally {
      setGenerating(null)
    }
  }

  async function generateAll() {
    for (const charge of pending) {
      await generate(charge)
    }
  }

  if (!open || pending.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Cobranças Recorrentes Pendentes
          </DialogTitle>
          <DialogDescription>
            Os aluguéis abaixo venceram este mês e ainda não foram lançados na conta corrente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-1">
          {pending.map(charge => (
            <div
              key={charge.rentalId}
              className="flex items-center justify-between gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg"
            >
              <div className="flex items-start gap-2 min-w-0">
                <Wrench className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{charge.equipmentName}</p>
                  <p className="text-xs text-gray-500 truncate">{charge.producerName}</p>
                  <Badge variant="outline" className="text-xs mt-1">
                    {formatCurrency(charge.monthlyAmount)}/mês
                  </Badge>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => generate(charge)}
                disabled={generating !== null}
                className="shrink-0"
              >
                {generating === charge.rentalId ? 'Gerando...' : 'Gerar'}
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Lembrar Depois
          </Button>
          {pending.length > 1 && (
            <Button onClick={generateAll} disabled={generating !== null}>
              Gerar Todas ({pending.length})
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
