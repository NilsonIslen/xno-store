# Tienda XNO

App independiente para vender paquetes Nano (XNO).

## Comandos

```bash
npm install
npm run dev
npm run dev:api
npm run build
npm run lint
```

## Configuracion

- `VITE_XNO_STORE_API_URL`: URL del backend de la tienda. En local usa `http://localhost:8787/api`.
- Los paquetes se editan en `src/packages.ts`.
- Los precios unitarios se editan en `src/xnoUnitPrices.ts`.
- Las cuentas de pago y la linea de soporte se editan en `src/paymentAccounts.ts`.
- Los pedidos se revisan en `http://localhost:8787/admin/orders`.
- Los pedidos se guardan en `backend/data/orders.json`.
