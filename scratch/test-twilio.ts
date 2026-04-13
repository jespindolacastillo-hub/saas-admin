// 🧪 Script de prueba para validar credenciales de Twilio
// Ejecútalo con: deno run --allow-env --allow-net test-twilio.ts

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM") || "whatsapp:+14155238886"; // Sandbox default

// Cambia esto por tu número para recibir la prueba
const TEST_RECEIVER = "whatsapp:+5215512345678"; 

async function testTwilio() {
  console.log("🚀 Iniciando prueba de Twilio...");
  
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error("❌ ERROR: Faltan variables de entorno TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN");
    return;
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  
  const body = new URLSearchParams({
    From: TWILIO_WHATSAPP_FROM,
    To: TEST_RECEIVER,
    Body: "🧪 Prueba de Retelio: Si recibes esto, la integración de WhatsApp está funcionando correctamente al 100%.",
  });

  try {
    const res = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const data = await res.json();

    if (res.ok) {
      console.log("✅ ÉXITO: Mensaje enviado correctamente.");
      console.log("SID del mensaje:", data.sid);
    } else {
      console.error("❌ FALLÓ la conexión con Twilio:");
      console.error(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error("❌ ERROR de red:", err);
  }
}

testTwilio();
