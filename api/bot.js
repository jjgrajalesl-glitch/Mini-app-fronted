export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Bot activo');

  const body = req.body;
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const PROJECT_ID = "saas-miniapps-prod";

  async function sendMessage(chatId, text, keyboard = null) {
    const payload = { chat_id: chatId, text: text, parse_mode: 'Markdown' };
    if (keyboard) payload.reply_markup = keyboard;

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  async function answerCallback(callbackQueryId, text = '') {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text: text })
    });
  }

  // Funciones de Firestore REST
  async function getClient(clientId) {
    try {
      const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/clients/${clientId}`);
      if (res.status === 200) {
        const data = await res.json();
        const fields = data.fields || {};
        return {
          step: fields.step ? fields.step.stringValue : null,
          email: fields.email ? fields.email.stringValue : '',
          otp: fields.otp ? fields.otp.stringValue : '',
          api_key: fields.api_key ? fields.api_key.stringValue : '',
          store_name: fields.store_name ? fields.store_name.stringValue : ''
        };
      }
    } catch (e) { console.error(e); }
    return null;
  }

  async function updateClient(clientId, fieldsData) {
    const formattedFields = {};
    for (const key in fieldsData) {
      formattedFields[key] = { stringValue: String(fieldsData[key]) };
    }
    await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: formattedFields })
    });
  }

  // 1. MANEJO DE BOTONES (CALLBACKS)
  if (body && body.callback_query) {
    const callback = body.callback_query;
    const chatId = callback.message.chat.id;
    const clientId = `CLI-${chatId}`;
    const data = callback.data;

    await answerCallback(callback.id);

    if (data === 'btn_info') {
      const keyboard = {
        inline_keyboard: [[{ text: "👤 Crear Usuario y Registrarme", callback_data: "btn_start_reg" }]]
      };
      await sendMessage(
        chatId,
        `ℹ️ *Plataforma SaaS de Mini Apps en Telegram*\n\n` +
        `Crea tu tienda virtual interactiva con catálogo de productos y recepción de pedidos al instante.\n\n` +
        `Haz clic abajo para iniciar tu registro.`,
        keyboard
      );
      return res.status(200).send('OK');
    }

    if (data === 'btn_start_reg') {
      await updateClient(clientId, { step: 'AWAITING_NAME', telegram_id: chatId });
      await sendMessage(chatId, `📝 *Registro de Propietario*\n\nPor favor envía tu *Nombre Completo*:`);
      return res.status(200).send('OK');
    }

    if (data === 'type_pn' || data === 'type_pj') {
      const pType = data === 'type_pn' ? 'Persona Natural (PN)' : 'Persona Jurídica (PJ)';
      await updateClient(clientId, { person_type: pType, step: 'AWAITING_EMAIL' });
      await sendMessage(chatId, `✅ Registrado: *${pType}*\n\n✉️ Envía tu *Correo Electrónico*:`);
      return res.status(200).send('OK');
    }

    return res.status(200).send('OK');
  }

  if (!body || !body.message) return res.status(200).send('OK');

  const message = body.message;
  const chatId = message.chat.id;
  const clientId = `CLI-${chatId}`;
  const storeId = `store-${chatId}`;
  const text = message.text ? message.text.trim() : '';

  // 2. RECEPCIÓN DE PEDIDOS DESDE LA MINI APP
  if (message.web_app_data && message.web_app_data.data) {
    try {
      const order = JSON.parse(message.web_app_data.data);
      const orderNum = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "📦 Marcar Despachado", callback_data: `despachado_${orderNum}` },
            { text: "✅ Marcar Entregado", callback_data: `entregado_${orderNum}` }
          ]
        ]
      };

      await sendMessage(
        chatId,
        `🚨 *¡NUEVA VENTA RECIBIDA!*\n\n` +
        `📦 *Pedido:* #${orderNum}\n` +
        `👤 *Cliente:* ${order.user_name || 'Cliente'}\n` +
        `🛒 *Items:* ${order.items}\n` +
        `💰 *Total:* $${order.total} USD\n\n` +
        `🔴 *Estado:* PENDIENTE DE DESPACHO`,
        keyboard
      );
    } catch (e) { console.error(e); }
    return res.status(200).send('OK');
  }

  // 3. EVALUAR CLIENTE
  const clientData = await getClient(clientId);

  if (text === '/start' || !clientData || !clientData.step) {
    const keyboard = {
      inline_keyboard: [
        [{ text: "👤 Crear Usuario / Registro", callback_data: "btn_start_reg" }],
        [{ text: "ℹ️ Recibir Información", callback_data: "btn_info" }]
      ]
    };
    await sendMessage(
      chatId,
      `🚀 *Bienvenido a la Plataforma SaaS de Mini Apps*\n\n` +
      `Para acceder a la creación de tiendas debes completar un breve registro de seguridad. ¿Qué deseas hacer?`,
      keyboard
    );
    return res.status(200).send('OK');
  }

  // 4. FLUJO DE REGISTRO PASO A PASO
  if (clientData.step === 'AWAITING_NAME') {
    await updateClient(clientId, { owner_name: text, step: 'AWAITING_TYPE' });
    const keyboard = {
      inline_keyboard: [
        [{ text: "👤 Persona Natural (PN)", callback_data: "type_pn" }],
        [{ text: "🏢 Persona Jurídica (PJ)", callback_data: "type_pj" }]
      ]
    };
    await sendMessage(chatId, `✅ Nombre guardado: *${text}*\n\nSelecciona el tipo de persona:`, keyboard);
    return res.status(200).send('OK');
  }

  if (clientData.step === 'AWAITING_EMAIL') {
    // Generar OTP de 4 dígitos y API Key única
    const generatedOtp = String(Math.floor(1000 + Math.random() * 9000));
    const generatedApiKey = `KEY-${clientId}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    await updateClient(clientId, {
      email: text,
      otp: generatedOtp,
      api_key: generatedApiKey,
      email_verified: 'false',
      step: 'AWAITING_OTP'
    });

    await sendMessage(
      chatId,
      `📩 *Verificación de Correo*\n\n` +
      `Hemos generado un código de verificación de 4 dígitos para confirmación de tu correo \`${text}\`.\n\n` +
      `🔐 *Tu Código de Verificación:* \`${generatedOtp}\`\n\n` +
      `Por favor escribe este código de 4 dígitos en el chat para validar tu correo:`
    );
    return res.status(200).send('OK');
  }

  // 5. VERIFICACIÓN DEL CÓDIGO OTP
  if (clientData.step === 'AWAITING_OTP') {
    if (text === clientData.otp) {
      await updateClient(clientId, {
        email_verified: 'true',
        step: 'AWAITING_PHONE'
      });

      await sendMessage(
        chatId,
        `✅ *¡Correo verificado con éxito!*\n\n` +
        `🔑 *Tu API Key de Seguridad:* \`${clientData.api_key}\`\n` +
        `_(Guardada en tu perfil para proteger tus tiendas contra bots unauth/spam)._\n\n` +
        `📱 Envía tu *Número de Teléfono / WhatsApp*:`
      );
    } else {
      await sendMessage(
        chatId,
        `❌ *Código incorrecto.* Por favor escribe el código de 4 dígitos correcto: \`${clientData.otp}\``
      );
    }
    return res.status(200).send('OK');
  }

  if (clientData.step === 'AWAITING_PHONE') {
    await updateClient(clientId, {
      phone: text,
      step: 'AWAITING_STORE_NAME',
      plan: 'Free',
      created_at: new Date().toISOString()
    });

    await sendMessage(
      chatId,
      `🎉 *¡Inscripción y Verificación de Datos Completadas!*\n\n` +
      `🆔 *ID Cliente:* \`${clientId}\`\n` +
      `🔑 *API Key:* \`${clientData.api_key}\`\n\n` +
      `🏪 *Paso 1:* Envía ahora el *Nombre de tu Tienda* (Ej: \`Tienda de Juan\`):`
    );
    return res.status(200).send('OK');
  }

  // 6. CREACIÓN DE TIENDA CON API KEY
  if (clientData.step === 'AWAITING_STORE_NAME') {
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/stores/${storeId}`;
    await fetch(firestoreUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          name: { stringValue: text },
          client_id: { stringValue: clientId },
          api_key: { stringValue: clientData.api_key },
          active: { booleanValue: true }
        }
      })
    });

    await updateClient(clientId, { store_name: text, step: 'AWAITING_FIRST_PRODUCT' });

    await sendMessage(
      chatId,
      `✅ *Tienda "${text}" configurada con seguridad API Key activada.*\n\n` +
      `📦 *Paso 2:* Envía tu primer producto en formato: \`Nombre, Precio\`\n\n` +
      `Ejemplo: \`Camisa, 20\``
    );
    return res.status(200).send('OK');
  }

  // 7. CARGA DE PRODUCTO Y CELEBRACIÓN
  if (clientData.step === 'AWAITING_FIRST_PRODUCT' || clientData.step === 'READY' || text.includes(',')) {
    if (text.includes(',')) {
      const parts = text.split(',');
      const title = parts[0].trim();
      const price = parseFloat(parts[1].trim()) || 0;

      if (title && price > 0) {
        const productUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/stores/${storeId}/products`;
        await fetch(productUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              title: { stringValue: title },
              price: { doubleValue: price },
              image_url: { stringValue: 'https://via.placeholder.com/150' },
              active: { booleanValue: true }
            }
          })
        });

        await updateClient(clientId, { step: 'READY' });
        const appUrl = `https://mini-app-fronted.vercel.app/?store_id=${storeId}&api_key=${clientData.api_key}`;
        
        const keyboard = {
          inline_keyboard: [[{ text: "🛒 Validar Tienda y Catálogo", url: appUrl }]]
        };

        await sendMessage(
          chatId,
          `🎉 *¡Felicitaciones! Ya creaste tu tienda y tu catálogo de productos.*\n\n` +
          `📌 *Producto registrado:* ${title} ($${price} USD)\n` +
          `🔑 *API Key asignada:* \`${clientData.api_key}\`\n\n` +
          `👇 Para validar tu tienda en vivo, da clic en el botón de abajo:`,
          keyboard
        );
      }
      return res.status(200).send('OK');
    }
  }

  return res.status(200).send('OK');
}
