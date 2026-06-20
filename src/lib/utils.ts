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
