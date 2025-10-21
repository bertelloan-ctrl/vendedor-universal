import fs from 'fs/promises';
import path from 'path';

const LOGS_DIR = './logs';

// ============================================================
// CREAR DIRECTORIO DE LOGS
// ============================================================
async function ensureLogsDir() {
  try {
    await fs.access(LOGS_DIR);
  } catch {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  }
}

// ============================================================
// LOGGER DE CONVERSACIÓN
// ============================================================
export class ConversationLogger {
  constructor(callSid, clientId) {
    this.callSid = callSid;
    this.clientId = clientId;
    this.startTime = new Date();
    this.messages = [];
    this.metadata = {};
  }

  addMessage(role, content, timestamp = new Date()) {
    this.messages.push({
      role, // 'user' | 'assistant' | 'system'
      content,
      timestamp: timestamp.toISOString()
    });
  }

  addMetadata(key, value) {
    this.metadata[key] = value;
  }

  async save() {
    await ensureLogsDir();
    
    const endTime = new Date();
    const duration = (endTime - this.startTime) / 1000; // segundos

    const log = {
      call_sid: this.callSid,
      client_id: this.clientId,
      start_time: this.startTime.toISOString(),
      end_time: endTime.toISOString(),
      duration_seconds: duration,
      messages: this.messages,
      metadata: this.metadata,
      summary: this.generateSummary()
    };

    const filename = `${this.callSid}_${this.startTime.toISOString().split('T')[0]}.json`;
    const filepath = path.join(LOGS_DIR, filename);

    await fs.writeFile(filepath, JSON.stringify(log, null, 2));
    console.log(`💾 Log guardado: ${filename}`);
    
    return filepath;
  }

  generateSummary() {
    const userMessages = this.messages.filter(m => m.role === 'user').length;
    const assistantMessages = this.messages.filter(m => m.role === 'assistant').length;
    
    return {
      total_messages: this.messages.length,
      user_messages: userMessages,
      assistant_messages: assistantMessages,
      outcome: this.metadata.outcome || 'unknown', // 'sale', 'demo_scheduled', 'no_interest', 'callback'
      lead_quality: this.metadata.lead_quality || 'unknown' // 'hot', 'warm', 'cold'
    };
  }
}

// ============================================================
// ANALYTICS DIARIO
// ============================================================
export async function getDailyStats(date = new Date()) {
  await ensureLogsDir();
  
  const dateStr = date.toISOString().split('T')[0];
  const files = await fs.readdir(LOGS_DIR);
  const todayFiles = files.filter(f => f.includes(dateStr));
  
  const stats = {
    date: dateStr,
    total_calls: todayFiles.length,
    outcomes: {
      sale: 0,
      demo_scheduled: 0,
      no_interest: 0,
      callback: 0,
      unknown: 0
    },
    lead_quality: {
      hot: 0,
      warm: 0,
      cold: 0,
      unknown: 0
    },
    avg_duration: 0,
    total_duration: 0
  };

  for (const file of todayFiles) {
    try {
      const content = await fs.readFile(path.join(LOGS_DIR, file), 'utf8');
      const log = JSON.parse(content);
      
      stats.outcomes[log.summary.outcome]++;
      stats.lead_quality[log.summary.lead_quality]++;
      stats.total_duration += log.duration_seconds;
    } catch (err) {
      console.error(`Error leyendo ${file}:`, err.message);
    }
  }

  if (todayFiles.length > 0) {
    stats.avg_duration = stats.total_duration / todayFiles.length;
  }

  return stats;
}

// ============================================================
// EXPORTAR LOGS A CSV
// ============================================================
export async function exportLogsToCSV(startDate, endDate) {
  await ensureLogsDir();
  
  const files = await fs.readdir(LOGS_DIR);
  const logs = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(path.join(LOGS_DIR, file), 'utf8');
      const log = JSON.parse(content);
      
      const logDate = new Date(log.start_time);
      if (logDate >= startDate && logDate <= endDate) {
        logs.push({
          call_sid: log.call_sid,
          client_id: log.client_id,
          date: log.start_time,
          duration: log.duration_seconds,
          outcome: log.summary.outcome,
          lead_quality: log.summary.lead_quality,
          messages_count: log.summary.total_messages
        });
      }
    } catch (err) {
      console.error(`Error procesando ${file}:`, err.message);
    }
  }

  // Convertir a CSV
  if (logs.length === 0) return '';

  const headers = Object.keys(logs[0]).join(',');
  const rows = logs.map(log => Object.values(log).join(',')).join('\n');
  
  return `${headers}\n${rows}`;
}

// ============================================================
// BUSCAR CONVERSACIONES
// ============================================================
export async function searchConversations(query, clientId = null) {
  await ensureLogsDir();
  
  const files = await fs.readdir(LOGS_DIR);
  const results = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(path.join(LOGS_DIR, file), 'utf8');
      const log = JSON.parse(content);
      
      // Filtrar por cliente si se especifica
      if (clientId && log.client_id !== clientId) continue;

      // Buscar en mensajes
      const found = log.messages.some(m => 
        m.content.toLowerCase().includes(query.toLowerCase())
      );

      if (found) {
        results.push({
          call_sid: log.call_sid,
          client_id: log.client_id,
          date: log.start_time,
          summary: log.summary,
          file: file
        });
      }
    } catch (err) {
      console.error(`Error buscando en ${file}:`, err.message);
    }
  }

  return results;
}

export default {
  ConversationLogger,
  getDailyStats,
  exportLogsToCSV,
  searchConversations
};