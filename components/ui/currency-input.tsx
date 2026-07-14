'use client'

import { useState, useEffect } from 'react'
import { Input } from './input'
import { cn } from '@/lib/utils'

interface Props {
  value: string | number | undefined
  onValueChange: (raw: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  required?: boolean
  readOnly?: boolean
  suffix?: React.ReactNode
}

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function valueToCents(value: string | number | undefined): number {
  if (value === '' || value === undefined || value === null) return 0
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'))
  if (isNaN(num) || num === 0) return 0
  return Math.round(num * 100)
}

export function CurrencyInput({
  value, onValueChange, placeholder = '0,00', className, readOnly, suffix, ...props
}: Props) {
  const [display, setDisplay] = useState('')
  const [focused, setFocused] = useState(false)

  // Sincroniza do valor externo quando o campo não está em foco
  useEffect(() => {
    if (!focused) {
      const c = valueToCents(value)
      setDisplay(c > 0 ? centsToBRL(c) : '')
    }
  }, [value, focused])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Extrai apenas dígitos — comportamento ATM (centavos da direita para esquerda)
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) {
      setDisplay('')
      onValueChange('')
      return
    }
    const cents = parseInt(digits, 10)
    setDisplay(centsToBRL(cents))
    onValueChange(String(cents / 100))
  }

  function handleFocus() {
    setFocused(true)
  }

  function handleBlur() {
    setFocused(false)
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none pointer-events-none">
        R$
      </span>
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        readOnly={readOnly}
        value={display}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={cn('pl-9', suffix ? 'pr-14' : '', className)}
      />
      {suffix && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  )
}
