'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Search, CheckCircle, AlertCircle, ArrowRight, ArrowLeft, CalendarDays, Users, Calendar, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Producer } from '@/lib/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface EventGroup {
  id: string
  dateSerial: number
  dateStr: string
  session: string
  show: string
  producerName: string
  totalSales: number
  totalCardSales: number
  cashSales: number
  voucherSales: number
  feeCardPix: number
  feeCash: number
  feeService: number
  feeAdmin: number
  feePrinting: number
  voucher: number
  advertising: number
  loan: number
  loanInterest: number
  otherExpenses: number
  bonus: number
  beGrossProfit: number
  beOtherProfits: number
  beCardFee: number
  beTaxes: number
  pix: string
  phone: string
  email: string
  selected: boolean
}

interface ProducerMap {
  nameInFile: string
  pix: string
  phone: string
  email: string
  action: 'existing' | 'create'
  existingId: string
}

interface ImportResult {
  created: number
  skipped: number
  duplicates: number
  errors: string[]
  cancelledDebited: number
  collectionsApplied: number
  collectionsAmount: number
}

interface CancelledBE { ai: number; aj: number; am: number; ao: number }

interface CancelledGroup {
  key: string
  dateStr: string
  show: string
  producerName: string
  advertising: number
  loan: number
  loanInterest: number
  voucher: number
  otherExpenses: number
  pix: string
  phone: string
  email: string
}

interface BilheteriaEntry {
  id: number
  fechamento: string
  sessao: string
  espetaculo: string
  produtor: string
  tipo: string
  qtdIngressos: number
  semTaxaCartao: number
  semTaxaOutros: number
  semTaxaDinheiro: number
  semTaxaVoucher: number
  taxaCartao: number
  taxaDinheiro: number
  taxaServicoPercentual: number
  taxa: number
  taxaServicoFixa: number
  valorLocacao: number
  valorImpressaoUnitario: number
  taxaSistema: number
  valorAnuncio: number
  valorEmprestimo: number
  jurosEmprestimo: number
  valorOutros: number
  bv: number
  pix: string
  celular: string
  email: string
  flagCancelado: string
  ecad: number
}

type Step = 'select' | 'mapping' | 'preview' | 'importing' | 'done'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function r2(v: number) { return Math.round(v * 100) / 100 }

function normName(s: string) { return s.toLowerCase().trim().replace(/\s+/g, ' ') }

function findMatch(name: string, producers: Producer[]): Producer | null {
  const n = normName(name)
  return (
    producers.find(p => normName(p.full_name) === n) ??
    producers.find(p => normName(p.full_name).includes(n) || n.includes(normName(p.full_name))) ??
    null
  )
}

function parseAPIResponse(entries: BilheteriaEntry[]): {
  groups: EventGroup[]
  cancelled: number
  cancelledBE: CancelledBE
  cancelledWithValues: CancelledGroup[]
} {
  const map = new Map<string, EventGroup>()
  const cancelledMap = new Map<string, CancelledGroup>()
  let cancelled = 0
  const cancelledBE: CancelledBE = { ai: 0, aj: 0, am: 0, ao: 0 }

  for (const entry of entries) {
    const show     = (entry.espetaculo ?? '').trim()
    const producer = (entry.produtor   ?? '').trim()
    const dateStr  = (entry.fechamento ?? '').split('T')[0]

    if (!show || !producer || !dateStr) continue

    if (entry.flagCancelado === 'S') {
      cancelled++
      const adv  = entry.valorAnuncio    ?? 0
      const loan = entry.valorEmprestimo ?? 0
      const lInt = entry.jurosEmprestimo ?? 0
      const oth  = entry.valorOutros     ?? 0

      if (adv > 0 || loan > 0 || lInt > 0 || oth > 0) {
        const cKey = `${dateStr}|${show}|${producer}`
        const ex = cancelledMap.get(cKey)
        if (ex) {
          ex.advertising   = r2(ex.advertising   + adv)
          ex.loan          = r2(ex.loan          + loan)
          ex.loanInterest  = r2(ex.loanInterest  + lInt)
          ex.otherExpenses = r2(ex.otherExpenses + oth)
        } else {
          cancelledMap.set(cKey, {
            key: cKey, dateStr, show, producerName: producer,
            advertising: adv, loan, loanInterest: lInt, voucher: 0, otherExpenses: oth,
            pix: entry.pix ?? '', phone: entry.celular ?? '', email: entry.email ?? '',
          })
        }
      }
      continue
    }

    const key        = `${dateStr}|${show}|${producer}`
    const dateSerial = new Date(entry.fechamento).getTime() / 86400000

    // Vendas em DINHEIRO e VOUCHER são recebidas direto na bilheteria física (TEATRO/PDV):
    // FICAM no bruto do produtor, mas SAEM do líquido (entram como débito na conta do produtor,
    // pois a BE não recebeu esse dinheiro). NÃO entram na conta da BE — só as taxas (dinheiro
    // 2%, impressão) viram receita da BE.
    const cashSales      = entry.semTaxaDinheiro ?? 0
    const voucherSales   = entry.semTaxaVoucher ?? 0
    const totalSales     = r2((entry.semTaxaCartao ?? 0) + (entry.semTaxaOutros ?? 0) + cashSales + voucherSales)
    // Base da BE (taxa de serviço e lucro BE) = só cartão/online + outros (sem dinheiro/voucher)
    const beBase         = r2((entry.semTaxaCartao ?? 0) + (entry.semTaxaOutros ?? 0))
    const totalCardSales = entry.semTaxaCartao ?? 0
    const voucher       = 0
    const isTeatroPdv   = entry.tipo === 'TEATRO' || entry.tipo === 'PDV'
    // taxaCartao/taxaDinheiro são TAXAS INTEIRAS (ex: 2 = 2%) — multiplica pelas vendas e divide por 100
    const feeCardPix    = r2((entry.semTaxaCartao   ?? 0) * (entry.taxaCartao   ?? 0) / 100)
    // Taxa de dinheiro (≈2%) só nas vendas TEATRO/PDV — vira receita da BE e débito do produtor.
    // Voucher NÃO paga essa taxa (só a impressão/emissão, via feePrinting abaixo).
    const feeCash       = isTeatroPdv ? r2((entry.semTaxaDinheiro ?? 0) * (entry.taxaDinheiro ?? 0) / 100) : 0
    // taxaServicoPercentual é INTEGER % (ex: 7 = 7%) — divide por 100 para obter valor em R$.
    // Incide só sobre a base BE (cartão+outros), não sobre dinheiro/voucher.
    const hasActivity   = totalSales > 0 || (entry.qtdIngressos ?? 0) > 0
    const feeServiceQ   = r2(beBase * (entry.taxaServicoPercentual ?? 0) / 100)
    const feeService    = hasActivity ? r2(feeServiceQ + (entry.taxaServicoFixa ?? 0) + (entry.valorLocacao ?? 0)) : feeServiceQ
    const feeAdmin      = entry.taxaSistema         ?? 0
    // valorImpressaoUnitario é o valor POR ingresso — total = unitário × qtd.
    // Ingresso ONLINE é digital — sem taxa de impressão/emissão.
    const feePrinting   = entry.tipo === 'ONLINE' ? 0 : r2((entry.valorImpressaoUnitario ?? 0) * (entry.qtdIngressos ?? 0))
    // taxa é decimal (ex: 0.15 = 15%) — LUCRO BE, só sobre a base BE (cartão+outros)
    const beGrossProfit = r2(beBase * (entry.taxa ?? 0))
    const advertising   = entry.valorAnuncio        ?? 0
    const loan          = entry.valorEmprestimo     ?? 0
    const loanInterest  = entry.jurosEmprestimo     ?? 0
    const otherExpenses = entry.valorOutros         ?? 0
    const bonus         = entry.bv                  ?? 0
    const beTaxes       = entry.ecad                ?? 0

    const existing = map.get(key)
    if (existing) {
      existing.totalSales     = r2(existing.totalSales     + totalSales)
      existing.totalCardSales = r2(existing.totalCardSales + totalCardSales)
      existing.cashSales      = r2(existing.cashSales      + cashSales)
      existing.voucherSales   = r2(existing.voucherSales   + voucherSales)
      existing.feeCardPix    = r2(existing.feeCardPix    + feeCardPix)
      existing.feeCash       = r2(existing.feeCash       + feeCash)
      existing.feeService    = r2(existing.feeService    + feeService)
      existing.feeAdmin      = r2(existing.feeAdmin      + feeAdmin)
      existing.feePrinting   = r2(existing.feePrinting   + feePrinting)
      existing.beGrossProfit = r2(existing.beGrossProfit + beGrossProfit)
      existing.voucher       = r2(existing.voucher       + voucher)
      existing.advertising   = r2(existing.advertising   + advertising)
      existing.loan          = r2(existing.loan          + loan)
      existing.loanInterest  = r2(existing.loanInterest  + loanInterest)
      existing.otherExpenses = r2(existing.otherExpenses + otherExpenses)
      existing.bonus         = r2(existing.bonus         + bonus)
      existing.beTaxes       = r2(existing.beTaxes       + beTaxes)
      if (!existing.pix   && entry.pix)    existing.pix   = entry.pix
      if (!existing.phone && entry.celular) existing.phone = entry.celular
      if (!existing.email && entry.email)  existing.email = entry.email
    } else {
      map.set(key, {
        id: key, dateSerial, dateStr,
        session: entry.sessao ?? '',
        show, producerName: producer,
        totalSales, totalCardSales, cashSales, voucherSales, feeCardPix, feeCash, feeService, feeAdmin, feePrinting,
        voucher, advertising, loan, loanInterest, otherExpenses, bonus,
        beGrossProfit, beOtherProfits: 0, beCardFee: 0, beTaxes,
        pix: entry.pix ?? '', phone: entry.celular ?? '', email: entry.email ?? '',
        selected: true,
      })
    }
  }

  const groups = Array.from(map.values())
    .sort((a, b) => a.dateSerial - b.dateSerial || a.show.localeCompare(b.show))

  const cancelledWithValues = Array.from(cancelledMap.values()).filter(cg => !map.has(cg.key))

  return { groups, cancelled, cancelledBE, cancelledWithValues }
}

function evtTotalDebits(e: EventGroup) {
  return r2(e.feeCardPix + e.feeCash + e.feeService + e.feeAdmin + e.feePrinting
    + e.voucher + e.cashSales + e.voucherSales
    + e.advertising + e.loan + e.loanInterest + e.otherExpenses)
}

function evtLiquid(e: EventGroup) {
  return r2(e.totalSales - evtTotalDebits(e) + e.bonus)
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  initialProducers: Producer[]
}

export default function ImportWizard({ initialProducers }: Props) {
  const router  = useRouter()
  const supabase = createClient()

  const [step, setStep]   = useState<Step>('select')
  const [fetching, setFetching] = useState(false)

  // Período
  const today = new Date().toISOString().split('T')[0]
  const [dtInicial, setDtInicial] = useState('')
  const [dtFinal,   setDtFinal]   = useState(today)

  // Dados
  const [events,              setEvents]              = useState<EventGroup[]>([])
  const [cancelledCount,      setCancelledCount]      = useState(0)
  const [cancelledBESums,     setCancelledBESums]     = useState<CancelledBE>({ ai: 0, aj: 0, am: 0, ao: 0 })
  const [cancelledWithValues, setCancelledWithValues] = useState<CancelledGroup[]>([])
  const [producerMaps,        setProducerMaps]        = useState<ProducerMap[]>([])
  const [result,              setResult]              = useState<ImportResult | null>(null)
  const [progress,            setProgress]            = useState(0)
  const [duplicateMode,       setDuplicateMode]       = useState<'skip' | 'update'>('update')

  // ── Step 1: Buscar período ──────────────────────────────────────────────

  async function handleFetch() {
    if (!dtInicial || !dtFinal) { toast.error('Informe as duas datas'); return }
    if (dtInicial > dtFinal)    { toast.error('A data inicial deve ser anterior à data final'); return }

    setFetching(true)
    try {
      const res = await fetch(`/api/bilheteria/pagamentos?dtInicial=${dtInicial}&dtFinal=${dtFinal}`)
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Erro ao consultar API')
        return
      }

      const entries: BilheteriaEntry[] = await res.json()
      if (!Array.isArray(entries) || entries.length === 0) {
        toast.error('Nenhum registro encontrado no período informado')
        return
      }

      const { groups, cancelled, cancelledBE, cancelledWithValues } = parseAPIResponse(entries)
      if (groups.length === 0) { toast.error('Nenhum evento válido no período'); return }

      setEvents(groups)
      setCancelledCount(cancelled)
      setCancelledBESums(cancelledBE)
      setCancelledWithValues(cancelledWithValues)

      const uniqueNames = [...new Set(groups.map(g => g.producerName))]
      const maps: ProducerMap[] = uniqueNames.map(name => {
        const match = findMatch(name, initialProducers)
        const g = groups.find(x => x.producerName === name)!
        return {
          nameInFile: name,
          pix:   g.pix,
          phone: g.phone,
          email: g.email,
          action:     match ? 'existing' : 'create',
          existingId: match?.id ?? '',
        }
      })
      setProducerMaps(maps)
      setStep('mapping')
    } catch {
      toast.error('Erro ao conectar com a API')
    } finally {
      setFetching(false)
    }
  }

  // ── Step 3: Import ──────────────────────────────────────────────────────

  async function handleImport() {
    setStep('importing')
    setProgress(0)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Não autenticado'); setStep('preview'); return }

    const result: ImportResult = {
      created: 0, skipped: 0, duplicates: 0, errors: [],
      cancelledDebited: 0, collectionsApplied: 0, collectionsAmount: 0,
    }

    // ── 1. Resolver IDs de produtores ───────────────────────────────────
    const producerIdMap = new Map<string, string>()
    for (const pm of producerMaps) {
      if (pm.action === 'existing' && pm.existingId) {
        producerIdMap.set(pm.nameInFile, pm.existingId)
      } else {
        const { data, error } = await supabase.from('producers').insert({
          user_id:  user.id,
          full_name: pm.nameInFile,
          email:    pm.email || null,
          phone:    pm.phone || null,
          pix_key:  pm.pix   || null,
        }).select().single()
        if (error) result.errors.push(`Produtor "${pm.nameInFile}": ${error.message}`)
        else producerIdMap.set(pm.nameInFile, data.id)
      }
    }

    const allProducerIds = [...producerIdMap.values()]

    // ── 2. Carregar eventos existentes ──────────────────────────────────
    const existingKeys = new Map<string, string>()
    if (allProducerIds.length > 0) {
      const { data: existing } = await supabase
        .from('events')
        .select('id, producer_id, name, event_date')
        .in('producer_id', allProducerIds)
      for (const e of existing ?? []) {
        existingKeys.set(`${e.producer_id}|${e.name}|${e.event_date}`, e.id)
      }
    }

    // ── 3. Calcular pendências de cancelamento ──────────────────────────
    const pendingByProducer = new Map<string, number>()
    if (allProducerIds.length > 0) {
      const { data: cancelledEvs } = await supabase
        .from('events')
        .select('id, producer_id')
        .in('producer_id', allProducerIds)
        .eq('status', 'cancelado')

      const cancelledEvIds = cancelledEvs?.map(e => e.id) ?? []
      if (cancelledEvIds.length > 0) {
        const { data: cEntries } = await supabase
          .from('account_entries')
          .select('producer_id, entry_type, amount')
          .in('event_id', cancelledEvIds)

        for (const e of cEntries ?? []) {
          const curr = pendingByProducer.get(e.producer_id) ?? 0
          pendingByProducer.set(
            e.producer_id,
            r2(curr + (e.entry_type === 'debito' ? Number(e.amount) : -Number(e.amount)))
          )
        }
        for (const [pid, amt] of pendingByProducer) {
          if (amt <= 0) pendingByProducer.delete(pid)
        }
      }
    }

    // ── 4. Processar eventos CANCELADOS com valores ─────────────────────
    for (const cg of cancelledWithValues) {
      const producerId = producerIdMap.get(cg.producerName)
      if (!producerId) continue

      const dupKey = `${producerId}|${cg.show}|${cg.dateStr}`
      let eventId = existingKeys.get(dupKey)

      if (!eventId) {
        const { data: newEv, error } = await supabase.from('events').insert({
          producer_id: producerId,
          name:        cg.show,
          event_date:  cg.dateStr,
          gross_revenue: 0, platform_fee: 0, net_amount: 0,
          status: 'cancelado',
        }).select().single()
        if (error) { result.errors.push(`[CANCELADO] "${cg.show}": ${error.message}`); continue }
        eventId = newEv.id
        if (eventId) existingKeys.set(dupKey, eventId)
      }

      const { data: existingDebits } = await supabase
        .from('account_entries')
        .select('id')
        .eq('event_id', eventId)
        .eq('entry_type', 'debito')
        .limit(1)

      if (!existingDebits?.length) {
        const debCancelled = [
          { category: 'anuncio',          description: `Anúncio — ${cg.show} [cancelado]`,            amount: cg.advertising },
          { category: 'emprestimo',       description: `Empréstimo — ${cg.show} [cancelado]`,          amount: cg.loan },
          { category: 'juros_emprestimo', description: `Juros de Empréstimo — ${cg.show} [cancelado]`, amount: cg.loanInterest },
          { category: 'voucher',          description: `Voucher — ${cg.show} [cancelado]`,             amount: cg.voucher },
          { category: 'outros',           description: `Outros — ${cg.show} [cancelado]`,              amount: cg.otherExpenses },
        ]
        for (const d of debCancelled) {
          if (d.amount <= 0) continue
          await supabase.from('account_entries').insert({
            producer_id: producerId, event_id: eventId,
            entry_type: 'debito', category: d.category,
            description: d.description, amount: d.amount, date: cg.dateStr,
          })
          result.cancelledDebited++
        }
      }
    }

    // ── 5. Processar eventos normais ────────────────────────────────────
    const selected = events.filter(e => e.selected)
    let done = 0

    for (const evt of selected) {
      const producerId = producerIdMap.get(evt.producerName)
      if (!producerId) { result.skipped++; done++; setProgress(Math.round((done / selected.length) * 100)); continue }

      const dupKey        = `${producerId}|${evt.show}|${evt.dateStr}`
      const existingEventId = existingKeys.get(dupKey)

      if (existingEventId && duplicateMode === 'skip') {
        result.duplicates++; done++; setProgress(Math.round((done / selected.length) * 100)); continue
      }

      try {
        const gross   = Math.max(0, evt.totalSales)
        const debits  = evtTotalDebits(evt)
        const net     = Math.max(0, r2(gross - debits + evt.bonus))
        const platFee = r2(evt.feeService + evt.feeAdmin + evt.feePrinting)

        let eventId: string

        if (existingEventId) {
          const { error: updErr } = await supabase.from('events').update({
            gross_revenue: gross, platform_fee: platFee, net_amount: net, status: 'pending',
          }).eq('id', existingEventId)
          if (updErr) throw updErr
          await supabase.from('account_entries').delete().eq('event_id', existingEventId)
          await supabase.from('platform_entries').delete().eq('event_id', existingEventId)
          eventId = existingEventId
          result.duplicates++
        } else {
          const { data: newEvent, error: evtErr } = await supabase.from('events').insert({
            producer_id:   producerId,
            name:          evt.show,
            event_date:    evt.dateStr,
            gross_revenue: gross, platform_fee: platFee, net_amount: net,
            status: 'pending',
            notes: evt.session ? `Sessão: ${evt.session}` : null,
          }).select().single()
          if (evtErr) throw evtErr
          eventId = newEvent.id
          result.created++
        }

        if (gross > 0) {
          const { error: e1 } = await supabase.from('account_entries').insert({
            producer_id: producerId, event_id: eventId,
            entry_type: 'credito', category: 'venda_evento',
            description: `Venda de ingresso — ${evt.show}`, amount: gross, date: evt.dateStr,
          })
          if (e1) throw e1
        }

        if (evt.bonus > 0) {
          const { error: e2 } = await supabase.from('account_entries').insert({
            producer_id: producerId, event_id: eventId,
            entry_type: 'credito', category: 'bonificacao',
            description: `Bonificação — ${evt.show}`, amount: evt.bonus, date: evt.dateStr,
          })
          if (e2) throw e2
        }

        const debEntries = [
          { category: 'taxa_cartao_pix',     description: `Taxa Cartão/PIX — ${evt.show}`,        amount: evt.feeCardPix },
          { category: 'taxa_dinheiro',       description: `Taxa Vendas Dinheiro — ${evt.show}`,    amount: evt.feeCash },
          { category: 'taxa_servico',        description: `Taxa de Serviço — ${evt.show}`,         amount: evt.feeService },
          { category: 'taxa_administrativa', description: `Taxa Administrativa — ${evt.show}`,     amount: evt.feeAdmin },
          { category: 'taxa_impressao',      description: `Taxa Impressão/Envio — ${evt.show}`,    amount: evt.feePrinting },
          { category: 'voucher',             description: `Vendas Dinheiro/Voucher (recebidas na bilheteria) — ${evt.show}`, amount: r2(evt.cashSales + evt.voucherSales) },
          { category: 'anuncio',             description: `Anúncio — ${evt.show}`,                 amount: evt.advertising },
          { category: 'emprestimo',          description: `Empréstimo — ${evt.show}`,              amount: evt.loan },
          { category: 'juros_emprestimo',    description: `Juros de Empréstimo — ${evt.show}`,     amount: evt.loanInterest },
          { category: 'outros',              description: `Outros — ${evt.show}`,                  amount: evt.otherExpenses },
        ]
        for (const entry of debEntries) {
          if (entry.amount > 0) {
            await supabase.from('account_entries').insert({
              producer_id: producerId, event_id: eventId,
              entry_type: 'debito', category: entry.category,
              description: entry.description, amount: entry.amount, date: evt.dateStr,
            })
          }
        }

        // Cobrança automática de cancelamentos pendentes
        const pendingAmt = pendingByProducer.get(producerId) ?? 0
        if (pendingAmt > 0) {
          await supabase.from('account_entries').insert({
            producer_id: producerId, event_id: eventId,
            entry_type: 'credito', category: 'outros',
            description: `Cobrança de cancelamento — descontado em ${evt.show}`,
            amount: pendingAmt, date: evt.dateStr,
          })
          await supabase.from('platform_entries').insert({
            user_id: user.id, event_id: eventId, producer_id: producerId,
            entry_type: 'receita', category: 'outros_receita',
            description: `Recuperação de cancelamento — ${evt.show}`,
            amount: pendingAmt, date: evt.dateStr,
          })
          result.collectionsApplied++
          result.collectionsAmount = r2(result.collectionsAmount + pendingAmt)
          pendingByProducer.delete(producerId)
        }

        // Bilheteria Express — custo: BV pago ao produtor
        if (evt.bonus > 0) {
          await supabase.from('platform_entries').insert({
            user_id: user.id, event_id: eventId, producer_id: producerId,
            entry_type: 'despesa', category: 'outros_despesa',
            description: `BV pago ao produtor — ${evt.show}`, amount: evt.bonus, date: evt.dateStr,
          })
        }

        // Bilheteria Express — LUCRO (taxa contratual % das vendas, não debitado do produtor)
        if (evt.beGrossProfit > 0) {
          await supabase.from('platform_entries').insert({
            user_id: user.id, event_id: eventId, producer_id: producerId,
            entry_type: 'receita', category: 'taxa_evento',
            description: `Lucro BE — ${evt.show}`, amount: evt.beGrossProfit, date: evt.dateStr,
          })
        }
        // Bilheteria Express — outras receitas (taxas operacionais cobradas do produtor)
        const beRevenue = r2(evt.feeCardPix + evt.feeCash + evt.feeService + evt.feeAdmin + evt.feePrinting)
        if (beRevenue > 0) {
          await supabase.from('platform_entries').insert({
            user_id: user.id, event_id: eventId, producer_id: producerId,
            entry_type: 'receita', category: 'taxa_evento',
            description: `Taxas BE — ${evt.show}`, amount: beRevenue, date: evt.dateStr,
          })
        }
        if (evt.advertising > 0) {
          await supabase.from('platform_entries').insert({
            user_id: user.id, event_id: eventId, producer_id: producerId,
            entry_type: 'receita', category: 'outros_receita',
            description: `Anúncio — ${evt.show}`, amount: evt.advertising, date: evt.dateStr,
          })
        }
        if (evt.loanInterest > 0) {
          await supabase.from('platform_entries').insert({
            user_id: user.id, event_id: eventId, producer_id: producerId,
            entry_type: 'receita', category: 'outros_receita',
            description: `Juros de Empréstimo — ${evt.show}`, amount: evt.loanInterest, date: evt.dateStr,
          })
        }

        // Bilheteria Express — despesas: taxa cartão operadora (2,7% sobre vendas cartão + lucro BE)
        const beCardFeeCost = r2((evt.totalCardSales + evt.beGrossProfit) * 0.027)
        if (beCardFeeCost > 0) {
          const { error: eCard } = await supabase.from('platform_entries').insert({
            user_id: user.id, event_id: eventId, producer_id: producerId,
            entry_type: 'despesa', category: 'taxa_cartao',
            description: `Taxa Cartão BE — ${evt.show}`, amount: beCardFeeCost, date: evt.dateStr,
          })
          if (eCard) throw eCard
        }

        // Bilheteria Express — despesas: impostos (13,66% sobre lucro BE)
        const beTaxCost = r2(evt.beGrossProfit * 0.1366)
        if (beTaxCost > 0) {
          const { error: eTax } = await supabase.from('platform_entries').insert({
            user_id: user.id, event_id: eventId, producer_id: producerId,
            entry_type: 'despesa', category: 'impostos',
            description: `Impostos BE — ${evt.show}`, amount: beTaxCost, date: evt.dateStr,
          })
          if (eTax) throw eTax
        }

      } catch (err: unknown) {
        result.errors.push(`"${evt.show}": ${(err as Error).message}`)
        result.skipped++
      }

      done++
      setProgress(Math.round((done / selected.length) * 100))
    }

    setResult(result)
    setStep('done')
    router.refresh()
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const selectedCount = events.filter(e => e.selected).length
  const newProducers  = producerMaps.filter(p => p.action === 'create').length

  const fmtDate = (d: string) =>
    d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : ''

  // STEP 1: Selecionar período
  if (step === 'select') return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-xl border p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <CalendarDays className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Selecionar período</h2>
            <p className="text-xs text-gray-400">Informe o intervalo de datas para consultar</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="dt-inicial" className="text-xs text-gray-600">Data inicial</Label>
            <Input
              id="dt-inicial"
              type="date"
              value={dtInicial}
              onChange={e => setDtInicial(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dt-final" className="text-xs text-gray-600">Data final</Label>
            <Input
              id="dt-final"
              type="date"
              value={dtFinal}
              onChange={e => setDtFinal(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>

        <Button
          onClick={handleFetch}
          disabled={fetching || !dtInicial || !dtFinal}
          className="w-full"
        >
          {fetching
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Consultando…</>
            : <><Search className="h-4 w-4 mr-2" /> Consultar período</>
          }
        </Button>
      </div>
    </div>
  )

  // STEP 2: Mapping
  if (step === 'mapping') return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays className="h-4 w-4 text-blue-500" />
          <span className="font-medium text-sm text-gray-700">
            {fmtDate(dtInicial)} — {fmtDate(dtFinal)}
          </span>
        </div>
        <p className="text-xs text-gray-400">
          {events.length} eventos encontrados · {cancelledCount} cancelados · {producerMaps.length} produtores
        </p>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-500" />
          <span className="font-medium text-sm text-gray-700">Mapeamento de Produtores</span>
          {newProducers > 0 && (
            <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
              {newProducers} novo{newProducers > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        <div className="px-4 py-2 bg-gray-50 border-b grid grid-cols-[1fr_auto_260px] gap-3 items-center text-xs font-medium text-gray-400 uppercase tracking-wide">
          <span>Nome na API</span>
          <span />
          <span>Produtor cadastrado</span>
        </div>

        <div className="divide-y">
          {producerMaps.map((pm, i) => (
            <div key={pm.nameInFile} className="px-4 py-3 grid grid-cols-[1fr_auto_260px] gap-3 items-center">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{pm.nameInFile}</p>
                {pm.email && <p className="text-xs text-gray-400 truncate">{pm.email}</p>}
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
              <Select
                value={pm.action === 'existing' ? pm.existingId : '__create__'}
                onValueChange={v => {
                  const val = v ?? ''
                  setProducerMaps(prev => prev.map((x, j) => j !== i ? x : {
                    ...x,
                    action:     val === '__create__' ? 'create' : 'existing',
                    existingId: val === '__create__' ? '' : val,
                  }))
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__create__">
                    <span className="text-amber-600 font-medium">+ Criar novo produtor</span>
                  </SelectItem>
                  {initialProducers.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep('select')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <Button onClick={() => setStep('preview')}>
          Ver preview <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )

  // STEP 3: Preview
  if (step === 'preview') {
    const selEvts   = events.filter(e => e.selected)
    const totGross  = selEvts.reduce((s, e) => s + e.totalSales, 0)
    const totBonus  = selEvts.reduce((s, e) => s + e.bonus, 0)
    const totLiquid = selEvts.reduce((s, e) => s + evtLiquid(e), 0)

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{selectedCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Eventos</p>
          </div>
          <div className="bg-white rounded-xl border p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{newProducers}</p>
            <p className="text-xs text-gray-500 mt-0.5">Produtores novos</p>
          </div>
          <div className="bg-white rounded-xl border p-3 text-center">
            <p className="text-2xl font-bold text-gray-400">{cancelledCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Cancelados</p>
          </div>
          <div className="bg-white rounded-xl border p-3 text-center">
            <p className="text-lg font-bold text-green-600">{fmt(totBonus)}</p>
            <p className="text-xs text-gray-500 mt-0.5">BV total</p>
          </div>
        </div>

        {cancelledCount > 0 && cancelledWithValues.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-700">
              ⚠️ {cancelledWithValues.length} evento{cancelledWithValues.length !== 1 ? 's' : ''} cancelado{cancelledWithValues.length !== 1 ? 's' : ''} com valores — débitos serão lançados na conta corrente dos produtores
            </p>
          </div>
        )}

        {/* Toggle duplicatas */}
        <div className={`rounded-xl border p-4 flex items-center gap-4 ${duplicateMode === 'skip' ? 'bg-amber-50 border-amber-200' : 'bg-white'}`}>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">Ao encontrar evento já importado</p>
            <p className={`text-xs mt-0.5 ${duplicateMode === 'skip' ? 'text-amber-700 font-medium' : 'text-gray-400'}`}>
              {duplicateMode === 'skip'
                ? '⚠️ Eventos existentes serão IGNORADOS — lançamentos e BV NÃO serão recriados'
                : 'Eventos existentes serão atualizados e todos os lançamentos recriados do zero'}
            </p>
          </div>
          <div className="flex rounded-lg border overflow-hidden text-sm">
            <button
              onClick={() => setDuplicateMode('skip')}
              className={`px-3 py-1.5 transition-colors ${duplicateMode === 'skip' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              Pular
            </button>
            <button
              onClick={() => setDuplicateMode('update')}
              className={`px-3 py-1.5 transition-colors ${duplicateMode === 'update' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              Atualizar
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="font-medium text-sm text-gray-700">Eventos a importar</span>
            <button
              className="ml-auto text-xs text-gray-400 hover:text-gray-600"
              onClick={() => setEvents(prev => prev.map(e => ({ ...e, selected: !events.every(x => x.selected) })))}
            >
              {events.every(e => e.selected) ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
          </div>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left w-8"></th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Data</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Espetáculo</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Produtor</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Bruto</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Dinh./Voucher</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Taxas BE</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Outros Déb.</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Bônus</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {events.map(evt => {
                  const taxasBE    = r2(evt.feeCardPix + evt.feeCash + evt.feeService + evt.feeAdmin + evt.feePrinting)
                  const outrosDebs = r2(evt.voucher + evt.advertising + evt.loan + evt.loanInterest + evt.otherExpenses)
                  const dinhVouch  = r2(evt.cashSales + evt.voucherSales)
                  const liq        = evtLiquid(evt)
                  return (
                    <tr key={evt.id} className={`transition-colors ${evt.selected ? 'hover:bg-gray-50' : 'opacity-40 bg-gray-50'}`}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={evt.selected}
                          onChange={() => setEvents(prev => prev.map(e => e.id === evt.id ? { ...e, selected: !e.selected } : e))}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                        {new Date(evt.dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-800 max-w-[180px] truncate">{evt.show}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-[130px] truncate">{evt.producerName}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{fmt(evt.totalSales)}</td>
                      <td className="px-3 py-2 text-right text-purple-500">{dinhVouch > 0 ? fmt(dinhVouch) : '—'}</td>
                      <td className="px-3 py-2 text-right text-red-500">{taxasBE    > 0 ? fmt(taxasBE)    : '—'}</td>
                      <td className="px-3 py-2 text-right text-orange-500">{outrosDebs > 0 ? fmt(outrosDebs) : '—'}</td>
                      <td className="px-3 py-2 text-right text-blue-500">{evt.bonus  > 0 ? fmt(evt.bonus)  : '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`font-medium ${liq >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(liq)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="border-t bg-gray-50 sticky bottom-0">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-xs font-medium text-gray-500">Total ({selectedCount} eventos)</td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-gray-700">{fmt(totGross)}</td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-purple-500">
                    {fmt(selEvts.reduce((s, e) => s + r2(e.cashSales + e.voucherSales), 0))}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-red-500">
                    {fmt(selEvts.reduce((s, e) => s + r2(e.feeCardPix + e.feeCash + e.feeService + e.feeAdmin + e.feePrinting), 0))}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-orange-500">
                    {fmt(selEvts.reduce((s, e) => s + r2(e.voucher + e.advertising + e.loan + e.loanInterest + e.otherExpenses), 0))}
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-blue-500">{fmt(totBonus)}</td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-green-700">{fmt(totLiquid)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep('mapping')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <Button onClick={handleImport} disabled={selectedCount === 0} className="bg-green-600 hover:bg-green-700">
            Importar {selectedCount} evento{selectedCount !== 1 ? 's' : ''} <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    )
  }

  // STEP 4: Importing (progress)
  if (step === 'importing') return (
    <div className="max-w-md mx-auto text-center py-16">
      <Loader2 className="h-12 w-12 mx-auto mb-4 text-blue-500 animate-spin" />
      <p className="font-medium text-gray-700 mb-2">Importando eventos…</p>
      <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-gray-400">{progress}% concluído</p>
    </div>
  )

  // STEP 5: Done
  if (step === 'done' && result) return (
    <div className="max-w-md mx-auto text-center py-12 space-y-6">
      <div className={`rounded-full p-4 w-20 h-20 mx-auto flex items-center justify-center ${
        result.errors.length === 0 ? 'bg-green-50' : 'bg-amber-50'
      }`}>
        {result.errors.length === 0
          ? <CheckCircle className="h-10 w-10 text-green-500" />
          : <AlertCircle className="h-10 w-10 text-amber-500" />
        }
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">
          {result.errors.length === 0 ? 'Importação concluída!' : 'Importação com avisos'}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {result.created} criado{result.created !== 1 ? 's' : ''}
          {result.duplicates > 0 && ` · ${result.duplicates} ${duplicateMode === 'update' ? 'atualizado' : 'ignorado'}${result.duplicates !== 1 ? 's' : ''}`}
          {result.skipped > 0 && ` · ${result.skipped} com erro`}
        </p>
        {(result.cancelledDebited > 0 || result.collectionsApplied > 0) && (
          <div className="mt-3 space-y-1 text-xs text-gray-500">
            {result.cancelledDebited > 0 && (
              <p>🔴 {result.cancelledDebited} débito{result.cancelledDebited !== 1 ? 's' : ''} de cancelamento lançados na conta corrente</p>
            )}
            {result.collectionsApplied > 0 && (
              <p>✅ {result.collectionsApplied} cobrança{result.collectionsApplied !== 1 ? 's' : ''} de cancelamento recuperada{result.collectionsApplied !== 1 ? 's' : ''} · {fmt(result.collectionsAmount)}</p>
            )}
          </div>
        )}
      </div>
      {result.errors.length > 0 && (
        <div className="bg-amber-50 rounded-xl p-4 text-left">
          <p className="text-xs font-medium text-amber-700 mb-2">Erros encontrados:</p>
          <ul className="space-y-1">
            {result.errors.map((e, i) => (
              <li key={i} className="text-xs text-amber-600">{e}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex gap-3 justify-center">
        <Button variant="outline" onClick={() => { setStep('select'); setEvents([]); setResult(null) }}>
          Nova consulta
        </Button>
        <Button onClick={() => router.push('/dashboard/bilheteria')}>
          Ver Bilheteria Express
        </Button>
      </div>
    </div>
  )

  return null
}
