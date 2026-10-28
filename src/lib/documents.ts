import { supabase } from '@/lib/supabase'
import type { Enums, Tables } from '@/lib/database.types'

export const DOCUMENTS_BUCKET = 'documents'

function safeName(name: string) {
  const cleaned = name.normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_')
  return cleaned.slice(-120) || 'file'
}

/** Upload a file to Storage and register it in `documents`. Rolls back the file if the row fails. */
export async function uploadDocument(
  entityType: Enums<'entity_type'>,
  entityId: string,
  file: File,
  docType: Enums<'doc_type'>,
): Promise<Tables<'documents'>> {
  const path = `${entityType}/${entityId}/${crypto.randomUUID()}-${safeName(file.name)}`
  const { error: upErr } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (upErr) throw upErr

  const { data, error } = await supabase
    .from('documents')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      doc_type: docType,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
    })
    .select()
    .single()
  if (error) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([path])
    throw error
  }
  return data
}

export async function openDocument(doc: Pick<Tables<'documents'>, 'storage_path' | 'file_name'>) {
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(doc.storage_path, 120, { download: doc.file_name })
  if (error) throw error
  window.open(data.signedUrl, '_blank', 'noopener')
}

export async function deleteDocument(doc: Pick<Tables<'documents'>, 'id' | 'storage_path'>) {
  const { data, error } = await supabase.from('documents').delete().eq('id', doc.id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('permission denied')
  await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path])
}
