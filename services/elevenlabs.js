import fetch from 'node-fetch';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// ============================================================
// VOCES DISPONIBLES
// ============================================================
export const VOICES = {
  // Voces en español
  DIEGO: 'ErXwobaYiN019PkySvjV', // Hombre, joven, energético
  VALENTINA: 'Xb7hH8MSUJpSbSDYk0k2', // Mujer, profesional, amigable
  MATEO: 'iP95p4xoKVk53GoZ742B', // Hombre, maduro, confiable
  SOFIA: 'EXAVITQu4vr4xnSDxMaL', // Mujer, cálida, cercana
  
  // Puedes agregar más voice_ids de tu cuenta ElevenLabs
};

// ============================================================
// CONFIGURACIÓN POR ESTILO
// ============================================================
const VOICE_STYLES = {
  profesional_amigable: {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.3,
    use_speaker_boost: true
  },
  energetico_vendedor: {
    stability: 0.4,
    similarity_boost: 0.8,
    style: 0.5,
    use_speaker_boost: true
  },
  formal_corporativo: {
    stability: 0.7,
    similarity_boost: 0.7,
    style: 0.2,
    use_speaker_boost: false
  },
  casual_cercano: {
    stability: 0.3,
    similarity_boost: 0.85,
    style: 0.6,
    use_speaker_boost: true
  }
};

// ============================================================
// SINTETIZAR VOZ
// ============================================================
export async function textToSpeech(text, voiceId = VOICES.DIEGO, style = 'profesional_amigable') {
  try {
    const settings = VOICE_STYLES[style] || VOICE_STYLES.profesional_amigable;
    
    const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: settings
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs error: ${error}`);
    }

    const audioBuffer = await response.buffer();
    return audioBuffer;

  } catch (error) {
    console.error('❌ Error en ElevenLabs:', error.message);
    throw error;
  }
}

// ============================================================
// OBTENER VOCES DISPONIBLES
// ============================================================
export async function getAvailableVoices() {
  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error('No se pudieron obtener las voces');
    }

    const data = await response.json();
    return data.voices.filter(v => 
      v.labels && (v.labels.language === 'es' || v.labels.language === 'spanish')
    );

  } catch (error) {
    console.error('❌ Error obteniendo voces:', error.message);
    return [];
  }
}

// ============================================================
// STREAMING DE VOZ (para Twilio WebSocket)
// ============================================================
export async function streamTextToSpeech(text, voiceId, style, onChunk) {
  try {
    const settings = VOICE_STYLES[style] || VOICE_STYLES.profesional_amigable;
    
    const response = await fetch(
      `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: settings
        })
      }
    );

    if (!response.ok) {
      throw new Error('Error en streaming de ElevenLabs');
    }

    // Procesar stream en chunks
    const reader = response.body.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      // Convertir cada chunk a base64 para Twilio
      const base64Audio = value.toString('base64');
      onChunk(base64Audio);
    }

  } catch (error) {
    console.error('❌ Error en streaming:', error.message);
    throw error;
  }
}

// ============================================================
// HELPER: Convertir MP3 a μ-law (formato Twilio)
// ============================================================
export function convertToUlaw(mp3Buffer) {
  // Aquí necesitarías una librería como 'ffmpeg' o 'audiobuffer-to-wav'
  // Por simplicidad, este es un placeholder
  // En producción, usa ffmpeg-static + fluent-ffmpeg
  
  console.warn('⚠️  Conversión MP3→μ-law no implementada. Usar audio directo.');
  return mp3Buffer;
}

export default {
  textToSpeech,
  getAvailableVoices,
  streamTextToSpeech,
  VOICES
};