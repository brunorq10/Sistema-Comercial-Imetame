import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const r = await p.paradaHhConfig.findFirst()
console.log(JSON.stringify(r, null, 2))
await p.$disconnect()
