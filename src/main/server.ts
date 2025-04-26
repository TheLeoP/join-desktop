import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import auth from '@fastify/auth'
import bearerAuthPlugin from '@fastify/bearer-auth'
import { oauth2 } from './google'
import { BrowserWindow } from 'electron'
import { handleGcm } from './pushReceiver'
import type { JoinData } from '../preload/types'
import { ownCertificate, ownPrivateKey } from './consts'

declare module 'fastify' {
  export interface FastifyInstance {
    verifyTokenInSearchParams: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

let currentFastify: FastifyInstance | undefined
async function checkTokenInfo(token: string | undefined) {
  if (!token) return false

  const info = await oauth2.tokeninfo({ oauth_token: token })
  return !!(info.data.expires_in && info.data.expires_in > 0)
}

async function config(win: BrowserWindow) {
  const fastify = Fastify({
    logger: false,
    https: {
      cert: ownCertificate,
      key: ownPrivateKey,
    },
  })
  await fastify.register(cors)
  fastify.decorate('verifyTokenInSearchParams', async (req, _rep) => {
    // @ts-ignore: I can't type this correctly
    const { token } = req.query
    const isValid = await checkTokenInfo(token)
    // TODO: this is returning some JSON, how to change it's shape?
    if (!isValid) throw new Error('token is invalid')
  })
  await fastify.register(auth)
  await fastify.register(bearerAuthPlugin, {
    keys: new Set<string>(),
    auth: async (key, _req) => {
      return await checkTokenInfo(key)
    },
    addHook: false,
  })
  if (!fastify.verifyBearerAuth) throw new Error('verifyBearerAuth not defined')
  fastify.addHook(
    'preHandler',
    fastify.auth([fastify.verifyBearerAuth, fastify.verifyTokenInSearchParams]),
  )

  fastify.post(
    '/gcm',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              userAuthError: { type: 'boolean' },
              errorMessage: { type: 'string' },
            },
            required: ['success', 'userAuthError'],
          },
        },
        request: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            json: { type: 'string' },
          },
        },
      },
    },
    async function handler(req, _rep) {
      handleGcm(req.body as JoinData, win)
      return { success: true, userAuthError: false }
    },
  )
  fastify.get('/acceptcertificate', async function handler(_req, _rep) {
    return 'Everything done'
  })
  currentFastify = fastify
  return fastify
}

export async function start(win: BrowserWindow) {
  const fastify = await config(win)
  try {
    return await fastify.listen({ port: 0, host: '0.0.0.0' })
  } catch (err) {
    fastify.log.error(err)
    return
  }
}

export async function stop() {
  if (!currentFastify) return
  await currentFastify.close()
}
