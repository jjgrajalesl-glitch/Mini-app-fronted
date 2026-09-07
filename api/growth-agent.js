import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const { mode } = req.query;

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

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const geminiData = await geminiRes.json();
    const script = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Disparar renderizado en Google Cloud Workflow con estilo visual exacto
    if (process.env.GOOGLE_WORKFLOW_URL) {
      await fetch(process.env.GOOGLE_WORKFLOW_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          script, 
          languages: ['es-US', 'en-US', 'pt-BR'],
          audio_settings: {
            voice_type: "AI_professional_male",
            bg_music: "ambient_tech_subtle"
          },
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
    }

    return res.status(200).json({ success: true, mode: 'AM', script_generated: script });
  }

  // --- RUTINA PM (06:00 PM): Medición y Reporte en Telegram ---
  if (mode === 'PM') {
    const today = new Date().toISOString().split('T')[0];

    // Consultar nuevos usuarios y accesos de hoy en Supabase
    const { data: users, error } = await supabase
      .from('app_access')
      .select('plan, points_remaining, created_at')
      .gte('created_at', today);

    const newSignups = users ? users.length : 0;
    const trialsActive = users ? users.filter(u => u.plan === 'trial').length : 0;
    const conversions = users ? users.filter(u => u.plan !== 'trial').length : 0;

    // Mensaje de Telegram
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

    // Enviar a Telegram
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: telegramMessage,
        parse_mode: 'Markdown'
      })
    });

    return res.status(200).json({ success: true, mode: 'PM', metrics: { newSignups, conversions } });
  }

  return res.status(400).json({ error: "Especifique modo: ?mode=AM o ?mode=PM" });
}
