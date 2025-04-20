import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import auth from '@fastify/auth'
import bearerAuthPlugin from '@fastify/bearer-auth'
import { oauth2 } from './google'
import { BrowserWindow } from 'electron'
import { handleGcm } from './pushReceiver'
import { JoinData } from '../preload/types'

declare module 'fastify' {
  export interface FastifyInstance {
    verifyTokenInSearchParams: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

let currentFastify: FastifyInstance
async function checkTokenInfo(token: string | undefined) {
  if (!token) return false

  const info = await oauth2.tokeninfo({ oauth_token: token })
  return !!(info.data.expires_in && info.data.expires_in > 0)
}

async function config(win: BrowserWindow) {
  const fastify = Fastify({
    logger: true,
    https: {
      // TODO: accept this certificate on frontend
      cert: `-----BEGIN CERTIFICATE-----
MIIDCTCCAfGgAwIBAgIUFCWNSTUhoYVBoN0Mvreh4pGpkCIwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI1MDQxOTE5MzQwMloXDTI1MDUx
OTE5MzQwMlowFDESMBAGA1UEAwwJbG9jYWxob3N0MIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAhnuYjSbVIomMYt3/KKZv4IswvfT/E+jZO4FfGRWfZLk7
3Htz7raCQwOPwz6Avfg2NHx//ntX/+/F9C0MFytA35jiebU/u3lAxTqdoAg6zyCp
UgJvASvwQ/Uuq8fT8sde424LiOzBnTtKFYTLaTBqwkuYOWaInqeKTe0BjWhtN1Ap
IDewmccxHP7vPd8U5l4t7i9LucxoJRmeWq9+oHmbLmZK7Abyf8/ueMS9bNw8RJj0
MS1K3jtv+abdWk0jY8vb4w8+ZfDENhozRTL3qc24XcLRuf3xD1aU2cNY0kFIRIwW
oVpsFe5B6sUn4U72LwbaEp6cKtc1fwglEMxlZrcGMwIDAQABo1MwUTAdBgNVHQ4E
FgQU+7rKzbrlmN/KfDS5Zw3xpULJbNMwHwYDVR0jBBgwFoAU+7rKzbrlmN/KfDS5
Zw3xpULJbNMwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAGDZ0
yOLQEdlKZT+wQ7qaDi0u/N9/ir/7BF+OjQgkU/qudKEMPR9OniUcFMKhQCwcU3/f
2DWxkJnVPS+wdn+N1F3J/DKiZ6wy2QVEQL8PWgaPMrfeMbt1Ygt5Y81WKkU1C0CG
7pHWbZZ/UOYW7s5xsbubHL4d19he5OT42ICzfc7NEsK1fp7po6giMY6/xbkkkAUu
bb66jlpyppnZvZLNPTcW63w9KLIJ3s3iozdfnK1HPLylfiR8BClmZlemlrkw7MQk
VH4qDu6cnLr+kbpU3UXOXfzaaYtSS2Ato+kbtBylPr4E/UwEiHIJaDRkzIaTjiQb
ut3hJCBnf1l8Xwj/gw==
-----END CERTIFICATE-----`,
      key: `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCGe5iNJtUiiYxi
3f8opm/gizC99P8T6Nk7gV8ZFZ9kuTvce3PutoJDA4/DPoC9+DY0fH/+e1f/78X0
LQwXK0DfmOJ5tT+7eUDFOp2gCDrPIKlSAm8BK/BD9S6rx9Pyx17jbguI7MGdO0oV
hMtpMGrCS5g5Zoiep4pN7QGNaG03UCkgN7CZxzEc/u893xTmXi3uL0u5zGglGZ5a
r36geZsuZkrsBvJ/z+54xL1s3DxEmPQxLUreO2/5pt1aTSNjy9vjDz5l8MQ2GjNF
MvepzbhdwtG5/fEPVpTZw1jSQUhEjBahWmwV7kHqxSfhTvYvBtoSnpwq1zV/CCUQ
zGVmtwYzAgMBAAECggEAFS2EhgHuAXzYsz8TbgLbzmgM+nUI8Ek0YGcMo0Yg7jsv
XpbAWIC8PbJjYtNGceQTISvT+i7RWlgXe87WPxXMJwoL7C+rRCohlY2YAfoZzMFv
eJ8yfOQ+92y2d03GJk7YNgd/4IWsLccG8SGS6NM7lLJT3AI2FIn8wS3IF00xGcsW
5CZP1n54Yk+pyK4ryjnMH6Q+6yv2zi+vFZGCfNgJdjT9SqWisUgoMSxFpni7hjVA
ZYboEbzKN/ITtbprv2zoQw50v4fHxNUjXRU8DAXgWCUDtwSOSxKnACjcYs/+TtNW
r1gt6AcEThzb9O8XzCjqIn89t+1lXEexRiY+h0dQwQKBgQC802sjWeEDBGdybfSw
PmidQBU2NJ4anOHITxctLoh9K7ktKzF7IIFxVPiByoQ0DBIAXLjvn7hkw09W+bum
oIGm23uNQxm1A3QJT5shOB27/2m+73aEwHy6+ax1iAmZhqAg7Zk6Zq97n8G9am8V
2X/t/3A0CP4g/CAL6+YiuwkOwQKBgQC2UxguuPojgn7alDYJadhpHhyzEjzG8ueY
/nIt11TpncIgR6z2tfdy3/HRILpvA6LUp892efxBKEUnJ9ky/yDKYaNyrWzGYUW6
xyGDvOK9eZZbjkiI4VNrJobRvG9kQcgN5RhdcqYEY52m0e60Nk3/8igQUX7bcW4h
dS4tmSRF8wKBgH2qtsLwLjAz3iTpyM8CudztqTBKFG7hueH1wRbwwSWM09CbznKD
T6J9SmYWwaVh4xkanHndcnqdAVCBI8HhUGgb6j45SgKOKcuIj1WsYx2a/mV0OQxg
jqJhR8Vwo/LpBejkN/YGIQPFbssA6q0/80QRnDsFQRvyr+E/PgofMAgBAoGAecvg
p7WiQ/50x4ei4X73tqELAwT33N9/n1C67ayfaMCeYfn/rX+5od/AJrf6UxbWu8Cu
crLitJQ2PgX8rniIayn2ijEYLR3l+vPzi5Gu1mxW6SqPggEkPLwr7Ag5UXwwLDgS
orpn9R6mvj4XfAOa75PQ97W5TNblfyxMgOGAvckCgYBy7paNXYLs336YbUnMDKjd
P5/IZ7AzYJDyohlDqaBK/dWVh2GkzHdDSHxPLxCE3wfQhvBuWw2gj9lZa7D13QPb
U7ez5s6I/FhDi+Fmn/7NMHHrCPUJYcH+icKHNNffW9lq6J01QOk6ut9uIYubgVxv
lQP0yPLNeHqObxDmNGeRqA==
-----END PRIVATE KEY-----`,
    },
  })
  await fastify.register(cors)
  fastify.decorate('verifyTokenInSearchParams', async (req, _rep) => {
    // @ts-ignore: I can't type this correctly
    const { token } = req.query
    const isValid = await checkTokenInfo(token)
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
    async function handler(req, rep) {
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
  await currentFastify.close()
}
