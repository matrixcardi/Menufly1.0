
import { createClient } from '@supabase/supabase-js';

const SOURCE_URL = 'https://tviknowihpwolwfjuwog.supabase.co';
const TARGET_URL = process.env.TARGET_URL;
const TARGET_SERVICE_ROLE_KEY = process.env.TARGET_SERVICE_ROLE_KEY;

if (!TARGET_URL || !TARGET_SERVICE_ROLE_KEY) {
  console.error('Erro: TARGET_URL e TARGET_SERVICE_ROLE_KEY são necessários.');
  process.exit(1);
}

const supabase = createClient(TARGET_URL, TARGET_SERVICE_ROLE_KEY);

const TABLES_COLUMNS = [
  { table: 'addon_items', column: 'image_url' },
  { table: 'campaigns', column: 'image_url' },
  { table: 'products', column: 'image_url' },
  { table: 'promos', column: 'image_url' },
  { table: 'restaurants', column: 'banner_url' },
  { table: 'restaurants', column: 'logo_url' }
];

async function migrate() {
  const allUrls = new Set();

  for (const { table, column } of TABLES_COLUMNS) {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .like(column, `${SOURCE_URL}%`);

    if (error) {
      console.error(`Erro ao buscar em ${table}.${column}:`, error.message);
      continue;
    }

    data.forEach(row => {
      if (row[column]) allUrls.add(row[column]);
    });
  }

  console.log(`Encontradas ${allUrls.size} URLs únicas para migrar.`);

  for (const url of allUrls) {
    try {
      // Exemplo de URL: https://tviknowihpwolwfjuwog.supabase.co/storage/v1/object/public/product-images/rest_id/file.png
      const pathParts = url.replace(`${SOURCE_URL}/storage/v1/object/public/`, '').split('/');
      const bucket = pathParts.shift();
      const filePath = pathParts.join('/');

      console.log(`Migrando [${bucket}] ${filePath}...`);

      // 1. Download
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Falha no download: ${response.statusText}`);
      const blob = await response.blob();

      // 2. Upload to new project
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, blob, {
          upsert: true,
          contentType: response.headers.get('content-type')
        });

      if (uploadError) {
        console.error(`Erro no upload de ${filePath}:`, uploadError.message);
      } else {
        console.log(`Sucesso: ${filePath}`);
      }
    } catch (err) {
      console.error(`Falha ao migrar ${url}:`, err.message);
    }
  }

  console.log('Migração concluída!');
}

migrate();
