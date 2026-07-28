# Publicar en Google Play — pasos

Todo lo del código ya está listo (firma, AAB, versionCode automático, icono, política de
privacidad). Faltan unos pasos que solo tú puedes hacer.

**Nombre del paquete (applicationId):** `com.yukioyoko.finanzas` — regístralo igual en Play.

## 1. Generar el keystore EN LÍNEA (sin instalar nada)

Como no puedes instalar el JDK, se genera en GitHub Actions con el workflow
`Generar keystore (una sola vez)`. Guarda los secretos solo (no expone el archivo, seguro en repo público).

1. Crea un **token fino**: GitHub → tu foto → **Settings → Developer settings →
   Fine-grained tokens → Generate new token**. Repository access: solo `Finanzas`.
   Permisos → Repository permissions → **Secrets: Read and write**. Genera y copia el token.
2. En el repo: **Settings → Secrets and variables → Actions → New repository secret**,
   crea `GH_PAT` con ese token.
3. Ve a la pestaña **Actions → "Generar keystore (una sola vez)" → Run workflow**.
4. Al terminar, ya quedaron creados los 4 secretos de firma
   (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS`).
5. Borra el secreto `GH_PAT` (ya no se necesita) y, si quieres, el token en GitHub.

> ℹ️ **¿Y si pierdo la llave?** Como usarás **Play App Signing** (paso 5), esta es solo tu
> _llave de subida_. Si algún día se pierde, Google te deja **resetearla** desde la consola;
> no perderías la app. Aun así, no borres los secretos del repo.

En el siguiente push a `main`, el workflow compilará el **AAB firmado** (en los _artefactos_ de la
ejecución) y el APK firmado (en Releases).

## 2. Publicar la política de privacidad (GitHub Pages)

En el repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch →
Branch: `main` / carpeta `/docs`**. Guarda. Tu URL será:

```
https://yukioyoko.github.io/Finanzas/
```

Esa es la URL de política de privacidad que pide Play.

## 3. En Play Console

1. **Crear app** → nombre "Mis Finanzas", idioma español, tipo App, gratis. Paquete: `com.yukioyoko.finanzas`.
2. **Ficha principal**: descripción corta y larga, sube el icono `android/app/src/main/ic_launcher-playstore.png` (512×512), un gráfico destacado 1024×500, y capturas de pantalla del teléfono.
3. **Política de privacidad**: pega la URL del paso 2.
4. **Seguridad de los datos**: declara que **no se recopilan ni se comparten datos** (todo es local).
5. **Clasificación de contenido**: responde el cuestionario (app de finanzas, sin contenido sensible).
6. **Prueba cerrada**: crea una pista de _Closed testing_, sube el **AAB** (descárgalo de los artefactos del workflow), invita **≥12 testers** y mantenla **14 días** (requisito para cuentas nuevas).
7. Tras los 14 días, promueve a **producción**.

## Notas importantes

- **Transición de firma**: el APK nuevo está firmado con tu keystore, distinto al de los APK
  anteriores. Para instalarlo sobre una versión vieja tendrás que **desinstalar primero** (una sola
  vez). Antes de hacerlo, **exporta tu respaldo** desde Ajustes → Datos y respaldo, y reimpórtalo
  después. A partir de aquí, todas las actualizaciones conservan los datos.
- **Play App Signing**: al subir el primer AAB, deja que Google administre la firma (recomendado).
  Tu keystore queda como _llave de subida_.
- La lectura de notificaciones ya es **opcional y apagada de fábrica**, lo que ayuda en la revisión.
