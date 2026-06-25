'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Eye, EyeOff, KeyRound, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function ChangePasswordForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      toast.error('As senhas não coincidem.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      toast.error('Erro ao alterar senha: ' + error.message)
      return
    }

    setPassword('')
    setConfirm('')
    setDone(true)
    toast.success('Senha alterada com sucesso!')
  }

  return (
    <div className="bg-white rounded-xl border p-6 max-w-md">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
          <KeyRound className="h-4 w-4 text-blue-600" />
        </div>
        <h2 className="font-semibold text-gray-900">Alterar senha</h2>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Defina uma nova senha de acesso para a sua conta.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-password">Nova senha</Label>
          <div className="relative">
            <Input
              id="new-password"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setDone(false) }}
              placeholder="Mínimo 6 caracteres"
              className="pr-10"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShow(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirmar nova senha</Label>
          <Input
            id="confirm-password"
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setDone(false) }}
            placeholder="Repita a nova senha"
            required
            minLength={6}
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : done
              ? <><CheckCircle className="h-4 w-4 mr-1.5" /> Senha alterada</>
              : 'Salvar nova senha'}
        </Button>
      </form>
    </div>
  )
}
