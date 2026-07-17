'use client'

import { useState, useTransition } from 'react'
import { Download, X, AlertCircle, Building2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { gerarCNAB240Itau, resolveBank, detectPixKeyType, type EmpresaConfig, type PagamentoCNAB } from '@/lib/utils/cnab240'
import { saveCnabConfig } from '@/app/actions/cnabConfig'
import { toast } from 'sonner'
import type { PaymentOrder, Producer } from '@/lib/types'

type ProducerBankInfo = Pick<Producer, 'id' | 'full_name' | 'cpf_cnpj' | 'bank_name' | 'bank_agency' | 'bank_account' | 'pix_key'>

interface Props {
  orders: PaymentOrder[]
  producers: ProducerBankInfo[]
  cnabConfig?: Partial<EmpresaConfig>
  onClose: () => void
}

function nextBusinessDay(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export default function ExportarCNABModal({ orders, producers, cnabConfig, onClose }: Props) {
  const [cnpj,     setCnpj]     = useState(cnabConfig?.cnpj         ?? '')
  const [nome,     setNome]     = useState(cnabConfig?.nome         ?? '')
  const [agencia,  setAgencia]  = useState(cnabConfig?.agencia      ?? '')
  const [digitoAg, setDigitoAg] = useState(cnabConfig?.digitoAgencia ?? '')
  const [conta,    setConta]    = useState(cnabConfig?.conta        ?? '')
  const [digitoCt, setDigitoCt] = useState(cnabConfig?.digitoConta  ?? '')
  const [dataPgto, setDataPgto] = useState(nextBusinessDay())
  const [erros,    setErros]    = useState<string[]>([])
  const [saving,   startSave]   = useTransition()

  const producerMap = new Map(producers.map(p => [p.id, p]))

  function buildEmpresa(): EmpresaConfig {
    return {
      cnpj,
      nome:          nome.trim(),
      agencia:       agencia.replace(/\D/g, ''),
      digitoAgencia: digitoAg.trim(),
      conta:         conta.replace(/\D/g, ''),
      digitoConta:   digitoCt.trim(),
    }
  }

  function validar(): string[] {
    const e: string[] = []
    if (!cnpj.replace(/\D/g, '') || cnpj.replace(/\D/g, '').length < 14) e.push('CNPJ da empresa inválido')
    if (!nome.trim())              e.push('Razão social obrigatória')
    if (!agencia.replace(/\D/g, '')) e.push('Agência obrigatória')
    if (!conta.replace(/\D/g, ''))   e.push('Conta obrigatória')
    if (!dataPgto)                 e.push('Data de pagamento obrigatória')

    orders.forEach(order => {
      const prod = producerMap.get(order.producer_id)
      if (!prod) { e.push(`Produtor não encontrado para OP ${order.order_number}`); return }
      if (!prod.cpf_cnpj) e.push(`${prod.full_name}: CPF/CNPJ não cadastrado (obrigatório para CNAB)`)
      const hasPix = !!prod.pix_key?.trim()
      if (!hasPix) {
        if (!prod.bank_agency)  e.push(`${prod.full_name}: agência não cadastrada (sem chave PIX)`)
        if (!prod.bank_account) e.push(`${prod.full_name}: conta não cadastrada (sem chave PIX)`)
        if (!prod.bank_name)    e.push(`${prod.full_name}: banco não cadastrado (sem chave PIX)`)
        else if (resolveBank(prod.bank_name) === '000')
          e.push(`${prod.full_name}: banco "${prod.bank_name}" não reconhecido`)
      }
    })
    return e
  }

  function handleSalvar() {
    const e = validar()
    setErros(e)
    if (e.length > 0) return
    startSave(async () => {
      const result = await saveCnabConfig(buildEmpresa())
      if (result.error) toast.error('Erro ao salvar: ' + result.error)
      else toast.success('Dados da empresa salvos com sucesso')
    })
  }

  function gerar() {
    const e = validar()
    setErros(e)
    if (e.length > 0) return

    const empresa = buildEmpresa()

    // Salva silenciosamente ao gerar
    startSave(async () => { await saveCnabConfig(empresa) })

    const pagamentos: PagamentoCNAB[] = orders.map(order => {
      const prod = producerMap.get(order.producer_id)!
      return {
        ordemNumero:    order.order_number,
        nomeFavorecido: prod.full_name,
        cpfCnpj:        prod.cpf_cnpj ?? undefined,
        banco:          prod.bank_name   ?? '',
        agencia:        prod.bank_agency ?? '',
        conta:          prod.bank_account ?? '',
        pixKey:         prod.pix_key ?? undefined,
        valor:          Number(order.amount),
        dataPagamento:  new Date(dataPgto + 'T12:00:00'),
      }
    })

    try {
      const conteudo = gerarCNAB240Itau(empresa, pagamentos)
      const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      const hoje = new Date().toISOString().split('T')[0].replace(/-/g, '')
      a.href     = url
      a.download = `CNAB240_ITAU_${hoje}.rem`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Arquivo CNAB 240 gerado com ${orders.length} pagamento${orders.length > 1 ? 's' : ''}`)
      onClose()
    } catch (err) {
      toast.error('Erro ao gerar arquivo: ' + String(err))
    }
  }

  const nPix = orders.filter(o => !!producerMap.get(o.producer_id)?.pix_key?.trim()).length
  const nTed = orders.length - nPix
  const keyLabel: Record<string, string> = { '01': 'tel', '02': 'email', '03': 'cpf/cnpj', '04': 'aleat.' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2.5">
            <Building2 className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="font-semibold text-gray-900">Exportar CNAB 240 — Itaú</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {orders.length} ordem{orders.length > 1 ? 's' : ''} selecionada{orders.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Dados da empresa pagadora */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Dados da empresa pagadora
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">CNPJ</label>
                  <Input value={cnpj} onChange={e => setCnpj(e.target.value)}
                    placeholder="00.000.000/0001-00" className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Razão Social</label>
                  <Input value={nome} onChange={e => setNome(e.target.value)}
                    placeholder="BILHETERIA EXPRESS" className="h-8 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Agência Itaú</label>
                  <Input value={agencia} onChange={e => setAgencia(e.target.value)}
                    placeholder="1234" className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Dígito ag.</label>
                  <Input value={digitoAg} onChange={e => setDigitoAg(e.target.value)}
                    placeholder="5" className="h-8 text-sm" maxLength={1} />
                </div>
                <div className="col-span-1" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Conta Corrente</label>
                  <Input value={conta} onChange={e => setConta(e.target.value)}
                    placeholder="12345" className="h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Dígito ct.</label>
                  <Input value={digitoCt} onChange={e => setDigitoCt(e.target.value)}
                    placeholder="6" className="h-8 text-sm" maxLength={1} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline" size="sm"
                  onClick={handleSalvar}
                  disabled={saving}
                  className="text-xs h-7 gap-1.5"
                >
                  <Save className="h-3 w-3" />
                  {saving ? 'Salvando…' : 'Salvar dados da empresa'}
                </Button>
              </div>
            </div>
          </div>

          {/* Data de pagamento */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
              Data de Pagamento
            </label>
            <Input type="date" value={dataPgto} onChange={e => setDataPgto(e.target.value)}
              className="h-8 text-sm w-44" />
            <p className="text-xs text-gray-400 mt-1">Próximo dia útil sugerido automaticamente</p>
          </div>

          {/* Resumo PIX / TED */}
          {nPix > 0 && nTed > 0 && (
            <div className="flex gap-2 text-xs">
              <span className="bg-green-50 text-green-700 border border-green-200 rounded px-2 py-1 font-medium">
                {nPix} via PIX
              </span>
              <span className="bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-1 font-medium">
                {nTed} via TED
              </span>
              <span className="text-gray-400 self-center">— lotes separados no arquivo</span>
            </div>
          )}

          {/* Lista de pagamentos */}
          <div className="bg-gray-50 rounded-lg border divide-y max-h-40 overflow-y-auto">
            {orders.map(order => {
              const prod   = producerMap.get(order.producer_id)
              const isPix  = !!prod?.pix_key?.trim()
              const kType  = isPix ? detectPixKeyType(prod!.pix_key!) : null
              return (
                <div key={order.id} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="font-mono text-blue-700 font-semibold">{order.order_number}</span>
                  <span className="text-gray-600 truncate mx-2 flex-1">{prod?.full_name ?? '—'}</span>
                  {isPix
                    ? <span className="text-green-600 font-medium mr-2 whitespace-nowrap">PIX {kType ? keyLabel[kType] : ''}</span>
                    : <span className="text-blue-600 font-medium mr-2">TED</span>
                  }
                  <span className="font-semibold text-gray-800 whitespace-nowrap">
                    {Number(order.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Erros */}
          {erros.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-red-700 text-xs font-semibold mb-1">
                <AlertCircle className="h-3.5 w-3.5" /> Corrija antes de gerar:
              </div>
              {erros.map((e, i) => (
                <p key={i} className="text-xs text-red-600">• {e}</p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={gerar} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Download className="h-4 w-4 mr-1.5" />
            Gerar arquivo .rem
          </Button>
        </div>
      </div>
    </div>
  )
}
