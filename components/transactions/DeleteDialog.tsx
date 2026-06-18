'use client'

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: () => void
  description?: string
}

export default function DeleteDialog({ open, onOpenChange, onConfirm, description }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Excluir transação</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir <strong>&ldquo;{description}&rdquo;</strong>? Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} className="flex-1">
            Excluir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
