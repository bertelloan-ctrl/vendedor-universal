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
const callClientMap = new Map();

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
  return `Eres ${config.company_name && config.company_name !== 'Empresa Demo' ? 'un vendedor de ' + config.company_name : 'un vendedor profesional'}. 

ESTILO DE CONVERSACIÓN:
- Hablas de forma NATURAL y HUMANA, como una persona real
- Usas muletillas ocasionales: "eee", "mmm", "bueno", "pues", "este"
- No eres perfecto: a veces reformulas ideas
- Eres cálido, amigable pero profesional
- Hablas en español mexicano casual pero profesional

SOBRE TI Y TU EMPRESA:
${config.company_name ? `- Trabajas en ${config.company_name}` : ''}
${config.industry ? `- Industria: ${config.industry}` : ''}
${config.products ? `- Productos: ${config.products.join(', ')}` : ''}
${config.value_proposition ? `- Promesa clave: ${config.value_proposition}` : ''}
${config.conditions ? `- Condiciones: Precios ${config.conditions.pricing || 'competitivos'}, pedido mínimo ${config.conditions.min_order || 'flexible'}, cobertura en ${config.conditions.coverage || 'toda la república'}` : ''}

FLUJO DE CONVERSACIÓN:
1. Saludo breve y directo: "Hola, ¿qué tal? Soy [nombre] de ${config.company_name || 'la empresa'}. Eee... te llamaba para ver si manejas [productos relevantes]"
2. Pregunta de calificación: "¿Ustedes compran/usan [productos] actualmente?"
3. Si usan: "Perfecto, mmm... ¿y con quién trabajan ahorita?"
4. Propuesta de valor: "Mira, nosotros... bueno, lo que hacemos es [beneficio principal]. ¿Te interesaría que te platicara más?"
5. Si hay interés: "¿A qué correo te mando la info?" o "¿Cuándo podríamos agendar una llamada?"
6. Si no hay interés: "Va, sin problema. Cualquier cosa, aquí andamos. ¡Suerte!"

REGLAS IMPORTANTES:
- NO uses listas numeradas al hablar
- Frases CORTAS (máximo 2 oraciones seguidas)
- Responde RÁPIDO, no des discursos largos
- Si te interrumpen, NO repitas lo que ibas a decir
- Si dicen "no gracias", acepta amablemente y cierra
- NO insistas si no hay interés
- Suena NATURAL: "este...", "o sea", "pues mira"`;
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', clients: clientConfigs.size });
});

app.post('/incoming-call', (req, res) => {
  const { From, CallSid } = req.body;
  const clientId = req.query.client || 'default';
  
  callClientMap.set(CallSid, clientId);
  
  console.log(`📞 Llamada de ${From} | CallSid: ${CallSid} | Cliente: ${clientId}`);
  
  const twiml = new VoiceResponse();
  twiml.connect().stream({
    url: `wss://${req.headers.host}/media-stream`
  });
  
  res.type('text/xml').send(twiml.toString());
});

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
        
        if (callClientMap.has(callSid)) {
          clientId = callClientMap.get(callSid);
          config = getClientConfig(clientId);
          console.log(`🎙️ WebSocket conectado | CallSid: ${callSid} | Cliente: ${clientId} | Empresa: ${config.company_name}`);
        }
        
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
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500
              },
              input_audio_format: 'g711_ulaw',
              output_audio_format: 'g711_ulaw',
              voice: 'shimmer',
              instructions: buildPrompt(config),
              temperature: 0.8,
              max_response_output_tokens: 150
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
        if (callSid) callClientMap.delete(callSid);
        if (openAiWs) openAiWs.close();
      }
    } catch (error) {
      console.error('❌ Error procesando mensaje WebSocket:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket cliente cerrado');
    if (callSid) callClientMap.delete(callSid);
    if (openAiWs) openAiWs.close();
  });
});

app.post('/api/clients/:clientId/config', (req, res) => {
  const config = req.body;
  config.client_id = req.params.clientId;
  clientConfigs.set(req.params.clientId, config);
  console.log(`✅ Config guardada para ${req.params.clientId}`);
  res.json({ success: true, clientId: req.params.clientId });
});

app.get('/api/clients/:clientId/config', (req, res) => {
  const config = getClientConfig(req.params.clientId);
  res.json(config);
});

app.listen(PORT, () => {
  console.log(`🚀 Vendedor Universal corriendo en puerto ${PORT}`);
  console.log(`📞 Endpoint: /incoming-call`);
  console.log(`⚙️  API Config: /api/clients/:clientId/config`);
});