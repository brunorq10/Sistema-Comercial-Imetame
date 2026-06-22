type ClassValue = string | number | boolean | null | undefined

export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(' ')
}

export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num)
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  // String só-data "YYYY-MM-DD": calendário puro, sem conversão de fuso
  if (typeof date === 'string') {
    const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (m) return `${m[3]}/${m[2]}/${m[1]}`
  }
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  // Datas-calendário são gravadas como meia-noite UTC → exibe na própria data (UTC).
  // Timestamps reais (created_at etc.) mantêm o fuso local.
  const midnightUTC =
    d.getUTCHours() === 0 && d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
  return new Intl.DateTimeFormat('pt-BR', midnightUTC ? { timeZone: 'UTC' } : undefined).format(d)
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d)
}

/** Data de hoje no fuso LOCAL, formato YYYY-MM-DD (para inputs <input type="date">). */
export function todayInput(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDateInput(date: Date | string | null | undefined): string {
  if (!date) return ''
  // String ISO/só-data: usa a parte da data diretamente (sem parse/fuso)
  if (typeof date === 'string') {
    const m = date.match(/^(\d{4}-\d{2}-\d{2})/)
    if (m) return m[1]
  }
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().split('T')[0]
}

export function gerarNumeroSolicitacao(sequencial: number): string {
  return `SOL-${String(sequencial).padStart(4, '0')}`
}

export function isAtrasado(prazo: Date | null | undefined): boolean {
  if (!prazo) return false
  return new Date(prazo) < new Date()
}

export function formatRev(versao: number): string {
  return `Rev${String(versao - 1).padStart(2, '0')}`
}

// Máscara de Nº OS no formato 0798.02.003 (4-2-3 dígitos)
export function maskOS(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 9)
  let out = d.slice(0, 4)
  if (d.length > 4) out += '.' + d.slice(4, 6)
  if (d.length > 6) out += '.' + d.slice(6, 9)
  return out
}

// Máscara de CNPJ no formato 07.986.997/0001-40 (14 dígitos)
export function maskCNPJ(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 14)
  let out = d.slice(0, 2)
  if (d.length > 2)  out += '.' + d.slice(2, 5)
  if (d.length > 5)  out += '.' + d.slice(5, 8)
  if (d.length > 8)  out += '/' + d.slice(8, 12)
  if (d.length > 12) out += '-' + d.slice(12, 14)
  return out
}
