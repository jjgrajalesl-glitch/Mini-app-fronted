module.exports = async function handler(req, res) {
  // Asegurar cabeceras de respuesta JSON
  res.setHeader('Content-Type', 'application/json');

  try {
    const { mode } = req.query;

    if (!mode || (mode !== 'AM' && mode !== 'PM')) {
      return res.status(400).json({ 
        success: false, 
        message: "Por favor especifica un modo válido en la URL: ?mode=AM o ?mode=PM" 
      });
    }

    // --- RUTINA AM (08:00 AM): Creación y Difusión Viral ---
    if (mode === 'AM') {
      const prompt = `
        Crea 3 variaciones de guion de video (30s) para Agency AI OS en tres idiomas específicos:
        1. Español EE. UU. (es-US)
        2. Inglés EE. UU. (en-US)
        3. Portugués Brasil (pt-BR)

        REGLAS DE PRODUCCIÓN VISUAL Y AUDIO (ESTRICTAS):
        - CERO personas o figuras humanas en pantalla.
        - Estilo visual: Redes neuronales abstractas, líneas cibernéticas brillantes y tono azul oscuro/negro.
        - Texto en pantalla: Transcripción animada en letras grandes blancas sincronizadas con la voz.
        - Identidad de marca: Nombre y logo de Agency AI OS presente en todo momento.
        - Audio: Locución masculina sintética profesional y música de fondo ambiental estilo tech.

        ESTRUCTURA DE CONTENIDO (30s):
        - 0-3s: Gancho disruptivo sobre el tiempo perdido haciendo prompts a mano.
        - 3-20s: Demostración rápida de la Fórmula de 7 Pasos generando resultados.
        - 20-30s: Llamado a la acción (CTA): 'Prueba 10 puntos gratis en https://revenue-os-mvp.vercel.app'.
      `;

      let script = "Guion base automatizado para Agency AI OS.";

      const geminiKey = process.env.GEMINI_KEY;
      if (geminiKey) {
        try {
          const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
          });
          if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            script = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || script;
          }
        } catch (e) {
          console.error("Error al llamar Gemini:", e.message);
        }
      }

      // Disparar renderizado en Google Cloud Workflow
      const workflowUrl = process.env.GOOGLE_WORKFLOW_URL;
      if (workflowUrl && workflowUrl.startsWith('http')) {
        try {
          await fetch(workflowUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              script, 
              languages: ['es-US', 'en-US', 'pt-BR'],
              audio_settings: { voice_type: "AI_professional_male", bg_music: "ambient_tech_subtle" },
              visual_rules: { 
                no_humans: true, 
                theme: "dark_executive_saas",
                background_style: "abstract_neural_networks_glowing_lines_dark_blue",
                text_overlay: "animated_sync_with_audio_large_white",
                outro_logo: "agency_ai_os_logo"
              },
              target_url: "https://revenue-os-mvp.vercel.app" 
            })
          });
        } catch (e) {
          console.error("Error enviando orden a Google Workflow:", e.message);
        }
      }

      return res.status(200).json({ 
        success: true, 
        mode: 'AM', 
        message: "Rutina matutina ejecutada correctamente",
        script_generated: script 
      });
    }

    // --- RUTINA PM (06:00 PM): Medición y Reporte en Telegram ---
    if (mode === 'PM') {
      const today = new Date().toISOString().split('T')[0];
      let newSignups = 0;
      let trialsActive = 0;
      let conversions = 0;

      // Sanitizar URL de Supabase
      let rawSupabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

      if (rawSupabaseUrl) {
        if (!rawSupabaseUrl.startsWith('http://') && !rawSupabaseUrl.startsWith('https://')) {
          rawSupabaseUrl = `https://${rawSupabaseUrl}`;
        }
        rawSupabaseUrl = rawSupabaseUrl.replace(/\/+$/, '');
      }

      if (rawSupabaseUrl && supabaseKey) {
        try {
          const endpoint = `${rawSupabaseUrl}/rest/v1/app_access?select=plan,points_remaining,created_at&created_at=gte.${today}`;
          const supaRes = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            }
          });

          if (supaRes.ok) {
            const users = await supaRes.json();
            if (Array.isArray(users)) {
              newSignups = users.length;
              trialsActive = users.filter(u => u.plan === 'trial').length;
              conversions = users.filter(u => u.plan !== 'trial').length;
            }
          }
        } catch (e) {
          console.error("Error consultando Supabase REST:", e.message);
        }
      }

      // Sanitizar token y Chat ID de Telegram
      let telegramToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || "";
      let telegramChatId = process.env.TELEGRAM_CHAT_ID || "";

      if (telegramToken.startsWith('bot')) {
        telegramToken = telegramToken.replace(/^bot/, '');
      }

      const telegramMessage = `
📊 *REPORTE DIARIO DE CRECIMIENTO - AGENCY AI OS*
📅 Fecha: ${today}

🚀 *Métricas de Marketing:*
• Tareas ejecutadas: Video Viral AM (es-US, en-US, pt-BR)
• Estilo: Redes Neuronales / Voz IA / Tipografía
• Registros Nuevos: *${newSignups}*
• Usuarios en Prueba (10 pts): *${trialsActive}*
• Conversiones/Pagos (Hotmart): *${conversions}*

📈 *Estado del Embudo:*
Atracción automatizada ejecutada. Saldo gastado en la app derivando al muro de pago.
      `;

      let telegramSent = false;
      if (telegramToken && telegramChatId) {
        try {
          const telegramRes = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramChatId,
              text: telegramMessage,
              parse_mode: 'Markdown'
            })
          });
          if (telegramRes.ok) {
            telegramSent = true;
          }
        } catch (e) {
          console.error("Error enviando mensaje a Telegram:", e.message);
        }
      }

      return res.status(200).json({ 
        success: true, 
        mode: 'PM', 
        telegram_sent: telegramSent,
        metrics: { newSignups, trialsActive, conversions } 
      });
    }

  } catch (err) {
    return res.status(200).json({ 
      success: false, 
      error: err.message || "Error interno procesado" 
    });
  }
};
