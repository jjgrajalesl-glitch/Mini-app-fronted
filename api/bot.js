export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Bot activo');

  const body = req.body;
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
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

  async function sendEmailOTP(toEmail, otpCode) {
    if (!RESEND_API_KEY) return { ok: false, error: "Falta RESEND_API_KEY" };
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'SaaS Bot <onboarding@resend.dev>',
          to: [toEmail],
          subject: 'Código de Verificación - Mini App',
          html: `<p>Tu código de verificación es: <strong>${otpCode}</strong></p>`
        })
      });
      const data = await res.json();
      return { ok: res.ok, data };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

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
          api_key: fields.api_key ? fields.api_key.stringValue : ''
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

  if (!body || !body.message) return res.status(200).send('OK');

  const message = body.message;
  const chatId = message.chat.id;
  const clientId = `CLI-${chatId}`;
  const storeId = `store-${chatId}`;
  const text = message.text ? message.text.trim() : '';

  const clientData = await getClient(clientId);

  if (text === '/start' || !clientData || !clientData.step) {
    await updateClient(clientId, { step: 'AWAITING_NAME', telegram_id: chatId });
    await sendMessage(chatId, `🚀 *Bienvenido a la Plataforma SaaS*\n\nPor favor envía tu *Nombre Completo*:`);
    return res.status(200).send('OK');
  }

  if (clientData.step === 'AWAITING_NAME') {
    await updateClient(clientId, { owner_name: text, step: 'AWAITING_EMAIL' });
    await sendMessage(chatId, `✅ Nombre guardado.\n\n✉️ Envía tu *Correo Electrónico*:`);
    return res.status(200).send('OK');
  }

  // Envío del Código al Correo
  if (clientData.step === 'AWAITING_EMAIL') {
    const generatedOtp = String(Math.floor(1000 + Math.random() * 9000));
    const generatedApiKey = `KEY-${clientId}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    await updateClient(clientId, {
      email: text,
      otp: generatedOtp,
      api_key: generatedApiKey,
      step: 'AWAITING_OTP'
    });

    const emailResult = await sendEmailOTP(text, generatedOtp);

    if (emailResult.ok) {
      await sendMessage(
        chatId,
        `📩 *Verificación enviada a tu Correo*\n\n` +
        `Hemos enviado el código de 4 dígitos a \`${text}\`.\n` +
        `_(Revisa tu bandeja de Spam / Correo no deseado)._\n\n` +
        `Ingresa el código de 4 dígitos aquí:`
      );
    } else {
      await sendMessage(
        chatId,
        `⚠️ *Aviso de envío:* El servicio de correo no entregó a \`${text}\`.\n` +
        `🔐 *Tu Código de prueba es:* \`${generatedOtp}\`\n\n` +
        `Ingresa los 4 dígitos aquí para continuar:`
      );
    }
    return res.status(200).send('OK');
  }

  // Validar OTP
  if (clientData.step === 'AWAITING_OTP') {
    if (text === clientData.otp) {
      await updateClient(clientId, { step: 'AWAITING_PHONE' });
      await sendMessage(
        chatId,
        `✅ *Correo verificado correctamente.*\n\n📱 Envía tu *Número de Teléfono / WhatsApp*:`
      );
    } else {
      await sendMessage(chatId, `❌ *Código incorrecto.* Ingrese los 4 dígitos enviados:`);
    }
    return res.status(200).send('OK');
  }

  if (clientData.step === 'AWAITING_PHONE') {
    await updateClient(clientId, { phone: text, step: 'AWAITING_STORE_NAME' });
    await sendMessage(chatId, `🏪 *Paso 1:* Envía el *Nombre de tu Tienda* (Ej: \`Moda Express\`):`);
    return res.status(200).send('OK');
  }

  // Configurar Nombre de Tienda y LIMPIAR catálogo anterior
  if (clientData.step === 'AWAITING_STORE_NAME') {
    // 1. Eliminar productos previos de Firestore para iniciar desde cero
    const oldProductsUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/stores/${storeId}/products`;
    const oldDocsRes = await fetch(oldProductsUrl);
    if (oldDocsRes.ok) {
      const oldDocsData = await oldDocsRes.json();
      if (oldDocsData.documents) {
        for (const doc of oldDocsData.documents) {
          await fetch(`https://firestore.googleapis.com/v1/${doc.name}`, { method: 'DELETE' });
        }
      }
    }

    // 2. Guardar nueva configuración de tienda
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

    await updateClient(clientId, { store_name: text, step: 'AWAITING_PRODUCT' });
    await sendMessage(chatId, `✅ *Tienda "${text}" configurada en blanco.*\n\n📦 *Paso 2:* Envía tu producto en formato: \`Nombre, Precio\``);
    return res.status(200).send('OK');
  }

  // Carga de producto
  if (clientData.step === 'AWAITING_PRODUCT' || text.includes(',')) {
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
          `🎉 *¡Felicitaciones! Tienda creada exitosamente.*\n\n` +
          `📌 *Producto:* ${title} ($${price} USD)\n\n` +
          `👇 Haz clic para ver tu tienda en vivo:`,
          keyboard
        );
      }
      return res.status(200).send('OK');
    }
  }

  return res.status(200).send('OK');
}
