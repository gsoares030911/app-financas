'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, Loader2, MailCheck, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('As senhas não coincidem.')
      return
    }
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    setRegisteredEmail(email)
    setEmailSent(true)
    setLoading(false)
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-2 mb-8">
            <TrendingUp className="h-7 w-7 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">FinançasPRO</span>
          </div>
          <Card className="dark:bg-gray-900 dark:border-gray-800">
            <CardContent className="pt-8 pb-8">
              <div className="flex flex-col items-center text-center gap-4">
                {/* Ícone */}
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950 rounded-full flex items-center justify-center">
                  <MailCheck className="h-8 w-8 text-blue-600" />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                    Confirme seu e-mail
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Enviamos um link de confirmação para:
                  </p>
                  <p className="font-semibold text-gray-800 dark:text-gray-200 mt-1">
                    {registeredEmail}
                  </p>
                </div>

                <div className="w-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-left">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-amber-800 dark:text-amber-300">
                      <p className="font-semibold mb-1">Não encontrou o e-mail?</p>
                      <p>Verifique sua <strong>caixa de spam</strong> ou lixo eletrônico — às vezes o e-mail de confirmação cai por lá.</p>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Após confirmar, clique no link do e-mail para ativar sua conta e acessar o app.
                </p>

                <Link href="/login" className="w-full">
                  <Button className="w-full">
                    Ir para o Login
                  </Button>
                </Link>

                <button
                  onClick={() => setEmailSent(false)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Usar outro e-mail
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <TrendingUp className="h-7 w-7 text-blue-600" />
          <span className="text-2xl font-bold text-gray-900 dark:text-white">FinançasPRO</span>
        </div>
        <Card className="dark:bg-gray-900 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="dark:text-white">Criar conta gratuita</CardTitle>
            <CardDescription className="dark:text-gray-400">Preencha os dados para começar a organizar suas finanças</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="dark:text-gray-300">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="dark:text-gray-300">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm" className="dark:text-gray-300">Confirmar senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="Repita sua senha"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar conta'}
              </Button>
            </form>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
              Já tem conta?{' '}
              <Link href="/login" className="text-blue-600 font-medium hover:underline">
                Entrar
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
