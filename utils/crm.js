import fetch from 'node-fetch';

const LEADS_WEBHOOK_URL = process.env.LEADS_WEBHOOK_URL;

// ============================================================
// GUARDAR LEAD EN GOOGLE SHEETS
// ============================================================
export async function saveLead(leadData) {
  try {
    const payload = {
      timestamp: new Date().toISOString(),
      ...leadData,
      source: leadData.source || 'ai_call'
    };

    const response = await fetch(LEADS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await response.text();

    if (response.ok) {
      console.log('✅ Lead guardado en CRM:', leadData.company || leadData.phone);
      return { success: true, data: text };
    } else {
      console.error('❌ Error guardando lead:', response.status, text);
      return { success: false, error: text };
    }
  } catch (error) {
    console.error('❌ Error en saveLead:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================================
// ACTUALIZAR ESTADO DE LEAD
// ============================================================
export async function updateLeadStatus(phone, newStatus, notes = '') {
  // Esta función necesitará un endpoint adicional en tu Google Apps Script
  // Por ahora solo registra localmente
  
  console.log(`📝 Actualizar lead ${phone}: ${newStatus}`);
  console.log(`   Notas: ${notes}`);
  
  // TODO: Implementar endpoint de actualización en Google Sheets
  return { success: true };
}

// ============================================================
// FORMATEAR DATOS DE CONVERSACIÓN PARA CRM
// ============================================================
export function formatConversationForCRM(conversationLog) {
  const { metadata, messages } = conversationLog;
  
  return {
    // Datos básicos
    phone: metadata.phone || '',
    company: metadata.company_name || '',
    contact_name: metadata.contact_name || '',
    email: metadata.email || '',
    
    // Clasificación
    lead_quality: metadata.lead_quality || 'cold',
    interest_level: metadata.interest_level || 'low',
    
    // Resultado de la llamada
    call_outcome: metadata.outcome || 'no_answer',
    demo_scheduled: metadata.demo_date ? 'yes' : 'no',
    demo_date: metadata.demo_date || '',
    
    // Información comercial
    products_interested: metadata.products_interested || '',
    estimated_value: metadata.estimated_value || '',
    budget_range: metadata.budget_range || '',
    decision_maker: metadata.is_decision_maker ? 'yes' : 'no',
    
    // Seguimiento
    next_action: metadata.next_action || '',
    callback_date: metadata.callback_date || '',
    notes: generateNotes(messages, metadata),
    
    // Metadata
    call_sid: conversationLog.call_sid,
    duration_seconds: conversationLog.duration_seconds,
    client_id: conversationLog.client_id,
    source: 'ai_call'
  };
}

function generateNotes(messages, metadata) {
  const notes = [];
  
  // Extraer puntos clave de la conversación
  const userMessages = messages.filter(m => m.role === 'user');
  
  if (userMessages.length > 0) {
    notes.push('Conversación:');
    userMessages.slice(0, 3).forEach((msg, i) => {
      notes.push(`${i + 1}. ${msg.content.substring(0, 100)}...`);
    });
  }
  
  if (metadata.objections) {
    notes.push(`\nObjeciones: ${metadata.objections}`);
  }
  
  if (metadata.special_requirements) {
    notes.push(`Requisitos especiales: ${metadata.special_requirements}`);
  }
  
  return notes.join('\n');
}

// ============================================================
// GUARDAR RESULTADO DE CONVERSACIÓN COMPLETA
// ============================================================
export async function saveConversationResult(conversationLog) {
  const crmData = formatConversationForCRM(conversationLog);
  return await saveLead(crmData);
}

// ============================================================
// WEBHOOK PARA INTEGRACIÓN CON OTROS CRMs
// ============================================================
export async function sendToExternalCRM(leadData, webhookUrl) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Vendedor-Universal/2.0'
      },
      body: JSON.stringify(leadData)
    });

    return {
      success: response.ok,
      status: response.status,
      data: await response.text()
    };
  } catch (error) {
    console.error('❌ Error enviando a CRM externo:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================================
// INTEGRACIÓN CON ZAPIER/MAKE
// ============================================================
export async function triggerAutomation(event, data) {
  const automationUrl = process.env.AUTOMATION_WEBHOOK_URL;
  
  if (!automationUrl) {
    console.warn('⚠️  No hay webhook de automatización configurado');
    return { success: false, error: 'No automation webhook configured' };
  }

  const payload = {
    event: event, // 'demo_scheduled', 'sale_closed', 'callback_required', etc.
    timestamp: new Date().toISOString(),
    data: data
  };

  try {
    const response = await fetch(automationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log(`🔄 Automatización disparada: ${event}`);
    return { success: response.ok };
  } catch (error) {
    console.error('❌ Error en automatización:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================================
// TIPOS DE EVENTOS PARA AUTOMATIZACIÓN
// ============================================================
export const AUTOMATION_EVENTS = {
  DEMO_SCHEDULED: 'demo_scheduled',
  SALE_CLOSED: 'sale_closed',
  HOT_LEAD: 'hot_lead',
  CALLBACK_REQUIRED: 'callback_required',
  OBJECTION_PRICE: 'objection_price',
  NO_INTEREST: 'no_interest',
  ESCALATE_TO_HUMAN: 'escalate_to_human'
};

export default {
  saveLead,
  updateLeadStatus,
  formatConversationForCRM,
  saveConversationResult,
  sendToExternalCRM,
  triggerAutomation,
  AUTOMATION_EVENTS
};