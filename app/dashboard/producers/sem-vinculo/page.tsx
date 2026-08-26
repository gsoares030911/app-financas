import { AlertCircle } from 'lucide-react'

export default function SemVinculoPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="p-4 bg-yellow-50 rounded-full mb-4">
        <AlertCircle className="h-10 w-10 text-yellow-500" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Conta não configurada</h1>
      <p className="text-gray-500 text-sm max-w-sm">
        Seu perfil de produtor ainda não foi vinculado a uma conta corrente.
        Fale com o administrador para configurar seu acesso.
      </p>
    </div>
  )
}
