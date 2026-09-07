<div align="center">

# 💸 Mis Finanzas

**Tu control de finanzas personales — privado, sin nube y hecho para México.**

Registra cuentas, tarjetas, deudas y cajas de ahorro; sigue tus gastos mes a mes y
descarga la app de Android. Todos tus datos viven en tu dispositivo: nada se sube a internet.

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Capacitor](https://img.shields.io/badge/Capacitor-Android-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com)
[![Moneda](https://img.shields.io/badge/Moneda-MXN-006847)](#)

[**⬇️ Descargar APK**](https://github.com/YukioYoko/Finanzas/releases/latest/download/finanzas.apk) ·
[**🔒 Política de privacidad**](https://yukioyoko.github.io/Finanzas/) ·
[**🐛 Reportar un problema**](https://github.com/YukioYoko/Finanzas/issues)

</div>

---

## 📋 Tabla de contenido

- [¿Qué es Mis Finanzas?](#-qué-es-mis-finanzas)
- [Funciones](#-funciones)
- [Instalación en Android](#-instalación-en-android)
- [Stack técnico](#-stack-técnico)
- [Desarrollo local](#-desarrollo-local)
- [Compilar para producción](#-compilar-para-producción)
- [App de Android (Capacitor)](#-app-de-android-capacitor)
- [Arquitectura](#-arquitectura)
- [Privacidad](#-privacidad)
- [Autor](#-autor)

---

## 🧭 ¿Qué es Mis Finanzas?

**Mis Finanzas** es una aplicación de finanzas personales pensada para el día a día en México:
lleva la cuenta de lo que gastas y ganas, de cuánto debes en tus tarjetas de crédito, de tus
compras a meses sin intereses y de cuánto rinde tu ahorro. Toda la matemática de saldos,
estados de cuenta e intereses se calcula de forma automática a partir de tus movimientos.

Funciona igual en el navegador y como app nativa de Android, y **guarda todo localmente**:
tu información nunca sale de tu teléfono ni de tu navegador.

---

## ✨ Funciones

### Cuentas y tarjetas
- **Cuentas** de banco, efectivo o deuda; puedes excluir cualquiera de los totales.
- **Tarjetas de débito y crédito.** Las de crédito manejan día de corte, día de pago, límite de
  crédito y una **barra de uso** (verde → ámbar → rojo) con aviso cuando te acercas al límite.
- **Cajas de ahorro** con rendimiento anual (%) que se **abona solo cada día** con interés compuesto.
- **Deudas** con interés mensual o anual que se acumula automáticamente día a día.

### Movimientos
- Gastos e ingresos con título, descripción, fecha y categoría.
- **Compras a meses sin intereses (MSI)** con comisión, mensualidad y meses restantes.
- **Transferencias** entre tus cuentas (no cuentan como gasto ni ingreso).
- **Pagos divididos**: una compra pagada con varios medios en un solo registro.

### Análisis y resumen
- Panel de **Resumen** con balance neto, por pagar del mes, gastos e ingresos, deuda en crédito y ahorro total.
- Gastos agrupados por frecuencia (mensuales, anuales, esporádicos).
- **Gráficas** de ingresos/gastos de los últimos 6 meses, desglose por categoría y resumen anual.

### Cargos fijos y recordatorios
- **Cargos y abonos recurrentes** (mensuales o semanales) que se generan automáticamente.
- Recordatorios de corte y pago de tus tarjetas de crédito.

### Captura de notificaciones *(solo Android, opcional)*
- Lee las notificaciones de **los bancos que tú elijas** y te sugiere el movimiento con el monto
  y la tarjeta ya detectados, sin registrar el mismo cargo dos veces.
- **Apagado de fábrica** y **100 % local**: todo se procesa en el teléfono, nada se envía a internet.

### Extras
- **Respaldo y restauración** de todos tus datos en un archivo JSON.
- **Tema claro y oscuro.**
- Tour de bienvenida en el primer arranque (se puede repetir desde Ajustes).

---

## 📲 Instalación en Android

1. Descarga el APK más reciente:
   **[finanzas.apk](https://github.com/YukioYoko/Finanzas/releases/latest/download/finanzas.apk)**
2. Ábrelo en tu teléfono y permite la instalación de orígenes desconocidos si te lo pide.
3. ¡Listo! No necesita cuenta ni conexión a internet.

> Cada push a `main` genera un APK nuevo de forma automática y lo publica en
> [**Releases**](https://github.com/YukioYoko/Finanzas/releases).

---

## 🛠️ Stack técnico

| Área | Tecnología |
|------|-----------|
| UI | React 18 |
| Build | Vite |
| Estilos | Tailwind CSS (solo layout; los colores vienen de un sistema de *theme* propio) |
| App nativa | Capacitor (Android) |
| Almacenamiento | `localStorage` / `window.storage` (local) |
| CI/CD | GitHub Actions (APK/AAB firmados automáticos) |

---

## 💻 Desarrollo local

**Requisitos:** Node.js 18+ y npm.

```bash
npm install       # instalar dependencias
npm run dev       # servidor de desarrollo en http://localhost:5173
```

Otros comandos disponibles:

```bash
npm run build     # build de producción a dist/
npm run preview   # previsualizar el build de producción
```

> No hay suite de pruebas ni linter configurados en el repositorio.

---

## 📦 Compilar para producción

```bash
npm run build
```

El resultado queda en la carpeta `dist/`.

---

## 🤖 App de Android (Capacitor)

Para compilar la app de Android localmente necesitas **Android Studio**:

```bash
npm run build
npx cap sync android
npx cap open android
```

### Builds automáticos

Al hacer push a `main`, el workflow [`build-apk.yml`](.github/workflows/build-apk.yml) compila la app:

- Con los secretos de firma (`ANDROID_KEYSTORE_BASE64` y contraseñas/alias): genera un **AAB firmado**
  (artefacto de la ejecución, listo para Play Console) y un **APK firmado** que se publica en Releases.
- Sin los secretos: genera un **APK debug** sin firmar.

El `versionCode` y `versionName` se toman del número de ejecución del workflow.
Para el proceso completo de publicación en Play Store, consulta **[`PLAY_STORE.md`](PLAY_STORE.md)**.

---

## 🏗️ Arquitectura

La app no usa router ni librería de estado: un único objeto `data` en `src/App.jsx` guarda todo,
y las pantallas reciben `{ data, update }` para aplicar cambios parciales.

- **`src/App.jsx`** — shell de la app: estado global, efectos de carga (interés, cargos fijos,
  captura de notificaciones, recordatorios) y la barra de pestañas.
- **`src/lib/finance.js`** — toda la matemática de dinero como funciones puras; **única fuente de
  verdad** para saldos y estados de cuenta (las pantallas nunca los calculan por su cuenta).
- **`src/theme.js`** — tokens de color de los temas claro/oscuro (`useTheme()`).
- **`src/screens/*.jsx`** — una pantalla por pestaña: Resumen, Cuentas, Movimientos, Fijos, Categorías.
- **`src/components/ui.jsx`** — primitivas de UI reutilizables (`Field`, `Btn`, `Card`, `Amount`, …).

> Los saldos no se guardan: se derivan siempre a partir de los movimientos, lo que mantiene el
> historial siempre consistente. Encontrarás la guía completa en **[`CLAUDE.md`](CLAUDE.md)**.

---

## 🔒 Privacidad

Mis Finanzas **no recopila ni comparte ningún dato**. Toda tu información se guarda localmente en
tu dispositivo o navegador y nunca se sube a internet. Como no hay respaldo en la nube, conviene
exportar de vez en cuando un respaldo desde **Ajustes → Datos y respaldo**.

Política de privacidad completa: **https://yukioyoko.github.io/Finanzas/**

---

## 👤 Autor

Desarrollado por [**@YukioYoko**](https://github.com/YukioYoko).

¿Encontraste un problema o tienes una idea? Abre un
[issue](https://github.com/YukioYoko/Finanzas/issues) en el repositorio.
