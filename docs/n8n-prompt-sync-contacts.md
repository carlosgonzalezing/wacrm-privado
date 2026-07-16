# Prompt para Crear Flujo de n8n - Sincronización de Contactos

Copia y pega este prompt en n8n para crear el flujo de trabajo de sincronización de contactos desde Excel:

---

Quiero crear un flujo de trabajo en n8n para sincronizar contactos desde un archivo de Excel a mi CRM.

El flujo debe realizar los siguientes pasos:

1. **Leer un archivo de Excel:**
   - El archivo de Excel se cargará manualmente o se obtendrá de una fuente (por ejemplo, OneDrive, Google Drive).
   - Debe leer todas las filas del archivo.
   - El Excel tiene las columnas: Name, Phone, Email, Company, Tags, Created

2. **Iterar sobre cada fila del Excel:**
   - Para cada fila, extraer los datos de las columnas correspondientes.

3. **Preparar los datos para el CRM:**
   - Mapear los datos del Excel a la estructura esperada por el endpoint `/api/sync/contacts` de mi CRM.
   - Asegurarse de que los números de teléfono se normalicen (quitar espacios, guiones, paréntesis).
   - Si el campo `Tags` en Excel es una cadena con múltiples etiquetas separadas por comas, convertirlas a un array de strings.
   - El campo `Created` debe estar en formato ISO 8601. Si no hay fecha, usar la fecha actual.

4. **Agrupar todos los contactos en un array:**
   - Usar un nodo "Aggregate" o "Merge" para agrupar todos los contactos en un solo array.

5. **Enviar los datos al endpoint de sincronización del CRM:**
   - Utilizar un nodo HTTP Request para enviar una solicitud POST al endpoint `https://[TU_DOMINIO_CRM]/api/sync/contacts`.
   - El cuerpo de la solicitud debe ser un JSON con esta estructura:
     ```json
     {
       "contacts": [
         {
           "name": "Nombre del contacto",
           "phone": "+573001234567",
           "email": "correo@ejemplo.com",
           "company": "Nombre empresa",
           "tags": ["tag1", "tag2"],
           "created_at": "2024-01-15T10:00:00Z"
         }
       ],
       "sync_type": "incremental"
     }
     ```
   - Incluir autenticación con API Key en el header: `Authorization: Bearer YOUR_API_KEY`
   - Content-Type: `application/json`

6. **Manejar la respuesta del CRM:**
   - Registrar el resumen de la sincronización (created, updated, failed).
   - Si hay errores, capturar los mensajes para depuración.

**Requisitos adicionales:**
- El flujo debe ser robusto ante datos faltantes en el Excel.
- Debe manejar correctamente la conversión de tags de string a array.
- Debe normalizar los números de teléfono antes de enviarlos.
- Debe incluir manejo de errores básico.

Por favor, genera el flujo de trabajo completo en n8n basado en estos requisitos.

---

## Configuración del Endpoint

**URL:** `https://[TU_DOMINIO_CRM]/api/sync/contacts`
**Método:** `POST`
**Headers:**
- `Authorization: Bearer YOUR_API_KEY`
- `Content-Type: application/json`

**Body:**
```json
{
  "contacts": [
    {
      "name": "{{ $json.name }}",
      "phone": "{{ $json.phone }}",
      "email": "{{ $json.email }}",
      "company": "{{ $json.company }}",
      "tags": {{ $json.tags }},
      "created_at": "{{ $json.created_at }}"
    }
  ],
  "sync_type": "incremental"
}
```

## Ejemplo de Datos de Excel

| Name | Phone | Email | Company | Tags | Created |
|------|-------|-------|---------|------|---------|
| Juan Pérez | +57 300 123 4567 | juan@ejemplo.com | Cafetería Central | cliente,horeca | 2024-01-15 |
| María García | +57 310 987 6543 | maria@ejemplo.com | Restaurante ABC | prospecto | 2024-01-16 |

## Transformación de Datos en n8n

Si necesitas transformar los datos en n8n, usa este código en un nodo "Function":

```javascript
// Normalizar teléfono
const phone = $json.phone.replace(/[\s\-\(\)]/g, '');

// Convertir tags de string a array si es necesario
let tags = $json.tags;
if (typeof tags === 'string') {
  tags = tags.split(',').map(t => t.trim());
}

// Formatear fecha si es necesario
let createdAt = $json.created_at;
if (createdAt && !createdAt.includes('T')) {
  createdAt = new Date(createdAt).toISOString();
}

return {
  json: {
    name: $json.name,
    phone: phone,
    email: $json.email,
    company: $json.company,
    tags: tags,
    created_at: createdAt || new Date().toISOString()
  }
};
```
