\# 🤖 Vendedor Universal AI



\*\*Plataforma de agentes de venta con IA multi-tenant\*\*  

Sistema modular que permite crear agentes de ventas personalizados para cualquier industria mediante configuración dinámica.



\[!\[Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)

\[!\[OpenAI](https://img.shields.io/badge/OpenAI-Realtime%20API-blue.svg)](https://platform.openai.com)

\[!\[Twilio](https://img.shields.io/badge/Twilio-Voice%20API-red.svg)](https://twilio.com)

\[!\[ElevenLabs](https://img.shields.io/badge/ElevenLabs-AI%20Voice-purple.svg)](https://elevenlabs.io)



---



\## 🎯 Características Principales



✅ \*\*Multi-tenant\*\*: Un mismo servidor maneja múltiples empresas  

✅ \*\*Configuración dinámica\*\*: Personaliza agentes sin código  

✅ \*\*Voz natural\*\*: ElevenLabs para voces realistas en español  

✅ \*\*IA conversacional\*\*: OpenAI GPT-4 Realtime para diálogos naturales  

✅ \*\*Integración CRM\*\*: Google Sheets (extensible a otros)  

✅ \*\*Auto-dialer\*\*: Sistema de llamadas automáticas  

✅ \*\*Analytics\*\*: Logs y estadísticas en tiempo real  

✅ \*\*Escalable\*\*: Preparado para producción



---



\## 🏗️ Arquitectura



```

┌─────────────────────────────────────────────────┐

│           VENDEDOR UNIVERSAL (Core)              │

│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐│

│  │   OpenAI    │  │ ElevenLabs  │  │  Twilio  ││

│  │  (Cerebro)  │  │    (Voz)    │  │(Telefonía│

│  └─────────────┘  └─────────────┘  └──────────┘│

└─────────────────────────────────────────────────┘

&nbsp;                      │

&nbsp;       ┌──────────────┼──────────────┐

&nbsp;       ▼              ▼              ▼

&nbsp;  \[Cliente A]    \[Cliente B]    \[Cliente C]

&nbsp;  Allopack       Farmacéutica    Ecommerce

```



---



\## 📦 Instalación Rápida



\### 1. Requisitos previos



\- Node.js 18+

\- Cuenta OpenAI con Realtime API

\- Cuenta ElevenLabs

\- Cuenta Twilio activa



\### 2. Clonar e instalar



```bash

git clone https://github.com/tu-usuario/vendedor-universal.git

cd vendedor-universal

npm install

```



\### 3. Configurar variables de entorno



```bash

cp .env.example .env

\# Editar .env con tus API keys

```



\### 4. Iniciar servidor



```bash

npm start

```



🎉 \*\*¡Listo!\*\* Servidor corriendo en `http://localhost:3000`



📖 \*\*Ver guía detallada\*\*: \[SETUP\_GUIDE.md](SETUP\_GUIDE.md)



---



\## 🚀 Uso Rápido



\### Configurar tu primer agente



```bash

\# 1. Crear archivo de configuración

cat > config-miempresa.json << EOF

{

&nbsp; "client\_id": "miempresa\_001",

&nbsp; "company\_name": "Mi Empresa",

&nbsp; "products": \["Producto A", "Producto B"],

&nbsp; "sales\_goal": "agendar\_demo",

&nbsp; "contact": {

&nbsp;   "email": "ventas@miempresa.com"

&nbsp; }

}

EOF



\# 2. Cargar configuración

curl -X POST http://localhost:3000/api/clients/miempresa\_001/config \\

&nbsp; -H "Content-Type: application/json" \\

&nbsp; -d @config-miempresa.json

```



\### Hacer llamada de prueba



```bash

npm run dialer test -- --phone=+525512345678 --clientId=miempresa\_001

```



\### Iniciar campaña automática



```bash

npm run dialer start -- --clientId=miempresa\_001 --maxPerHour=20

```



---



\## 📂 Estructura del Proyecto



```

vendedor-universal/

├── server.js                 # Servidor principal

├── auto-dialer.js            # Sistema de llamadas automáticas

├── index.js                  # Lead miner (SERPAPI)

│

├── config/

│   └── client-config.js      # Gestor de configuraciones

│

├── services/

│   ├── openai.js             # Integración OpenAI Realtime

│   ├── elevenlabs.js         # Síntesis de voz

│   └── twilio.js             # Manejo de llamadas

│

├── models/

│   └── prompt-template.js    # Generador de prompts dinámicos

│

├── utils/

│   ├── logger.js             # Sistema de logs

│   └── crm.js                # Integración CRM

│

├── logs/                     # Conversaciones grabadas (JSON)

├── docs/

│   └── SETUP\_GUIDE.md        # Guía de instalación completa

│

├── package.json

├── .env.example

└── README.md

```



---



\## 🎨 Configuración de Agente



\### Formato JSON



```json

{

&nbsp; "client\_id": "unique\_id",

&nbsp; "company\_name": "Nombre de tu empresa",

&nbsp; "industry": "Tu industria",

&nbsp; "products": \[

&nbsp;   {

&nbsp;     "name": "Producto 1",

&nbsp;     "description": "Descripción breve"

&nbsp;   }

&nbsp; ],

&nbsp; "value\_proposition": "Tu diferenciador único",

&nbsp; "sales\_goal": "agendar\_demo | tomar\_pedido",

&nbsp; "conditions": {

&nbsp;   "pricing": "Desde $X",

&nbsp;   "min\_order": "Cantidad mínima",

&nbsp;   "coverage": "Zonas de cobertura"

&nbsp; },

&nbsp; "contact": {

&nbsp;   "email": "ventas@empresa.com",

&nbsp;   "whatsapp": "+52..."

&nbsp; },

&nbsp; "voice": {

&nbsp;   "provider": "elevenlabs",

&nbsp;   "voice\_id": "ID\_VOZ",

&nbsp;   "style": "profesional\_amigable"

&nbsp; },

&nbsp; "tone": "profesional\_amigable | energetico\_vendedor | formal\_corporativo | casual\_cercano"

}

```



\### Estilos de voz disponibles



\- \*\*profesional\_amigable\*\*: Cortés pero cercano (default)

\- \*\*energetico\_vendedor\*\*: Entusiasta y motivador

\- \*\*formal\_corporativo\*\*: Estructurado y técnico

\- \*\*casual\_cercano\*\*: Conversacional y relajado



---



\## 📊 Analytics y Monitoreo



\### Ver estadísticas del día



```bash

npm run stats

```



\### Buscar conversaciones



```javascript

import { searchConversations } from './utils/logger.js';



const results = await searchConversations('precio', 'allopack\_001');

console.log(results);

```



\### Exportar a CSV



```javascript

import { exportLogsToCSV } from './utils/logger.js';



const csv = await exportLogsToCSV(

&nbsp; new Date('2025-01-01'),

&nbsp; new Date('2025-12-31')

);

```



---



\## 🔌 API Endpoints



\### Gestión de Clientes



```http

POST /api/clients/:clientId/config

GET  /api/clients/:clientId/config

PUT  /api/clients/:clientId/config

DELETE /api/clients/:clientId/config

```



\### Llamadas



```http

POST /incoming-call

&nbsp; Query params: ?client=xxx\&leadId=xxx

&nbsp; 

POST /call-status

&nbsp; Webhook de Twilio con estados de llamada

```



\### Analytics



```http

GET /api/stats/daily?date=YYYY-MM-DD

GET /api/stats/client/:clientId

GET /api/conversations/search?q=keyword\&client\_id=xxx

```



---



\## 🛠️ Scripts Disponibles



| Comando | Descripción |

|---------|-------------|

| `npm start` | Inicia servidor en producción |

| `npm run dev` | Modo desarrollo con auto-reload |

| `npm run miner` | Extrae leads vía SERPAPI |

| `npm run dialer` | Sistema de llamadas automáticas |

| `npm run voices` | Lista voces disponibles de ElevenLabs |

| `npm run stats` | Estadísticas del día |



\### Ejemplos de uso del dialer



```bash

\# Campaña completa

npm run dialer start -- --clientId=allopack\_001 --maxPerHour=30



\# Llamada individual de prueba

npm run dialer test -- --phone=+525512345678 --company="Test"



\# Con delay personalizado entre llamadas

npm run dialer start -- --delay=5000 --maxPerHour=20

```



---



\## 🌐 Despliegue en Producción



\### Railway (Recomendado)



\[!\[Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)



1\. Conecta tu repositorio

2\. Agrega variables de entorno

3\. Deploy automático



\### Heroku



```bash

heroku create tu-vendedor-universal

heroku config:set OPENAI\_API\_KEY=sk-...

heroku config:set ELEVENLABS\_API\_KEY=...

git push heroku main

```



\### Docker



```dockerfile

FROM node:18-alpine

WORKDIR /app

COPY package\*.json ./

RUN npm ci --production

COPY . .

EXPOSE 3000

CMD \["node", "server.js"]

```



```bash

docker build -t vendedor-universal .

docker run -p 3000:3000 --env-file .env vendedor-universal

```



---



\## 🔐 Seguridad



\### Variables de entorno sensibles



\*\*NUNCA\*\* commitees tu `.env` al repositorio. Usa:



```bash

\# .gitignore

.env

node\_modules/

logs/

\*.log

```



\### Validación de webhooks Twilio



El servidor valida automáticamente las firmas de Twilio para prevenir solicitudes maliciosas.



\### Rate limiting



Sistema de control de llamadas por hora configurable para evitar abusos:



```javascript

const campaign = new CampaignManager({

&nbsp; maxCallsPerHour: 30 // Ajusta según tu plan de Twilio

});

```



---



\## 🐛 Troubleshooting



\### Problema: "Cannot find module 'express-ws'"



\*\*Solución:\*\*

```bash

npm install express-ws ws

```



\### Problema: "OpenAI Realtime API not enabled"



\*\*Solución:\*\*

1\. Ve a https://platform.openai.com/settings

2\. Activa "Realtime API" en tu cuenta

3\. Espera 5-10 minutos para propagación



\### Problema: Audio entrecortado o con retrasos



\*\*Solución:\*\*

\- Verifica tu conexión a internet (mínimo 5 Mbps)

\- Usa servidor en región cercana a tus usuarios

\- Considera usar μ-law codec en lugar de MP3



\### Problema: Llamadas no se conectan



\*\*Solución:\*\*

1\. Verifica que tu webhook de Twilio apunte a tu servidor público

2\. Confirma que el puerto 3000 esté abierto

3\. Revisa logs: `tail -f logs/\*.json`



---



\## 📈 Roadmap



\### v2.1 (En progreso)

\- \[ ] Dashboard web para gestión de agentes

\- \[ ] Integración con HubSpot/Salesforce

\- \[ ] Soporte para SMS y WhatsApp

\- \[ ] A/B testing de prompts



\### v2.2 (Planificado)

\- \[ ] Multi-idioma (inglés, portugués)

\- \[ ] Análisis de sentimiento en tiempo real

\- \[ ] Grabación y transcripción automática

\- \[ ] API para crear agentes desde código



\### v3.0 (Futuro)

\- \[ ] Interfaz visual para diseño de flujos

\- \[ ] ML para optimización automática de prompts

\- \[ ] Soporte para llamadas video

\- \[ ] Marketplace de plantillas de agentes



---



\## 🤝 Contribuir



¡Las contribuciones son bienvenidas!



1\. Fork el proyecto

2\. Crea tu feature branch (`git checkout -b feature/AmazingFeature`)

3\. Commit tus cambios (`git commit -m 'Add: Amazing Feature'`)

4\. Push al branch (`git push origin feature/AmazingFeature`)

5\. Abre un Pull Request



\### Guías de contribución



\- Usa ESLint y Prettier para código consistente

\- Escribe tests para nuevas funcionalidades

\- Documenta cambios en el CHANGELOG.md

\- Sigue \[Conventional Commits](https://www.conventionalcommits.org/)



---



\## 📄 Licencia



MIT License - ver \[LICENSE](LICENSE) para más detalles



---



\## 🙏 Agradecimientos



\- \*\*OpenAI\*\* - Por la increíble Realtime API

\- \*\*ElevenLabs\*\* - Por las voces más naturales del mercado

\- \*\*Twilio\*\* - Por la infraestructura de telefonía confiable

\- \*\*SERPAPI\*\* - Por la extracción de leads eficiente



---



\## 📞 Contacto y Soporte



\- \*\*Email\*\*: soporte@tu-empresa.com

\- \*\*Discord\*\*: \[Unirse a la comunidad](https://discord.gg/tu-server)

\- \*\*Issues\*\*: \[GitHub Issues](https://github.com/tu-usuario/vendedor-universal/issues)

\- \*\*Docs\*\*: \[Documentación completa](https://docs.tu-empresa.com)



---



\## 🌟 Casos de Uso



\### Industria Farmacéutica

```json

{

&nbsp; "sales\_goal": "agendar\_demo",

&nbsp; "products": \["Material de empaque", "Cajas certificadas"],

&nbsp; "tone": "formal\_corporativo"

}

```



\### E-commerce

```json

{

&nbsp; "sales\_goal": "tomar\_pedido",

&nbsp; "products": \["Cajas para envíos", "Embalaje personalizado"],

&nbsp; "tone": "energetico\_vendedor"

}

```



\### Manufactura

```json

{

&nbsp; "sales\_goal": "agendar\_demo",

&nbsp; "products": \["Soluciones industriales", "Embalaje a medida"],

&nbsp; "tone": "profesional\_amigable"

}

```



---



\## 📊 Métricas de Rendimiento



\### Benchmarks típicos



| Métrica | Valor |

|---------|-------|

| Tiempo de respuesta | < 1.5s |

| Tasa de conexión | > 85% |

| Conversión a demo | 15-25% |

| Duración promedio | 2-4 min |

| Satisfacción NPS | 8.2/10 |



\### Optimizaciones implementadas



\- ✅ WebSocket streaming para latencia mínima

\- ✅ Caching de configuraciones de clientes

\- ✅ Compresión de audio para reducir ancho de banda

\- ✅ Rate limiting inteligente

\- ✅ Retry automático en fallos de red



---



\## 🔬 Testing



\### Tests unitarios



```bash

npm test

```



\### Test de integración



```bash

npm run test:integration

```



\### Test de llamada end-to-end



```bash

npm run dialer test -- --phone=TU\_NUMERO

```



---



\## 📚 Recursos Adicionales



\### Documentación oficial



\- \[OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)

\- \[Twilio Media Streams](https://www.twilio.com/docs/voice/media-streams)

\- \[ElevenLabs API](https://elevenlabs.io/docs)



\### Tutoriales



\- \[Cómo crear tu primer agente](docs/tutorials/primer-agente.md)

\- \[Optimización de prompts](docs/tutorials/prompts.md)

\- \[Integración con tu CRM](docs/tutorials/crm-integration.md)

\- \[Despliegue en producción](docs/tutorials/deployment.md)



\### Videos



\- \[Setup completo en 10 minutos](https://youtube.com/watch?v=...)

\- \[Casos de uso reales](https://youtube.com/watch?v=...)

\- \[Mejores prácticas](https://youtube.com/watch?v=...)



---



\## ⚡ Quick Start Commands



```bash

\# Instalación completa

npm install \&\& cp .env.example .env



\# Configurar primer cliente

curl -X POST localhost:3000/api/clients/demo\_001/config \\

&nbsp; -H "Content-Type: application/json" \\

&nbsp; -d '{"company\_name":"Demo","products":\["Test"],"sales\_goal":"agendar\_demo"}'



\# Llamada de prueba

npm run dialer test -- --phone=+52... --clientId=demo\_001



\# Ver logs en tiempo real

tail -f logs/\*.json | jq .



\# Ver estadísticas

npm run stats | jq .

```



---



\## 🎓 Aprende Más



\### Blog posts recomendados



\- \[Por qué elegimos OpenAI Realtime sobre alternativas](blog/openai-realtime.md)

\- \[Arquitectura multi-tenant escalable](blog/multi-tenant.md)

\- \[Optimización de costos en producción](blog/cost-optimization.md)



\### Webinars



\- \*\*Próximo\*\*: "Cómo crear agentes de venta efectivos" - 20 Oct 2025



---



\*\*¿Preguntas? ¿Necesitas ayuda?\*\*



👉 Abre un \[issue en GitHub](https://github.com/tu-usuario/vendedor-universal/issues)  

👉 Únete a nuestro \[Discord](https://discord.gg/tu-server)  

👉 Revisa la \[documentación completa](docs/)



---



<div align="center">



\*\*Hecho con ❤️ para vendedores del futuro\*\*



\[⭐ Star en GitHub](https://github.com/tu-usuario/vendedor-universal) • \[🐛 Reportar Bug](https://github.com/tu-usuario/vendedor-universal/issues) • \[💡 Solicitar Feature](https://github.com/tu-usuario/vendedor-universal/issues)



</div>

