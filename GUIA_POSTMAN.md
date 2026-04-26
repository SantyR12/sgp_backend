# Guía de Pruebas de la API con Postman (SGP Backend)

¡Hola equipo! Esta guía está diseñada para que todos puedan probar y entender cómo interactuar con el backend de **SGP (Sistema de Gestión de Prescripciones)** de forma rápida y sencilla usando Postman.

Nuestra API cuenta con un **flujo de autenticación de dos pasos (Login + OTP)** por razones de seguridad. Hemos preparado una colección de Postman preconfigurada que automatiza el manejo de los tokens para que probar los módulos sea lo más fluido posible.

---

## 🚀 Paso 1: Importar la Colección

En la raíz del proyecto backend, encontrarás un archivo llamado `SGP_Postman_Collection.json`.

1. Abre la aplicación de **Postman**.
2. En la esquina superior izquierda, haz clic en el botón **"Import"**.
3. Arrastra el archivo `SGP_Postman_Collection.json` a la ventana, o búscalo desde tus carpetas.
4. Una vez importada, verás una nueva carpeta a la izquierda llamada **"SGP Backend API"**.

---

## 🔐 Paso 2: Flujo de Autenticación (Login)

Para consumir la mayoría de los endpoints de la API (como pacientes, recetas, medicamentos), necesitamos un `accessToken`. Este token **NO** se obtiene solo con correo y contraseña; requiere un código de verificación (OTP).

### 2.1. Iniciar el Login
1. Despliega la carpeta **"SGP Backend API"** -> **"Autenticación"**.
2. Selecciona la petición **"Login (Step 1)"**.
3. En la pestaña **Body**, verás un JSON con el correo y contraseña (por ejemplo, el de administrador o el del médico `medico@sgp.com` / `Medico123`).
4. Dale al botón azul **Send**.
5. *Resultado:* La API te responderá con un mensaje indicando que el código de verificación fue enviado.

### 2.2. Obtener el Código OTP
1. Revisa la consola donde está corriendo tu backend localmente (la terminal donde ejecutaste `npm run dev`).
2. Verás un mensaje en consola que dice: `Tu código de verificación es: 123456` (este número cambiará siempre).
3. ¡Copia ese código de 6 dígitos!

### 2.3. Verificar el OTP y Obtener el Token
1. En Postman, ve a la petición **"Verify OTP (Step 2)"**.
2. En la pestaña **Body**, cambia el valor de `"otp": "XXXXXX"` pegando el código que acabas de copiar.
3. Dale al botón azul **Send**.
4. *Resultado:* Verás una respuesta JSON con tus datos de usuario, el `accessToken` y el `refreshToken`.

> [!TIP]
> **🌟 LA MAGIA DE POSTMAN:**
> No necesitas copiar y pegar el `accessToken` manualmente. En esta colección, la petición **"Verify OTP"** tiene un pequeño script configurado en la pestaña *Tests*. Al recibir la respuesta exitosa, Postman **automáticamente** guarda el token en una variable global llamada `{{access_token}}`.

---

## 🩺 Paso 3: Probar los Endpoints Protegidos

Ahora que ya estamos autenticados y Postman tiene el token guardado, probar el resto del sistema es automático.

1. Abre la carpeta **"Medicamentos"** y selecciona **"Buscar Medicamento"**.
2. Si vas a la pestaña de **Headers**, notarás que ya hay un Header llamado `Authorization` con el valor `Bearer {{access_token}}`.
3. Simplemente dale al botón **Send**.
4. ¡El backend te responderá con la lista de medicamentos (ej. "Ibuprofeno")!

Lo mismo aplica para la búsqueda en la carpeta de **"Historial"**. Si creas nuevos endpoints en Postman, solo asegúrate de incluir el Header:
`Authorization`: `Bearer {{access_token}}`

---

## 🛠️ Preguntas Frecuentes

- **¿Qué pasa si me sale un error "401 Unauthorized" o "Token Expirado"?**
  Los JWT (Tokens de acceso) tienen un tiempo de expiración (generalmente un par de horas). Si recibes este error, simplemente vuelve al **Paso 2** (Login y Verify OTP) para generar un nuevo token.
  
- **¿Cómo cambio la ruta base si subo el servidor a producción?**
  Haz clic derecho sobre la colección principal "SGP Backend API" -> Selecciona "Edit" o "Variables". Ahí verás la variable `base_url` que por ahora está en `http://localhost:3000/api`. Solo cambias esa URL y todas las peticiones apuntarán al nuevo servidor.

¡Con esto ya están listos para probar, integrar y destruir la API (con cariño) para encontrar bugs!
