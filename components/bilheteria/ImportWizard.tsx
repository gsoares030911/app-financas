'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Upload, CheckCircle, AlertCircle, ArrowRight, ArrowLeft, FileSpreadsheet, Users, Calendar, Loader2 } from 'lucide-react'
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
  // Coluna H — Bruto
  totalSales: number
  // Taxas da Bilheteria Express cobradas do produtor
  feeCardPix: number      // M — taxa cartão/PIX (todos os tipos)
  feeCash: number         // O — taxa dinheiro (PDV/TEATRO, será 0 nas linhas ONLINE)
  feeService: number      // Q — taxa de serviço
  feeAdmin: number        // S — taxa administrativa
  feePrinting: number     // V — taxa impressão/envio
  // Outros débitos
  voucher: number         // K — voucher/outros sistemas
  advertising: number     // AA — anúncio
  loan: number            // AB — empréstimo
  loanInterest: number    // AC — juros empréstimo
  otherExpenses: number   // AD — outros
  // Crédito extra
  bonus: number           // AE — bonificação
  // BE financeiro
  beGrossProfit: number    // AI — Lucro (R$)
  beOtherProfits: number   // AJ — Outros Lucros (R$, pode ser negativo)
  beCardFee: number        // AM — $CARTÃO taxa banco (R$, não o % da col AL)
  beTaxes: number          // AO — $IMPOSTO/NF (R$, não o % da col AN)
  // Contato
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

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'done'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function excelToISO(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000)
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

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

function num(v: unknown): number {
  if (typeof v === 'number') return isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const s = v.replace(/[R$\s]/g, '')
    const lastDot = s.lastIndexOf('.')
    const lastComma = s.lastIndexOf(',')
    const cleaned = lastComma > lastDot
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '')
    const n = Number(cleaned)
    return isFinite(n) ? n : 0
  }
  const n = Number(v)
  return isFinite(n) ? n : 0
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

async function parseXLSX(file: File): Promise<{
  groups: EventGroup[]
  cancelled: number
  cancelledBE: CancelledBE
  cancelledWithValues: CancelledGroup[]
}> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: 0 }) as unknown[][]

  const map = new Map<string, EventGroup>()
  const cancelledMap = new Map<string, CancelledGroup>()
  let cancelled = 0
  const cancelledBE: CancelledBE = { ai: 0, aj: 0, am: 0, ao: 0 }

  for (const row of rows.slice(1)) {
    const show = String(row[2] ?? '').trim()
    const producer = String(row[3] ?? '').trim()
    const dateSerial = Number(row[0])
    if (!show || !producer || !dateSerial) continue

    if (String(row[42]) === 'S') {
      cancelled++
      cancelledBE.ai = r2(cancelledBE.ai + num(row[34]))
      cancelledBE.aj = r2(cancelledBE.aj + num(row[35]))
      cancelledBE.am = r2(cancelledBE.am + num(row[38]))
      cancelledBE.ao = r2(cancelledBE.ao + num(row[40]))

      const adv  = num(row[26])  // AA — anúncio
      const loan = num(row[27])  // AB — empréstimo
      const lInt = num(row[28])  // AC — juros
      const vch  = num(row[10])  // K  — voucher
      const oth  = num(row[29])  // AD — outros

      if (adv > 0 || loan > 0 || lInt > 0 || vch > 0 || oth > 0) {
        const cKey = `${dateSerial}|${show}|${producer}`
        const ex = cancelledMap.get(cKey)
        if (ex) {
          ex.advertising   = r2(ex.advertising   + adv)
          ex.loan          = r2(ex.loan          + loan)
          ex.loanInterest  = r2(ex.loanInterest  + lInt)
          ex.voucher       = r2(ex.voucher       + vch)
          ex.otherExpenses = r2(ex.otherExpenses + oth)
        } else {
          cancelledMap.set(cKey, {
            key: cKey,
            dateStr: excelToISO(dateSerial),
            show, producerName: producer,
            advertising: adv, loan, loanInterest: lInt, voucher: vch, otherExpenses: oth,
            pix: String(row[44] ?? ''), phone: String(row[45] ?? ''), email: String(row[46] ?? ''),
          })
        }
      }
      continue
    }

    const key = `${dateSerial}|${show}|${producer}`

    const saleType = String(row[5] ?? '').trim().toUpperCase()
    const sales    = num(row[7])   // H — bruto

    // Taxas
    const feeCardPix  = num(row[12])  // M
    const feeCash     = num(row[14])  // O (PDV/TEATRO — será 0 em ONLINE naturalmente)
    const feeService  = num(row[16])  // Q
    const feeAdmin    = num(row[18])  // S
    const feePrinting = num(row[21])  // V

    // Outros débitos
    const voucher      = num(row[10])  // K
    const advertising  = num(row[26])  // AA
    const loan         = num(row[27])  // AB
    const loanInterest = num(row[28])  // AC
    const otherExpenses = num(row[29]) // AD

    // Crédito extra
    const bonus = num(row[30])  // AE

    // BE financeiro — lidos diretamente da planilha
    const beGross = num(row[34])   // AI = Lucro (R$)
    const beOther = num(row[35])   // AJ = Outros Lucros (R$, pode ser negativo)
    const beCard  = num(row[38])   // AM = $CARTÃO (valor R$, não o % da coluna AL)
    const beTax   = num(row[40])   // AO = $IMPOSTO (valor R$, não o % da coluna AN)

    const pix   = String(row[44] ?? '')
    const phone = String(row[45] ?? '')
    const email = String(row[46] ?? '')

    const existing = map.get(key)
    if (existing) {
      existing.totalSales    = r2(existing.totalSales    + sales)
      existing.feeCardPix    = r2(existing.feeCardPix    + feeCardPix)
      existing.feeCash       = r2(existing.feeCash       + feeCash)
      existing.feeService    = r2(existing.feeService    + feeService)
      existing.feeAdmin      = r2(existing.feeAdmin      + feeAdmin)
      existing.feePrinting   = r2(existing.feePrinting   + feePrinting)
      existing.voucher       = r2(existing.voucher       + voucher)
      existing.advertising   = r2(existing.advertising   + advertising)
      existing.loan          = r2(existing.loan          + loan)
      existing.loanInterest  = r2(existing.loanInterest  + loanInterest)
      existing.otherExpenses = r2(existing.otherExpenses + otherExpenses)
      existing.bonus          = r2(existing.bonus          + bonus)
      existing.beGrossProfit  = r2(existing.beGrossProfit  + beGross)
      existing.beOtherProfits = r2(existing.beOtherProfits + beOther)
      existing.beCardFee      = r2(existing.beCardFee      + beCard)
      existing.beTaxes        = r2(existing.beTaxes        + beTax)
      if (!existing.pix   && pix)   existing.pix   = pix
      if (!existing.phone && phone) existing.phone = phone
      if (!existing.email && email) existing.email = email
    } else {
      map.set(key, {
        id: key,
        dateSerial,
        dateStr: excelToISO(dateSerial),
        session: String(row[1] ?? ''),
        show,
        producerName: producer,
        totalSales: sales, feeCardPix, feeCash, feeService, feeAdmin, feePrinting,
        voucher, advertising, loan, loanInterest, otherExpenses, bonus,
        beGrossProfit: beGross, beOtherProfits: beOther, beCardFee: beCard, beTaxes: beTax,
        pix, phone, email,
        selected: true,
      })
    }
  }

  const groups = Array.from(map.values())
    .sort((a, b) => a.dateSerial - b.dateSerial || a.show.localeCompare(b.show))

  // Só considera cancelado se NÃO existe nenhuma linha não-cancelada com o mesmo key
  const cancelledWithValues = Array.from(cancelledMap.values()).filter(cg => !map.has(cg.key))

  return { groups, cancelled, cancelledBE, cancelledWithValues }
}

function evtTotalDebits(e: EventGroup) {
  return r2(e.feeCardPix + e.feeCash + e.feeService + e.feeAdmin + e.feePrinting
    + e.voucher + e.advertising + e.loan + e.loanInterest + e.otherExpenses)
}

function evtLiquid(e: EventGroup) {
  return r2(e.totalSales - evtTotalDebits(e) + e.bonus)
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  initialProducers: Producer[]
}

export default function ImportWizard({ initialProducers }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>('upload')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [events, setEvents] = useState<EventGroup[]>([])
  const [cancelledCount, setCancelledCount] = useState(0)
  const [cancelledBESums, setCancelledBESums] = useState<CancelledBE>({ ai: 0, aj: 0, am: 0, ao: 0 })
  const [cancelledWithValues, setCancelledWithValues] = useState<CancelledGroup[]>([])
  const [producerMaps, setProducerMaps] = useState<ProducerMap[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [progress, setProgress] = useState(0)
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'update'>('update')

  // ── Step 1: Upload ──────────────────────────────────────────────────────

  async function handleFile(file: File) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Selecione um arquivo .xlsx ou .xls')
      return
    }
    setFileName(file.name)
    try {
      const { groups, cancelled, cancelledBE, cancelledWithValues } = await parseXLSX(file)
      if (groups.length === 0) { toast.error('Nenhum evento válido encontrado na planilha'); return }
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
          pix: g.pix,
          phone: g.phone,
          email: g.email,
          action: match ? 'existing' : 'create',
          existingId: match?.id ?? '',
        }
      })
      setProducerMaps(maps)
      setStep('mapping')
    } catch {
      toast.error('Erro ao ler o arquivo. Verifique se é um XLSX válido.')
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

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
          user_id: user.id,
          full_name: pm.nameInFile,
          email: pm.email || null,
          phone: pm.phone || null,
          pix_key: pm.pix || null,
        }).select().single()
        if (error) result.errors.push(`Produtor "${pm.nameInFile}": ${error.message}`)
        else producerIdMap.set(pm.nameInFile, data.id)
      }
    }

    const allProducerIds = [...producerIdMap.values()]

    // ── 2. Carregar eventos existentes (todos os status) ────────────────
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

    // ── 3. Calcular pendências de cancelamento ANTES de criar novos ────
    // (só considera débitos de imports anteriores, não os desta rodada)
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
          name: cg.show,
          event_date: cg.dateStr,
          gross_revenue: 0,
          platform_fee: 0,
          net_amount: 0,
          status: 'cancelado',
        }).select().single()
        if (error) { result.errors.push(`[CANCELADO] "${cg.show}": ${error.message}`); continue }
        eventId = newEv.id
        existingKeys.set(dupKey, eventId)
      }

      // Lança débitos do cancelamento na conta corrente do produtor
      const debCancelled = [
        { category: 'anuncio',          description: `Anúncio — ${cg.show} [cancelado]`,            amount: cg.advertising },
        { category: 'emprestimo',       description: `Empréstimo — ${cg.show} [cancelado]`,          amount: cg.loan },
        { category: 'juros_emprestimo', description: `Juros de Empréstimo — ${cg.show} [cancelado]`, amount: cg.loanInterest },
        { category: 'voucher',          description: `Voucher — ${cg.show} [cancelado]`,             amount: cg.voucher },
        { category: 'outros',           description: `Outros — ${cg.show} [cancelado]`,              amount: cg.otherExpenses },
      ]

      // Verifica se já existem débitos para este evento cancelado (evita duplicar)
      const { data: existingDebits } = await supabase
        .from('account_entries')
        .select('id')
        .eq('event_id', eventId)
        .eq('entry_type', 'debito')
        .limit(1)

      if (!existingDebits?.length) {
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

      const dupKey = `${producerId}|${evt.show}|${evt.dateStr}`
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
            gross_revenue: gross, platform_fee: platFee, net_amount: net,
            status: 'pending',
          }).eq('id', existingEventId)
          if (updErr) throw updErr
          const { error: delAcc } = await supabase.from('account_entries').delete().eq('event_id', existingEventId)
          if (delAcc) throw delAcc
          const { error: delPlat } = await supabase.from('platform_entries').delete().eq('event_id', existingEventId)
          if (delPlat) throw delPlat
          eventId = existingEventId
          result.duplicates++
        } else {
          const { data: newEvent, error: evtErr } = await supabase.from('events').insert({
            producer_id: producerId, name: evt.show, event_date: evt.dateStr,
            gross_revenue: gross, platform_fee: platFee, net_amount: net,
            status: 'pending', notes: evt.session ? `Sessão: ${evt.session}` : null,
          }).select().single()
          if (evtErr) throw evtErr
          eventId = newEvent.id
          result.created++
        }

        // Crédito: venda bruta
        if (gross > 0) {
          const { error: e1 } = await supabase.from('account_entries').insert({
            producer_id: producerId, event_id: eventId,
            entry_type: 'credito', category: 'venda_evento',
            description: `Venda de ingresso — ${evt.show}`, amount: gross, date: evt.dateStr,
          })
          if (e1) throw e1
        }

        // Crédito: bonificação
        if (evt.bonus > 0) {
          const { error: e2 } = await supabase.from('account_entries').insert({
            producer_id: producerId, event_id: eventId,
            entry_type: 'credito', category: 'bonificacao',
            description: `Bonificação — ${evt.show}`, amount: evt.bonus, date: evt.dateStr,
          })
          if (e2) throw e2
        }

        // Débitos por tipo de taxa
        const debEntries = [
          { category: 'taxa_cartao_pix',     description: `Taxa Cartão/PIX — ${evt.show}`,        amount: evt.feeCardPix },
          { category: 'taxa_dinheiro',       description: `Taxa Vendas Dinheiro — ${evt.show}`,    amount: evt.feeCash },
          { category: 'taxa_servico',        description: `Taxa de Serviço — ${evt.show}`,         amount: evt.feeService },
          { category: 'taxa_administrativa', description: `Taxa Administrativa — ${evt.show}`,     amount: evt.feeAdmin },
          { category: 'taxa_impressao',      description: `Taxa Impressão/Envio — ${evt.show}`,    amount: evt.feePrinting },
          { category: 'voucher',             description: `Voucher/Outros Sistemas — ${evt.show}`, amount: evt.voucher },
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

        // ── Cobrança automática de cancelamentos pendentes ──────────────
        const pendingAmt = pendingByProducer.get(producerId) ?? 0
        if (pendingAmt > 0) {
          // Crédito de compensação na conta do produtor (quita a dívida)
          await supabase.from('account_entries').insert({
            producer_id: producerId, event_id: eventId,
            entry_type: 'credito', category: 'outros',
            description: `Cobrança de cancelamento — descontado em ${evt.show}`,
            amount: pendingAmt, date: evt.dateStr,
          })
          // Receita na Bilheteria Express (a plataforma recuperou o custo)
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

        // ── Bilheteria Express ──────────────────────────────────────────
        if (evt.beGrossProfit > 0) {
          const { error: pe1 } = await supabase.from('platform_entries').insert({
            user_id: user.id, event_id: eventId, producer_id: producerId,
            entry_type: 'receita', category: 'taxa_evento',
            description: `Lucro bruto — ${evt.show}`, amount: evt.beGrossProfit, date: evt.dateStr,
          })
          if (pe1) throw pe1
        }
        if (evt.beOtherProfits > 0) {
          const { error: pe2 } = await supabase.from('platform_entries').insert({
            user_id: user.id, event_id: eventId, producer_id: producerId,
            entry_type: 'receita', category: 'outros_receita',
            description: `Outros lucros — ${evt.show}`, amount: evt.beOtherProfits, date: evt.dateStr,
          })
          if (pe2) throw pe2
        } else if (evt.beOtherProfits < 0) {
          const { error: pe2 } = await supabase.from('platform_entries').insert({
            user_id: user.id, event_id: eventId, producer_id: producerId,
            entry_type: 'despesa', category: 'outros_despesa',
            description: `Outros custos — ${evt.show}`, amount: Math.abs(evt.beOtherProfits), date: evt.dateStr,
          })
          if (pe2) throw pe2
        }
        if (evt.beCardFee > 0) {
          const { error: pe3 } = await supabase.from('platform_entries').insert({
            user_id: user.id, event_id: eventId, producer_id: producerId,
            entry_type: 'despesa', category: 'infraestrutura',
            description: `Taxa cartão banco — ${evt.show}`, amount: evt.beCardFee, date: evt.dateStr,
          })
          if (pe3) throw pe3
        }
        if (evt.beTaxes > 0) {
          const { error: pe4 } = await supabase.from('platform_entries').insert({
            user_id: user.id, event_id: eventId, producer_id: producerId,
            entry_type: 'despesa', category: 'impostos',
            description: `Impostos/NF — ${evt.show}`, amount: evt.beTaxes, date: evt.dateStr,
          })
          if (pe4) throw pe4
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

  // STEP 1: Upload
  if (step === 'upload') return (
    <div className="max-w-xl mx-auto">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
        onClick={() => document.getElementById('xlsx-input')?.click()}
      >
        <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p className="font-medium text-gray-700 mb-1">Arraste o arquivo XLSX aqui</p>
        <p className="text-sm text-gray-400 mb-4">ou clique para selecionar</p>
        <Button variant="outline" size="sm" type="button">Selecionar arquivo</Button>
        <input
          id="xlsx-input"
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </div>
      <p className="text-xs text-gray-400 text-center mt-3">
        Formato esperado: planilha de fechamento semanal com colunas FECHAMENTO, ESPETÁCULO, PRODUTOR…
      </p>
    </div>
  )

  // STEP 2: Mapping
  if (step === 'mapping') return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center gap-2 mb-1">
          <Upload className="h-4 w-4 text-blue-500" />
          <span className="font-medium text-sm text-gray-700">{fileName}</span>
        </div>
        <p className="text-xs text-gray-400">
          {events.length} eventos encontrados · {cancelledCount} cancelados ignorados · {producerMaps.length} produtores
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
          <span>Nome na planilha</span>
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
                    action: val === '__create__' ? 'create' : 'existing',
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
        <Button variant="outline" onClick={() => setStep('upload')}>
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
    const selEvts = events.filter(e => e.selected)
    const totGross   = selEvts.reduce((s, e) => s + e.totalSales, 0)
    const totDebits  = selEvts.reduce((s, e) => s + evtTotalDebits(e), 0)
    const totBonus   = selEvts.reduce((s, e) => s + e.bonus, 0)
    const totLiquid  = selEvts.reduce((s, e) => s + evtLiquid(e), 0)

    // BE totals para diagnóstico
    const beAI   = r2(selEvts.reduce((s, e) => s + e.beGrossProfit, 0))
    const beAJ   = r2(selEvts.reduce((s, e) => s + e.beOtherProfits, 0))
    const beAM   = r2(selEvts.reduce((s, e) => s + e.beCardFee, 0))
    const beAO   = r2(selEvts.reduce((s, e) => s + e.beTaxes, 0))
    const beNet  = r2(beAI + beAJ - beAM - beAO)
    const cancelNet = r2(cancelledBESums.ai + cancelledBESums.aj - cancelledBESums.am - cancelledBESums.ao)

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
            <p className="text-xs text-gray-500 mt-0.5">BV lido (AE)</p>
          </div>
        </div>

        {/* Resumo Bilheteria Express — diagnóstico */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">Resumo Bilheteria Express (lido da planilha)</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div>
              <p className="text-sm font-bold text-gray-800">{fmt(beAI)}</p>
              <p className="text-xs text-gray-500">AI — Lucro</p>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">{fmt(beAJ)}</p>
              <p className="text-xs text-gray-500">AJ — Outros Lucros</p>
            </div>
            <div>
              <p className="text-sm font-bold text-red-600">−{fmt(beAM)}</p>
              <p className="text-xs text-gray-500">AM — Taxa Cartão</p>
            </div>
            <div>
              <p className="text-sm font-bold text-red-600">−{fmt(beAO)}</p>
              <p className="text-xs text-gray-500">AO — Impostos</p>
            </div>
            <div className="sm:border-l sm:border-blue-200 sm:pl-3">
              <p className="text-sm font-bold text-blue-700">{fmt(beNet)}</p>
              <p className="text-xs text-gray-500">AP — Líquido</p>
            </div>
          </div>
          {cancelledCount > 0 && (
            <p className="text-xs text-amber-700 mt-3 border-t border-blue-200 pt-2">
              {cancelledWithValues.length > 0
                ? `⚠️ ${cancelledWithValues.length} eventos cancelados com valores · débitos serão lançados na conta corrente dos produtores · cobranças pendentes serão descontadas automaticamente`
                : `ℹ️ ${cancelledCount} eventos cancelados sem valores — ignorados`
              }
            </p>
          )}
        </div>

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
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Taxas BE</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Outros Déb.</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Bônus</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {events.map(evt => {
                  const taxasBE = r2(evt.feeCardPix + evt.feeCash + evt.feeService + evt.feeAdmin + evt.feePrinting)
                  const outrosDebs = r2(evt.voucher + evt.advertising + evt.loan + evt.loanInterest + evt.otherExpenses)
                  const liq = evtLiquid(evt)
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
                      <td className="px-3 py-2 text-right text-red-500">{taxasBE > 0 ? fmt(taxasBE) : '—'}</td>
                      <td className="px-3 py-2 text-right text-orange-500">{outrosDebs > 0 ? fmt(outrosDebs) : '—'}</td>
                      <td className="px-3 py-2 text-right text-blue-500">{evt.bonus > 0 ? fmt(evt.bonus) : '—'}</td>
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
        <Button variant="outline" onClick={() => { setStep('upload'); setEvents([]); setResult(null) }}>
          Nova importação
        </Button>
        <Button onClick={() => router.push('/dashboard/bilheteria')}>
          Ver Bilheteria Express
        </Button>
      </div>
    </div>
  )

  return null
}
