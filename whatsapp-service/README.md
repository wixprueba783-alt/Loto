# Notificaciones de citas por WhatsApp

Este servicio independiente observa las citas en Firestore y envía notificaciones de WhatsApp: recepción de la solicitud, confirmación, recordatorios automáticos y manuales, cancelaciones, cambios de horario, confirmación de pagos y aviso de nuevas citas al negocio. Registra el estado de cada intento en `whatsappMessageLog`; el servicio Admin SDK escribe esos registros y solo los administradores generales pueden consultarlos.

Utiliza [whatsapp-web.js](https://github.com/wwebjs/whatsapp-web.js).

En **Administración → Configuración → Automatizaciones e historial de WhatsApp**, el administrador general puede habilitar o deshabilitar cada evento, editar plantillas, ajustar la anticipación del recordatorio y consultar los últimos 50 intentos. Las plantillas aceptan `{firstName}`, `{name}`, `{date}`, `{time}` y `{service}`. El estado `sent` significa que `whatsapp-web.js` aceptó el mensaje, no que exista confirmación de entrega al teléfono. Un intento cuyo resultado queda incierto no se reenvía automáticamente para evitar duplicados; el historial marca que requiere revisión manual.

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

## Publicar el sitio en Vercel y WhatsApp en Render

La aplicación web se puede publicar como sitio Vite en Vercel. El observador de citas, la sesión de WhatsApp Web y las API administrativas deben permanecer en un servidor Node persistente; `render.yaml` configura ese servidor en Render. El servicio de Render también sirve una copia del sitio, pero los clientes pueden usar la URL de Vercel.

1. En Render, crea un **Blueprint** conectado al repositorio y selecciona `render.yaml`. Configura las variables `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID` y `VITE_FIREBASE_APP_ID` con la configuración web del proyecto Firebase `loto-19em`.
2. En **Secret Files**, agrega `service-account.json` con la clave de la cuenta de servicio de Firebase. El servicio la espera en `/etc/secrets/service-account.json`; nunca la subas al repositorio.
3. Espera a que Render publique el servicio y copia su dominio HTTPS, por ejemplo `https://loto-whatsapp.onrender.com`.
4. En Vercel, importa el mismo repositorio desde GitHub, deja el directorio raíz como `.` y usa la configuración de `vercel.json`. Define las seis variables `VITE_FIREBASE_*` con la configuración web de Firebase y agrega `VITE_WHATSAPP_API_URL` con el dominio HTTPS de Render, sin una barra final.
5. Publica el sitio en Vercel y copia su dominio HTTPS. En Render configura `WHATSAPP_ALLOWED_ORIGINS` con el dominio exacto de Vercel. Si tienes dominio propio, agrega también su origen HTTPS, separados por comas. Guarda el cambio para que Render reinicie el servicio.
6. Agrega el dominio de Vercel (y cualquier dominio propio) en Firebase Authentication → **Dominios autorizados**.
7. Abre el sitio de Vercel, inicia sesión como administradora y vincula WhatsApp en **Administración → Configuración → WhatsApp**. La sesión queda almacenada en el disco persistente de Render.

`VITE_FIREBASE_*` son valores de configuración del cliente web, no claves de cuenta de servicio. No pegues la clave privada de Firebase en Vercel ni la incluyas en Git. La clave de servicio solo va en **Secret Files** de Render. Mantén una sola instancia de WhatsApp para evitar sesiones duplicadas.

## Publicación del sitio y WhatsApp juntos en Render

El archivo `render.yaml` también permite servir la aplicación web junto con `/api/whatsapp/status` y mantener WhatsApp conectado. Esta opción no requiere Vercel; el proceso persistente sigue siendo necesario para observar Firestore y enviar mensajes.

1. En Render, crea un **Blueprint** conectado al repositorio y selecciona `render.yaml`.
2. Configura las variables `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID` y `VITE_FIREBASE_APP_ID` con la configuración web del proyecto Firebase `loto-19em`.
3. En **Secret Files**, agrega el archivo `service-account.json` de Firebase. El servicio lo espera en `/etc/secrets/service-account.json`. Nunca lo subas al repositorio.
4. Espera a que termine el despliegue, agrega el dominio personalizado al servicio y configura el DNS según indique Render. Agrega también ese dominio a los dominios autorizados de Firebase Authentication.
5. Inicia sesión en el sitio publicado como administrador y vincula WhatsApp escaneando el QR en **Administración → Configuración → WhatsApp**. El disco persistente conserva la sesión entre reinicios y despliegues.

Después de esa configuración inicial, el administrador usa solamente la página web. Render mantiene el proceso encendido; la terminal no es necesaria para enviar notificaciones. Conserva una sola instancia para evitar sesiones de WhatsApp duplicadas y notificaciones repetidas.

## Usar una computadora dedicada con Windows

La computadora dedicada puede ejecutar el servicio sin tener una terminal abierta. Los usuarios siguen usando el dominio publicado para reservar; el proceso local observa Firestore y envía las notificaciones. Windows reinicia el servicio al iniciar sesión y desbloquear la computadora. Mientras Windows está suspendido no se pueden enviar mensajes; al reanudar, el servicio se recupera automáticamente. Si necesitas que los mensajes se envíen sin demora, mantén la computadora encendida y evita la suspensión automática.

1. Instala Node.js 22.12 o posterior en esa computadora.
2. Descarga el repositorio actualizado y descomprímelo en una carpeta permanente fuera de OneDrive, por ejemplo `C:\Loto`.
3. Copia `whatsapp-service/.env.example` a `whatsapp-service/.env`. Configura `FIREBASE_PROJECT_ID=loto-19em` y `GOOGLE_APPLICATION_CREDENTIALS=./service-account.json`. En las variables `VITE_FIREBASE_*`, pega la configuración web del proyecto Firebase `loto-19em` (Firebase Console → configuración del proyecto → tus apps → SDK web). `VITE_FIREBASE_PROJECT_ID` debe ser `loto-19em`.
4. En Firebase Console, descarga una clave de cuenta de servicio y guárdala como `whatsapp-service/service-account.json`. No la compartas ni la subas al repositorio.
5. Haz doble clic en `whatsapp-service/Instalar-Servicio-WhatsApp.bat` y espera el mensaje de instalación completa. Durante esta primera instalación aparecerá una consola para mostrar el progreso; se cerrará al terminar. El servicio diario arranca oculto con Windows Script Host, sin dejar una ventana de PowerShell o terminal abierta, y se reinicia automáticamente si el proceso se detiene. Una tarea adicional lo reinicia al iniciar sesión y al desbloquear Windows, lo que también recupera WhatsApp después de suspender la computadora.
6. En esa computadora abre `http://localhost:10000`, entra como administrador y escanea el QR de **Configuración → WhatsApp** una sola vez. La sesión se conserva en el perfil local de Windows.
7. Deja esa computadora activa. Las nuevas citas, confirmaciones y recordatorios manuales/automáticos se procesan aunque los clientes entren al sitio desde otro dispositivo.

El dominio público no podrá mostrar el estado/QR de WhatsApp de la computadora local a menos que se configure además una conexión HTTPS segura desde el dominio hacia esa computadora. Esto no impide el envío de avisos: los recordatorios manuales se guardan en Firestore y el servicio local los detecta. El QR inicial se escanea desde `localhost` en la computadora dedicada.

Las tareas se llaman `Loto WhatsApp Notifications` y `Loto WhatsApp Resume Recovery`. Los registros están en `whatsapp-service/logs/service.log` y `whatsapp-service/logs/recovery.log`. Si el servicio falla, el iniciador oculto lo intenta levantar de nuevo. Las escuchas de Firestore se restablecen automáticamente tras errores, con reintentos que aumentan hasta un minuto; además, cada minuto el servicio vuelve a leer las citas para recuperar eventos perdidos, como solicitudes de recordatorio manual tras suspender la computadora. Si Chromium o WhatsApp Web queda inutilizable al reanudar desde suspensión, Windows reinicia el servicio al desbloquear la sesión y este reintenta los mensajes pendientes. La carga inicial de citas también se reintenta mientras Firestore no responda. Para actualizar el código, descarga la nueva versión y vuelve a ejecutar el instalador.

El servicio omite las citas que ya existían cuando se instala por primera vez. Para las citas nuevas, envía un mensaje de recepción al número guardado en `clientPhone`. Si el número tiene diez dígitos, se interpreta como mexicano y se agrega el prefijo `52`. Si la confirmación automática está activa, la cita se crea como confirmada y recibe directamente el mensaje de confirmación; de lo contrario, cuando la administración cambia el estado de `pending` a `confirmed`, envía los datos de fecha y hora guardados en Firestore. Para citas confirmadas, busca cada minuto si llegó el momento de enviar el recordatorio según las horas configuradas en `settings/general.reminderHours` (24 horas por defecto); las citas canceladas no reciben ese recordatorio. Las respuestas de las clientas al recordatorio no se procesan ni guardan automáticamente.

El QR y el estado de conexión solo se entregan en la página de configuración a una sesión autenticada como administradora. El botón **Recordatorio** aparece en el detalle de citas confirmadas. Al usarlo, la aplicación actualiza la marca `manualReminderRequest` en el documento de la cita para que este servicio envíe el mismo mensaje de recordatorio; no agrega colecciones a Firestore. El registro local de notificaciones enviadas se conserva en `whatsapp-service/.data` para evitar duplicados y permitir reintentos. En Windows, la sesión de WhatsApp se guarda por defecto en `%LOCALAPPDATA%\LotoWhatsapp\wwebjs_auth`, fuera de carpetas sincronizadas como OneDrive. En otros sistemas se guarda en una carpeta `LotoWhatsapp/wwebjs_auth` junto al servicio. No borres esos datos si quieres conservar la sesión y evitar notificaciones repetidas. `WHATSAPP_LOCAL_AUTH_DIR` permite cambiar la ubicación.

La zona horaria de las citas se configura con `BUSINESS_TIME_ZONE` y por defecto es `America/Mexico_City`. Antes de enviar, el servicio usa `getNumberId()` de `whatsapp-web.js` para resolver el identificador de chat registrado, incluidos los identificadores LID de WhatsApp multidispositivo. Así evita depender de módulos internos de WhatsApp Web, cuya API cambia entre versiones. Si WhatsApp no puede resolver el número, la notificación permanece pendiente y se reintenta. Confirma que el teléfono guardado tenga el código de país correcto y revisa la terminal para ver si el mensaje se envió.

Para ejecutar las pruebas del formato del mensaje y los teléfonos:

```powershell
npm test --prefix whatsapp-service
```

## Importante

`whatsapp-web.js` automatiza WhatsApp Web y no es una API oficial de Meta. Mantén el servicio actualizado, evita mensajes no solicitados y obtén el consentimiento de contacto de las clientas. El uso de automatización puede ocasionar restricciones en la cuenta de WhatsApp.
