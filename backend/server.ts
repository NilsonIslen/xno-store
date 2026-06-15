import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createXnoPackage, packageAmounts } from '../src/packages'
import { paymentAccounts } from '../src/paymentAccounts'
import { xnoUnitPrices } from '../src/xnoUnitPrices'

type PaymentMethod = 'cop' | 'btc' | 'usdt'

type StoreOrder = {
  orderCode: string
  amountXno: number
  paymentMethod: PaymentMethod
  paymentInstruction: PaymentInstruction
  receiverAddress: string
  clientIp: string
  status: 'PENDING_PAYMENT' | 'PAID' | 'SENT' | 'CANCELLED'
  createdAt: string
}

type PaymentInstruction = {
  method: PaymentMethod
  label: string
  value: string
  amountToPay: number
  amountToPayFormatted: string
  instruction: string
}

const port = Number(process.env.XNO_STORE_API_PORT ?? 8787)
const __dirname = dirname(fileURLToPath(import.meta.url))
const ordersPath = join(__dirname, 'data', 'orders.json')
const orderCooldownMs = 60 * 60 * 1000

const nanoAddressPattern = /^(nano|xrb)_[13][13456789abcdefghijkmnopqrstuwxyz]{59}$/

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.XNO_STORE_ALLOWED_ORIGIN ?? '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const formatAmount = (method: PaymentMethod, value: number) => {
  if (method === 'cop') {
    return `${new Intl.NumberFormat('es-CO').format(value)} COP`
  }

  if (method === 'btc') {
    return `${value.toFixed(8)} BTC`
  }

  return `${value.toFixed(2)} USDT`
}

const sendJson = (response: ServerResponse, status: number, data: unknown) => {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    ...corsHeaders,
  })
  response.end(JSON.stringify(data))
}

const escapeHtml = (value: string | number) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const sendHtml = (response: ServerResponse, status: number, html: string) => {
  response.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    ...corsHeaders,
  })
  response.end(html)
}

const readBody = async (request: IncomingMessage) => {
  const chunks: Buffer[] = []

  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk))
  }

  if (!chunks.length) return {}

  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const getClientIp = (request: IncomingMessage) => {
  const forwardedFor = request.headers['x-forwarded-for']
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor

  return forwardedIp?.split(',')[0]?.trim() || request.socket.remoteAddress || 'unknown'
}

const readOrders = async () => {
  try {
    const content = await readFile(ordersPath, 'utf8')
    return JSON.parse(content) as StoreOrder[]
  } catch {
    return []
  }
}

const writeOrders = async (orders: StoreOrder[]) => {
  await mkdir(dirname(ordersPath), { recursive: true })
  await writeFile(ordersPath, `${JSON.stringify(orders, null, 2)}\n`)
}

const createOrderCode = () => {
  const timePart = Date.now().toString(36).toUpperCase()
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase()

  return `XNO-${timePart}-${randomPart}`
}

const getPackagesResponse = () => ({
  unitPrices: xnoUnitPrices,
  paymentAccounts,
  packages: packageAmounts.map((amount) => createXnoPackage(amount)),
})

const createPaymentInstructions = (amountXno: number) => {
  const selectedPackage = createXnoPackage(amountXno)

  return (Object.keys(paymentAccounts) as PaymentMethod[]).map((method) => {
    const amountToPay = selectedPackage.prices[method]
    const amountToPayFormatted = formatAmount(method, amountToPay)
    const paymentAccount = paymentAccounts[method]

    return {
      method,
      label: paymentAccount.label,
      value: paymentAccount.value,
      amountToPay,
      amountToPayFormatted,
      instruction: `${paymentAccount.instructionPrefix} ${amountToPayFormatted} ${paymentAccount.instructionConnector} ${paymentAccount.label} ${paymentAccount.value}`,
    }
  })
}

const createPaymentInstruction = (amountXno: number, method: PaymentMethod) =>
  createPaymentInstructions(amountXno).find((instruction) => instruction.method === method)!

const getOrderPaymentOptions = (order: StoreOrder) => {
  if (order.paymentInstruction) {
    return [order.paymentInstruction]
  }

  if ('paymentOptions' in order && Array.isArray(order.paymentOptions)) {
    return order.paymentOptions as PaymentInstruction[]
  }

  return createPaymentInstructions(order.amountXno)
}

const renderOrdersAdmin = (orders: StoreOrder[]) => `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pedidos XNO</title>
    <style>
      :root {
        color: #1f171b;
        background: #fbf7f4;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      body {
        margin: 0;
      }

      main {
        display: grid;
        gap: 18px;
        padding: clamp(18px, 4vw, 44px);
      }

      h1 {
        margin: 0;
        font-size: clamp(1.8rem, 5vw, 3rem);
        letter-spacing: 0;
      }

      .summary {
        color: #395f98;
        font-weight: 800;
      }

      .orders {
        display: grid;
        gap: 12px;
      }

      .order {
        display: grid;
        gap: 10px;
        padding: 14px;
        border: 1px solid rgba(32, 43, 48, 0.1);
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 16px 36px rgba(42, 54, 58, 0.08);
      }

      .order header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .order strong,
      .address {
        overflow-wrap: anywhere;
      }

      .status {
        padding: 5px 8px;
        border-radius: 999px;
        color: #1d4ed8;
        background: #eff6ff;
        font-size: 0.78rem;
        font-weight: 900;
      }

      dl {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 10px;
        margin: 0;
      }

      dt {
        color: #395f98;
        font-size: 0.78rem;
        font-weight: 900;
        text-transform: uppercase;
      }

      dd {
        margin: 3px 0 0;
        color: #514b50;
        font-weight: 700;
      }

      .empty {
        padding: 18px;
        border: 1px solid rgba(32, 43, 48, 0.1);
        border-radius: 8px;
        background: #ffffff;
      }
    </style>
  </head>
  <body>
    <main>
      <div>
        <h1>Pedidos XNO</h1>
        <p class="summary">${orders.length} pedido${orders.length === 1 ? '' : 's'}</p>
      </div>

      ${
        orders.length
          ? `<section class="orders" aria-label="Pedidos">
              ${orders
                .map(
                  (order) => `
                    <article class="order">
                      <header>
                        <strong>${escapeHtml(order.orderCode)}</strong>
                        <span class="status">${escapeHtml(order.status)}</span>
                      </header>
                      <dl>
                        <div>
                          <dt>Paquete</dt>
                          <dd>${escapeHtml(order.amountXno)} XNO</dd>
                        </div>
                        <div>
                          <dt>Pago</dt>
                          <dd>${getOrderPaymentOptions(order)
                            .map((option) => `${escapeHtml(option.method.toUpperCase())}: ${escapeHtml(option.amountToPayFormatted)}`)
                            .join('<br />')}</dd>
                        </div>
                        <div>
                          <dt>Fecha</dt>
                          <dd>${escapeHtml(new Date(order.createdAt).toLocaleString('es-CO'))}</dd>
                        </div>
                        <div>
                          <dt>Direccion Nano</dt>
                          <dd class="address">${escapeHtml(order.receiverAddress)}</dd>
                        </div>
                      </dl>
                    </article>
                  `,
                )
                .join('')}
            </section>`
          : '<p class="empty">Aun no hay pedidos.</p>'
      }
    </main>
  </body>
</html>
`

createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders)
    response.end()
    return
  }

  const url = new URL(request.url ?? '/', `http://${request.headers.host}`)

  try {
    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, { ok: true })
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/packages') {
      sendJson(response, 200, getPackagesResponse())
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/orders') {
      const orders = await readOrders()
      sendJson(response, 200, { orders })
      return
    }

    if (request.method === 'GET' && url.pathname === '/admin/orders') {
      const orders = await readOrders()
      sendHtml(response, 200, renderOrdersAdmin(orders))
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/orders') {
      const body = await readBody(request)
      const amountXno = Number(body.amountXno)
      const paymentMethod = String(body.paymentMethod ?? '').toLowerCase() as PaymentMethod
      const receiverAddress = String(body.receiverAddress ?? '').trim()

      if (!packageAmounts.includes(amountXno)) {
        sendJson(response, 400, { error: 'Paquete no disponible' })
        return
      }

      if (!['cop', 'btc', 'usdt'].includes(paymentMethod)) {
        sendJson(response, 400, { error: 'Selecciona como deseas pagar' })
        return
      }

      if (!nanoAddressPattern.test(receiverAddress)) {
        sendJson(response, 400, { error: 'Ingresa una direccion Nano valida' })
        return
      }

      const clientIp = getClientIp(request)
      const orders = await readOrders()
      const now = Date.now()
      const recentOrder = orders.find((order) => {
        const createdAt = new Date(order.createdAt).getTime()
        const isRecent = Number.isFinite(createdAt) && now - createdAt < orderCooldownMs

        return (
          isRecent &&
          (order.receiverAddress === receiverAddress ||
            ('clientIp' in order && order.clientIp === clientIp))
        )
      })

      if (recentOrder) {
        sendJson(response, 429, {
          error: 'Solo puedes crear un pedido cada hora. Intenta mas tarde.',
        })
        return
      }

      const paymentInstruction = createPaymentInstruction(amountXno, paymentMethod)
      const order: StoreOrder = {
        orderCode: createOrderCode(),
        amountXno,
        paymentMethod,
        paymentInstruction,
        receiverAddress,
        clientIp,
        status: 'PENDING_PAYMENT',
        createdAt: new Date().toISOString(),
      }

      orders.unshift(order)
      await writeOrders(orders)

      sendJson(response, 201, {
        order,
        paymentInstruction,
      })
      return
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/orders/')) {
      const orderCode = decodeURIComponent(url.pathname.replace('/api/orders/', ''))
      const orders = await readOrders()
      const order = orders.find((item) => item.orderCode === orderCode)

      if (!order) {
        sendJson(response, 404, { error: 'Pedido no encontrado' })
        return
      }

      sendJson(response, 200, { order })
      return
    }

    sendJson(response, 404, { error: 'Ruta no encontrada' })
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Error interno',
    })
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`XNO Store API: http://localhost:${port}`)
})
