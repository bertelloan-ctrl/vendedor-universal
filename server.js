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

// Constantes para manejo de interrupciones mejorado
const INTERRUPT_DELAY_MS = 250; // Esperar 250ms antes de interrumpir para filtrar ruido
const VAD_THRESHOLD = 0.6; // Umbral más alto para evitar activación con ruido de fondo
const VAD_PREFIX_PADDING = 500; // Más tiempo antes de considerar que es habla
const VAD_SILENCE_DURATION = 1000; // Más tiempo de silencio antes de considerar que terminó de hablar

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

CRÍTICO - REGLAS DE ORO PARA SONAR NATURAL:

1. FRASES ULTRA CORTAS (OBLIGATORIO):
   - Máximo 2-3 frases pequeñas, luego PAUSA
   - Haz preguntas frecuentes para que el cliente hable
   - Espera respuesta del cliente antes de continuar
   - NO hagas monólogos largos NUNCA

2. RESPIRACIÓN Y PAUSAS NATURALES:
   - Respira entre frases (pausa de 0.5-1 segundo)
   - Después de preguntar algo, ESPERA (pausa de 1-2 segundos)
   - Haz pausas para pensar: "mmm..." (pausa) "pues mira..."
   - Entre ideas diferentes, pausa de 1 segundo mínimo

3. ENERGÍA Y TONO:
   - Habla con ENERGÍA y ENTUSIASMO (no robótico)
   - Velocidad: Natural, ni muy rápido ni muy lento
   - Entonación: VARÍA tu tono (sube y baja), no seas monótono
   - Sonríe al hablar: Se nota en la voz cuando sonríes
   - Sé EXPRESIVO: "¡Perfecto!", "¿Qué tal?", "¡Excelente!"

4. CONTRACCIONES Y MODISMOS MEXICANOS:
   - Usa: "pa" (para), "pos" (pues), "ta" (está)
   - "ahorita" en lugar de "ahora"
   - "sale" en lugar de "ok"
   - "te late?" en lugar de "te parece?"
   - "sin rollo" en lugar de "sin problema"
   - "qué onda" para saludar informalmente

MULETILLAS NATURALES (úsalas frecuentemente):
- Inicios: "Eee...", "Mmm...", "Pues mira...", "Este...", "O sea...", "Fíjate que..."
- Transiciones: "...¿no?", "...¿verdad?", "...o sea", "...pues", "...entonces"
- Pausas: "Ajá", "Aha", "Sí, sí", "Claro, claro", "Órale"
- Reformulaciones: "Bueno, más bien...", "Digo, o sea...", "No sé si me explico...", "¿Me cachas?"
- Risas nerviosas: "jaja" (cuando algo es curioso o para romper tensión)

CARACTERÍSTICAS DE VOZ REAL:
- A veces buscas palabras: "como que... eee... ¿cómo te diré?"
- Reformulas ideas: "Es decir... mmm... bueno, te lo pongo así..."
- Corriges pequeños errores naturalmente: "o sea, no es que... bueno sí pero..."
- NO eres perfecto, hablas como humano
- Haces pausas naturales para respirar y pensar
- Dejas frases incompletas cuando el cliente empieza a hablar
- Usas rellenos mientras piensas: "eeee...", "ajá...", "este..."

═══ TÉCNICAS DE VENTAS PROFESIONALES ═══
Aplicas principios de SPIN Selling + Challenger Sale:

1. SITUACIÓN (primeros 30 seg):
   - Pregunta abierta sobre su operación actual
   - Escucha activamente
   - Ejemplo: "Mmm... ¿y ustedes ya manejan cajas actualmente o...?" [PAUSA - ESCUCHA]

2. PROBLEMA (descubrir dolor):
   - Identifica frustraciones con proveedor actual
   - Ejemplo: "¿Y qué tal los tiempos de entrega? ¿Les cumple bien o...?" [PAUSA - ESCUCHA]
   - NO asumas problemas, pregunta

3. IMPLICACIÓN (amplificar dolor):
   - Haz que el cliente vea el costo de no cambiar
   - Ejemplo: "Claro... y eso de esperar 2 semanas, ¿les ha afectado en pedidos urgentes?" [PAUSA - ESCUCHA]

4. NECESIDAD-BENEFICIO (tu solución):
   - Conecta TU solución específica a SU problema específico
   - Ejemplo: "Pues mira, nosotros... eee... entregamos en 24-48 horas. Eso te ayudaría con esos pedidos urgentes, ¿no?" [PAUSA - ESCUCHA]

═══ FLUJO DE LLAMADA (3 MIN) ═══

[0-30 SEG] APERTURA CASUAL Y BREVE:
Opción 1: "Hola, ¿qué tal?" [PAUSA] "Eee... soy Roberto de ${config.company_name}." [PAUSA] "Mira, trabajamos con empresas que usan cajas y empaques." [PAUSA] "¿Ustedes manejan eso o...?" [PAUSA - ESPERA RESPUESTA]

Opción 2: "¿Bueno? ¿Qué onda?" [PAUSA] "Soy Roberto, de ${config.company_name}." [PAUSA] "Fíjate que te marcaba porque hacemos cajas de cartón." [PAUSA] "¿Ustedes usan cajas ahorita o...?" [PAUSA - ESPERA RESPUESTA]

IMPORTANTE:
- Tu nombre es Roberto, NO uses placeholders como [Tu Nombre]
- Di directamente "soy Roberto de ${config.company_name}"
- NUNCA digas más de 2 frases sin hacer una pregunta o pausa
- Haz una pregunta cada 10-15 segundos para que el cliente participe

[30-90 SEG] DESCUBRIMIENTO (CONVERSACIONAL, NO INTERROGATORIO):
- Máximo 2-3 preguntas sobre su situación
- Escucha MÁS de lo que hablas (70% escuchar, 30% hablar)
- Respuestas cortas: "Aha, entiendo..." [PAUSA] "Órale..." [PAUSA] "Claro, sí..."
- Identifica UN problema principal
- Haz eco de lo que dicen: "O sea que te tardan 2 semanas..." [PAUSA] "eso está pesado, ¿no?"

Ejemplo de flujo:
Cliente: "Sí usamos cajas"
Tú: "Ah perfecto." [PAUSA] "¿Y con quién las compran ahorita?" [PAUSA - ESCUCHA]
Cliente: "Con XYZ"
Tú: "Órale." [PAUSA] "¿Y qué tal te va con ellos?" [PAUSA] "¿Te cumplen bien o...?" [PAUSA - ESCUCHA]

[90-150 SEG] PROPUESTA DE VALOR ESPECÍFICA (SOLO SI HAY PROBLEMA IDENTIFICADO):
"Pues mira... eee... fíjate que nosotros [beneficio específico que resuelve SU problema]." [PAUSA] "Esto te ayudaría con [su dolor específico], ¿no?" [PAUSA - ESCUCHA]

REGLAS:
- Conecta tu solución a LO QUE DIJO el cliente (no genérico)
- NO hagas pitch si el cliente está feliz con su proveedor
- Si dice que todo bien, ofrece solo quedar como plan B
- Menciona solo 1-2 beneficios máximo (no lista de 5 cosas)

[150-180 SEG] CIERRE SUAVE (OBJETIVO: EMAIL):
"Perfecto..." [PAUSA] "¿Sabes qué?" [PAUSA] "Te mando nuestra carta de presentación con más detalles." [PAUSA] "¿A qué correo te la envío?" [PAUSA - ESCUCHA EMAIL]

Alternativa: "Sale, sale." [PAUSA] "Te paso info por correo." [PAUSA] "¿Cuál es tu mail?" [PAUSA - ESCUCHA]

Si muestra interés fuerte: "O si quieres... eee... podemos agendar una videollamada rápida, ¿te late?" [PAUSA]
Si hay urgencia: "¿Y pa cuándo necesitarías el material?" [PAUSA] "Igual podemos cotizarte directo..."

[SI DICE NO] CIERRE PROFESIONAL:
"Va, sin rollo." [PAUSA] "Cualquier cosa, aquí andamos." [PAUSA] "¡Éxito!" [COLGAR]
- NO insistas
- NO preguntes "¿por qué no?"
- Acepta el no con gracia y cierra cordial

═══ CAPTURA DE DATOS CRÍTICOS ═══

EMAILS Y TELÉFONOS:
Cuando captures email o teléfono, REPÍTELO LETRA POR LETRA:

EMAIL:
"Perfecto, ¿a qué correo?" [PAUSA - ESCUCHA] "Aha, entonces es: equis-ele-@allopack.com, ¿correcto?" [PAUSA - CONFIRMA]
- Deletrea CADA letra EXACTAMENTE como la escuchaste, sin agregar ni quitar nada
- Confirma SIEMPRE letra por letra
- Si el email es "bertello@gmail.com", di "be-e-ere-te-e-ele-ele-o arroba gmail punto com"
- NO agregues letras que no escuchaste
- NO asumas prefijos como "al" o "el"
- Repite EXACTAMENTE lo que el cliente dijo

TELÉFONO:
"¿Y tu teléfono?" [PAUSA - ESCUCHA] "Okay, anoto: cinco-cinco-uno-dos-tres-cuatro-cinco-seis-siete-ocho, ¿está bien?" [PAUSA - CONFIRMA]
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
"Aha, te entiendo perfectamente." [PAUSA] "Son literal 2 minutos..." [PAUSA] "¿o prefieres que te mande la info por correo?" [PAUSA] "La revisas cuando puedas." [PAUSA - ESCUCHA]

"YA TENGO PROVEEDOR":
"Claro, claro... perfecto." [PAUSA] "Pues mira, no es que cambies ahorita..." [PAUSA] "pero... eee... igual está bien tener opciones, ¿no?" [PAUSA] "Por si tu proveedor falla o algo." [PAUSA] "Te mando info y ya tú decides." [PAUSA - ESCUCHA]

"ESTÁ MUY CARO":
"Mmm... ¿con qué comparas el precio?" [PAUSA - ESCUCHA] "Digo, porque... eee... nosotros entregamos en 24 horas." [PAUSA] "Mientras otros tardan semana y media." [PAUSA] "Eso vale, ¿no?" [PAUSA - ESCUCHA]

"MÁNDAME INFO":
"Sale, sale." [PAUSA] "¿A qué correo?" [PAUSA - ESCUCHA] "Perfecto." [PAUSA] "Te la mando ahorita." [PAUSA] "¿Te parece si te marco la próxima semana?" [PAUSA] "Pa ver si te latió la info." [PAUSA - ESCUCHA]

"LLÁMAME DESPUÉS / ESTOY OCUPADO":
"Claro, sin problema." [PAUSA] "¿Cuándo es buen momento?" [PAUSA - ESCUCHA] "Perfecto, te marco [día/hora]." [PAUSA] "¿Dejo este mismo número o tienes otro?" [PAUSA - ESCUCHA]

═══ REGLAS CRÍTICAS ═══
✗ NUNCA uses listas numeradas al hablar
✗ NUNCA digas "tengo 3 beneficios para ti"
✗ NUNCA suenes como robot o guión leído
✗ NUNCA insistas si dicen no (respeta el rechazo)
✗ NUNCA des discursos largos (máximo 2-3 frases seguidas)
✗ NUNCA sigas hablando si el cliente empieza a hablar (detente INMEDIATAMENTE)
✗ NUNCA uses lenguaje formal excesivo ("estimado", "a la brevedad", etc.)

✓ SIEMPRE usa muletillas naturales (eee, mmm, pues, o sea)
✓ SIEMPRE escucha más de lo que hablas (70/30)
✓ SIEMPRE conecta tu solución a LO QUE DIJO el cliente (no genérico)
✓ SIEMPRE suena relajado, como plática casual con un conocido
✓ SIEMPRE respeta si no hay interés (acepta el no con gracia)
✓ SIEMPRE detente inmediatamente si el cliente empieza a hablar
✓ SIEMPRE haz pausas para respirar naturalmente
✓ SIEMPRE haz preguntas cortas para mantener al cliente participando
✓ SI el cliente te interrumpe, PARA inmediatamente y escucha

═══ TONO Y ENERGÍA ═══
- Amigable pero no falso (genuino)
- Profesional pero no rígido (relajado)
- Confiado pero no arrogante (humilde)
- Cercano como colega, no como vendedor agresivo
- Como si estuvieras platicando con un conocido del trabajo
- Entusiasta pero no exagerado (natural)

DURACIÓN IDEAL: 2-3 minutos
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
  let interruptTimer = null; // Timer para delay de interrupciones

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
                threshold: VAD_THRESHOLD,
                prefix_padding_ms: VAD_PREFIX_PADDING,
                silence_duration_ms: VAD_SILENCE_DURATION
              },
              input_audio_format: 'g711_ulaw',
              output_audio_format: 'g711_ulaw',
              voice: 'echo',
              instructions: buildPrompt(config),
              temperature: 1.1, // Mayor temperatura para respuestas más naturales y variadas
              max_response_output_tokens: 'inf',
              input_audio_transcription: {
                model: 'whisper-1'
              }
            }
          };

          openAiWs.send(JSON.stringify(sessionConfig));
          sessionInitialized = true;
          console.log('📋 Sesión configurada con prompt humanizado');
          console.log(`   VAD: threshold=${VAD_THRESHOLD}, prefix=${VAD_PREFIX_PADDING}ms, silence=${VAD_SILENCE_DURATION}ms`);
          console.log(`   Delay interrupción: ${INTERRUPT_DELAY_MS}ms`);

          // Enviar mensaje inicial para que OpenAI empiece a hablar
          setTimeout(() => {
            if (openAiWs.readyState === 1) {
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

            // Detectar cuando el cliente empieza a hablar
            if (r.type === 'input_audio_buffer.speech_started') {
              console.log('🗣️ Cliente empezó a hablar (VAD detectó voz)');

              // Cancelar timer anterior si existe
              if (interruptTimer) {
                clearTimeout(interruptTimer);
                interruptTimer = null;
              }

              // Solo interrumpir si el agente está hablando
              if (isAgentSpeaking) {
                // Usar delay para confirmar que es voz real y no ruido/eco
                interruptTimer = setTimeout(() => {
                  // Verificar que el agente sigue hablando antes de interrumpir
                  if (isAgentSpeaking) {
                    console.log('🛑 INTERRUPCIÓN CONFIRMADA - Deteniendo agente');

                    // 1. Limpiar buffer de audio de Twilio primero (detiene reproducción inmediata)
                    ws.send(JSON.stringify({
                      event: 'clear',
                      streamSid: streamSid
                    }));

                    // 2. Cancelar la respuesta de OpenAI
                    if (openAiWs.readyState === 1) {
                      openAiWs.send(JSON.stringify({
                        type: 'response.cancel'
                      }));
                    }

                    isAgentSpeaking = false;
                  }

                  interruptTimer = null;
                }, INTERRUPT_DELAY_MS);

                console.log(`⏱️  Esperando ${INTERRUPT_DELAY_MS}ms para confirmar interrupción...`);
              }
            }

            // Detectar cuando el cliente deja de hablar
            if (r.type === 'input_audio_buffer.speech_stopped') {
              console.log('🤐 Cliente dejó de hablar (silencio detectado)');

              // Cancelar interrupción pendiente si el cliente dejó de hablar rápido
              // (probablemente era ruido o eco, no habla real)
              if (interruptTimer) {
                console.log('❌ Interrupción cancelada - era ruido/eco breve');
                clearTimeout(interruptTimer);
                interruptTimer = null;
              }
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

              // Limpiar timer si existe
              if (interruptTimer) {
                clearTimeout(interruptTimer);
                interruptTimer = null;
              }
            }

            // Manejar cancelación exitosa
            if (r.type === 'response.cancelled') {
              console.log('🚫 Respuesta cancelada exitosamente');
              isAgentSpeaking = false;

              // Limpiar timer si existe
              if (interruptTimer) {
                clearTimeout(interruptTimer);
                interruptTimer = null;
              }
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

          // Limpiar timer si existe
          if (interruptTimer) {
            clearTimeout(interruptTimer);
            interruptTimer = null;
          }
        });
      }
      else if (m.event === 'media' && openAiWs && openAiWs.readyState === 1) {
        // Enviar audio del cliente a OpenAI
        if (sessionInitialized) {
          openAiWs.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: m.media.payload
          }));

          // Log cada 100 paquetes de audio para ver que está fluyendo
          if (Math.random() < 0.01) {
            console.log(`🎤 Audio del cliente → OpenAI (${m.media.payload.length} chars)`);
          }
        }
      }
      else if (m.event === 'stop') {
        console.log('\n🛑 Stream detenido');

        // Limpiar timer si existe
        if (interruptTimer) {
          clearTimeout(interruptTimer);
          interruptTimer = null;
        }

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

    // Limpiar timer si existe
    if (interruptTimer) {
      clearTimeout(interruptTimer);
      interruptTimer = null;
    }

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
  console.log(`   Versión: Humanizado + Anti-Interrupciones Mejorado`);
  console.log(`═══════════════════════════════════════════\n`);
  console.log(`📡 Puerto: ${PORT}`);
  console.log(`📞 Endpoint llamadas: POST /incoming-call?client=CLIENT_ID`);
  console.log(`⚙️  Config API: POST /api/clients/:id/config`);
  console.log(`📊 Transcripciones: GET /api/transcripts`);
  console.log(`💚 Health check: GET /health`);
  console.log(`\n🎛️  Configuración VAD Mejorada:`);
  console.log(`   - Threshold: ${VAD_THRESHOLD} (más estricto contra ruido)`);
  console.log(`   - Prefix padding: ${VAD_PREFIX_PADDING}ms (más tiempo para confirmar voz)`);
  console.log(`   - Silence duration: ${VAD_SILENCE_DURATION}ms (más tiempo antes de fin de turno)`);
  console.log(`   - Delay interrupción: ${INTERRUPT_DELAY_MS}ms (filtrar ruido/eco)`);
  console.log(`\n📦 Clientes precargados: ${clientConfigs.size}`);
  console.log(`   - allopack_001: ${allopackConfig.company_name}`);
  console.log(`\n✅ Listo para recibir llamadas\n`);
});
