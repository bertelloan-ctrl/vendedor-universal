import fetch from 'node-fetch';



const LEADS\_WEBHOOK\_URL = process.env.LEADS\_WEBHOOK\_URL;



// ============================================================

// GUARDAR LEAD EN GOOGLE SHEETS

// ============================================================

export async function saveLead(leadData) {

&nbsp; try {

&nbsp;   const payload = {

&nbsp;     timestamp: new Date().toISOString(),

&nbsp;     ...leadData,

&nbsp;     source: leadData.source || 'ai\_call'

&nbsp;   };



&nbsp;   const response = await fetch(LEADS\_WEBHOOK\_URL, {

&nbsp;     method: 'POST',

&nbsp;     headers: { 'Content-Type': 'application/json' },

&nbsp;     body: JSON.stringify(payload)

&nbsp;   });



&nbsp;   const text = await response.text();



&nbsp;   if (response.ok) {

&nbsp;     console.log('✅ Lead guardado en CRM:', leadData.company || leadData.phone);

&nbsp;     return { success: true, data: text };

&nbsp;   } else {

&nbsp;     console.error('❌ Error guardando lead:', response.status, text);

&nbsp;     return { success: false, error: text };

&nbsp;   }

&nbsp; } catch (error) {

&nbsp;   console.error('❌ Error en saveLead:', error.message);

&nbsp;   return { success: false, error: error.message };

&nbsp; }

}



// ============================================================

// ACTUALIZAR ESTADO DE LEAD

// ============================================================

export async function updateLeadStatus(phone, newStatus, notes = '') {

&nbsp; // Esta función necesitará un endpoint adicional en tu Google Apps Script

&nbsp; // Por ahora solo registra localmente

&nbsp; 

&nbsp; console.log(`📝 Actualizar lead ${phone}: ${newStatus}`);

&nbsp; console.log(`   Notas: ${notes}`);

&nbsp; 

&nbsp; // TODO: Implementar endpoint de actualización en Google Sheets

&nbsp; return { success: true };

}



// ============================================================

// FORMATEAR DATOS DE CONVERSACIÓN PARA CRM

// ============================================================

export function formatConversationForCRM(conversationLog) {

&nbsp; const { metadata, messages } = conversationLog;

&nbsp; 

&nbsp; return {

&nbsp;   // Datos básicos

&nbsp;   phone: metadata.phone || '',

&nbsp;   company: metadata.company\_name || '',

&nbsp;   contact\_name: metadata.contact\_name || '',

&nbsp;   email: metadata.email || '',

&nbsp;   

&nbsp;   // Clasificación

&nbsp;   lead\_quality: metadata.lead\_quality || 'cold',

&nbsp;   interest\_level: metadata.interest\_level || 'low',

&nbsp;   

&nbsp;   // Resultado de la llamada

&nbsp;   call\_outcome: metadata.outcome || 'no\_answer',

&nbsp;   demo\_scheduled: metadata.demo\_date ? 'yes' : 'no',

&nbsp;   demo\_date: metadata.demo\_date || '',

&nbsp;   

&nbsp;   // Información comercial

&nbsp;   products\_interested: metadata.products\_interested || '',

&nbsp;   estimated\_value: metadata.estimated\_value || '',

&nbsp;   budget\_range: metadata.budget\_range || '',

&nbsp;   decision\_maker: metadata.is\_decision\_maker ? 'yes' : 'no',

&nbsp;   

&nbsp;   // Seguimiento

&nbsp;   next\_action: metadata.next\_action || '',

&nbsp;   callback\_date: metadata.callback\_date || '',

&nbsp;   notes: generateNotes(messages, metadata),

&nbsp;   

&nbsp;   // Metadata

&nbsp;   call\_sid: conversationLog.call\_sid,

&nbsp;   duration\_seconds: conversationLog.duration\_seconds,

&nbsp;   client\_id: conversationLog.client\_id,

&nbsp;   source: 'ai\_call'

&nbsp; };

}



function generateNotes(messages, metadata) {

&nbsp; const notes = \[];

&nbsp; 

&nbsp; // Extraer puntos clave de la conversación

&nbsp; const userMessages = messages.filter(m => m.role === 'user');

&nbsp; 

&nbsp; if (userMessages.length > 0) {

&nbsp;   notes.push('Conversación:');

&nbsp;   userMessages.slice(0, 3).forEach((msg, i) => {

&nbsp;     notes.push(`${i + 1}. ${msg.content.substring(0, 100)}...`);

&nbsp;   });

&nbsp; }

&nbsp; 

&nbsp; if (metadata.objections) {

&nbsp;   notes.push(`\\nObjeciones: ${metadata.objections}`);

&nbsp; }

&nbsp; 

&nbsp; if (metadata.special\_requirements) {

&nbsp;   notes.push(`Requisitos especiales: ${metadata.special\_requirements}`);

&nbsp; }

&nbsp; 

&nbsp; return notes.join('\\n');

}



// ============================================================

// GUARDAR RESULTADO DE CONVERSACIÓN COMPLETA

// ============================================================

export async function saveConversationResult(conversationLog) {

&nbsp; const crmData = formatConversationForCRM(conversationLog);

&nbsp; return await saveLead(crmData);

}



// ============================================================

// WEBHOOK PARA INTEGRACIÓN CON OTROS CRMs

// ============================================================

export async function sendToExternalCRM(leadData, webhookUrl) {

&nbsp; try {

&nbsp;   const response = await fetch(webhookUrl, {

&nbsp;     method: 'POST',

&nbsp;     headers: {

&nbsp;       'Content-Type': 'application/json',

&nbsp;       'User-Agent': 'Vendedor-Universal/2.0'

&nbsp;     },

&nbsp;     body: JSON.stringify(leadData)

&nbsp;   });



&nbsp;   return {

&nbsp;     success: response.ok,

&nbsp;     status: response.status,

&nbsp;     data: await response.text()

&nbsp;   };

&nbsp; } catch (error) {

&nbsp;   console.error('❌ Error enviando a CRM externo:', error.message);

&nbsp;   return { success: false, error: error.message };

&nbsp; }

}



// ============================================================

// INTEGRACIÓN CON ZAPIER/MAKE

// ============================================================

export async function triggerAutomation(event, data) {

&nbsp; const automationUrl = process.env.AUTOMATION\_WEBHOOK\_URL;

&nbsp; 

&nbsp; if (!automationUrl) {

&nbsp;   console.warn('⚠️  No hay webhook de automatización configurado');

&nbsp;   return { success: false, error: 'No automation webhook configured' };

&nbsp; }



&nbsp; const payload = {

&nbsp;   event: event, // 'demo\_scheduled', 'sale\_closed', 'callback\_required', etc.

&nbsp;   timestamp: new Date().toISOString(),

&nbsp;   data: data

&nbsp; };



&nbsp; try {

&nbsp;   const response = await fetch(automationUrl, {

&nbsp;     method: 'POST',

&nbsp;     headers: { 'Content-Type': 'application/json' },

&nbsp;     body: JSON.stringify(payload)

&nbsp;   });



&nbsp;   console.log(`🔄 Automatización disparada: ${event}`);

&nbsp;   return { success: response.ok };

&nbsp; } catch (error) {

&nbsp;   console.error('❌ Error en automatización:', error.message);

&nbsp;   return { success: false, error: error.message };

&nbsp; }

}



// ============================================================

// TIPOS DE EVENTOS PARA AUTOMATIZACIÓN

// ============================================================

export const AUTOMATION\_EVENTS = {

&nbsp; DEMO\_SCHEDULED: 'demo\_scheduled',

&nbsp; SALE\_CLOSED: 'sale\_closed',

&nbsp; HOT\_LEAD: 'hot\_lead',

&nbsp; CALLBACK\_REQUIRED: 'callback\_required',

&nbsp; OBJECTION\_PRICE: 'objection\_price',

&nbsp; NO\_INTEREST: 'no\_interest',

&nbsp; ESCALATE\_TO\_HUMAN: 'escalate\_to\_human'

};



export default {

&nbsp; saveLead,

&nbsp; updateLeadStatus,

&nbsp; formatConversationForCRM,

&nbsp; saveConversationResult,

&nbsp; sendToExternalCRM,

&nbsp; triggerAutomation,

&nbsp; AUTOMATION\_EVENTS

};

