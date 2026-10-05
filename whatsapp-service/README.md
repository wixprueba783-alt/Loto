# Notificaciones de citas por WhatsApp

Este servicio independiente observa las citas en Firestore y envía notificaciones de WhatsApp: recepción de la solicitud, confirmación por administración, recordatorio automático 24 horas antes y recordatorios manuales solicitados desde el detalle de una cita confirmada. No crea colecciones nuevas en Firestore.

Utiliza [whatsapp-web.js](https://github.com/wwebjs/whatsapp-web.js).

## Requisitos

- Node.js 22.12 o posterior.
- Acceso de lectura a Firestore mediante una cuenta de servicio de Firebase.
- WhatsApp vinculado al servicio mediante **Dispositivos vinculados**.
- Una computadora o servidor encendido y conectado a internet mientras se reciben citas.

## Configuración

1. Desde la raíz del proyecto, instala las dependencias del servicio:

   ```powershell
   npm install --prefix whatsapp-service
   npm install-scripts approve puppeteer --prefix whatsapp-service
   npm rebuild puppeteer --prefix whatsapp-service
   ```

2. Copia `whatsapp-service/.env.example` a `whatsapp-service/.env`.
3. En Firebase Console, crea o descarga una clave de cuenta de servicio para el proyecto y guárdala como `whatsapp-service/service-account.json`. No la publiques ni la compartas.
4. Verifica que `FIREBASE_PROJECT_ID` en `whatsapp-service/.env` corresponda al proyecto de Firebase.
5. Inicia la aplicación desde la raíz del proyecto:

   ```powershell
   npm run dev
   ```

6. Entra a **Administración → Configuración → WhatsApp**. La primera vez, escanea el QR mostrado en esa página desde WhatsApp > **Dispositivos vinculados**. La conexión se inicia junto con el servidor web y la sesión se conserva localmente; no necesitas iniciar otro proceso ni volver a escanear en cada inicio.

## Publicación persistente en Render

El archivo `render.yaml` define un servicio Docker que sirve tanto la aplicación web como `/api/whatsapp/status` y mantiene WhatsApp conectado. No publiques solo `dist/` como sitio estático: en ese caso no existe un proceso que observe Firestore ni que envíe mensajes.

1. En Render, crea un **Blueprint** conectado al repositorio y selecciona `render.yaml`.
2. Configura las variables `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID` y `VITE_FIREBASE_APP_ID` con la configuración web del proyecto Firebase `loto-19em`.
3. En **Secret Files**, agrega el archivo `service-account.json` de Firebase. El servicio lo espera en `/etc/secrets/service-account.json`. Nunca lo subas al repositorio.
4. Espera a que termine el despliegue, agrega el dominio personalizado al servicio y configura el DNS según indique Render. Agrega también ese dominio a los dominios autorizados de Firebase Authentication.
5. Inicia sesión en el sitio publicado como administrador y vincula WhatsApp escaneando el QR en **Administración → Configuración → WhatsApp**. El disco persistente conserva la sesión entre reinicios y despliegues.

Después de esa configuración inicial, el administrador usa solamente la página web. Render mantiene el proceso encendido; la terminal no es necesaria para enviar notificaciones. Conserva una sola instancia para evitar sesiones de WhatsApp duplicadas y notificaciones repetidas.

El servicio omite las citas que ya existían cuando se instala por primera vez. Para las citas nuevas, envía un mensaje de recepción al número guardado en `clientPhone`. Si el número tiene diez dígitos, se interpreta como mexicano y se agrega el prefijo `52`. Si la confirmación automática está activa, la cita se crea como confirmada y recibe directamente el mensaje de confirmación; de lo contrario, cuando la administración cambia el estado de `pending` a `confirmed`, envía los datos de fecha y hora guardados en Firestore. Para citas confirmadas, busca cada minuto si llegó el momento de enviar el recordatorio según las horas configuradas en `settings/general.reminderHours` (24 horas por defecto); las citas canceladas no reciben ese recordatorio. Las respuestas de las clientas al recordatorio no se procesan ni guardan automáticamente.

El QR y el estado de conexión solo se entregan en la página de configuración a una sesión autenticada como administradora. El botón **Recordatorio** aparece en el detalle de citas confirmadas. Al usarlo, la aplicación actualiza la marca `manualReminderRequest` en el documento de la cita para que este servicio envíe el mismo mensaje de recordatorio; no agrega colecciones a Firestore. El registro local de notificaciones enviadas se conserva en `whatsapp-service/.data` para evitar duplicados y permitir reintentos. En Windows, la sesión de WhatsApp se guarda por defecto en `%LOCALAPPDATA%\LotoWhatsapp\wwebjs_auth`, fuera de carpetas sincronizadas como OneDrive. En otros sistemas se guarda en una carpeta `LotoWhatsapp/wwebjs_auth` junto al servicio. No borres esos datos si quieres conservar la sesión y evitar notificaciones repetidas. `WHATSAPP_LOCAL_AUTH_DIR` permite cambiar la ubicación.

La zona horaria de las citas se configura con `BUSINESS_TIME_ZONE` y por defecto es `America/Mexico_City`. Si WhatsApp Web no encuentra el identificador interno de un contacto nuevo, el servicio intenta resolverlo mediante la sincronización de contactos de WhatsApp y mantiene la notificación pendiente para reintentar si falla el envío. Confirma que el teléfono guardado tenga el código de país correcto y revisa la terminal para ver si el mensaje se envió.

Para ejecutar las pruebas del formato del mensaje y los teléfonos:

```powershell
npm test --prefix whatsapp-service
```

## Importante

`whatsapp-web.js` automatiza WhatsApp Web y no es una API oficial de Meta. Mantén el servicio actualizado, evita mensajes no solicitados y obtén el consentimiento de contacto de las clientas. El uso de automatización puede ocasionar restricciones en la cuenta de WhatsApp.
