# Publicar en Google Play — pasos

Todo lo del código ya está listo (firma, AAB, versionCode automático, icono, política de
privacidad). Faltan unos pasos que solo tú puedes hacer.

## 1. Generar tu keystore (llave de firma) — UNA sola vez

⚠️ **Esta llave es única y permanente.** Si la pierdes, no podrás volver a actualizar la app
en Play. Guárdala en un lugar seguro (y respalda también las contraseñas).

Necesitas `keytool`, que viene con el **JDK de Java**. Si no lo tienes, dos opciones:

- **Opción A — Android Studio** (más fácil): _Build → Generate Signed Bundle/APK → Create new…_
  Te crea el `.jks` con una interfaz. Anota alias y contraseñas.
- **Opción B — Línea de comandos** (instala el JDK de Temurin y corre en PowerShell):

```powershell
keytool -genkeypair -v -keystore finanzas-release.jks -keyalg RSA -keysize 2048 `
  -validity 10000 -alias finanzas `
  -dname "CN=Mis Finanzas, O=YukioYoko, C=MX"
```

Te pedirá una contraseña para el keystore (y puedes usar la misma para la llave). **Anótalas.**

## 2. Convertir el keystore a texto (base64) para GitHub

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("finanzas-release.jks")) | Out-File keystore.b64.txt
```

(`keystore.b64.txt` y los `.jks` ya están en `.gitignore`; nunca se suben al repo.)

## 3. Agregar los secretos en GitHub

En el repo: **Settings → Secrets and variables → Actions → New repository secret**, crea estos 4:

| Nombre | Valor |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | todo el contenido de `keystore.b64.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | la contraseña del keystore |
| `ANDROID_KEY_ALIAS` | `finanzas` |
| `ANDROID_KEY_PASSWORD` | la contraseña de la llave (si usaste la misma, repítela) |

En el siguiente push a `main`, el workflow compilará el **AAB firmado** (en los _artefactos_ de la
ejecución) y el APK firmado (en Releases).

## 4. Publicar la política de privacidad (GitHub Pages)

En el repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch →
Branch: `main` / carpeta `/docs`**. Guarda. Tu URL será:

```
https://yukioyoko.github.io/Finanzas/
```

Esa es la URL de política de privacidad que pide Play.

## 5. En Play Console

1. **Crear app** → nombre "Mis Finanzas", idioma español, tipo App, gratis.
2. **Ficha principal**: descripción corta y larga, sube el icono `android/app/src/main/ic_launcher-playstore.png` (512×512), un gráfico destacado 1024×500, y capturas de pantalla del teléfono.
3. **Política de privacidad**: pega la URL del paso 4.
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
