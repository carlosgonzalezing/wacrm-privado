# Configuración de Groq para Pruebas de IA

## ¿Qué es Groq?

**Groq** es una plataforma de inferencia de IA ultra-rápida que ofrece acceso gratuito a modelos de lenguaje de alta calidad como Llama 3, Mixtral y Gemma. Es ideal para pruebas y desarrollo.

**Importante:** Groq ≠ Grok (la IA de X/Twitter). Son empresas diferentes.

## Obtener API Key de Groq

1. Ve a [https://console.groq.com/keys](https://console.groq.com/keys)
2. Crea una cuenta gratuita si no tienes una
3. Genera una nueva API key
4. Copia la key (comienza con `gsk_...`)

## Configurar Groq en el Sistema

### 1. Acceder a Configuración de IA

- Ve a **Settings** → **AI Configuration**
- En la sección "Provider and Key" selecciona **Groq (Gratis para pruebas)**

### 2. Configurar Parámetros

**Proveedor:** Groq (Gratis para pruebas)

**Modelo:** Los modelos disponibles de Groq incluyen:
- `llama3-70b-8192` (Recomendado - Alta calidad)
- `llama3-8b-8192` (Más rápido, menos capacidad)
- `mixtral-8x7b-32768`
- `gemma-7b-it`

**API Key:** Tu key de Groq (comienza con `gsk_...`)

### 3. Probar la Configuración

Haz clic en el botón **"Test Key"** para verificar que tu API key funcione correctamente.

## Características de Groq

### Ventajas
- ✅ **Gratis** para pruebas con límites generosos
- ✅ **Ultra-rápido** - Latencia extremadamente baja
- ✅ **API-compatible** con OpenAI (fácil integración)
- ✅ **Modelos de alta calidad** - Llama 3 70B es muy potente

### Limitaciones
- Límites de rate en el plan gratuito
- Menos modelos que OpenAI/Anthropic
- Solo disponible para pruebas/desarrollo

## Uso en el Sistema

Una vez configurado, Groq funcionará igual que OpenAI o Anthropic:

### Auto-Reply
- El bot responderá automáticamente mensajes entrantes
- Usará el modelo de Groq para generar respuestas
- Respetará los límites configurados por conversación

### Draft Assistant
- Podrás generar borradores de respuestas en el inbox
- El asistente usará Groq para sugerir respuestas

### Campaign Leads
- El clasificador de leads puede usar Groq para análisis
- Clasificación automática de leads de campañas

## Modelos Recomendados

### Para Producción
- `llama3-70b-8192` - Mejor calidad, similar a GPT-4

### Para Desarrollo/Pruebas
- `llama3-8b-8192` - Más rápido, suficiente para pruebas

### Para Análisis de Texto
- `mixtral-8x7b-32768` - Buen balance calidad/velocidad

## Solución de Problemas

### Error: "Invalid API key"
- Verifica que la key sea correcta y comience con `gsk_...`
- Asegúrate de que la key esté activa en tu cuenta de Groq

### Error: "Rate limit exceeded"
- El plan gratuito tiene límites de rate
- Espera unos minutos y reintenta
- Considera actualizar a un plan pago si necesitas más capacidad

### Error: "Model not found"
- Verifica que el nombre del modelo sea correcto
- Usa los modelos listados arriba
- Groq puede cambiar los nombres de modelos

## Comparación con Otros Proveedores

| Característica | Groq | OpenAI | Anthropic |
|---------------|------|--------|-----------|
| Costo | Gratis (pruebas) | Pago | Pago |
| Velocidad | Ultra-rápido | Rápido | Rápido |
| Modelos | Limitados | Amplios | Amplios |
| Calidad | Alta | Muy Alta | Muy Alta |
| API | OpenAI-compatible | OpenAI | Propia |

## Recursos

- [Documentación de Groq](https://console.groq.com/docs)
- [Playground de Groq](https://console.groq.com/playground)
- [Lista de modelos disponibles](https://console.groq.com/docs/models)

## Notas Importantes

1. **Solo para pruebas:** Groq es ideal para desarrollo y pruebas, pero para producción considera planes pagos de OpenAI o Anthropic.

2. **Límites:** El plan gratuito tiene límites que pueden afectar el uso intensivo.

3. **Privacidad:** Revisa la política de privacidad de Groq si manejas datos sensibles.

4. **Alternativa:** Si necesitas más capacidad, considera migrar a OpenAI o Anthropic con planes pagos.
