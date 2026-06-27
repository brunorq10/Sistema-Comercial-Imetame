'use client'

import { useRef, useState } from 'react'

export interface AnexoNovo { nome: string; tipo: string; url: string; tamanho: number }

const MAX_FILE = 2 * 1024 * 1024   // 2 MB por arquivo
const MAX_TOTAL = 3 * 1024 * 1024  // 3 MB no total (limite de payload da plataforma)

const IconFile = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><polyline points="14 2 14 8 20 8" />
  </svg>
)
const IconUpload = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

interface Props {
  value: AnexoNovo[]
  onChange: (next: AnexoNovo[]) => void
  onError?: (msg: string) => void
  hint?: string
  accept?: string
}

function readFile(f: File): Promise<AnexoNovo> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve({ nome: f.name, tipo: f.type || 'application/octet-stream', url: String(r.result), tamanho: f.size })
    r.onerror = reject
    r.readAsDataURL(f)
  })
}

export function AnexosUploader({ value, onChange, onError, hint, accept = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt' }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const lerArquivos = async (files: FileList | null) => {
    if (!files) return
    let total = value.reduce((s, a) => s + a.tamanho, 0)
    const aceitos: File[] = []
    for (const f of Array.from(files)) {
      if (f.size > MAX_FILE) { onError?.(`"${f.name}" excede 2 MB.`); continue }
      if (total + f.size > MAX_TOTAL) { onError?.('Tamanho total dos anexos excede 3 MB.'); break }
      total += f.size
      aceitos.push(f)
    }
    const lidos = await Promise.all(aceitos.map(readFile))
    if (lidos.length) onChange([...value, ...lidos])
  }

  const remover = (i: number) => onChange(value.filter((_, idx) => idx !== i))

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); lerArquivos(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={
          'border border-dashed rounded-lg px-4 py-5 text-center cursor-pointer transition-colors ' +
          (dragOver ? 'border-green-primary bg-green-light/40' : 'border-gray-300 hover:bg-gray-50')
        }
      >
        <IconUpload className="w-5 h-5 mx-auto text-gray-400 mb-1" />
        <p className="text-[11px] text-gray-600 font-semibold">Arraste arquivos ou clique para anexar</p>
        {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => { lerArquivos(e.target.files); e.target.value = '' }}
        />
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {value.map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-full pl-2 pr-1 py-1 text-[10px] text-gray-700">
              <IconFile className="w-3 h-3 text-gray-400" />
              <span className="max-w-[160px] truncate">{a.nome}</span>
              <button onClick={(e) => { e.stopPropagation(); remover(i) }} className="text-gray-400 hover:text-red-500 font-bold px-0.5" title="Remover">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
