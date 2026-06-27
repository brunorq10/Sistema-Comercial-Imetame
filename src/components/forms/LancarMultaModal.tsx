'use client'

import { Modal } from '@/components/ui/Modal'
import { MultaForm, type MultaEdit } from '@/components/forms/MultaForm'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  contratoId: number
  subtitulo?: string
  editando?: MultaEdit | null
}

export function LancarMultaModal({ open, onClose, onSuccess, contratoId, subtitulo, editando }: Props) {
  if (!open) return null
  return (
    <Modal
      open={open}
      confirmClose
      onClose={onClose}
      title={editando ? 'Editar Multa/Penalidade' : 'Lançar Multa/Penalidade'}
      subtitle={subtitulo}
      wide
    >
      <MultaForm
        contratoId={contratoId}
        editando={editando}
        onSaved={() => { onSuccess(); onClose() }}
        onCancel={onClose}
      />
    </Modal>
  )
}
