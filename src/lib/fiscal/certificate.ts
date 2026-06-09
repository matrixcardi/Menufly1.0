import { supabase } from '@/integrations/supabase/client'

export interface CertificateUploadResult {
  path: string
  fileName: string
}

export async function uploadCertificate(
  restaurantId: string,
  file: File
): Promise<CertificateUploadResult> {
  const timestamp = Date.now()
  const path = `${restaurantId}/certificado_${timestamp}.pfx`
  
  console.log('[CERT] Uploading certificate:', path)
  
  const { data, error } = await supabase.storage
    .from('fiscal-certificates')
    .upload(path, file, {
      contentType: 'application/x-pkcs12',
      upsert: false,
    })
  
  if (error) {
    console.error('[CERT] Upload error:', error)
    throw new Error(`Falha no upload: ${error.message}`)
  }
  
  console.log('[CERT] Upload success:', data)
  
  return {
    path: data.path,
    fileName: file.name,
  }
}

export async function deleteCertificate(path: string): Promise<void> {
  console.log('[CERT] Deleting certificate:', path)
  
  const { error } = await supabase.storage
    .from('fiscal-certificates')
    .remove([path])
  
  if (error) {
    console.error('[CERT] Delete error:', error)
    throw new Error(`Falha ao deletar: ${error.message}`)
  }
}

export function encodePassword(password: string): string {
  // TODO FASE 4: substituir por criptografia AES via Edge Function
  return btoa(password)
}

export function decodePassword(encoded: string): string {
  // TODO FASE 4: substituir por descriptografia AES via Edge Function
  return atob(encoded)
}
