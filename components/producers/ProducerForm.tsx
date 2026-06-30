'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Producer, ProducerFormData } from '@/lib/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  producer: Producer | null
  onUpdate?: (updated: Producer) => void
}

const EMPTY: ProducerFormData = {
  full_name: '',
  email: '',
  phone: '',
  pix_key: '',
  bank_name: '',
  bank_agency: '',
  bank_account: '',
  notes: '',
}

export default function ProducerForm({ open, onOpenChange, producer, onUpdate }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState<ProducerFormData>(EMPTY)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (producer) {
      setForm({
        full_name: producer.full_name,
        email: producer.email ?? '',
        phone: producer.phone ?? '',
        pix_key: producer.pix_key ?? '',
        bank_name: producer.bank_name ?? '',
        bank_agency: producer.bank_agency ?? '',
        bank_account: producer.bank_account ?? '',
        notes: producer.notes ?? '',
      })
    } else {
      setForm(EMPTY)
    }
  }, [producer, open])

  function set(field: keyof ProducerFormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) { toast.error('Nome completo é obrigatório'); return }
    setLoading(true)
    try {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        pix_key: form.pix_key.trim() || null,
        bank_name: form.bank_name.trim() || null,
        bank_agency: form.bank_agency.trim() || null,
        bank_account: form.bank_account.trim() || null,
        notes: form.notes.trim() || null,
      }
      if (producer) {
        const { data: updated, error } = await supabase
          .from('producers')
          .update(payload)
          .eq('id', producer.id)
          .select()
          .single()
        if (error) throw error
        if (!updated) throw new Error('Nenhum registro atualizado')
        toast.success('Produtor atualizado!')
        onUpdate?.(updated as Producer)
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { error } = await supabase.from('producers').insert({ ...payload, user_id: user!.id })
        if (error) throw error
        toast.success('Produtor cadastrado!')
      }
      router.refresh()
      onOpenChange(false)
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Erro ao salvar produtor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{producer ? 'Editar Produtor' : 'Novo Produtor'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nome Completo *</Label>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={e => set('full_name', e.target.value)}
              placeholder="Nome do produtor"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone (com DDD)</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pix_key">Chave PIX</Label>
            <Input
              id="pix_key"
              value={form.pix_key}
              onChange={e => set('pix_key', e.target.value)}
              placeholder="CPF, telefone, email ou chave aleatória"
            />
          </div>

          <div className="space-y-1">
            <Label>Dados Bancários</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <Input
                value={form.bank_name}
                onChange={e => set('bank_name', e.target.value)}
                placeholder="Banco"
              />
              <Input
                value={form.bank_agency}
                onChange={e => set('bank_agency', e.target.value)}
                placeholder="Agência"
              />
              <Input
                value={form.bank_account}
                onChange={e => set('bank_account', e.target.value)}
                placeholder="Conta"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <textarea
              id="notes"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Notas adicionais..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : producer ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
