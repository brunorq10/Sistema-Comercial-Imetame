import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

interface EmailOptions {
  to: string
  subject: string
  html: string
}

// Disparo assíncrono — nunca bloqueia a action (RN-16)
export function sendEmailAsync(options: EmailOptions): void {
  transporter
    .sendMail({
      from: process.env.SMTP_FROM,
      ...options,
    })
    .catch((err) => logger.error('email', 'Falha ao enviar e-mail', err))
}

const DEDUP_WINDOW_MS = 3 * 60 * 1000 // M10: janela de 3 minutos para evitar duplicatas

// Cria notificação in-app no banco — suprime duplicatas com mesmo título para o mesmo usuário nos últimos 3 minutos
export async function createNotificacao(
  userId: number,
  titulo: string,
  mensagem: string,
  link?: string,
): Promise<void> {
  const since = new Date(Date.now() - DEDUP_WINDOW_MS)
  const existente = await prisma.notificacao.findFirst({
    where: { user_id: userId, titulo, created_at: { gte: since } },
    select: { id: true },
  }).catch(() => null)

  if (existente) return

  await prisma.notificacao.create({
    data: { user_id: userId, titulo, mensagem, link: link ?? null },
  }).catch((err) => logger.error('notificacao', 'Falha ao criar notificação', err))
}

export function emailNovaSolicitacao(para: string, numero: string, cliente: string): void {
  sendEmailAsync({
    to: para,
    subject: `[Imetame] Nova solicitação atribuída — ${numero}`,
    html: `
      <p>Uma nova solicitação de orçamento foi atribuída a você.</p>
      <p><strong>Número:</strong> ${numero}</p>
      <p><strong>Cliente:</strong> ${cliente}</p>
      <p>Acesse o sistema para visualizar os detalhes.</p>
    `,
  })
}

export function emailNovaRevisao(para: string, numero: string, revisao: number): void {
  sendEmailAsync({
    to: para,
    subject: `[Imetame] Nova revisão solicitada — ${numero}`,
    html: `
      <p>Uma nova revisão foi solicitada para o orçamento <strong>${numero}</strong>.</p>
      <p><strong>Revisão:</strong> Rev${String(revisao - 1).padStart(2, '0')}</p>
      <p>Acesse o painel para registrar as novas propostas técnica e comercial.</p>
    `,
  })
}

export function emailSolicitacaoAprovada(
  para: string,
  numero: string,
  cliente: string,
): void {
  sendEmailAsync({
    to: para,
    subject: `[Imetame] Solicitação aprovada — ${numero}`,
    html: `
      <p>A solicitação <strong>${numero}</strong> — ${cliente} foi aprovada pelo Analista Crítico e atribuída a você.</p>
      <p>Acesse o painel para visualizar os detalhes e iniciar a elaboração das propostas.</p>
    `,
  })
}

export function emailSolicitacaoReprovada(
  para: string,
  numero: string,
  cliente: string,
  motivo: string,
): void {
  sendEmailAsync({
    to: para,
    subject: `[Imetame] Solicitação agradecida — ${numero}`,
    html: `
      <p>A solicitação <strong>${numero}</strong> — ${cliente} foi agradecida pelo Analista Crítico.</p>
      <p><strong>Motivo:</strong> ${motivo}</p>
    `,
  })
}

export function emailStatusAlterado(
  para: string,
  numero: string,
  novoStatus: string,
): void {
  sendEmailAsync({
    to: para,
    subject: `[Imetame] Status atualizado — ${numero}`,
    html: `
      <p>O status da solicitação <strong>${numero}</strong> foi alterado para <strong>${novoStatus}</strong>.</p>
    `,
  })
}
