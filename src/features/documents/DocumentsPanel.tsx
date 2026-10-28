import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Download, FileText, Loader2, Trash2, UploadCloud, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/auth/AuthProvider'
import { cn } from '@/lib/utils'
import { DOC_TYPES } from '@/lib/status'
import { formatBytes, formatDateTime } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import { deleteDocument, openDocument, uploadDocument } from '@/lib/documents'
import type { Enums, Tables } from '@/lib/database.types'
import { useUsers, userName } from '@/hooks/useReference'

type Staged = { key: string; file: File; docType: Enums<'doc_type'> }

const MAX_BYTES = 50 * 1024 * 1024

function guessType(name: string): Enums<'doc_type'> {
  const n = name.toLowerCase()
  if (/slip/.test(n)) return 'slip'
  if (/border|bdx/.test(n)) return 'bordereau'
  if (/invoice/.test(n)) return 'invoice'
  if (/debit/.test(n)) return 'debit_note'
  if (/credit/.test(n)) return 'credit_note'
  if (/\.(eml|msg)$/.test(n)) return 'correspondence'
  return 'submission'
}

/** Generic documents list + drag-and-drop multi upload for any entity (submission now; premium/claim later). */
export function DocumentsPanel({
  entityType,
  entityId,
  documents,
  canWrite,
  evidenceIds,
}: {
  entityType: Enums<'entity_type'>
  entityId: string
  documents: Tables<'documents'>[]
  canWrite: boolean
  /** Documents referenced as confirmation evidence in the status history — cannot be deleted. */
  evidenceIds?: Set<string>
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { profile, role } = useAuth()
  const users = useUsers()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [staged, setStaged] = useState<Staged[]>([])
  const [uploading, setUploading] = useState(false)

  const usersById = new Map(users.data?.map((u) => [u.id, u]))

  function addFiles(list: FileList | null) {
    if (!list) return
    const next: Staged[] = []
    for (const file of Array.from(list)) {
      if (file.size > MAX_BYTES) {
        toast.error(t('docs.tooLarge', { name: file.name }))
        continue
      }
      next.push({ key: crypto.randomUUID(), file, docType: guessType(file.name) })
    }
    setStaged((s) => [...s, ...next])
  }

  async function uploadAll() {
    setUploading(true)
    let ok = 0
    const failed: Staged[] = []
    for (const s of staged) {
      try {
        await uploadDocument(entityType, entityId, s.file, s.docType)
        ok++
      } catch (e) {
        failed.push(s)
        toast.error(`${s.file.name}: ${errorMessage(e)}`)
      }
    }
    setStaged(failed)
    setUploading(false)
    if (ok) toast.success(t('docs.uploaded', { count: ok }))
    await qc.invalidateQueries({ queryKey: ['documents', entityType, entityId] })
  }

  async function remove(doc: Tables<'documents'>) {
    if (!window.confirm(t('docs.confirmDelete', { name: doc.file_name }))) return
    try {
      await deleteDocument(doc)
      toast.success(t('docs.deleted'))
      await qc.invalidateQueries({ queryKey: ['documents', entityType, entityId] })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const canDelete = (d: Tables<'documents'>) =>
    !evidenceIds?.has(d.id) && (role === 'admin' || (canWrite && d.uploaded_by === profile?.id))

  return (
    <div className="grid gap-4">
      {canWrite && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm text-muted-foreground transition-colors',
            dragOver ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
          )}
        >
          <UploadCloud className="size-6" />
          <span>{t('docs.dropHere')}</span>
          <span className="text-xs">{t('docs.maxSize')}</span>
          <input ref={inputRef} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        </div>
      )}

      {staged.length > 0 && (
        <div className="grid gap-2 rounded-lg border p-3">
          {staged.map((s) => (
            <div key={s.key} className="flex flex-wrap items-center gap-2">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm" title={s.file.name}>{s.file.name}</span>
              <span className="text-xs text-muted-foreground">{formatBytes(s.file.size)}</span>
              <div className="w-44">
                <NativeSelect
                  value={s.docType}
                  aria-label={t('fields.docType')}
                  onChange={(e) => setStaged((all) => all.map((x) => (x.key === s.key ? { ...x, docType: e.target.value as Enums<'doc_type'> } : x)))}
                >
                  {DOC_TYPES.map((d) => <option key={d} value={d}>{t(`docType.${d}`)}</option>)}
                </NativeSelect>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setStaged((all) => all.filter((x) => x.key !== s.key))} disabled={uploading} aria-label={t('common.remove')}>
                <X />
              </Button>
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setStaged([])} disabled={uploading}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={() => void uploadAll()} disabled={uploading}>
              {uploading ? <Loader2 className="animate-spin" /> : <UploadCloud />}
              {t('docs.uploadN', { count: staged.length })}
            </Button>
          </div>
        </div>
      )}

      {documents.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{t('docs.none')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t('docs.file')}</TableHead>
              <TableHead>{t('fields.docType')}</TableHead>
              <TableHead>{t('docs.version')}</TableHead>
              <TableHead>{t('docs.size')}</TableHead>
              <TableHead>{t('docs.uploadedBy')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="max-w-72">
                  <button type="button" className="flex items-center gap-2 truncate text-left text-primary hover:underline" onClick={() => openDocument(d).catch((e) => toast.error(errorMessage(e)))}>
                    <FileText className="size-4 shrink-0" />
                    <span className="truncate" title={d.file_name}>{d.file_name}</span>
                  </button>
                </TableCell>
                <TableCell>
                  {t(`docType.${d.doc_type}`)}
                  {evidenceIds?.has(d.id) && <span className="ml-1.5 rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">{t('docs.evidence')}</span>}
                </TableCell>
                <TableCell>v{d.version}</TableCell>
                <TableCell>{formatBytes(d.size_bytes)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {userName(usersById.get(d.uploaded_by ?? ''))}
                  <br />
                  {formatDateTime(d.uploaded_at)}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openDocument(d).catch((e) => toast.error(errorMessage(e)))} aria-label={t('docs.download')}>
                    <Download />
                  </Button>
                  {canDelete(d) && (
                    <Button variant="ghost" size="icon" onClick={() => void remove(d)} aria-label={t('common.delete')}>
                      <Trash2 />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
