import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { loginRateLimit } from '@/lib/rate-limit'
import type { Perfil } from '@prisma/client'

declare module 'next-auth' {
  interface User {
    perfil: Perfil
    is_analista_critico: boolean
  }
  interface Session {
    user: {
      id: string
      nome: string
      email: string
      perfil: Perfil
      is_analista_critico: boolean
    }
  }
}


const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const email = parsed.data.email

        // A6: verificar bloqueio por tentativas excessivas
        const rlBefore = loginRateLimit.check(email)
        if (rlBefore.locked) return null

        const user = await prisma.user.findUnique({ where: { email } })

        if (!user || !user.ativo) {
          loginRateLimit.increment(email)
          return null
        }

        const passwordOk = await compare(parsed.data.password, user.password_hash)
        if (!passwordOk) {
          loginRateLimit.increment(email)
          return null
        }

        loginRateLimit.reset(email)
        return {
          id: String(user.id),
          name: user.nome,
          email: user.email,
          perfil: user.perfil,
          is_analista_critico: user.is_analista_critico,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const t = token as any
        t.id = user.id as string
        t.nome = user.name as string
        t.perfil = user.perfil
        t.is_analista_critico = user.is_analista_critico
      }
      return token
    },
    session({ session, token }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = token as any
      session.user.id = t.id as string
      session.user.nome = t.nome as string
      session.user.perfil = t.perfil as Perfil
      session.user.is_analista_critico = t.is_analista_critico as boolean
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
})