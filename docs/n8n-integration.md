# Documentación de API para Integración n8n

Esta documentación describe los endpoints API que n8n utilizará para sincronizar datos desde Excel y OneDrive hacia el CRM.

## Autenticación

Todos los endpoints requieren autenticación mediante API Key. Debes incluir la API Key en el header `Authorization`:

```
Authorization: Bearer YOUR_API_KEY
```

Para obtener una API Key:
1. Inicia sesión en el CRM
2. Ve a Settings → API Keys
3. Crea una nueva API Key con los permisos necesarios

## Endpoints

### 1. Sincronización de Contactos desde Excel

#### POST /api/sync/contacts

Sincroniza contactos desde Excel hacia el CRM. Realiza upsert (insert/update) basado en `phone`.

**Permisos requeridos:** `contacts:write`

**Request Body:**
```json
{
  "contacts": [
    {
      "name": "Juan Pérez",
      "phone": "+57 300 123 4567",
      "email": "juan@cafeteria.com",
      "company": "Cafetería Central",
      "tags": ["cliente", "horeca"],
      "created_at": "2024-01-15T10:00:00Z"
    }
  ],
  "sync_type": "incremental"
}
```

**Campos del contacto:**
- `name` (requerido): Nombre completo del contacto
- `phone` (requerido): Número de teléfono (se normaliza automáticamente)
- `email` (opcional): Correo electrónico
- `company` (opcional): Nombre de la empresa
- `tags` (opcional): Array de etiquetas (strings)
- `created_at` (opcional): Fecha de creación en formato ISO 8601

**sync_type:**
- `incremental`: Solo sincroniza cambios (default)
- `full`: Sincronización completa

**Response:**
```json
{
  "success": true,
  "summary": {
    "processed": 100,
    "created": 15,
    "updated": 82,
    "failed": 3
  },
  "errors": [
    {
      "row": 5,
      "error": "Missing required fields: nit_cedula, celular, or nombre_completo"
    }
  ]
}
```

#### GET /api/sync/contacts

Obtiene los logs de sincronización de contactos.

**Permisos requeridos:** `contacts:read`

**Query Parameters:**
- `limit` (opcional): Número de logs a retornar (default: 10)

**Response:**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "sync_type": "incremental",
    "records_processed": 100,
    "records_created": 15,
    "records_updated": 82,
    "records_failed": 3,
    "error_message": null,
    "started_at": "2024-01-15T10:00:00Z",
    "completed_at": "2024-01-15T10:01:30Z"
  }
]
```

---

### 2. Sincronización Multimedia desde OneDrive

#### POST /api/sync/media

Sincroniza archivos multimedia desde OneDrive hacia el CRM. Realiza upsert basado en `onedrive_id`.

**Permisos requeridos:** `contacts:write`

**Request Body:**
```json
{
  "files": [
    {
      "filename": "video_promo.mp4",
      "file_type": "video",
      "file_url": "https://onedrive.live.com/...",
      "file_size": 5242880,
      "mime_type": "video/mp4",
      "title": "Video Promocional Enero",
      "description": "Video promocional para campaña de enero",
      "category": "promocional",
      "segment": "Horeca Regional Costa",
      "onedrive_id": "01ABC123...",
      "onedrive_path": "/Marketing/Videos/2024"
    }
  ]
}
```

**Campos del archivo:**
- `filename` (requerido): Nombre del archivo
- `file_type` (requerido): Tipo de archivo (`video`, `image`, `document`, `audio`)
- `file_url` (requerido): URL del archivo en OneDrive
- `file_size` (opcional): Tamaño en bytes
- `mime_type` (opcional): Tipo MIME
- `title` (opcional): Título descriptivo (default: filename)
- `description` (opcional): Descripción del contenido
- `category` (opcional): Categoría del archivo
- `segment` (opcional): Segmento objetivo (default: "Horeca Regional Costa")
- `onedrive_id` (requerido): ID único en OneDrive
- `onedrive_path` (opcional): Ruta en OneDrive

**Response:**
```json
{
  "success": true,
  "summary": {
    "processed": 25,
    "created": 5,
    "updated": 18,
    "failed": 2
  },
  "errors": [
    {
      "file": "video_corrupt.mp4",
      "error": "Missing required fields: onedrive_id"
    }
  ]
}
```

#### GET /api/sync/media

Obtiene la biblioteca multimedia sincronizada.

**Permisos requeridos:** `contacts:read`

**Query Parameters:**
- `limit` (opcional): Número de archivos a retornar (default: 50)
- `file_type` (opcional): Filtrar por tipo de archivo
- `category` (opcional): Filtrar por categoría

**Response:**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "filename": "video_promo.mp4",
    "file_type": "video",
    "file_url": "https://onedrive.live.com/...",
    "file_size": 5242880,
    "mime_type": "video/mp4",
    "title": "Video Promocional Enero",
    "description": "Video promocional para campaña de enero",
    "category": "promocional",
    "segment": "Horeca Regional Costa",
    "onedrive_id": "01ABC123...",
    "onedrive_path": "/Marketing/Videos/2024",
    "onedrive_synced_at": "2024-01-15T10:00:00Z",
    "whatsapp_media_id": null,
    "media_status": "pending",
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  }
]
```

---

## Configuración en n8n

### Flujo de Sincronización de Excel

1. **Trigger:** Google Sheets Watch (o OneDrive Watch)
   - Configura para detectar cambios en el archivo Excel
   - Intervalo recomendado: cada 5 minutos

2. **Leer Excel:** Google Sheets node (o Excel node)
   - Lee todas las filas del archivo
   - Mapea las columnas al formato JSON requerido

3. **Transformar Datos:** Function node
   ```javascript
   return items.map(item => ({
     json: {
       fecha: item.json.FECHA,
       nit_cedula: item.json['NIT O CEDULA'],
       nombre_completo: item.json['Nombre completo'],
       empresa: item.json.Empresa,
       celular: item.json.Celular,
       correo: item.json.Correo,
       ciudad_operacion: item.json['Ciudad de operación'],
       cargo: item.json.Cargo,
       sector: item.json.SECTOR || 'Horeca Regional Costa',
       interes_agua: item.json.AGUA === 'x' || item.json.AGUA === true,
       interes_multibebi: item.json.MULTIBEBI === 'x' || item.json.MULTIBEBI === true,
       interes_cafe: item.json.CAFÉ === 'x' || item.json.CAFÉ === true,
       interes_granizados: item.json.GRANIZADOS === 'x' || item.json.GRANIZADOS === true,
       interes_hielo: item.json.HIELO === 'x' || item.json.HIELO === true,
       interes_otros: item.json.OTROS === 'x' || item.json.OTROS === true,
       excel_row_id: item.$index + 1
     }
   }));
   ```

4. **Agrupar Contactos:** Aggregate node
   - Agrupa todos los contactos en un array
   - Operación: Aggregate Items
   - Fields to aggregate: Todos los campos

5. **Enviar al CRM:** HTTP Request node
   - Method: POST
   - URL: `https://tu-crm.com/api/sync/contacts`
   - Authentication: Generic Credential Type
   - Header: `Authorization: Bearer YOUR_API_KEY`
   - Content Type: JSON
   - Body:
     ```json
     {
       "contacts": {{ $json.contacts }},
       "sync_type": "incremental"
     }
     ```

### Flujo de Sincronización Multimedia

1. **Trigger:** OneDrive Watch
   - Configura para detectar cambios en la carpeta de marketing
   - Intervalo recomendado: cada 10 minutos

2. **Listar Archivos:** OneDrive node
   - Lista archivos en la carpeta específica
   - Filtra por tipo de archivo (video, image, etc.)

3. **Transformar Datos:** Function node
   ```javascript
   return items.map(item => ({
     json: {
       filename: item.json.name,
       file_type: getFileType(item.json.name),
       file_url: item.json['@microsoft.graph.downloadUrl'],
       file_size: item.json.size,
       mime_type: item.json.file?.mimeType,
       title: item.json.name,
       category: getCategory(item.json.parentReference.path),
       segment: 'Horeca Regional Costa',
       onedrive_id: item.json.id,
       onedrive_path: item.json.parentReference.path
     }
   }));
   
   function getFileType(filename) {
     const ext = filename.split('.').pop().toLowerCase();
     if (['mp4', 'mov', 'avi'].includes(ext)) return 'video';
     if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'image';
     if (['pdf', 'doc', 'docx'].includes(ext)) return 'document';
     if (['mp3', 'wav'].includes(ext)) return 'audio';
     return 'document';
   }
   
   function getCategory(path) {
     if (path.includes('promocional')) return 'promocional';
     if (path.includes('catalogo')) return 'catalogo';
     if (path.includes('informativo')) return 'informativo';
     return 'general';
   }
   ```

4. **Agrupar Archivos:** Aggregate node
   - Agrupa todos los archivos en un array

5. **Enviar al CRM:** HTTP Request node
   - Method: POST
   - URL: `https://tu-crm.com/api/sync/media`
   - Authentication: Generic Credential Type
   - Header: `Authorization: Bearer YOUR_API_KEY`
   - Content Type: JSON
   - Body:
     ```json
     {
       "files": {{ $json.files }}
     }
     ```

## Manejo de Errores

- Los endpoints retornan errores detallados en el array `errors`
- Cada error incluye el índice de la fila/archivo y el mensaje específico
- La sincronización continúa aunque algunos registros fallen
- Revisa los logs en `GET /api/sync/contacts` para auditoría

## Consideraciones

- **Deduplicación:** Los contactos se deduplican por `nit_cedula` o `phone`
- **Normalización:** Los números de teléfono se normalizan automáticamente
- **Timestamps:** Se registran automáticamente `excel_synced_at` y `onedrive_synced_at`
- **RLS:** Todos los datos están protegidos por Row Level Security
- **Logs:** Cada sincronización crea un registro en `excel_sync_logs`

## Testing

Para probar los endpoints localmente:

```bash
# Sincronizar contactos
curl -X POST http://localhost:3000/api/sync/contacts \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contacts": [
      {
        "nit_cedula": "900123456",
        "nombre_completo": "Juan Pérez",
        "empresa": "Cafetería Central",
        "celular": "+57 300 123 4567"
      }
    ],
    "sync_type": "incremental"
  }'

# Sincronizar media
curl -X POST http://localhost:3000/api/sync/media \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {
        "filename": "video.mp4",
        "file_type": "video",
        "file_url": "https://...",
        "onedrive_id": "01ABC123"
      }
    ]
  }'
```
