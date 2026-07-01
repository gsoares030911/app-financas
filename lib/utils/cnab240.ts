// Gerador CNAB 240 — Itaú SISPAG (versão 085, outubro/2020)
// Lote TED: Serviço 20, Forma 41 (Segmento A)
// Lote PIX: Serviço 20, Forma 45 (Segmentos A + B)

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

// NOTA 11 — Agência Conta Favorecido (posições 024-043, 20 bytes)
// Itaú (341/409): 0 + ag(4) + ' ' + 000000 + ct(6) + ' ' + DAC
// Outros bancos: ag(5) + ' ' + ct(12) + ' ' + DAC
function buildAgenciaConta(bankCode: string, ag: string, ct: string, dct: string): string {
  if (bankCode === '341' || bankCode === '409') {
    return '0' + ag.slice(-4) + ' ' + '000000' + ct.slice(-6) + ' ' + a(dct, 1)
  }
  return n(ag, 5) + ' ' + n(ct, 12) + ' ' + a(dct, 1)
}

// Detecta tipo de chave PIX (NOTA 37)
// 01=telefone 02=email 03=CPF/CNPJ 04=chave aleatória
export function detectPixKeyType(key: string): '01' | '02' | '03' | '04' {
  const clean = key.trim()
  if (clean.includes('@')) return '02'
  const digits = clean.replace(/\D/g, '')
  if (digits.length === 11 || digits.length === 14) return '03'
  if (digits.length >= 10 && digits.length <= 13 && /^\+?[\d\s()\-]+$/.test(clean)) return '01'
  return '04'
}

function assertLen(label: string, linha: string) {
  if (linha.length !== 240) throw new Error(`${label}: esperado 240 chars, gerado ${linha.length}`)
}

export interface EmpresaConfig {
  cnpj: string         // "00.000.000/0001-00"
  nome: string         // razão social (até 30 chars)
  agencia: string      // "1234" ou "1234-5"
  digitoAgencia: string
  conta: string        // "12345" ou "12345-6"
  digitoConta: string
}

export interface PagamentoCNAB {
  ordemNumero: string
  nomeFavorecido: string
  cpfCnpj?: string     // CPF/CNPJ do favorecido (obrigatório para TED — NOTA 15)
  banco: string        // nome ou código COMPE (ignorado em PIX)
  agencia: string      // "1234" (ignorado em PIX via chave)
  conta: string        // "12345" (ignorado em PIX via chave)
  pixKey?: string      // chave PIX — se informada, usa lote PIX (forma 45)
  valor: number
  dataPagamento: Date
}

// ──────────────────────────────────────────────────────────────
// Construtores de registros
// ──────────────────────────────────────────────────────────────

function buildHeaderArquivo(empresa: EmpresaConfig, cnpj: string, empAg: string, empCt: string, empDct: string, now: Date): string {
  const hArq =
    n('341', 3)               // 001-003  Código banco
    + n('0', 4)               // 004-007  Lote = 0000
    + '0'                     // 008      Tipo registro
    + br(6)                   // 009-014  Brancos
    + '080'                   // 015-017  Versão layout arquivo
    + '2'                     // 018      Tipo inscrição = CNPJ
    + n(cnpj, 14)             // 019-032  CNPJ empresa
    + br(20)                  // 033-052  Brancos
    + n(empAg, 5)             // 053-057  Agência debitada
    + ' '                     // 058      Branco
    + n(empCt, 12)            // 059-070  Conta debitada
    + ' '                     // 071      Branco
    + a(empDct, 1)            // 072      DAC agência/conta
    + a(empresa.nome, 30)     // 073-102  Nome empresa
    + a('BANCO ITAU SA', 30)  // 103-132  Nome banco
    + br(10)                  // 133-142  Brancos
    + '1'                     // 143      Arquivo-código remessa
    + fmtDate(now)            // 144-151  Data geração
    + fmtTime(now)            // 152-157  Hora geração
    + zr(9)                   // 158-166  Zeros
    + zr(5)                   // 167-171  Densidade (zeros = teleprocessamento)
    + br(69)                  // 172-240  Brancos
  assertLen('Header arquivo', hArq)
  return hArq
}

function buildHeaderLote(loteNum: string, forma: string, empresa: EmpresaConfig, cnpj: string, empAg: string, empCt: string, empDct: string): string {
  const hLote =
    n('341', 3)               // 001-003  Código banco
    + n(loteNum, 4)           // 004-007  Lote
    + '1'                     // 008      Tipo registro
    + 'C'                     // 009      Tipo operação = Crédito
    + '20'                    // 010-011  Tipo pagamento = Fornecedores
    + forma                   // 012-013  Forma pagamento (41=TED, 45=PIX)
    + '040'                   // 014-016  Versão layout lote
    + ' '                     // 017      Branco
    + '2'                     // 018      Tipo inscrição = CNPJ
    + n(cnpj, 14)             // 019-032  CNPJ empresa
    + br(4)                   // 033-036  Identificação lançamento (brancos)
    + br(16)                  // 037-052  Brancos
    + n(empAg, 5)             // 053-057  Agência debitada
    + ' '                     // 058      Branco
    + n(empCt, 12)            // 059-070  Conta debitada
    + ' '                     // 071      Branco
    + a(empDct, 1)            // 072      DAC agência/conta
    + a(empresa.nome, 30)     // 073-102  Nome empresa
    + br(30)                  // 103-132  Finalidade lote (brancos)
    + br(10)                  // 133-142  Histórico C/C debitada
    + br(30)                  // 143-172  Endereço empresa
    + zr(5)                   // 173-177  Número (zeros)
    + br(15)                  // 178-192  Complemento
    + br(20)                  // 193-212  Cidade
    + zr(8)                   // 213-220  CEP (zeros)
    + br(2)                   // 221-222  Estado
    + br(8)                   // 223-230  Brancos
    + br(10)                  // 231-240  Ocorrências (brancos em remessa)
  assertLen(`Header lote ${loteNum}`, hLote)
  return hLote
}

function buildSegmentoA_TED(loteNum: string, seq: number, pag: PagamentoCNAB): string {
  const bankCode  = resolveBank(pag.banco)
  const [ag, dag] = parseAgency(pag.agencia)
  const [ct, dct] = parseAccount(pag.conta)
  const agConta   = buildAgenciaConta(bankCode, ag, ct, dct || dag)
  const seuNum    = a(pag.ordemNumero.replace(/\D/g, '').padStart(20, '0').slice(-20), 20)
  const cpfCnpj   = n((pag.cpfCnpj ?? '').replace(/\D/g, ''), 14)

  const seg =
    n('341', 3)               // 001-003
    + n(loteNum, 4)           // 004-007
    + '3'                     // 008
    + n(String(seq), 5)       // 009-013  Nº sequencial
    + 'A'                     // 014
    + '000'                   // 015-017  Tipo movimento = inclusão
    + zr(3)                   // 018-020  Câmara (zeros = TED padrão, NOTA 35)
    + n(bankCode, 3)          // 021-023  Banco favorecido
    + agConta                 // 024-043  Agência/Conta (NOTA 11)
    + a(pag.nomeFavorecido, 30) // 044-073 Nome favorecido
    + seuNum                  // 074-093  Seu número
    + fmtDate(pag.dataPagamento) // 094-101 Data pagamento
    + 'REA'                   // 102-104  Tipo moeda
    + zr(8)                   // 105-112  ISPB (zeros, NOTA 35)
    + br(2)                   // 113-114  Identificação transferência (brancos = TED)
    + zr(5)                   // 115-119  Zeros
    + fmtValor(pag.valor, 15) // 120-134  Valor
    + br(15)                  // 135-149  Nosso número (brancos em remessa)
    + br(5)                   // 150-154  Brancos
    + zr(8)                   // 155-162  Data efetiva (zeros em remessa)
    + zr(15)                  // 163-177  Valor efetivo (zeros em remessa)
    + br(20)                  // 178-197  Finalidade detalhe
    + zr(6)                   // 198-203  Nº documento banco (zeros em remessa)
    + cpfCnpj                 // 204-217  CPF/CNPJ favorecido (NOTA 15)
    + br(2)                   // 218-219  Finalidade DOC e status funcionário
    + '00005'                 // 220-224  Finalidade TED = Fornecedores (NOTA 26)
    + br(5)                   // 225-229  Brancos
    + '0'                     // 230      Aviso ao favorecido
    + br(10)                  // 231-240  Ocorrências (brancos em remessa)
  assertLen(`Segmento A TED #${seq}`, seg)
  return seg
}

function buildSegmentoA_PIX(loteNum: string, seq: number, pag: PagamentoCNAB): string {
  const seuNum  = a(pag.ordemNumero.replace(/\D/g, '').padStart(20, '0').slice(-20), 20)
  const cpfCnpj = n((pag.cpfCnpj ?? '').replace(/\D/g, ''), 14)
  // PIX via chave: agência/conta é opcional — zeros/espaços
  const agConta = zr(5) + ' ' + zr(12) + ' ' + ' '

  const seg =
    n('341', 3)               // 001-003
    + n(loteNum, 4)           // 004-007
    + '3'                     // 008
    + n(String(seq), 5)       // 009-013
    + 'A'                     // 014
    + '000'                   // 015-017  Tipo movimento = inclusão
    + '009'                   // 018-020  Câmara = SPI/PIX (NOTA 35)
    + '009'                   // 021-023  Banco = SPI (PIX)
    + agConta                 // 024-043  Agência/Conta (opcional para PIX via chave)
    + a(pag.nomeFavorecido, 30) // 044-073 Nome favorecido
    + seuNum                  // 074-093  Seu número
    + fmtDate(pag.dataPagamento) // 094-101 Data pagamento
    + 'REA'                   // 102-104  Tipo moeda
    + zr(8)                   // 105-112  ISPB (zeros para PIX via chave)
    + '04'                    // 113-114  Identificação transferência = Chave PIX (NOTA 36)
    + zr(5)                   // 115-119  Zeros
    + fmtValor(pag.valor, 15) // 120-134  Valor
    + br(15)                  // 135-149  Nosso número (brancos em remessa)
    + br(5)                   // 150-154  Brancos
    + zr(8)                   // 155-162  Data efetiva (zeros em remessa)
    + zr(15)                  // 163-177  Valor efetivo (zeros em remessa)
    + br(20)                  // 178-197  Finalidade detalhe
    + zr(6)                   // 198-203  Nº documento banco
    + cpfCnpj                 // 204-217  CPF/CNPJ favorecido
    + br(2)                   // 218-219  Finalidade DOC e status
    + br(5)                   // 220-224  Finalidade TED (brancos em PIX)
    + br(5)                   // 225-229  Brancos
    + '0'                     // 230      Aviso ao favorecido
    + br(10)                  // 231-240  Ocorrências
  assertLen(`Segmento A PIX #${seq}`, seg)
  return seg
}

// Segmento B PIX — obrigatório (pág. 18 do layout SISPAG 085)
function buildSegmentoB_PIX(loteNum: string, seq: number, pag: PagamentoCNAB): string {
  const pixKey     = pag.pixKey ?? ''
  const keyType    = detectPixKeyType(pixKey)
  const cpfCnpjRaw = (pag.cpfCnpj ?? '').replace(/\D/g, '')
  const tipoInscr  = cpfCnpjRaw.length === 14 ? '2' : '1'
  const cpfCnpj    = n(cpfCnpjRaw, 14)

  const segB =
    n('341', 3)               // 001-003
    + n(loteNum, 4)           // 004-007
    + '3'                     // 008
    + n(String(seq), 5)       // 009-013  Mesmo nº do Segmento A correspondente (NOTA 9)
    + 'B'                     // 014
    + keyType                 // 015-016  Tipo chave PIX (NOTA 37)
    + ' '                     // 017      Branco
    + tipoInscr               // 018      Tipo inscrição favorecido (1=CPF, 2=CNPJ)
    + cpfCnpj                 // 019-032  CPF/CNPJ favorecido
    + br(30)                  // 033-062  Brancos
    + zr(65)                  // 063-127  Informações entre usuários (zeros)
    + a(pixKey, 100)          // 128-227  Chave PIX
    + br(3)                   // 228-230  Brancos
    + br(10)                  // 231-240  Ocorrências (brancos em remessa)
  assertLen(`Segmento B PIX #${seq}`, segB)
  return segB
}

function buildTrailerLote(loteNum: string, qtdRegistros: number, totalValor: number): string {
  const tLote =
    n('341', 3)               // 001-003
    + n(loteNum, 4)           // 004-007
    + '5'                     // 008      Tipo registro = trailer lote
    + br(9)                   // 009-017  Brancos
    + n(String(qtdRegistros), 6) // 018-023 Qtd registros do lote (NOTA 17)
    + fmtValor(totalValor, 18) // 024-041  Soma valores (9(16)V9(2))
    + zr(18)                  // 042-059  Zeros
    + br(171)                 // 060-230  Brancos
    + br(10)                  // 231-240  Ocorrências (brancos em remessa)
  assertLen(`Trailer lote ${loteNum}`, tLote)
  return tLote
}

// ──────────────────────────────────────────────────────────────
// Função principal
// ──────────────────────────────────────────────────────────────

export function gerarCNAB240Itau(empresa: EmpresaConfig, pagamentos: PagamentoCNAB[]): string {
  if (!pagamentos.length) throw new Error('Nenhum pagamento informado')

  const now  = new Date()
  const cnpj = empresa.cnpj.replace(/\D/g, '')
  const [empAg, ] = parseAgency(empresa.agencia + (empresa.digitoAgencia ? `-${empresa.digitoAgencia}` : ''))
  const [empCt, empDct] = parseAccount(empresa.conta + (empresa.digitoConta ? `-${empresa.digitoConta}` : ''))

  const tedPagamentos = pagamentos.filter(p => !p.pixKey?.trim())
  const pixPagamentos = pagamentos.filter(p =>  p.pixKey?.trim())

  const linhas: string[] = []
  linhas.push(buildHeaderArquivo(empresa, cnpj, empAg, empCt, empDct, now))

  let numLotes = 0

  // ── Lote PIX (forma 45) ───────────────────────────────────
  if (pixPagamentos.length > 0) {
    numLotes++
    const loteNum = String(numLotes).padStart(4, '0')
    linhas.push(buildHeaderLote(loteNum, '45', empresa, cnpj, empAg, empCt, empDct))

    let totalPix = 0
    pixPagamentos.forEach((pag, idx) => {
      const seq = idx + 1
      totalPix += pag.valor
      linhas.push(buildSegmentoA_PIX(loteNum, seq, pag))
      linhas.push(buildSegmentoB_PIX(loteNum, seq, pag))
    })

    // Header(1) + A+B por pagamento + Trailer(1)
    const qtdRegistros = 1 + pixPagamentos.length * 2 + 1
    linhas.push(buildTrailerLote(loteNum, qtdRegistros, totalPix))
  }

  // ── Lote TED (forma 41) ───────────────────────────────────
  if (tedPagamentos.length > 0) {
    numLotes++
    const loteNum = String(numLotes).padStart(4, '0')
    linhas.push(buildHeaderLote(loteNum, '41', empresa, cnpj, empAg, empCt, empDct))

    let totalTed = 0
    tedPagamentos.forEach((pag, idx) => {
      const seq = idx + 1
      totalTed += pag.valor
      linhas.push(buildSegmentoA_TED(loteNum, seq, pag))
    })

    // Header(1) + A por pagamento + Trailer(1)
    const qtdRegistros = 1 + tedPagamentos.length + 1
    linhas.push(buildTrailerLote(loteNum, qtdRegistros, totalTed))
  }

  // ── Trailer de Arquivo ────────────────────────────────────
  const qtdRegistrosArquivo = linhas.length + 1
  const tArq =
    n('341', 3)               // 001-003
    + n('9999', 4)            // 004-007  Lote = 9999
    + '9'                     // 008      Tipo registro = trailer arquivo
    + br(9)                   // 009-017  Brancos
    + n(String(numLotes), 6)  // 018-023  Qtd lotes
    + n(String(qtdRegistrosArquivo), 6) // 024-029 Qtd registros
    + br(211)                 // 030-240  Brancos
  assertLen('Trailer arquivo', tArq)
  linhas.push(tArq)

  return linhas.join('\r\n') + '\r\n'
}
