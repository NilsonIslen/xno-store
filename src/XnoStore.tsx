import { useState } from 'react'
import { ShoppingBag, Wallet } from 'lucide-react'
import { createXnoOrder, type CreatedOrder } from './api'
import { type XnoPackage, xnoPackages } from './packages'
import { supportLine } from './paymentAccounts'
import './XnoStore.css'

export function XnoStore() {
  const [selectedPackage, setSelectedPackage] = useState<XnoPackage | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'cop' | 'btc' | 'usdt'>('cop')
  const [receiverAddress, setReceiverAddress] = useState('')
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null)
  const [orderError, setOrderError] = useState('')
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)

  const handlePackageClick = (item: XnoPackage, isSelected: boolean) => {
    setSelectedPackage(isSelected ? null : item)
    setCreatedOrder(null)
    setOrderError('')
  }

  const handleReceiverAddressChange = (value: string) => {
    setReceiverAddress(value)
    setCreatedOrder(null)
    setOrderError('')
  }

  const handlePaymentMethodChange = (method: 'cop' | 'btc' | 'usdt') => {
    setPaymentMethod(method)
    setCreatedOrder(null)
    setOrderError('')
  }

  const handleSubmitOrder = async (item: XnoPackage) => {
    setIsSubmittingOrder(true)
    setOrderError('')
    setCreatedOrder(null)

    try {
      const order = await createXnoOrder({
        amountXno: item.amount,
        paymentMethod,
        receiverAddress,
      })

      setCreatedOrder(order)
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : 'No se pudo crear el pedido')
    } finally {
      setIsSubmittingOrder(false)
    }
  }

  return (
    <main className="store-shell">
      <header className="store-topbar">
        <div className="store-brand">
          <span className="store-brand-mark">XN</span>
          <span>Tienda XNO</span>
        </div>
      </header>

      <section className="store-page" aria-label="Tienda XNO">
        <div className="store-heading">
          <ShoppingBag size={24} aria-hidden="true" />
          <div>
            <p className="store-eyebrow">Compra Nano</p>
            <h1>Paquetes Nano</h1>
          </div>
        </div>

        <div className="package-grid">
          {xnoPackages.map((item) => {
            const isSelected = selectedPackage?.amount === item.amount

            return (
              <article
                className={isSelected ? 'package-item selected' : 'package-item'}
                key={item.amount}
              >
                <button
                  className="package-card"
                  type="button"
                  onClick={() => handlePackageClick(item, isSelected)}
                >
                  <strong>{item.amount} XNO</strong>
                  <span>{item.cop}</span>
                  <span>{item.btc}</span>
                  <span>{item.usdt}</span>
                </button>

                {isSelected && (
                  <section className="receive-panel" aria-label="Direccion para recibir XNO">
                    <div className="payment-methods" aria-label="Forma de pago">
                      <button
                        className={paymentMethod === 'cop' ? 'selected' : ''}
                        type="button"
                        onClick={() => handlePaymentMethodChange('cop')}
                      >
                        COP
                      </button>
                      <button
                        className={paymentMethod === 'btc' ? 'selected' : ''}
                        type="button"
                        onClick={() => handlePaymentMethodChange('btc')}
                      >
                        BTC
                      </button>
                      <button
                        className={paymentMethod === 'usdt' ? 'selected' : ''}
                        type="button"
                        onClick={() => handlePaymentMethodChange('usdt')}
                      >
                        USDT
                      </button>
                    </div>

                    <label className="store-field">
                      <span>Direccion Nano</span>
                      <input
                        value={receiverAddress}
                        onChange={(event) => handleReceiverAddressChange(event.target.value)}
                        placeholder="nano_..."
                      />
                      <small>Recibes {item.amount} XNO.</small>
                    </label>

                    <button
                      className="order-submit"
                      type="button"
                      disabled={isSubmittingOrder || !receiverAddress.trim()}
                      onClick={() => handleSubmitOrder(item)}
                    >
                      {isSubmittingOrder ? 'Creando pedido...' : 'Enviar pedido'}
                    </button>

                    {orderError && <p className="order-message error">{orderError}</p>}

                    {createdOrder && (
                      <div className="order-result" role="status">
                        <span>Pedido creado</span>
                        <strong>{createdOrder.order.orderCode}</strong>
                        <p>
                          Tus {createdOrder.order.amountXno} XNO se enviaran a tu direccion Nano
                          despues de validar el pago.
                        </p>
                        <p>
                          Envio inmediato tras confirmar pago. Max. 24 horas. Soporte:{' '}
                          {supportLine}
                        </p>

                        <div className="payment-instruction">
                          <span>{createdOrder.paymentInstruction.method.toUpperCase()}</span>
                          <strong>{createdOrder.paymentInstruction.instruction}</strong>
                          <small>{createdOrder.paymentInstruction.value}</small>
                        </div>
                      </div>
                    )}

                    <div className="wallet-box">
                      <p className="wallet-note">
                        Necesitas wallet (monedero XNO).
                      </p>

                      <a
                        className="wallet-download"
                        href="https://nautilus.io/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Wallet size={18} aria-hidden="true" />
                        Descargar wallet (monedero XNO)
                      </a>
                    </div>
                  </section>
                )}
              </article>
            )
          })}
        </div>
      </section>
    </main>
  )
}
