import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TrendingUp, Shield, BarChart3, Download, ArrowRight } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">FinançasPRO</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link href="/register">
              <Button>Criar conta grátis</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-3 py-1 rounded-full mb-6">
          <span>✨</span>
          <span>Controle financeiro simples e visual</span>
        </div>
        <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
          Suas finanças sob controle,<br />
          <span className="text-blue-600">de verdade</span>
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          Registre receitas e despesas, visualize seu saldo em tempo real e tome decisões financeiras com confiança.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/register">
            <Button size="lg" className="gap-2">
              Começar gratuitamente <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              Já tenho conta
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Tudo que você precisa para organizar seu dinheiro
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <BarChart3 className="h-8 w-8 text-blue-600" />,
                title: 'Dashboard Visual',
                desc: 'Veja receitas, despesas e saldo com gráficos claros e objetivos.',
              },
              {
                icon: <TrendingUp className="h-8 w-8 text-green-600" />,
                title: 'Controle de Transações',
                desc: 'Cadastre e categorize cada receita e despesa com facilidade.',
              },
              {
                icon: <Shield className="h-8 w-8 text-purple-600" />,
                title: 'Dados Seguros',
                desc: 'Autenticação robusta e dados isolados por usuário (RLS).',
              },
              {
                icon: <Download className="h-8 w-8 text-orange-600" />,
                title: 'Exportar CSV',
                desc: 'Exporte suas transações filtradas para análise em planilhas.',
              },
            ].map((f, i) => (
              <div key={i} className="bg-white p-6 rounded-xl border shadow-sm">
                <div className="mb-4">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
          Categorias pré-definidas
        </h2>
        <p className="text-center text-gray-500 mb-10">
          Organize seus gastos e receitas de forma inteligente
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Educação', 'Salário', 'Freelance', 'Outros'].map(
            (cat) => (
              <span
                key={cat}
                className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
              >
                {cat}
              </span>
            )
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-20">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Pronto para organizar suas finanças?
          </h2>
          <p className="text-blue-100 mb-8">
            Crie sua conta gratuitamente e comece agora mesmo.
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary" className="gap-2">
              Criar conta gratuita <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-gray-400 text-sm">
          © {new Date().getFullYear()} FinançasPRO — Gestão financeira pessoal
        </div>
      </footer>
    </div>
  )
}
