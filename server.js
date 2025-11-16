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

CRÍTICO - REGLA DE ORO:
- MÁXIMO 3-5 PALABRAS por frase
- PAUSA obligatoria después de cada frase
- Habla como WhatsApp: mensajes cortos y rápidos
- NO hagas oraciones largas NUNCA
- Energía natural, entusiasta pero ULTRA breve
- Sé EXPRESIVO: "¡Perfecto!", "¿Qué tal?", "¡Excelente!"

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

═══ TÉCNICA: PREGUNTAS CORTAS ═══
1. Pregunta inicial: "¿Ya manejan cajas?" (BREVE)
2. Si tienen proveedor: "¿Qué tal les va?" (PAUSA - espera respuesta)
3. Encuentra UN problema: "¿Los tiempos de entrega?" (CORTO)
4. Ofrece solución BREVE: "Nosotros entregamos en 24-48h"
5. Pregunta de cierre: "¿Te interesa info?"

NUNCA hables más de 10 segundos sin parar

═══ FLUJO: MICRO-FRASES ═══

CRÍTICO: Habla en MICRO-BURSTS de 3-5 PALABRAS MÁXIMO

SALUDO:
"Hola."
[PAUSA]
"Soy Roberto de Allopack."
[PAUSA]

PROPÓSITO:
"Hacemos cajas."
[PAUSA]
"¿Ustedes usan?"
[PAUSA - ESCUCHA]

Si dicen SÍ:
"Ah, perfecto."
[PAUSA]
"¿Qué tal va?"
[PAUSA - ESCUCHA]

NUNCA digas más de 5 palabras seguidas

═══ MANEJO DE SILENCIOS ═══
NUNCA dejes silencios largos:
- Si piensas → usa "mmm..." o "este..." INMEDIATO
- Si procesas → "a ver..." o "claro, claro..."
- RELLENA con muletillas mientras piensas
- NO anuncies que estás pensando
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

═══ CAPTURA DE DATOS CRÍTICOS ═══

EMAILS Y TELÉFONOS:
Cuando captures email o teléfono, REPÍTELO LETRA POR LETRA:

EMAIL:
"Perfecto, ¿a qué correo? ... Aha, entonces es: equis-ele-@allopack.com, ¿correcto?"
- Deletrea CADA letra EXACTAMENTE como la escuchaste, sin agregar ni quitar nada
- Confirma SIEMPRE letra por letra
- Si el email es "bertello@gmail.com", di "be-e-ere-te-e-ele-ele-o arroba gmail punto com"
- NO agregues letras que no escuchaste
- NO asumas prefijos como "al" o "el"
- Repite EXACTAMENTE lo que el cliente dijo

TELÉFONO:
"¿Y tu teléfono? ... Okay, anoto: cinco-cinco-uno-dos-tres-cuatro-cinco-seis-siete-ocho, ¿está bien?"
- Repite número por número
- Confirma SIEMPRE

MARCA CON ETIQUETAS:
Cuando captures datos, usa estas etiquetas en tu respuesta:
- Email: "[EMAIL:correo@ejemplo.com]"
- Teléfono: "[PHONE:5512345678]"
- Nombre: "[NAME:Roberto García]"
- Empresa cliente: "[COMPANY:Coca Cola]"

Ejemplo: "Perfecto Roberto [NAME:Roberto García], te mando la info a roberto@cocacola.com [EMAIL:roberto@cocacola.com]"

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
✗ NUNCA sigas hablando si el cliente te interrumpe

✓ SIEMPRE usa muletillas naturales
✓ SIEMPRE escucha más de lo que hablas
✓ SIEMPRE conecta tu solución a LO QUE DIJO el cliente
✓ SIEMPRE suena relajado, como plática casual
✓ SIEMPRE respeta si no hay interés
✓ SIEMPRE detente inmediatamente si el cliente empieza a hablar
✓ SI el cliente te interrumpe, deja de hablar y escucha

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
          
          const sessionConfig = {
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              turn_detection: { 
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 700
              },
              input_audio_format: 'g711_ulaw',
              output_audio_format: 'g711_ulaw',
              voice: 'echo',
              instructions: buildPrompt(config),
              temperature: 1.0,
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
              
              // Cancelar timeout de reenganche ya que el usuario respondió
              if (silenceTimeout) {
                clearTimeout(silenceTimeout);
                silenceTimeout = null;
              }
              
              if (isAgentSpeaking) {
                console.log('🛑 Interrumpiendo agente - limpiando buffer de audio');
                
                // PRIMERO: Limpiar buffer de Twilio INMEDIATAMENTE
                ws.send(JSON.stringify({
                  event: 'clear',
                  streamSid: streamSid
                }));
                
                // SEGUNDO: Cancelar generación de OpenAI
                setTimeout(() => {
                  if (openAiWs.readyState === 1) {
                    openAiWs.send(JSON.stringify({
                      type: 'response.cancel'
                    }));
                  }
                }, 50); // 50ms delay para que clear se procese primero
                
                isAgentSpeaking = false;
              }
            }
            
            // Detectar cuando el cliente termina de hablar
            if (r.type === 'input_audio_buffer.speech_stopped') {
              console.log('🤐 Cliente dejó de hablar (silencio detectado)');
            }
            
            // Detectar cuando REALMENTE empieza a generar audio (no solo la respuesta)
            if (r.type === 'response.audio.delta' && !isAgentSpeaking) {
              isAgentSpeaking = true;
            }
            
            // Log especial para response.created
            if (r.type === 'response.created') {
              console.log('📢 OpenAI empezando a generar respuesta...');
            }
            
            // Log especial para response.done
            if (r.type === 'response.done') {
              console.log('✅ OpenAI terminó de generar respuesta');
              isAgentSpeaking = false;
              
              // NO iniciar timeout si acabamos de detectar que el usuario habló hace poco
              // Esto evita el error conversation_already_has_active_response
            }
            
            // Manejar cancelación exitosa
            if (r.type === 'response.cancelled') {
              console.log('🚫 Respuesta cancelada exitosamente');
              isAgentSpeaking = false;
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
            
            // Capturar respuesta del agente (texto)
            if (r.type === 'response.audio_transcript.delta' && r.delta) {
              console.log(`🤖 Agente: ${r.delta}`);
              
              // Acumular texto completo del agente
              transcript.agent_full_text += r.delta;
              
              // Buscar etiquetas en el texto completo acumulado
              const emailMatch = transcript.agent_full_text.match(/\[EMAIL:([^\]]+)\]/);
              const phoneMatch = transcript.agent_full_text.match(/\[PHONE:([^\]]+)\]/);
              const nameMatch = transcript.agent_full_text.match(/\[NAME:([^\]]+)\]/);
              const companyMatch = transcript.agent_full_text.match(/\[COMPANY:([^\]]+)\]/);
              
              if (emailMatch && !transcript.captured_data.email) {
                transcript.captured_data.email = emailMatch[1];
                console.log(`📧 Email capturado: ${emailMatch[1]}`);
              }
              if (phoneMatch && !transcript.captured_data.phone) {
                transcript.captured_data.phone = phoneMatch[1];
                console.log(`📞 Teléfono capturado: ${phoneMatch[1]}`);
              }
              if (nameMatch && !transcript.captured_data.name) {
                transcript.captured_data.name = nameMatch[1];
                console.log(`👤 Nombre capturado: ${nameMatch[1]}`);
              }
              if (companyMatch && !transcript.captured_data.company) {
                transcript.captured_data.company = companyMatch[1];
                console.log(`🏢 Empresa capturada: ${companyMatch[1]}`);
              }
            }
            
            // Capturar datos al finalizar respuesta
            if (r.type === 'response.done' && r.response?.output) {
              r.response.output.forEach(item => {
                if (item.type === 'message' && item.content) {
                  item.content.forEach(content => {
                    if (content.type === 'text') {
                      transcript.agent.push(content.text);
                      
                      // Extraer datos etiquetados
                      const emailMatch = content.text.match(/\[EMAIL:([^\]]+)\]/);
                      const phoneMatch = content.text.match(/\[PHONE:([^\]]+)\]/);
                      const nameMatch = content.text.match(/\[NAME:([^\]]+)\]/);
                      const companyMatch = content.text.match(/\[COMPANY:([^\]]+)\]/);
                      
                      if (emailMatch) {
                        transcript.captured_data.email = emailMatch[1];
                        console.log(`📧 Email capturado: ${emailMatch[1]}`);
                      }
                      if (phoneMatch) {
                        transcript.captured_data.phone = phoneMatch[1];
                        console.log(`📞 Teléfono capturado: ${phoneMatch[1]}`);
                      }
                      if (nameMatch) {
                        transcript.captured_data.name = nameMatch[1];
                        console.log(`👤 Nombre capturado: ${nameMatch[1]}`);
                      }
                      if (companyMatch) {
                        transcript.captured_data.company = companyMatch[1];
                        console.log(`🏢 Empresa capturada: ${companyMatch[1]}`);
                      }
                    }
                  });
                }
              });
            }
            
            // Log de errores (excepto errores de cancelación esperados)
            if (r.type === 'error') {
              if (r.error?.code === 'response_cancel_not_active') {
                // Ignorar este error - es normal cuando no hay respuesta activa
                console.log('⚠️ Intento de cancelar sin respuesta activa (ignorado)');
              } else if (r.error?.code === 'conversation_already_has_active_response') {
                // Ignorar este error - ocurre cuando el reenganche se activa mientras hay respuesta
                console.log('⚠️ Ya hay una respuesta activa (ignorado)');
              } else {
                console.error('❌ Error de OpenAI:', r.error);
              }
            }
            
          } catch (error) {
            console.error('❌ Error procesando mensaje de OpenAI:', error);
          }
        });
        
        openAiWs.on('error', (error) => {
          console.error('❌ Error en WebSocket de OpenAI:', error);
        });
        
        openAiWs.on('close', () => {
          console.log('🔌 WebSocket de OpenAI cerrado');
        });
      }
      else if (m.event === 'media' && openAiWs && openAiWs.readyState === 1) {
        // Enviar audio del cliente a OpenAI
        if (sessionInitialized) {
          openAiWs.send(JSON.stringify({ 
            type: 'input_audio_buffer.append', 
            audio: m.media.payload 
          }));
          
          // Log cada 20 paquetes para ver flujo de audio
          audioChunkCount++;
          if (audioChunkCount % 20 === 0) {
            console.log(`🎤 Audio recibido: ${audioChunkCount} chunks (${m.media.payload.length} chars)`);
          }
        }
      }
      else if (m.event === 'stop') {
        console.log('\n🛑 Stream detenido');
        
        if (callSid && callTranscripts.has(callSid)) {
          const finalTranscript = callTranscripts.get(callSid);
          
          console.log('\n═══════════════════════════════════════');
          console.log('📋 RESUMEN DE LLAMADA');
          console.log('═══════════════════════════════════════');
          console.log(`CallSid: ${callSid}`);
          console.log(`Cliente: ${clientId} (${config.company_name})`);
          console.log(`\n📊 DATOS CAPTURADOS:`);
          console.log(JSON.stringify(finalTranscript.captured_data, null, 2));
          console.log(`\n💬 TRANSCRIPCIÓN CLIENTE:`);
          finalTranscript.client.forEach((msg, i) => {
            console.log(`  ${i+1}. ${msg}`);
          });
          console.log('═══════════════════════════════════════\n');
        }
        
        if (callSid) {
          callClientMap.delete(callSid);
          setTimeout(() => callTranscripts.delete(callSid), 3600000);
        }
        
        if (openAiWs) openAiWs.close();
      }
    } catch (error) {
      console.error('❌ Error procesando mensaje WebSocket:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket de Twilio cerrado');
    
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
  const config = req.body;
  config.client_id = req.params.clientId;
  clientConfigs.set(req.params.clientId, config);
  console.log(`✅ Config guardada para ${req.params.clientId}`);
  console.log(`   Empresa: ${config.company_name}`);
  res.json({ success: true, clientId: req.params.clientId, config: config });
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

app.listen(PORT, () => {
  console.log(`\n🚀 ═══════════════════════════════════════════`);
  console.log(`   VENDEDOR UNIVERSAL - SERVIDOR ACTIVO`);
  console.log(`═══════════════════════════════════════════\n`);
  console.log(`📡 Puerto: ${PORT}`);
  console.log(`📞 Endpoint llamadas: POST /incoming-call?client=CLIENT_ID`);
  console.log(`⚙️  Config API: POST /api/clients/:id/config`);
  console.log(`📊 Transcripciones: GET /api/transcripts`);
  console.log(`💚 Health check: GET /health`);
  console.log(`\n📦 Clientes precargados: ${clientConfigs.size}`);
  console.log(`   - allopack_001: ${allopackConfig.company_name}`);
  console.log(`\n✅ Listo para recibir llamadas\n`);
});