-- ============================================================
-- MIGRACIÓN: Campos para integración con Excel
-- ============================================================

-- Agregar campos faltantes a la tabla contacts
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS nit_cedula TEXT,
ADD COLUMN IF NOT EXISTS ciudad_operacion TEXT,
ADD COLUMN IF NOT EXISTS cargo TEXT,
ADD COLUMN IF NOT EXISTS sector TEXT DEFAULT 'Horeca Regional Costa',
ADD COLUMN IF NOT EXISTS fecha_registro DATE,
ADD COLUMN IF NOT EXISTS interes_agua BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS interes_multibebi BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS interes_cafe BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS interes_granizados BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS interes_hielo BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS interes_otros BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS excel_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS excel_row_id INTEGER;

-- Crear índices para los nuevos campos
CREATE INDEX IF NOT EXISTS idx_contacts_sector ON contacts(sector);
CREATE INDEX IF NOT EXISTS idx_contacts_nit ON contacts(nit_cedula);
CREATE INDEX IF NOT EXISTS idx_contacts_excel_sync ON contacts(excel_synced_at);

-- Crear tabla para seguimiento de sincronizaciones
CREATE TABLE IF NOT EXISTS excel_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental')),
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_excel_sync_logs_user ON excel_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_excel_sync_logs_date ON excel_sync_logs(started_at);

ALTER TABLE excel_sync_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own sync logs" ON excel_sync_logs;
CREATE POLICY "Users can manage own sync logs" ON excel_sync_logs FOR ALL USING (auth.uid() = user_id);

-- Crear tabla para leads (calificados por IA)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES broadcasts(id) ON DELETE SET NULL,
  
  -- Información capturada por el chatbot
  producto_interes TEXT,
  tipologia_negocio TEXT,
  contacto_nombre TEXT,
  contacto_telefono TEXT,
  
  -- Calificación por IA
  ia_score INTEGER CHECK (ia_score >= 0 AND ia_score <= 100),
  ia_resumen TEXT,
  ia_intencion TEXT,
  
  -- Gestión del lead
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  
  -- Exportación
  exported_to_sales BOOLEAN DEFAULT FALSE,
  exported_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_user ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_contact ON leads(contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(ia_score);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own leads" ON leads;
CREATE POLICY "Users can manage own leads" ON leads FOR ALL USING (auth.uid() = user_id);

-- Crear tabla para biblioteca multimedia
CREATE TABLE IF NOT EXISTS media_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Información del archivo
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('video', 'image', 'document', 'audio')),
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  
  -- Metadatos
  title TEXT,
  description TEXT,
  category TEXT,
  segment TEXT DEFAULT 'Horeca Regional Costa',
  
  -- Integración con OneDrive
  onedrive_id TEXT,
  onedrive_path TEXT,
  onedrive_synced_at TIMESTAMPTZ,
  
  -- Uso en campañas
  whatsapp_media_id TEXT,
  media_status TEXT DEFAULT 'pending' CHECK (media_status IN ('pending', 'uploaded', 'failed')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_library_user ON media_library(user_id);
CREATE INDEX IF NOT EXISTS idx_media_library_type ON media_library(file_type);
CREATE INDEX IF NOT EXISTS idx_media_library_category ON media_library(category);
CREATE INDEX IF NOT EXISTS idx_media_library_segment ON media_library(segment);

ALTER TABLE media_library ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own media" ON media_library;
CREATE POLICY "Users can manage own media" ON media_library FOR ALL USING (auth.uid() = user_id);

-- Crear tabla para campañas específicas del negocio
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  
  -- Configuración
  segment_filter TEXT DEFAULT 'Horeca Regional Costa',
  template_name TEXT NOT NULL,
  template_language TEXT DEFAULT 'es_CO',
  
  -- Contenido multimedia
  media_ids UUID[] DEFAULT '{}',
  
  -- Programación
  campaign_type TEXT DEFAULT 'manual' CHECK (campaign_type IN ('manual', 'scheduled')),
  scheduled_date DATE,
  videos_per_day INTEGER DEFAULT 2,
  
  -- Estadísticas
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  total_contacts INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  lead_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_user ON marketing_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_date ON marketing_campaigns(scheduled_date);

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own campaigns" ON marketing_campaigns;
CREATE POLICY "Users can manage own campaigns" ON marketing_campaigns FOR ALL USING (auth.uid() = user_id);

-- Trigger para updated_at en nuevas tablas
DROP TRIGGER IF EXISTS set_updated_at ON leads;
DROP TRIGGER IF EXISTS set_updated_at ON media_library;
DROP TRIGGER IF EXISTS set_updated_at ON marketing_campaigns;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON media_library FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON marketing_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentación
COMMENT ON COLUMN contacts.nit_cedula IS 'NIT o cédula del cliente desde Excel';
COMMENT ON COLUMN contacts.ciudad_operacion IS 'Ciudad de operación del negocio';
COMMENT ON COLUMN contacts.cargo IS 'Cargo del contacto';
COMMENT ON COLUMN contacts.sector IS 'Sector de negocio (Horeca Regional Costa)';
COMMENT ON COLUMN contacts.fecha_registro IS 'Fecha de registro desde Excel';
COMMENT ON COLUMN contacts.interes_agua IS 'Interés en producto AGUA';
COMMENT ON COLUMN contacts.interes_multibebi IS 'Interés en producto MULTIBEBI';
COMMENT ON COLUMN contacts.interes_cafe IS 'Interés en producto CAFÉ';
COMMENT ON COLUMN contacts.interes_granizados IS 'Interés en producto GRANIZADOS';
COMMENT ON COLUMN contacts.interes_hielo IS 'Interés en producto HIELO';
COMMENT ON COLUMN contacts.interes_otros IS 'Interés en producto OTROS';
COMMENT ON COLUMN contacts.excel_synced_at IS 'Última sincronización desde Excel';
COMMENT ON COLUMN contacts.excel_row_id IS 'ID de fila en Excel original';

COMMENT ON TABLE leads IS 'Leads calificados por IA desde conversaciones';
COMMENT ON TABLE media_library IS 'Biblioteca multimedia sincronizada desde OneDrive';
COMMENT ON TABLE marketing_campaigns IS 'Campañas de marketing específicas del negocio';
COMMENT ON TABLE excel_sync_logs IS 'Logs de sincronización desde Excel';
