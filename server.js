diff --git a/server.js b/server.js
index f289761c7f96daf8ec4f85de7d41e15a0c1879ff..b9c3ba2b6937983d4f77d979beb7ffafe861bba8 100644
--- a/server.js
+++ b/server.js
@@ -1,53 +1,90 @@
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
 const callTranscripts = new Map();
 
+const DEFAULT_VAD_CONFIG = {
+  threshold: 0.28,
+  prefix_padding_ms: 500,
+  silence_duration_ms: 1200
+};
+
+const SPEECH_START_INTERRUPT_DELAY_MS = 220;
+
 function getClientConfig(clientId) {
   if (!clientConfigs.has(clientId)) {
     clientConfigs.set(clientId, {
       client_id: clientId,
       company_name: 'Empresa Demo',
       products: ['Producto 1'],
-      sales_goal: 'agendar_demo'
+      sales_goal: 'agendar_demo',
+      voice: 'alloy',
+      temperature: 1.1,
+      vad: { ...DEFAULT_VAD_CONFIG }
     });
   }
   return clientConfigs.get(clientId);
 }
 
+function mergeClientConfig(clientId, overrides = {}) {
+  const current = getClientConfig(clientId);
+  const merged = {
+    ...current,
+    ...overrides,
+    client_id: clientId
+  };
+
+  merged.vad = {
+    ...DEFAULT_VAD_CONFIG,
+    ...(current.vad || {}),
+    ...(overrides.vad || {})
+  };
+
+  merged.voice = overrides.voice || current.voice || 'alloy';
+
+  if (typeof overrides.temperature === 'number') {
+    merged.temperature = overrides.temperature;
+  } else if (typeof current.temperature !== 'number') {
+    merged.temperature = 1.1;
+  }
+
+  clientConfigs.set(clientId, merged);
+  return merged;
+}
+
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
 
 CRÍTICO - REGLA DE ORO:
 - MÁXIMO 2-3 FRASES SEGUIDAS, luego PAUSA
 - Habla en BURSTS CORTOS de 5-10 segundos
 - Deja que el cliente responda FRECUENTEMENTE
 - NO hagas monólogos largos NUNCA
 - Energía natural, entusiasta pero breve
 - Sé EXPRESIVO: "¡Perfecto!", "¿Qué tal?", "¡Excelente!"
 
 MULETILLAS NATURALES (úsalas frecuentemente):
 - Inicios: "Eee...", "Mmm...", "Pues mira...", "Este...", "O sea..."
 - Transiciones: "...¿no?", "...¿verdad?", "...o sea", "...pues"
 - Pausas: "Ajá", "Aha", "Sí, sí", "Claro, claro"
@@ -180,252 +217,286 @@ DURACIÓN IDEAL: 3 minutos
 OBJETIVO PRINCIPAL: Conseguir email para enviar carta presentación
 OBJETIVOS SECUNDARIOS: Agendar demo o cotizar si hay oportunidad clara
 
 ${config.additional_instructions ? '\n═══ INSTRUCCIONES ADICIONALES ═══\n' + config.additional_instructions : ''}`;
 }
 
 // Precargar configuración de Allopack al iniciar
 const allopackConfig = {
   client_id: 'allopack_001',
   company_name: 'Allopack',
   industry: 'Empaque industrial y cartón corrugado',
   products: [
     'Cajas de cartón corrugado personalizadas',
     'Cajas troqueladas con diseño',
     'Empaques para ecommerce',
     'Soluciones de empaque industrial'
   ],
   value_proposition: 'Entrega exprés 24-48 horas, calidad ISO 9001:2015, precios 8-15% más competitivos que la competencia',
   conditions: {
     pricing: 'Desde $5 MXN por caja (dependiendo volumen y especificaciones)',
     min_order: '100 cajas mínimo',
     coverage: 'CDMX, Estado de México, Guadalajara, Monterrey',
     delivery_time: '24-48 horas estándar, urgencias en 12 horas'
   },
   sales_goal: 'conseguir_email_y_agendar',
+  voice: 'alloy',
+  temperature: 1.1,
+  vad: {
+    ...DEFAULT_VAD_CONFIG,
+    threshold: 0.32,
+    silence_duration_ms: 1000
+  },
   additional_instructions: `CONTEXTO ESPECÍFICO DE ALLOPACK:
 Somos fabricantes directos, no intermediarios. Tenemos planta en Naucalpan, Estado de México. Nuestros clientes principales son empresas de ecommerce, retailers y distribuidoras. Competimos contra Cartonajes Estrella, Smurfit Kappa y proveedores chinos (pero somos más rápidos). El precio promedio del mercado es $7-12 MXN por caja; nosotros podemos ofrecer desde $5 MXN en volúmenes mayores. Las cajas se cotizan por millar. Las cajas troqueladas llevan diseño pero son más caras. Menciona que trabajamos con Amazon, Mercado Libre y retailers. Si preguntan por certificaciones, menciona ISO 9001:2015. Para pedidos mayores a 1000 cajas, hay descuentos por volumen. En temporada alta (noviembre-diciembre para ecommerce), los tiempos pueden ser de 3-5 días. Siempre preguntar: ¿qué tipo de producto empacan? ¿qué medidas necesitan? ¿cuántas cajas al mes compran? Esto ayuda a dar mejor precio.`
 };
 
 clientConfigs.set('allopack_001', allopackConfig);
 console.log('✅ Configuración de Allopack precargada al iniciar servidor');
 
 app.get('/health', (req, res) => {
   res.json({ 
     status: 'ok', 
     clients: clientConfigs.size,
     uptime: process.uptime(),
     timestamp: new Date().toISOString()
   });
 });
 
 app.post('/incoming-call', (req, res) => {
   const { From, CallSid } = req.body;
   const clientId = req.query.client || 'default';
   
   callClientMap.set(CallSid, clientId);
   
   console.log(`📞 Llamada entrante`);
   console.log(`   De: ${From}`);
   console.log(`   CallSid: ${CallSid}`);
   console.log(`   Cliente: ${clientId}`);
   
   const twiml = new VoiceResponse();
   const connect = twiml.connect();
   connect.stream({
     url: `wss://${req.headers.host}/media-stream`
   });
   
   res.type('text/xml').send(twiml.toString());
 });
 
 app.ws('/media-stream', (ws, req) => {
   let clientId = 'default';
   let config = getClientConfig(clientId);
   let openAiWs, streamSid, callSid;
   let transcript = { client: [], agent: [], captured_data: {}, agent_full_text: '' };
   let sessionInitialized = false;
   let isAgentSpeaking = false;
   let silenceTimeout = null;
   let initialMessageSent = false;
   let audioChunkCount = 0;
+  let speechInterruptionTimer = null;
   
   console.log('🔵 Nueva conexión WebSocket');
   
   ws.on('message', (msg) => {
     try {
       const m = JSON.parse(msg);
       
       if (m.event === 'start') {
         streamSid = m.start.streamSid;
         callSid = m.start.callSid;
         
         console.log(`\n🎙️  Stream iniciado`);
         console.log(`   StreamSid: ${streamSid}`);
         console.log(`   CallSid: ${callSid}`);
         
         callTranscripts.set(callSid, transcript);
         
         if (callClientMap.has(callSid)) {
           clientId = callClientMap.get(callSid);
           config = getClientConfig(clientId);
           console.log(`   Cliente identificado: ${clientId}`);
           console.log(`   Empresa: ${config.company_name}`);
         } else {
           console.log(`⚠️  CallSid no encontrado en mapa, usando config default`);
         }
         
         // Conectar a OpenAI
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
           console.log(`✅ OpenAI conectado para ${config.company_name}`);
           
+          const vadConfig = {
+            ...DEFAULT_VAD_CONFIG,
+            ...(config.vad || {})
+          };
+
           const sessionConfig = {
             type: 'session.update',
             session: {
               modalities: ['text', 'audio'],
               turn_detection: { 
                 type: 'server_vad',
-                threshold: 0.15,
-                prefix_padding_ms: 600,
-                silence_duration_ms: 1000
+                ...vadConfig
               },
               input_audio_format: 'g711_ulaw',
               output_audio_format: 'g711_ulaw',
-              voice: 'echo',
+              voice: config.voice || 'alloy',
               instructions: buildPrompt(config),
-              temperature: 1.0,
+              temperature: typeof config.temperature === 'number' ? config.temperature : 1.0,
               max_response_output_tokens: 'inf',
               input_audio_transcription: {
                 model: 'whisper-1'
               }
             }
           };
           
           openAiWs.send(JSON.stringify(sessionConfig));
           sessionInitialized = true;
           console.log('📋 Sesión configurada con prompt en español');
           
           // Enviar mensaje inicial para que OpenAI empiece a hablar
           setTimeout(() => {
             if (openAiWs.readyState === 1 && !initialMessageSent) {
               initialMessageSent = true;
               openAiWs.send(JSON.stringify({
                 type: 'conversation.item.create',
                 item: {
                   type: 'message',
                   role: 'user',
                   content: [
                     {
                       type: 'input_text',
                       text: 'Hola'
                     }
                   ]
                 }
               }));
               
               openAiWs.send(JSON.stringify({
                 type: 'response.create'
               }));
               
               console.log('🎬 Conversación iniciada');
             }
           }, 500);
         });
         
         openAiWs.on('message', (data) => {
           try {
             const r = JSON.parse(data);
             
             // Log de TODOS los eventos para debug (solo tipo)
             if (!['response.audio.delta', 'input_audio_buffer.speech_started', 'input_audio_buffer.speech_stopped'].includes(r.type)) {
               console.log(`🔔 OpenAI event: ${r.type}`);
             }
             
             // Detectar cuando el cliente empieza a hablar para interrumpir
             if (r.type === 'input_audio_buffer.speech_started') {
               console.log('🗣️ Cliente empezó a hablar (VAD detectó voz)');
-              
+
               // Cancelar timeout de reenganche ya que el usuario respondió
               if (silenceTimeout) {
                 clearTimeout(silenceTimeout);
                 silenceTimeout = null;
               }
-              
+
+              if (speechInterruptionTimer) {
+                clearTimeout(speechInterruptionTimer);
+              }
+
               if (isAgentSpeaking) {
-                console.log('🛑 Interrumpiendo agente - limpiando buffer de audio');
-                
-                // Limpiar el buffer de audio de Twilio para detener reproducción inmediata
-                ws.send(JSON.stringify({
-                  event: 'clear',
-                  streamSid: streamSid
-                }));
-                
-                // Cancelar la respuesta de OpenAI
-                if (openAiWs.readyState === 1) {
-                  openAiWs.send(JSON.stringify({
-                    type: 'response.cancel'
-                  }));
-                }
-                
-                isAgentSpeaking = false;
+                speechInterruptionTimer = setTimeout(() => {
+                  if (!isAgentSpeaking) {
+                    return;
+                  }
+
+                  console.log('🛑 Interrumpiendo agente - limpiando buffer de audio');
+
+                  if (ws.readyState === WebSocket.OPEN) {
+                    ws.send(JSON.stringify({
+                      event: 'clear',
+                      streamSid: streamSid
+                    }));
+                  }
+
+                  if (openAiWs.readyState === 1) {
+                    openAiWs.send(JSON.stringify({
+                      type: 'response.cancel'
+                    }));
+                  }
+
+                  isAgentSpeaking = false;
+                  speechInterruptionTimer = null;
+                }, SPEECH_START_INTERRUPT_DELAY_MS);
               }
             }
-            
+
             // Detectar cuando el cliente termina de hablar
             if (r.type === 'input_audio_buffer.speech_stopped') {
               console.log('🤐 Cliente dejó de hablar (silencio detectado)');
+              if (speechInterruptionTimer) {
+                clearTimeout(speechInterruptionTimer);
+                speechInterruptionTimer = null;
+              }
             }
             
             // Log especial para response.created
             if (r.type === 'response.created') {
               console.log('📢 OpenAI empezando a generar respuesta...');
               isAgentSpeaking = true;
             }
             
             // Log especial para response.done
             if (r.type === 'response.done') {
               console.log('✅ OpenAI terminó de generar respuesta');
               isAgentSpeaking = false;
+              if (speechInterruptionTimer) {
+                clearTimeout(speechInterruptionTimer);
+                speechInterruptionTimer = null;
+              }
               
               // NO iniciar timeout si acabamos de detectar que el usuario habló hace poco
               // Esto evita el error conversation_already_has_active_response
             }
             
             // Manejar cancelación exitosa
             if (r.type === 'response.cancelled') {
               console.log('🚫 Respuesta cancelada exitosamente');
               isAgentSpeaking = false;
+              if (speechInterruptionTimer) {
+                clearTimeout(speechInterruptionTimer);
+                speechInterruptionTimer = null;
+              }
             }
             
             // CRÍTICO: Enviar audio a Twilio
             if (r.type === 'response.audio.delta' && r.delta) {
               const audioPayload = {
                 event: 'media',
                 streamSid: streamSid,
                 media: {
                   payload: r.delta
                 }
               };
               
               ws.send(JSON.stringify(audioPayload));
               
               // Log solo cada 10 deltas para no saturar
               if (Math.random() < 0.1) {
                 console.log(`🔊 Audio → Twilio (${r.delta.length} chars)`);
               }
             }
             
             // Capturar transcripción del cliente
             if (r.type === 'conversation.item.input_audio_transcription.completed') {
               transcript.client.push(r.transcript);
               console.log(`👤 Cliente: "${r.transcript}"`);
             }
@@ -575,56 +646,60 @@ app.ws('/media-stream', (ws, req) => {
     
     if (callSid && callTranscripts.has(callSid)) {
       const finalTranscript = callTranscripts.get(callSid);
       
       console.log('\n═══════════════════════════════════════');
       console.log('📋 RESUMEN FINAL (WebSocket cerrado)');
       console.log('═══════════════════════════════════════');
       console.log(`\n📊 DATOS CAPTURADOS:`);
       console.log(JSON.stringify(finalTranscript.captured_data, null, 2));
       console.log('═══════════════════════════════════════\n');
     }
     
     if (callSid) {
       callClientMap.delete(callSid);
     }
     
     if (openAiWs) openAiWs.close();
   });
   
   ws.on('error', (error) => {
     console.error('❌ Error en WebSocket de Twilio:', error);
   });
 });
 
 app.post('/api/clients/:clientId/config', (req, res) => {
-  const config = req.body;
-  config.client_id = req.params.clientId;
-  clientConfigs.set(req.params.clientId, config);
+  const mergedConfig = mergeClientConfig(req.params.clientId, req.body || {});
   console.log(`✅ Config guardada para ${req.params.clientId}`);
-  console.log(`   Empresa: ${config.company_name}`);
-  res.json({ success: true, clientId: req.params.clientId, config: config });
+  console.log(`   Empresa: ${mergedConfig.company_name}`);
+  if (mergedConfig.vad) {
+    console.log(
+      `   VAD → threshold:${mergedConfig.vad.threshold} prefix:${mergedConfig.vad.prefix_padding_ms}ms silence:${mergedConfig.vad.silence_duration_ms}ms`
+    );
+  }
+  console.log(`   Voz: ${mergedConfig.voice} | Temperatura: ${mergedConfig.temperature}`);
+  res.json({ success: true, clientId: req.params.clientId, config: mergedConfig });
 });
 
 app.get('/api/clients/:clientId/config', (req, res) => {
   const config = getClientConfig(req.params.clientId);
   res.json(config);
 });
 
 app.get('/api/transcripts/:callSid', (req, res) => {
   const transcript = callTranscripts.get(req.params.callSid);
   if (transcript) {
     res.json(transcript);
   } else {
     res.status(404).json({ error: 'Transcripción no encontrada' });
   }
 });
 
 app.get('/api/transcripts', (req, res) => {
   const allTranscripts = Array.from(callTranscripts.entries()).map(([callSid, data]) => ({
     callSid,
     ...data,
     timestamp: new Date().toISOString()
   }));
   res.json(allTranscripts);
 });
 
