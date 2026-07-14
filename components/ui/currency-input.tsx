'use client'

import { useState, useEffect, useRef } from 'react'
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

function toDisplay(value: string | number | undefined): string {
  if (value === '' || value === undefined || value === null) return ''
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'))
  if (isNaN(num)) return ''
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseDisplay(display: string): string {
  return display
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.]/g, '')
}

export function CurrencyInput({ value, onValueChange, placeholder = '0,00', className, readOnly, suffix, ...props }: Props) {
  const [display, setDisplay] = useState('')
  const typing = useRef(false)

  useEffect(() => {
    if (typing.current) return
    setDisplay(toDisplay(value))
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    typing.current = true
    const filtered = e.target.value.replace(/[^0-9,.]/g, '')
    setDisplay(filtered)
    onValueChange(parseDisplay(filtered))
  }

  function handleBlur() {
    typing.current = false
    const raw = parseDisplay(display)
    setDisplay(raw && !isNaN(parseFloat(raw)) ? toDisplay(raw) : '')
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none pointer-events-none">
        R$
      </span>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        readOnly={readOnly}
        value={display}
        onChange={handleChange}
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
