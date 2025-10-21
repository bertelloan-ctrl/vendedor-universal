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

app.post('/incoming-call', (req, res) => {
  const { From, CallSid } = req.body;
  const clientId = req.query.client || 'default';
  console.log(`📞 ${From}`);

  const twiml = new VoiceResponse();
  twiml.connect().stream({
    url: `wss://${req.headers.host}/media-stream?client=${clientId}&callSid=${CallSid}`
  });

  res.type('text/xml').send(twiml.toString());
});

app.ws('/media-stream', (ws, req) => {
  const config = getClientConfig(req.query.client || 'default');
  let openAiWs, streamSid;

  openAiWs = new WebSocket(
    'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
    { headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'OpenAI-Beta': 'realtime=v1' }}
  );

  openAiWs.on('open', () => {
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
      ws.send(JSON.stringify({ event: 'media', streamSid, media: { payload: r.delta }}));
    }
  });

  ws.on('message', (msg) => {
    const m = JSON.parse(msg);
    if (m.event === 'start') streamSid = m.start.streamSid;
    else if (m.event === 'media' && openAiWs.readyState === 1) {
      openAiWs.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: m.media.payload }));
    }
    else if (m.event === 'stop') openAiWs.close();
  });

  ws.on('close', () => openAiWs.close());
});

app.post('/api/clients/:clientId/config', (req, res) => {
  const config = req.body;
  config.client_id = req.params.clientId;
  clientConfigs.set(req.params.clientId, config);
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`🚀 ${PORT}`));