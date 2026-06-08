const defaultApiUrl = `${window.location.protocol}//${window.location.hostname}:8787/api`

export const xnoStoreApiUrl =
  import.meta.env.VITE_XNO_STORE_API_URL?.trim() || defaultApiUrl

export type CreateOrderPayload = {
  amountXno: number
  paymentMethod: 'cop' | 'btc' | 'usdt'
  receiverAddress: string
}

export type CreatedOrder = {
  order: {
    orderCode: string
    amountXno: number
    paymentMethod: 'cop' | 'btc' | 'usdt'
    status: string
  }
  paymentInstruction: {
    method: 'cop' | 'btc' | 'usdt'
    label: string
    value: string
    amountToPayFormatted: string
    instruction: string
  }
}

export async function createXnoOrder(payload: CreateOrderPayload) {
  let response: Response

  try {
    response = await fetch(`${xnoStoreApiUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error(`No se pudo conectar con el backend: ${xnoStoreApiUrl}`)
  }

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || `No se pudo crear el pedido en ${xnoStoreApiUrl}`)
  }

  return data as CreatedOrder
}
