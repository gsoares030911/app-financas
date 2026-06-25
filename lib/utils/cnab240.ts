// Gerador CNAB 240 — Itaú (banco 341)
// Layout FEBRABAN para TED crédito em conta (Serviço 20, Segmento A)

const n = (val: string | number, len: number) =>
  String(val ?? '').replace(/\D/g, '').padStart(len, '0').slice(-len)

const a = (val: string, len: number) =>
  String(val ?? '').substring(0, len).padEnd(len, ' ')

const br = (len: number) => ' '.repeat(len)
const zr = (len: number) => '0'.repeat(len)

function fmtDate(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}${mm}${d.getFullYear()}`
}
function fmtTime(d: Date) {
  return `${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}`
}
function fmtValor(v: number, len: number) {
  return Math.round(Math.abs(v) * 100).toString().padStart(len, '0').slice(-len)
}

// Dicionário banco nome → código COMPE (3 dígitos)
export const BANK_COMPE: Record<string, string> = {
  '341': '341', 'itaú': '341', 'itau': '341', 'banco itaú': '341', 'banco itau': '341',
  '237': '237', 'bradesco': '237', 'banco bradesco': '237',
  '001': '001', 'banco do brasil': '001', 'bb': '001',
  '033': '033', 'santander': '033', 'banco santander': '033',
  '104': '104', 'caixa': '104', 'caixa econômica': '104', 'caixa econômica federal': '104', 'cef': '104',
  '260': '260', 'nubank': '260', 'nu pagamentos': '260', 'nu bank': '260',
  '077': '077', 'inter': '077', 'banco inter': '077',
  '748': '748', 'sicredi': '748',
  '756': '756', 'sicoob': '756', 'bancoob': '756',
  '212': '212', 'original': '212', 'banco original': '212',
  '336': '336', 'c6': '336', 'c6 bank': '336',
  '208': '208', 'btg': '208', 'btg pactual': '208',
  '290': '290', 'pagseguro': '290',
  '323': '323', 'mercado pago': '323',
  '380': '380', 'picpay': '380',
  '197': '197', 'stone': '197',
  '422': '422', 'safra': '422', 'banco safra': '422',
  '041': '041', 'banrisul': '041',
  '070': '070', 'brb': '070',
  '655': '655', 'votorantim': '655',
}

export function resolveBank(bankName: string): string {
  if (!bankName) return '000'
  const key = bankName.toLowerCase().trim()
  if (/^\d{3}$/.test(key)) return key
  return BANK_COMPE[key] ?? '000'
}

function parseAgency(raw: string): [agencia: string, digito: string] {
  const clean = (raw ?? '').replace(/\s/g, '')
  const match = clean.match(/^(\d+)[- ]?([0-9Xx]?)$/)
  if (!match) return ['00000', ' ']
  return [match[1].padStart(5, '0').slice(-5), (match[2] || ' ').toUpperCase()]
}

function parseAccount(raw: string): [conta: string, digito: string] {
  const clean = (raw ?? '').replace(/\s/g, '')
  const match = clean.match(/^(\d+)[- ]?([0-9Xx]?)$/)
  if (!match) return ['000000000000', ' ']
  return [match[1].padStart(12, '0').slice(-12), (match[2] || ' ').toUpperCase()]
}

export interface EmpresaConfig {
  cnpj: string         // "00.000.000/0001-00"
  nome: string         // razão social (até 20 chars)
  agencia: string      // "1234" ou "1234-5"
  digitoAgencia: string
  conta: string        // "12345" ou "12345-6"
  digitoConta: string
  convenio?: string    // opcional
}

export interface PagamentoCNAB {
  ordemNumero: string
  nomeFavorecido: string
  banco: string         // nome ou código COMPE
  agencia: string       // "1234" ou "1234-5"
  conta: string         // "12345" ou "12345-6"
  valor: number
  dataPagamento: Date
}

function assertLen(label: string, linha: string) {
  if (linha.length !== 240) throw new Error(`${label}: esperado 240 chars, gerado ${linha.length}`)
}

export function gerarCNAB240Itau(empresa: EmpresaConfig, pagamentos: PagamentoCNAB[]): string {
  if (!pagamentos.length) throw new Error('Nenhum pagamento informado')
  const now = new Date()
  const linhas: string[] = []
  const cnpj = empresa.cnpj.replace(/\D/g, '')
  const [empAg, empDag] = parseAgency(empresa.agencia + (empresa.digitoAgencia ? `-${empresa.digitoAgencia}` : ''))
  const [empCt, empDct] = parseAccount(empresa.conta + (empresa.digitoConta ? `-${empresa.digitoConta}` : ''))
  const conv = a(empresa.convenio ?? '', 20)
  const LOTE = '0001'
  const numLote = 1

  // ──────────────────────────────────────────────────────────────
  // HEADER DE ARQUIVO  (tipo 0)
  // ──────────────────────────────────────────────────────────────
  const hArq =
    n('341', 3)          // 001-003  Banco
    + n('0', 4)          // 004-007  Lote = 0000
    + '0'                // 008      Tipo registro
    + br(9)              // 009-017  Brancos
    + '0'                // 018      Versão CNAB
    + '02'               // 019-020  Tipo inscrição = CNPJ
    + n(cnpj, 14)        // 021-034  CNPJ empresa
    + conv               // 035-054  Convênio (20)
    + n(empAg, 5)        // 055-059  Agência
    + a(empDag, 1)       // 060      Dígito agência
    + n(empCt, 12)       // 061-072  Conta
    + a(empDct, 1)       // 073      Dígito conta
    + br(1)              // 074      Dígito ag/conta
    + a(empresa.nome, 20) // 075-094 Nome empresa
    + a('BANCO ITAU SA', 40) // 095-134 Nome banco
    + br(1)              // 135      Branco
    + fmtDate(now)       // 136-143  Data geração (8)
    + fmtTime(now)       // 144-149  Hora (6)
    + n('1', 7)          // 150-156  Sequencial arquivo
    + n('083', 3)        // 157-159  Versão layout
    + n('1600', 5)       // 160-164  Densidade
    + br(10)             // 165-174  Reservado banco
    + br(40)             // 175-214  Reservado empresa
    + br(26)             // 215-240  Brancos
  assertLen('Header arquivo', hArq)
  linhas.push(hArq)

  // ──────────────────────────────────────────────────────────────
  // HEADER DE LOTE  (tipo 1)
  // ──────────────────────────────────────────────────────────────
  const dataPgto = pagamentos[0].dataPagamento
  const hLote =
    n('341', 3)          // 001-003  Banco
    + n(LOTE, 4)         // 004-007  Lote
    + '1'                // 008      Tipo registro
    + 'C'                // 009      Operação = Crédito
    + n('20', 2)         // 010-011  Serviço = 20 (TED)
    + n('01', 2)         // 012-013  Forma lançamento = 01 (TED Outro Banco)
    + n('030', 3)        // 014-016  Versão layout lote
    + br(1)              // 017      Branco
    + n('02', 2)         // 018-019  Tipo inscrição empresa
    + n(cnpj, 14)        // 020-033  CNPJ empresa
    + conv               // 034-053  Convênio (20)
    + n(empAg, 5)        // 054-058  Agência
    + a(empDag, 1)       // 059      Dígito agência
    + n(empCt, 12)       // 060-071  Conta
    + a(empDct, 1)       // 072      Dígito conta
    + br(1)              // 073      Dígito ag/conta
    + a(empresa.nome, 20) // 074-093 Nome empresa
    + br(40)             // 094-133  Mensagem/histórico
    + fmtDate(dataPgto)  // 134-141  Data pagamento (8)
    + zr(8)              // 142-149  Data crédito (zeros)
    + br(8)              // 150-157  Moeda (brancos)
    + br(5)              // 158-162  Brancos
    + n('1', 7)          // 163-169  Sequencial arquivo
    + br(10)             // 170-179  Reservado banco
    + br(30)             // 180-209  Histórico crédito
    + br(20)             // 210-229  Endereço empresa
    + zr(5)              // 230-234  Número endereço
    + br(6)              // 235-240  Complemento
  assertLen('Header lote', hLote)
  linhas.push(hLote)

  // ──────────────────────────────────────────────────────────────
  // SEGMENTOS A  (tipo 3, segmento A) — um por pagamento
  // ──────────────────────────────────────────────────────────────
  let totalValor = 0
  pagamentos.forEach((pag, idx) => {
    const bankCode = resolveBank(pag.banco)
    const [ag, dag] = parseAgency(pag.agencia)
    const [ct, dct] = parseAccount(pag.conta)
    const docNum = pag.ordemNumero.replace(/\D/g, '').padStart(16, '0').slice(-16)
    totalValor += pag.valor

    const seg =
      n('341', 3)          // 001-003  Banco
      + n(LOTE, 4)         // 004-007  Lote
      + '3'                // 008      Tipo registro = detalhe
      + n(String(idx + 1), 5) // 009-013 Sequencial no lote
      + 'A'                // 014      Segmento A
      + '0'                // 015      Tipo movimento = inclusão
      + n('00', 2)         // 016-017  Código instrução
      + n(bankCode, 3)     // 018-020  Banco do favorecido
      + n(ag, 5)           // 021-025  Agência favorecido
      + a(dag, 1)          // 026      Dígito agência
      + n(ct, 12)          // 027-038  Conta favorecido
      + a(dct, 1)          // 039      Dígito conta
      + br(1)              // 040      Dígito ag/conta
      + a(pag.nomeFavorecido, 20) // 041-060 Nome favorecido
      + a(docNum, 16)      // 061-076  Nº documento empresa
      + fmtDate(pag.dataPagamento) // 077-084 Data pagamento (8)
      + 'BRL'              // 085-087  Tipo moeda
      + zr(5)              // 088-092  Qtd moeda
      + fmtValor(pag.valor, 15)  // 093-107 Valor (15)
      + br(15)             // 108-122  Nº doc banco (brancos)
      + zr(8)              // 123-130  Data real efetivação
      + zr(15)             // 131-145  Valor real efetivado
      + br(15)             // 146-160  Outras informações
      + 'OU'               // 161-162  Complemento tipo serviço
      + 'CC'               // 163-164  Tipo serviço = conta corrente
      + br(10)             // 165-174  Uso FEBRABAN
      + zr(12)             // 175-186  ISPB (zeros = TED COMPE)
      + a('PAGAMENTO AO PRODUTOR', 23) // 187-209 Finalidade TED
      + br(1)              // 210      Uso FEBRABAN
      + zr(2)              // 211-212  Finalidade complementar
      + '0'                // 213      Aviso ao favorecido
      + zr(9)              // 214-222  CPF/CNPJ favorecido
      + br(18)             // 223-240  Uso FEBRABAN
    assertLen(`Segmento A #${idx + 1}`, seg)
    linhas.push(seg)
  })

  const qtdDetalhes = pagamentos.length
  const qtdRegistrosLote = 2 + qtdDetalhes // header + segmentos + trailer

  // ──────────────────────────────────────────────────────────────
  // TRAILER DE LOTE  (tipo 5)
  // ──────────────────────────────────────────────────────────────
  const tLote =
    n('341', 3)          // 001-003  Banco
    + n(LOTE, 4)         // 004-007  Lote
    + '5'                // 008      Tipo registro = trailer lote
    + br(9)              // 009-017  Uso FEBRABAN
    + n(String(qtdRegistrosLote + 1), 6)  // 018-023 Qtd registros lote
    + fmtValor(totalValor, 18)   // 024-041 Somatória valores (18)
    + zr(18)             // 042-059  Somatória qtd moeda
    + zr(6)              // 060-065  Número aviso débito
    + br(165)            // 066-230  Uso FEBRABAN
    + br(10)             // 231-240  Uso FEBRABAN
  assertLen('Trailer lote', tLote)
  linhas.push(tLote)

  const qtdRegistrosArquivo = linhas.length + 1 // +1 para o próprio trailer arquivo

  // ──────────────────────────────────────────────────────────────
  // TRAILER DE ARQUIVO  (tipo 9)
  // ──────────────────────────────────────────────────────────────
  const tArq =
    n('341', 3)          // 001-003  Banco
    + n('9999', 4)       // 004-007  Lote = 9999
    + '9'                // 008      Tipo registro = trailer arquivo
    + br(9)              // 009-017  Uso FEBRABAN
    + n(String(numLote), 6)  // 018-023 Qtd lotes
    + n(String(qtdRegistrosArquivo), 6) // 024-029 Qtd registros arquivo
    + zr(6)              // 030-035  Qtd contas
    + br(205)            // 036-240  Uso FEBRABAN
  assertLen('Trailer arquivo', tArq)
  linhas.push(tArq)

  return linhas.join('\r\n') + '\r\n'
}
