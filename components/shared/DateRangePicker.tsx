'use client'

import { useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarDays, ChevronDown, X } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { ptBR } from 'date-fns/locale'
import {
  startOfMonth, endOfMonth, startOfYear, endOfYear,
  subMonths, subDays, startOfWeek, endOfWeek,
} from 'date-fns'
import { cn } from '@/lib/utils'

interface Props {
  value?: DateRange
  onChange: (range: DateRange | undefined) => void
  placeholder?: string
  align?: 'start' | 'end' | 'center'
  className?: string
}

function today() { return new Date() }

const PRESETS = [
  { label: 'Hoje', range: () => { const t = today(); return { from: t, to: t } } },
  { label: 'Esta semana', range: () => ({ from: startOfWeek(today(), { weekStartsOn: 0 }), to: endOfWeek(today(), { weekStartsOn: 0 }) }) },
  { label: 'Este mês', range: () => ({ from: startOfMonth(today()), to: endOfMonth(today()) }) },
  { label: 'Mês anterior', range: () => { const p = subMonths(today(), 1); return { from: startOfMonth(p), to: endOfMonth(p) } } },
  { label: 'Últimos 30 dias', range: () => ({ from: subDays(today(), 29), to: today() }) },
  { label: 'Últimos 90 dias', range: () => ({ from: subDays(today(), 89), to: today() }) },
  { label: 'Este ano', range: () => ({ from: startOfYear(today()), to: endOfYear(today()) }) },
]

function fmt(d: Date) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function DateRangePicker({ value, onChange, placeholder = 'Selecionar período', align = 'start', className }: Props) {
  const [open, setOpen] = useState(false)
  const [temp, setTemp] = useState<DateRange | undefined>(value)

  const midSelection = !!(temp?.from && !temp?.to)

  function handleOpenChange(o: boolean) {
    // Impede fechar enquanto só a data inicial foi selecionada
    if (!o && midSelection) return
    setOpen(o)
    if (o) setTemp(value)
  }

  function handleCalendarSelect(range: DateRange | undefined) {
    // react-day-picker sets from===to on first click — tratar como "só início selecionado"
    if (range?.from && range?.to && range.from.toDateString() === range.to.toDateString()) {
      setTemp({ from: range.from, to: undefined })
      return
    }
    setTemp(range)
    if (range?.from && range?.to) {
      onChange(range)
      setOpen(false)
    }
  }

  function handlePreset(preset: typeof PRESETS[number]) {
    const r = preset.range()
    setTemp(r)
    onChange(r)
    setOpen(false)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    setTemp(undefined)
    onChange(undefined)
  }

  const hasValue = !!value?.from

  const label = value?.from
    ? value.to
      ? `${fmt(value.from)} – ${fmt(value.to)}`
      : fmt(value.from)
    : placeholder

  const defaultMonth = value?.from ? subMonths(value.from, 1) : subMonths(today(), 1)

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        className={cn(
          'inline-flex items-center gap-1.5 h-8 px-3 text-sm rounded-md border font-normal transition-colors select-none',
          hasValue
            ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
          className
        )}
      >
        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
        <span>{label}</span>
        {hasValue ? (
          <span onClick={handleClear} className="ml-0.5 p-0.5 rounded-full hover:bg-blue-200 cursor-pointer">
            <X className="h-3 w-3" />
          </span>
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        )}
      </PopoverTrigger>

      <PopoverContent
        align={align}
        sideOffset={8}
        className="w-auto p-0 flex shadow-lg"
      >
        {/* Presets */}
        <div className="flex flex-col gap-0.5 p-2 border-r min-w-[140px]">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 pt-1 pb-2">
            Atalhos
          </p>
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => handlePreset(p)}
              className="text-left text-sm px-2 py-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-700 whitespace-nowrap"
            >
              {p.label}
            </button>
          ))}
          <div className="border-t mt-1 pt-1">
            <button
              onClick={() => { setTemp(undefined); onChange(undefined); setOpen(false) }}
              className="w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-400 whitespace-nowrap"
            >
              Todo período
            </button>
          </div>
        </div>

        {/* Calendar + status */}
        <div className="p-3">
          {/* Barra de status */}
          <div className="flex items-center gap-2 mb-3">
            <div className={cn(
              'flex-1 text-center rounded-md px-2 py-1.5 text-xs font-medium border',
              temp?.from
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-gray-50 border-gray-200 text-gray-400'
            )}>
              {temp?.from ? fmt(temp.from) : 'Data inicial'}
            </div>
            <span className="text-gray-300">→</span>
            <div className={cn(
              'flex-1 text-center rounded-md px-2 py-1.5 text-xs font-medium border',
              temp?.to
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : midSelection
                  ? 'bg-orange-50 border-orange-400 text-orange-600'
                  : 'bg-gray-50 border-gray-200 text-gray-400'
            )}>
              {temp?.to ? fmt(temp.to) : midSelection ? '← clique aqui no calendário' : 'Data final'}
            </div>
          </div>

          <Calendar
            mode="range"
            selected={temp}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
            locale={ptBR}
            defaultMonth={defaultMonth}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
