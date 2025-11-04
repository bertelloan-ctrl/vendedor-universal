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
  return `Eres vendedor de ${config.company_name}. Saluda y ayuda. Español.`;
}

// Endpoint de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', clients: clientConfigs.size });
});

// Endpoint para recibir llamadas de Twilio
app.post('/incoming-call', (req, res) => {
  const { From, CallSid } = req.body;
  const clientId = req.query.client || 'default';
  
  console.log(`📞 Llamada de ${From}`);
  
  const twiml = new VoiceResponse();
  twiml.connect().stream({
    url: `wss://${req.headers.host}/media-stream?client=${clientId}&callSid=${CallSid}`
  });
  
  res.type('text/xml').send(twiml.toString());
});

// WebSocket para streaming de audio
app.ws('/media-stream', (ws, req) => {
  const config = getClientConfig(req.query.client || 'default');
  let openAiWs, streamSid;
  
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
    console.log('✅ OpenAI WebSocket conectado');
    openAiWs.send(JSON.stringify({
      type: 'session.update',
      session: {
        turn_detection: { type: 'server_vad' },
        input_audio_format: 'g711_ulaw',
        output_audio_format: 'g711_ulaw',
        voice: 'alloy',
        instructions: buildPrompt(config)
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
  
  ws.on('message', (msg) => {
    const m = JSON.parse(msg);
    if (m.event === 'start') {
      streamSid = m.start.streamSid;
      console.log(`🎙️ Stream iniciado: ${streamSid}`);
    }
    else if (m.event === 'media' && openAiWs.readyState === 1) {
      openAiWs.send(JSON.stringify({ 
        type: 'input_audio_buffer.append', 
        audio: m.media.payload 
      }));
    }
    else if (m.event === 'stop') {
      console.log('🛑 Stream detenido');
      openAiWs.close();
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket cliente cerrado');
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