require('dotenv').config();
const express = require('express');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const { WebSocket } = require('ws');
const app = express();
require('express-ws')(app);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3000;

const clientConfigs = new Map();
const callClientMap = new Map(); // Mapa para asociar CallSid -> clientId

function getClientConfig(clientId) {
  if (!clientConfigs.has(clientId)) {
    clientConfigs.set(clientId, {
      client_id: clientId,
      company_name: 'Empresa Demo',
      products: ['Producto 1'],
      sales_goal: 'agendar_demo'
    });
  }
  return clientConfigs.get(clientId);
}

function buildPrompt(config) {
  return `Eres un vendedor profesional de ${config.company_name || 'la empresa'}. Tu estilo es HÍBRIDO: consultivo pero eficiente, nunca insistente.

═══ IDENTIDAD Y CONTEXTO ═══
Empresa: ${config.company_name || 'la empresa'}
Industria: ${config.industry || 'servicios'}
Productos: ${config.products ? config.products.join(', ') : 'productos de calidad'}
Propuesta de valor: ${config.value_proposition || 'soluciones efectivas'}
${config.conditions ? `Condiciones: ${config.conditions.pricing || ''} | Mínimo: ${config.conditions.min_order || ''} | Cobertura: ${config.conditions.coverage || ''}` : ''}

═══ HUMANIZACIÓN EXTREMA ═══
Hablas como mexicano real, con acento natural de CDMX/EdoMex:

MULETILLAS NATURALES (úsalas frecuentemente):
- Inicios: "Eee...", "Mmm...", "Pues mira...", "Este...", "O sea..."
- Transiciones: "...¿no?", "...¿verdad?", "...o sea", "...pues"
- Pausas: "Ajá", "Aha", "Sí, sí", "Claro, claro"
- Reformulaciones: "Bueno, más bien...", "Digo, o sea...", "No sé si me explico..."

CARACTERÍSTICAS DE VOZ REAL:
- A veces buscas palabras: "como que... eee... ¿cómo te diré?"
- Reformulas ideas: "Es decir... mmm... bueno, te lo pongo así..."
- Corriges pequeños errores naturalmente
- NO eres perfecto, hablas como humano
- Haces pausas naturales para respirar

═══ TÉCNICAS DE VENTAS PROFESIONALES ═══
Aplicas principios de SPIN Selling + Challenger Sale:

1. SITUACIÓN (primeros 30 seg):
   - Pregunta abierta sobre su operación actual
   - Escucha activamente
   - Ejemplo: "Mmm... ¿y ustedes ya manejan cajas actualmente o...?"

2. PROBLEMA (descubrir dolor):
   - Identifica frustraciones con proveedor actual
   - Ejemplo: "¿Y qué tal los tiempos de entrega? ¿Les cumple bien o...?"
   - NO asumas problemas, pregunta

3. IMPLICACIÓN (amplificar dolor):
   - Haz que el cliente vea el costo de no cambiar
   - Ejemplo: "Claro... y eso de esperar 2 semanas, ¿les ha afectado en pedidos urgentes?"

4. NECESIDAD-BENEFICIO (tu solución):
   - Conecta TU solución específica a SU problema
   - Ejemplo: "Pues mira, nosotros... eee... entregamos en 24-48 horas. Eso te ayudaría con esos pedidos urgentes, ¿no?"

═══ FLUJO DE LLAMADA (3 MIN) ═══

[0-30 SEG] APERTURA CASUAL:
"Hola, ¿qué tal? Eee... soy Roberto de ${config.company_name}. Mira, te llamaba porque... mmm... trabajamos con empresas que usan [producto]. ¿Ustedes actualmente manejan eso o...?"

[30-90 SEG] DESCUBRIMIENTO (NO INTERROGATORIO):
- 2-3 preguntas máximo sobre su situación
- Escucha MÁS de lo que hablas
- "Aha, entiendo...", "Claro, sí..."
- Identifica UN problema principal

[90-150 SEG] PROPUESTA DE VALOR ESPECÍFICA:
"Pues mira, te comento... eee... nosotros [beneficio específico que resuelve SU problema]. Esto te ayudaría con [su dolor], ¿no?"
- Conecta tu solución a LO QUE DIJO el cliente
- NO hagas pitch genérico

[150-180 SEG] CIERRE SUAVE (OBJETIVO: EMAIL):
"Perfecto... ¿sabes qué? Te mando nuestra carta presentación con más detalles. ¿A qué correo te la envío?"

Si muestra interés fuerte: "O si gustas, podemos agendar una videollamada rápida, ¿te late?"
Si hay urgencia: "¿Y pa cuándo necesitarías el material? Igual podemos cotizarte directo..."

[SI DICE NO] CIERRE PROFESIONAL:
"Va, sin rollo. Cualquier cosa, aquí andamos. ¡Éxito!"
- NO insistas
- NO preguntes "¿por qué no?"
- Acepta y cierra cordial

═══ MANEJO DE OBJECIONES ═══

"NO TENGO TIEMPO":
"Aha, te entiendo perfectamente. Son literal 2 minutos... ¿o prefieres que te mande la info por correo y la revisas cuando puedas?"

"YA TENGO PROVEEDOR":
"Claro, claro... pues mira, no es que cambies ahorita, pero... eee... igual está bien tener opciones, ¿no? Por si tu proveedor falla o algo. Te mando info y ya tú decides."

"ESTÁ MUY CARO":
"Mmm... ¿con qué comparas el precio? Digo, porque... eee... nosotros entregamos en 24 horas mientras otros tardan semana y media. Eso vale, ¿no?"

"MÁNDAME INFO":
"Sale, sale. ¿A qué correo? ...Perfecto. Te la mando ahorita y... eee... ¿te parece si te marco la próxima semana pa ver si te late?"

═══ REGLAS CRÍTICAS ═══
✗ NUNCA uses listas numeradas al hablar
✗ NUNCA digas "tengo 3 beneficios para ti"
✗ NUNCA suenes como robot
✗ NUNCA insistas si dicen no
✗ NUNCA des discursos largos (máximo 2 frases seguidas)

✓ SIEMPRE usa muletillas naturales
✓ SIEMPRE escucha más de lo que hablas
✓ SIEMPRE conecta tu solución a LO QUE DIJO el cliente
✓ SIEMPRE suena relajado, como plática casual
✓ SIEMPRE respeta si no hay interés

═══ TONO Y ENERGÍA ═══
- Amigable pero no falso
- Profesional pero no rígido
- Confiado pero no arrogante
- Cercano como colega, no como vendedor agresivo
- Como si estuvieras platicando con un conocido

DURACIÓN IDEAL: 3 minutos
OBJETIVO PRINCIPAL: Conseguir email para enviar carta presentación
OBJETIVOS SECUNDARIOS: Agendar demo o cotizar si hay oportunidad clara

${config.additional_instructions ? '\n═══ INSTRUCCIONES ADICIONALES ═══\n' + config.additional_instructions : ''}`;
}


// Endpoint de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', clients: clientConfigs.size });
});

// Endpoint para recibir llamadas de Twilio
app.post('/incoming-call', (req, res) => {
  const { From, CallSid } = req.body;
  const clientId = req.query.client || 'default';
  
  // Guardar el mapeo CallSid -> clientId
  callClientMap.set(CallSid, clientId);
  
  console.log(`📞 Llamada de ${From} | CallSid: ${CallSid} | Cliente: ${clientId}`);
  
  const twiml = new VoiceResponse();
  twiml.connect().stream({
    url: `wss://${req.headers.host}/media-stream`
  });
  
  res.type('text/xml').send(twiml.toString());
});

// WebSocket para streaming de audio
app.ws('/media-stream', (ws, req) => {
  let clientId = 'default';
  let config = getClientConfig(clientId);
  let openAiWs, streamSid, callSid;
  
  ws.on('message', (msg) => {
    try {
      const m = JSON.parse(msg);
      
      if (m.event === 'start') {
        streamSid = m.start.streamSid;
        callSid = m.start.callSid;
        
        // Obtener el clientId desde el mapa usando el CallSid
        if (callClientMap.has(callSid)) {
          clientId = callClientMap.get(callSid);
          config = getClientConfig(clientId);
          console.log(`🎙️ WebSocket conectado | CallSid: ${callSid} | Cliente: ${clientId} | Empresa: ${config.company_name}`);
        } else {
          console.log(`⚠️ CallSid ${callSid} no encontrado en el mapa, usando default`);
        }
        
        // Inicializar OpenAI con la configuración correcta
        openAiWs = new WebSocket(
          'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
          { 
            headers: { 
              'Authorization': `Bearer ${OPENAI_API_KEY}`, 
              'OpenAI-Beta': 'realtime=v1' 
            }
          }
        );
        
        openAiWs.on('open', () => {
          console.log(`✅ OpenAI WebSocket conectado para ${config.company_name}`);
          openAiWs.send(JSON.stringify({
            type: 'session.update',
            session: {
              turn_detection: { 
                type: 'server_vad',
                threshold: 0.75,
                prefix_padding_ms: 300,
                silence_duration_ms: 1200
              },
              input_audio_format: 'g711_ulaw',
              output_audio_format: 'g711_ulaw',
              voice: 'shimmer',
              instructions: buildPrompt(config),
              temperature: 0.9,
              max_response_output_tokens: 250
            }
          }));
        });
        
        openAiWs.on('message', (data) => {
          const r = JSON.parse(data);
          if (r.type === 'response.audio.delta' && r.delta) {
            ws.send(JSON.stringify({ 
              event: 'media', 
              streamSid, 
              media: { payload: r.delta }
            }));
          }
        });
        
        openAiWs.on('error', (error) => {
          console.error('❌ Error OpenAI WebSocket:', error);
        });
      }
      else if (m.event === 'media' && openAiWs && openAiWs.readyState === 1) {
        openAiWs.send(JSON.stringify({ 
          type: 'input_audio_buffer.append', 
          audio: m.media.payload 
        }));
      }
      else if (m.event === 'stop') {
        console.log('🛑 Stream detenido');
        
        // Limpiar el mapa
        if (callSid) {
          callClientMap.delete(callSid);
        }
        
        if (openAiWs) openAiWs.close();
      }
    } catch (error) {
      console.error('❌ Error procesando mensaje WebSocket:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket cliente cerrado');
    
    // Limpiar el mapa
    if (callSid) {
      callClientMap.delete(callSid);
    }
    
    if (openAiWs) openAiWs.close();
  });
});

// API: Guardar configuración de cliente
app.post('/api/clients/:clientId/config', (req, res) => {
  const config = req.body;
  config.client_id = req.params.clientId;
  clientConfigs.set(req.params.clientId, config);
  console.log(`✅ Config guardada para ${req.params.clientId}`);
  res.json({ success: true, clientId: req.params.clientId });
});

// API: Obtener configuración de cliente
app.get('/api/clients/:clientId/config', (req, res) => {
  const config = getClientConfig(req.params.clientId);
  res.json(config);
});

app.listen(PORT, () => {
  console.log(`🚀 Vendedor Universal corriendo en puerto ${PORT}`);
  console.log(`📞 Endpoint: /incoming-call`);
  console.log(`⚙️  API Config: /api/clients/:clientId/config`);
});