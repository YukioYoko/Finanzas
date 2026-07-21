# Mis Finanzas

App personal de finanzas hecha con React + Vite + Tailwind.

## Funciones

- **Cuentas** bancarias o de efectivo, con opción de excluirlas de la contabilización.
- **Tarjetas** de débito, crédito y **cajas de ahorro** con rendimiento anual (%) que se abona automáticamente cada día con interés compuesto.
- **Movimientos** con descripción, fecha y categoría; en tarjetas de crédito se puede marcar la compra **a meses (MSI)** con su comisión, y ver la mensualidad y los meses restantes.
- **Categorías** personalizables marcadas como mensuales, anuales o esporádicas.
- **Resumen** con gastos/ingresos del mes, deuda en crédito, ahorro total y gastos agrupados por tipo.
- Edición directa del saldo de cualquier tarjeta (se registra como movimiento de ajuste).
- Tema claro y oscuro. Los datos se guardan en el navegador (localStorage).

## Cómo correrlo

```bash
npm install
npm run dev
```

Abre http://localhost:5173

## Compilar para producción

```bash
npm run build
```

El resultado queda en `dist/`.

## App de Android (APK)

El proyecto usa Capacitor. Cada push a `main` dispara un GitHub Action que compila el APK
y lo publica en Releases. Descarga directa de la última versión:

https://github.com/YukioYoko/Finanzas/releases/latest/download/finanzas.apk

Para compilarlo localmente necesitas Android Studio:

```bash
npm run build
npx cap sync android
npx cap open android
```
