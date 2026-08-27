import path from 'path'
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { formatCurrency } from '@/lib/utils/format'
import { CATEGORY_LABELS } from '@/lib/types'
import type { OrdemPagamentoData } from '@/lib/ordemPagamento'

const LOGO_PATH = path.join(process.cwd(), 'public', 'logo-bilheteria-express.png')

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: 'Helvetica', color: '#111827' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, marginBottom: 18, borderBottomWidth: 2, borderBottomColor: '#111827' },
  logo: { height: 40, objectFit: 'contain' },
  titleBlock: { alignItems: 'flex-end' },
  eyebrow: { fontSize: 7, letterSpacing: 1.5, textTransform: 'uppercase', color: '#9ca3af', marginBottom: 2 },
  title: { fontSize: 16, fontWeight: 700, textTransform: 'uppercase', color: '#111827' },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  orderNumber: { fontFamily: 'Courier-Bold', fontSize: 11, backgroundColor: '#111827', color: '#ffffff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  muted: { color: '#6b7280', fontSize: 8 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 7, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#9ca3af', marginBottom: 6 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: '50%', marginBottom: 3 },
  label: { color: '#6b7280' },
  value: { fontWeight: 700, color: '#111827' },
  table: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  trHead: { flexDirection: 'row', backgroundColor: '#f9fafb', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  th: { padding: 5, fontWeight: 700, color: '#4b5563', fontSize: 8 },
  td: { padding: 5, fontSize: 8, color: '#374151' },
  right: { textAlign: 'right' },
  center: { textAlign: 'center' },
  green: { color: '#15803d', fontWeight: 700 },
  red: { color: '#dc2626' },
  totalBox: { borderWidth: 2, borderColor: '#86efac', backgroundColor: '#f0fdf4', borderRadius: 8, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 7, letterSpacing: 1, textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, marginBottom: 2 },
  totalValue: { fontSize: 20, fontWeight: 700, color: '#15803d' },
  footer: { marginTop: 28, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#e5e7eb', flexDirection: 'row', gap: 24 },
  footerCol: { flex: 1 },
  signLine: { borderTopWidth: 1, borderTopColor: '#9ca3af', paddingTop: 3, marginTop: 24, fontSize: 8, color: '#6b7280' },
})

export function OrdemPagamentoDocument({ order, producer, events, entries, periodDeductions }: OrdemPagamentoData) {
  const totalCredits = entries.filter(e => e.entry_type === 'credito').reduce((s, e) => s + Number(e.amount), 0)
  const totalDebits  = entries.filter(e => e.entry_type === 'debito').reduce((s, e) => s + Number(e.amount), 0)
  const totalDeductions = periodDeductions.reduce((s, e) => s + Number(e.amount), 0)
  const totalAPagar  = Math.round(Number(order.amount) * 100) / 100

  const debitsByEvent = entries.reduce<Record<string, number>>((acc, e) => {
    if (e.entry_type === 'debito' && e.event_id) {
      acc[e.event_id] = (acc[e.event_id] ?? 0) + Number(e.amount)
    }
    return acc
  }, {})

  const emittedAt = fmtDate(order.created_at.split('T')[0])
  const paidAt    = order.paid_at ? fmtDate(order.paid_at.split('T')[0]) : null

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <Image src={LOGO_PATH} style={styles.logo} />
          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>Conta Corrente de Produtor Cultural</Text>
            <Text style={styles.title}>Ordem de Pagamento</Text>
            <View style={styles.orderRow}>
              <Text style={styles.orderNumber}>{order.order_number}</Text>
              <Text style={styles.muted}>Emissão: {emittedAt}</Text>
            </View>
            {order.period_from && (
              <Text style={[styles.muted, { marginTop: 2 }]}>
                Período: {fmtDate(order.period_from)}{order.period_to ? ` a ${fmtDate(order.period_to)}` : ''}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Produtor</Text>
          <View style={styles.grid2}>
            <View style={styles.gridItem}>
              <Text><Text style={styles.label}>Nome: </Text><Text style={styles.value}>{producer.full_name}</Text></Text>
            </View>
            {producer.pix_key && (
              <View style={styles.gridItem}><Text><Text style={styles.label}>PIX: </Text><Text style={styles.value}>{producer.pix_key}</Text></Text></View>
            )}
            {producer.bank_name && (
              <View style={styles.gridItem}><Text><Text style={styles.label}>Banco: </Text><Text style={styles.value}>{producer.bank_name}</Text></Text></View>
            )}
            {producer.bank_agency && (
              <View style={styles.gridItem}>
                <Text><Text style={styles.label}>Ag / Conta: </Text><Text style={styles.value}>{producer.bank_agency}{producer.bank_account ? ` / ${producer.bank_account}` : ''}</Text></Text>
              </View>
            )}
            {producer.email && (
              <View style={styles.gridItem}><Text><Text style={styles.label}>E-mail: </Text><Text style={styles.value}>{producer.email}</Text></Text></View>
            )}
            {producer.phone && (
              <View style={styles.gridItem}><Text><Text style={styles.label}>Telefone: </Text><Text style={styles.value}>{producer.phone}</Text></Text></View>
            )}
          </View>
        </View>

        {events.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Eventos ({events.length})</Text>
            <View style={styles.table}>
              <View style={styles.trHead} fixed>
                <Text style={[styles.th, { width: '28%' }]}>Evento</Text>
                <Text style={[styles.th, { width: '14%' }, styles.center]}>Data</Text>
                <Text style={[styles.th, { width: '16%' }, styles.right]}>Bruto</Text>
                <Text style={[styles.th, { width: '16%' }, styles.right]}>Despesas</Text>
                <Text style={[styles.th, { width: '16%' }, styles.right]}>Líquido</Text>
                <Text style={[styles.th, { width: '10%' }, styles.center]}>Status</Text>
              </View>
              {events.map(ev => (
                <View style={styles.tr} key={ev.id} wrap={false}>
                  <Text style={[styles.td, { width: '28%' }]}>{ev.name}</Text>
                  <Text style={[styles.td, { width: '14%' }, styles.center]}>{fmtDate(ev.event_date)}</Text>
                  <Text style={[styles.td, { width: '16%' }, styles.right]}>{formatCurrency(ev.gross_revenue)}</Text>
                  <Text style={[styles.td, { width: '16%' }, styles.right, styles.red]}>−{formatCurrency(debitsByEvent[ev.id] ?? 0)}</Text>
                  <Text style={[styles.td, { width: '16%' }, styles.right, styles.green]}>{formatCurrency(ev.net_amount)}</Text>
                  <Text style={[styles.td, { width: '10%' }, styles.center]}>{ev.status === 'pending' ? 'Pendente' : 'Liquidado'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {entries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Conta Corrente</Text>
            <View style={styles.table}>
              <View style={styles.trHead} fixed>
                <Text style={[styles.th, { width: '15%' }]}>Data</Text>
                <Text style={[styles.th, { width: '40%' }]}>Descrição</Text>
                <Text style={[styles.th, { width: '25%' }]}>Categoria</Text>
                <Text style={[styles.th, { width: '20%' }, styles.right]}>Valor</Text>
              </View>
              {entries.map(e => (
                <View style={styles.tr} key={e.id} wrap={false}>
                  <Text style={[styles.td, { width: '15%' }]}>{fmtDate(e.date)}</Text>
                  <Text style={[styles.td, { width: '40%' }]}>{e.description}</Text>
                  <Text style={[styles.td, { width: '25%' }]}>{CATEGORY_LABELS[e.category] ?? e.category}</Text>
                  <Text style={[styles.td, { width: '20%' }, styles.right, e.entry_type === 'credito' ? styles.green : styles.red]}>
                    {e.entry_type === 'credito' ? '+' : '−'} {formatCurrency(Number(e.amount))}
                  </Text>
                </View>
              ))}
              <View style={[styles.tr, { backgroundColor: '#f9fafb' }]}>
                <Text style={[styles.td, { width: '80%' }]}>Total créditos</Text>
                <Text style={[styles.td, { width: '20%' }, styles.right, styles.green]}>+{formatCurrency(totalCredits)}</Text>
              </View>
              <View style={[styles.tr, { backgroundColor: '#f9fafb', borderBottomWidth: 0 }]}>
                <Text style={[styles.td, { width: '80%' }]}>Total débitos</Text>
                <Text style={[styles.td, { width: '20%' }, styles.right, styles.red]}>−{formatCurrency(totalDebits)}</Text>
              </View>
            </View>
          </View>
        )}

        {periodDeductions.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>Descontos do Período</Text>
            <View style={[styles.table, { borderColor: '#fecaca' }]}>
              <View style={[styles.trHead, { backgroundColor: '#fef2f2', borderBottomColor: '#fecaca' }]} fixed>
                <Text style={[styles.th, { width: '15%' }]}>Data</Text>
                <Text style={[styles.th, { width: '40%' }]}>Descrição</Text>
                <Text style={[styles.th, { width: '25%' }]}>Categoria</Text>
                <Text style={[styles.th, { width: '20%' }, styles.right]}>Desconto</Text>
              </View>
              {periodDeductions.map(e => (
                <View style={[styles.tr, { borderBottomColor: '#fef2f2' }]} key={e.id} wrap={false}>
                  <Text style={[styles.td, { width: '15%' }]}>{fmtDate(e.date)}</Text>
                  <Text style={[styles.td, { width: '40%' }]}>{e.description}</Text>
                  <Text style={[styles.td, { width: '25%' }]}>{CATEGORY_LABELS[e.category] ?? e.category}</Text>
                  <Text style={[styles.td, { width: '20%' }, styles.right, styles.red]}>− {formatCurrency(Number(e.amount))}</Text>
                </View>
              ))}
              <View style={[styles.tr, { backgroundColor: '#fef2f2', borderBottomWidth: 0 }]}>
                <Text style={[styles.td, { width: '80%' }]}>Total de descontos</Text>
                <Text style={[styles.td, { width: '20%' }, styles.right, styles.red]}>− {formatCurrency(totalDeductions)}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.totalBox}>
          <Text style={styles.muted}>
            {order.status === 'paid' ? `Pagamento confirmado em ${paidAt}` : 'Aguardando confirmação do pagamento no banco'}
          </Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.totalLabel}>
              {totalAPagar >= 0 ? 'Total a Pagar ao Produtor' : 'Total Devedor do Produtor'}
            </Text>
            <Text style={styles.totalValue}>{formatCurrency(Math.abs(totalAPagar))}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerCol}>
            <Text style={styles.muted}>Assinatura do Responsável</Text>
            <Text style={styles.signLine}>Data: ___/___/______</Text>
          </View>
          <View style={styles.footerCol}>
            <Text style={styles.muted}>Assinatura do Produtor</Text>
            <Text style={styles.signLine}>Data: ___/___/______</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
