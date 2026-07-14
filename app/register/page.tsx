import { redirect } from 'next/navigation'

export default function RegisterPage() {
  // Registro público desativado — novos usuários são criados pelo Admin.
  redirect('/login')
}
