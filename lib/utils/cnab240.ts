// Gerador CNAB 240 — Itaú SISPAG (versão 085, outubro/2020)
// Layout: Pagamentos a fornecedores via TED (Serviço 20, Forma 41, Segmento A)

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
// Para Itaú (341/409): 0 + agência(4) + branco + 000000 + conta(6) + branco + DAC(1)
// Para outros bancos (TED 41): agência(5) + branco + conta(12) + branco + DAC(1)
function buildAgenciaConta(bankCode: string, ag: string, ct: string, dct: string): string {
  if (bankCode === '341' || bankCode === '409') {
    return '0' + ag.slice(-4) + ' ' + '000000' + ct.slice(-6) + ' ' + a(dct, 1)
  }
  return n(ag, 5) + ' ' + n(ct, 12) + ' ' + a(dct, 1)
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
  cpfCnpj?: string     // CPF ou CNPJ do favorecido (obrigatório para TED — NOTA 15)
  banco: string        // nome ou código COMPE
  agencia: string      // "1234" ou "1234-5"
  conta: string        // "12345" ou "12345-6"
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
  const [empAg, ] = parseAgency(empresa.agencia + (empresa.digitoAgencia ? `-${empresa.digitoAgencia}` : ''))
  const [empCt, empDct] = parseAccount(empresa.conta + (empresa.digitoConta ? `-${empresa.digitoConta}` : ''))
  const LOTE = '0001'

  // ──────────────────────────────────────────────────────────────
  // HEADER DE ARQUIVO  (tipo 0) — pág. 12 do layout SISPAG 085
  // ──────────────────────────────────────────────────────────────
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
  linhas.push(hArq)

  // ──────────────────────────────────────────────────────────────
  // HEADER DE LOTE  (tipo 1) — pág. 13 do layout SISPAG 085
  // ──────────────────────────────────────────────────────────────
  const hLote =
    n('341', 3)               // 001-003  Código banco
    + n(LOTE, 4)              // 004-007  Lote
    + '1'                     // 008      Tipo registro
    + 'C'                     // 009      Tipo operação = Crédito
    + '20'                    // 010-011  Tipo pagamento = Fornecedores
    + '41'                    // 012-013  Forma pagamento = TED outro titular
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
  assertLen('Header lote', hLote)
  linhas.push(hLote)

  // ──────────────────────────────────────────────────────────────
  // SEGMENTOS A  (tipo 3) — pág. 15 do layout SISPAG 085
  // ──────────────────────────────────────────────────────────────
  let totalValor = 0
  pagamentos.forEach((pag, idx) => {
    const bankCode = resolveBank(pag.banco)
    const [ag, dag] = parseAgency(pag.agencia)
    const [ct, dct] = parseAccount(pag.conta)
    const agConta = buildAgenciaConta(bankCode, ag, ct, dct || dag)
    const seuNum = a(pag.ordemNumero.replace(/\D/g, '').padStart(20, '0').slice(-20), 20)
    const cpfCnpj = n((pag.cpfCnpj ?? '').replace(/\D/g, ''), 14)
    totalValor += pag.valor

    const seg =
      n('341', 3)               // 001-003  Código banco
      + n(LOTE, 4)              // 004-007  Lote
      + '3'                     // 008      Tipo registro = detalhe
      + n(String(idx + 1), 5)   // 009-013  Nº sequencial no lote
      + 'A'                     // 014      Segmento A
      + '000'                   // 015-017  Tipo movimento = inclusão (NOTA 10)
      + zr(3)                   // 018-020  Câmara (zeros = TED padrão, NOTA 35)
      + n(bankCode, 3)          // 021-023  Código banco favorecido
      + agConta                 // 024-043  Agência/Conta favorecido (NOTA 11)
      + a(pag.nomeFavorecido, 30) // 044-073 Nome favorecido
      + seuNum                  // 074-093  Seu número (nº doc empresa, 20 chars)
      + fmtDate(pag.dataPagamento) // 094-101 Data prevista pagamento
      + 'REA'                   // 102-104  Tipo moeda = Real
      + zr(8)                   // 105-112  Código ISPB (zeros = TED COMPE, NOTA 35)
      + br(2)                   // 113-114  Identificação transferência (brancos = TED)
      + zr(5)                   // 115-119  Zeros
      + fmtValor(pag.valor, 15) // 120-134  Valor previsto do pagamento
      + br(15)                  // 135-149  Nosso número (brancos em remessa)
      + br(5)                   // 150-154  Brancos (NOTA 42)
      + zr(8)                   // 155-162  Data efetiva (zeros em remessa)
      + zr(15)                  // 163-177  Valor efetivo (zeros em remessa)
      + br(20)                  // 178-197  Finalidade detalhe (brancos)
      + zr(6)                   // 198-203  Nº documento banco (zeros em remessa)
      + cpfCnpj                 // 204-217  CPF/CNPJ favorecido (NOTA 15)
      + br(2)                   // 218-219  Finalidade DOC e status funcionário
      + '00005'                 // 220-224  Finalidade TED = Pagamento de Fornecedores (NOTA 26)
      + br(5)                   // 225-229  Brancos
      + '0'                     // 230      Aviso ao favorecido (0 = não emite)
      + br(10)                  // 231-240  Ocorrências (brancos em remessa)
    assertLen(`Segmento A #${idx + 1}`, seg)
    linhas.push(seg)
  })

  const qtdDetalhes = pagamentos.length
  // Trailer de lote: conta registros tipo 1 + tipo 3 + tipo 5 (NOTA 17)
  const qtdRegistrosLote = 1 + qtdDetalhes + 1

  // ──────────────────────────────────────────────────────────────
  // TRAILER DE LOTE  (tipo 5) — pág. 24 do layout SISPAG 085
  // ──────────────────────────────────────────────────────────────
  const tLote =
    n('341', 3)               // 001-003  Código banco
    + n(LOTE, 4)              // 004-007  Lote
    + '5'                     // 008      Tipo registro = trailer lote
    + br(9)                   // 009-017  Brancos
    + n(String(qtdRegistrosLote), 6) // 018-023 Qtd registros do lote
    + fmtValor(totalValor, 18) // 024-041  Soma valor pagamentos (9(16)V9(2))
    + zr(18)                  // 042-059  Zeros
    + br(171)                 // 060-230  Brancos
    + br(10)                  // 231-240  Ocorrências (brancos em remessa)
  assertLen('Trailer lote', tLote)
  linhas.push(tLote)

  // +1 para o próprio trailer arquivo
  const qtdRegistrosArquivo = linhas.length + 1

  // ──────────────────────────────────────────────────────────────
  // TRAILER DE ARQUIVO  (tipo 9) — pág. 43 do layout SISPAG 085
  // ──────────────────────────────────────────────────────────────
  const tArq =
    n('341', 3)               // 001-003  Código banco
    + n('9999', 4)            // 004-007  Lote = 9999
    + '9'                     // 008      Tipo registro = trailer arquivo
    + br(9)                   // 009-017  Brancos
    + n('1', 6)               // 018-023  Qtd lotes
    + n(String(qtdRegistrosArquivo), 6) // 024-029 Qtd registros arquivo
    + br(211)                 // 030-240  Brancos
  assertLen('Trailer arquivo', tArq)
  linhas.push(tArq)

  return linhas.join('\r\n') + '\r\n'
}
