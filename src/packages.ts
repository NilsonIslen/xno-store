import { xnoUnitPrices } from './xnoUnitPrices'

export const packageAmounts = [10, 20, 50, 100, 200]

const formatCop = (value: number) =>
  `${new Intl.NumberFormat('es-CO').format(value)} COP`

const formatBtc = (value: number) => `${value.toFixed(8)} BTC`

const formatUsdt = (value: number) => `${value.toFixed(2)} USDT`

const roundBtc = (value: number) => Number(value.toFixed(8))

const roundUsdt = (value: number) => Number(value.toFixed(2))

export type XnoPackage = {
  amount: number
  prices: {
    cop: number
    btc: number
    usdt: number
  }
  cop: string
  btc: string
  usdt: string
}

export const createXnoPackage = (amount: number): XnoPackage => {
  const prices = {
    cop: amount * xnoUnitPrices.cop,
    btc: roundBtc(amount * xnoUnitPrices.btc),
    usdt: roundUsdt(amount * xnoUnitPrices.usdt),
  }

  return {
    amount,
    prices,
    cop: formatCop(prices.cop),
    btc: formatBtc(prices.btc),
    usdt: formatUsdt(prices.usdt),
  }
}

export const xnoPackages: XnoPackage[] = packageAmounts.map(createXnoPackage)
