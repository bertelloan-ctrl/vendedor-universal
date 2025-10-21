import 'dotenv/config';
import twilio from 'twilio';
import fetch from 'node-fetch';

// ============================================================
// CONFIGURACIÓN
// ============================================================
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_NUMBER = process.env.TWILIO_NUMBER;
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const LEADS_SHEET_URL = process.env.LEADS_WEBHOOK_URL;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// ============================================================
// OBTENER LEADS DESDE GOOGLE SHEETS
// ============================================================
async function getLeadsFromSheet() {
  try {
    // Convertir export URL a CSV
    const csvUrl = LEADS_SHEET_URL.replace('/exec', '/export?format=csv');
    const response = await fetch(csvUrl);
    const csvText = await response.text();
    
    // Parsear CSV simple (sin dependencias)
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const leads = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',').map(v => v.trim());
      const lead = {};
      
      headers.forEach((header, idx) => {
        lead[header] = values[idx] || '';
      });
      
      // Filtrar solo leads nuevos
      if (lead.status === 'new' && lead.phone) {
        leads.push(lead);
      }
    }
    
    return leads;
  } catch (error) {
    console.error('❌ Error obteniendo leads:', error.message);
    return [];
  }
}

// ============================================================
// NORMALIZAR TELÉFONO
// ============================================================
function normalizePhone(phone) {
  // Limpiar
  let cleaned = phone.replace(/\D/g, '');
  
  // Si empieza con 52 (México)
  if (cleaned.startsWith('52')) {
    return '+' + cleaned;
  }
  
  // Si son 10 dígitos (México sin código)
  if (cleaned.length === 10) {
    return '+52' + cleaned;
  }
  
  // Si ya tiene +
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // Default: asumir México
  return '+52' + cleaned;
}

// ============================================================
// HACER LLAMADA VIA TWILIO
// ============================================================
async function makeCall(lead, clientId = 'default') {
  try {
    const phone = normalizePhone(lead.phone);
    
    console.log(`📞 Llamando a: ${lead.company || 'Sin nombre'} (${phone})`);
    
    const call = await client.calls.create({
      to: phone,
      from: TWILIO_NUMBER,
      url: `${SERVER_URL}/incoming-call?client=${clientId}&leadId=${lead.id || ''}`,
      statusCallback: `${SERVER_URL}/call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      method: 'POST',
      record: false, // Cambiar a true si quieres grabar llamadas
      timeout: 60
    });
    
    console.log(`✅ Llamada iniciada: ${call.sid}`);
    
    return {
      success: true,
      callSid: call.sid,
      phone: phone,
      company: lead.company
    };
    
  } catch (error) {
    console.error(`❌ Error llamando a ${lead.phone}:`, error.message);
    
    return {
      success: false,
      error: error.message,
      phone: lead.phone,
      company: lead.company
    };
  }
}

// ============================================================
// PROCESADOR DE CAMPAÑAS
// ============================================================
class CampaignManager {
  constructor(config = {}) {
    this.clientId = config.clientId || 'default';
    this.delayBetweenCalls = config.delayBetweenCalls || 3000; // ms
    this.maxConcurrentCalls = config.maxConcurrentCalls || 1;
    this.maxCallsPerHour = config.maxCallsPerHour || 30;
    
    this.callsThisHour = 0;
    this.hourStartTime = Date.now();
    this.results = [];
  }

  async runCampaign(leads) {
    console.log(`🚀 Iniciando campaña para ${this.clientId}`);
    console.log(`📊 Total de leads: ${leads.length}`);
    console.log(`⚙️  Config: ${this.maxCallsPerHour} llamadas/hora, delay ${this.delayBetweenCalls}ms\n`);
    
    for (let i = 0; i < leads.length; i++) {
      // Control de rate limit
      this.checkRateLimit();
      
      const lead = leads[i];
      console.log(`[${i + 1}/${leads.length}] Procesando: ${lead.company || lead.phone}`);
      
      const result = await makeCall(lead, this.clientId);
      this.results.push(result);
      this.callsThisHour++;
      
      // Delay entre llamadas
      if (i < leads.length - 1) {
        await this.sleep(this.delayBetweenCalls);
      }
    }
    
    this.printSummary();
    return this.results;
  }

  checkRateLimit() {
    const now = Date.now();
    const hourPassed = (now - this.hourStartTime) / 1000 / 60 / 60;
    
    if (hourPassed >= 1) {
      // Reset contador cada hora
      this.callsThisHour = 0;
      this.hourStartTime = now;
    } else if (this.callsThisHour >= this.maxCallsPerHour) {
      // Pausar hasta próxima hora
      const msToWait = (1 - hourPassed) * 60 * 60 * 1000;
      console.log(`⏸️  Límite de ${this.maxCallsPerHour} llamadas/hora alcanzado. Pausando ${Math.round(msToWait/1000/60)} minutos...`);
      this.sleep(msToWait);
      this.callsThisHour = 0;
      this.hourStartTime = Date.now();
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printSummary() {
    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMEN DE CAMPAÑA');
    console.log('='.repeat(50));
    console.log(`✅ Exitosas: ${successful}`);
    console.log(`❌ Fallidas: ${failed}`);
    console.log(`📞 Total: ${this.results.length}`);
    console.log('='.repeat(50) + '\n');
    
    if (failed > 0) {
      console.log('❌ Llamadas fallidas:');
      this.results
        .filter(r => !r.success)
        .forEach(r => console.log(`   - ${r.company} (${r.phone}): ${r.error}`));
    }
  }
}

// ============================================================
// ENDPOINT PARA WEBHOOK DE ESTADO
// ============================================================
export function setupStatusWebhook(app) {
  app.post('/call-status', (req, res) => {
    const { CallSid, CallStatus, From, To } = req.body;
    
    console.log(`📊 Estado de llamada ${CallSid}: ${CallStatus}`);
    console.log(`   De: ${From} → A: ${To}`);
    
    // Aquí puedes guardar en DB o actualizar Google Sheets
    
    res.sendStatus(200);
  });
}

// ============================================================
// COMANDOS CLI
// ============================================================
async function runCliCommand(command, args) {
  switch (command) {
    case 'start':
      // Campaña completa desde Google Sheets
      const leads = await getLeadsFromSheet();
      if (leads.length === 0) {
        console.log('⚠️  No hay leads nuevos para procesar');
        return;
      }
      
      const campaign = new CampaignManager({
        clientId: args.clientId || 'default',
        delayBetweenCalls: parseInt(args.delay) || 3000,
        maxCallsPerHour: parseInt(args.maxPerHour) || 30
      });
      
      await campaign.runCampaign(leads);
      break;
      
    case 'test':
      // Llamada de prueba a un número
      if (!args.phone) {
        console.error('❌ Uso: npm run dialer test --phone=+525512345678');
        return;
      }
      
      const testLead = {
        phone: args.phone,
        company: args.company || 'Prueba',
        id: 'test_' + Date.now()
      };
      
      await makeCall(testLead, args.clientId || 'default');
      break;
      
    case 'status':
      // Ver estado de campaña actual
      console.log('📊 Estado del sistema...');
      // TODO: Consultar DB/logs para ver llamadas activas
      break;
      
    default:
      console.log(`
Uso del Auto-Dialer:

  npm run dialer start [opciones]
    Inicia campaña completa desde Google Sheets
    
    Opciones:
      --clientId=allopack_001    ID del cliente
      --delay=3000               Delay entre llamadas (ms)
      --maxPerHour=30            Máximo de llamadas por hora

  npm run dialer test --phone=+52... [opciones]
    Llamada de prueba a un número
    
    Opciones:
      --phone=+525512345678      Número a llamar (obligatorio)
      --company="Nombre"         Nombre de empresa
      --clientId=xxx             ID del cliente

Ejemplos:
  npm run dialer start --clientId=allopack_001 --maxPerHour=20
  npm run dialer test --phone=+525534063535 --company="Test Lead"
      `);
  }
}

// ============================================================
// EJECUTAR SI ES SCRIPT PRINCIPAL
// ============================================================
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  // Parsear argumentos
  const args = {};
  process.argv.slice(3).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value || true;
    }
  });
  
  runCliCommand(command, args).catch(err => {
    console.error('❌ Error fatal:', err);
    process.exit(1);
  });
}

export default {
  makeCall,
  CampaignManager,
  getLeadsFromSheet,
  normalizePhone
};