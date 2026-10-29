import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, Paperclip } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/Field'
import { StatusBadge } from '@/components/StatusBadge'
import { supabase } from '@/lib/supabase'
import { cleanDecimal, isDecimal, toScaled } from '@/lib/decimal'
import { addDays, formatPct, isoDate } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import { DOC_TYPES, type SubmissionStatus } from '@/lib/status'
import { uploadDocument } from '@/lib/documents'
import type { Enums, Tables } from '@/lib/database.types'
import type { SubmissionRow } from './api'

type Props = {
  submission: SubmissionRow
  target: SubmissionStatus | null
  documents: Tables<'documents'>[]
  onClose: () => void
  /** Called after a status change succeeded (the page opens the premium schedule step after binding). */
  onDone?: (status: SubmissionStatus) => void
}

/** Collects exactly what each transition needs; the database re-checks every rule. */
export function StatusChangeDialog({ submission, target, documents, onClose, onDone }: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [comment, setComment] = useState('')
  const [written, setWritten] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [signed, setSigned] = useState('')
  const [docId, setDocId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<Enums<'doc_type'>>('slip')
  const [noDocOk, setNoDocOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!target) return
    setComment('')
    setWritten(submission.written_share_pct === null ? '' : String(submission.written_share_pct))
    setValidUntil(submission.offer_valid_until ?? addDays(isoDate(), 30))
    setSigned(submission.written_share_pct === null ? '' : String(submission.written_share_pct))
    setDocId('')
    setFile(null)
    setNoDocOk(false)
    setError(null)
  }, [target, submission])

  if (!target) return null

  const needsReason = target === 'declined' || target === 'ntu'
  const isOffer = target === 'offered'
  const isBind = target === 'bound'

  function validate(): string | null {
    if (needsReason && !comment.trim()) return t('statusDlg.reasonRequired')
    if (isOffer) {
      if (!written || !isDecimal(written, 6) || Number(cleanDecimal(written)) <= 0 || Number(cleanDecimal(written)) > 100) return t('statusDlg.writtenInvalid')
      if (!validUntil) return t('statusDlg.validUntilRequired')
    }
    if (isBind) {
      if (!signed || !isDecimal(signed, 6) || Number(cleanDecimal(signed)) <= 0) return t('statusDlg.signedInvalid')
      const s = toScaled(signed, 6)!
      const w = toScaled(submission.written_share_pct ?? 0, 6)!
      if (s > w) return t('statusDlg.signedAboveWritten', { written: formatPct(submission.written_share_pct) })
      if (!docId && !file && !noDocOk) return t('statusDlg.docPrompt')
    }
    return null
  }

  async function submit() {
    const v = validate()
    if (v) {
      setError(v)
      return
    }
    setBusy(true)
    setError(null)
    try {
      let documentId = docId || null
      if (isBind && file) {
        const doc = await uploadDocument('submission', submission.id!, file, fileType)
        documentId = doc.id
      }
      const { error: rpcErr } = await supabase.rpc('change_submission_status', {
        p_submission_id: submission.id!,
        p_to_status: target!,
        p_comment: comment.trim() || undefined,
        p_written_share_pct: isOffer ? cleanDecimal(written) : undefined,
        p_offer_valid_until: isOffer ? validUntil : undefined,
        p_signed_share_pct: isBind ? cleanDecimal(signed) : undefined,
        p_document_id: documentId ?? undefined,
      })
      if (rpcErr) throw rpcErr
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['submissions'] }),
        qc.invalidateQueries({ queryKey: ['follow_ups'] }),
        qc.invalidateQueries({ queryKey: ['documents'] }),
        qc.invalidateQueries({ queryKey: ['audit'] }),
      ])
      toast.success(t('statusDlg.done', { status: t(`status.${target}`) }))
      onClose()
      onDone?.(target!)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t(`statusAction.${target}`)}</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {submission.ref_no} · <StatusBadge status={submission.status} /> → <StatusBadge status={target} />
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {isOffer && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('fields.writtenSharePct')} required>
                <Input inputMode="decimal" value={written} onChange={(e) => setWritten(e.target.value)} className="text-right" autoFocus />
              </Field>
              <Field label={t('fields.offerValidUntil')} required>
                <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </Field>
              <p className="text-caption text-muted-foreground sm:col-span-2">{t('statusDlg.offerFollowUpNote')}</p>
            </div>
          )}

          {isBind && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('fields.writtenSharePct')}>
                  <Input value={formatPct(submission.written_share_pct)} disabled />
                </Field>
                <Field label={t('fields.signedSharePct')} required hint={t('statusDlg.signedHint')}>
                  <Input inputMode="decimal" value={signed} onChange={(e) => setSigned(e.target.value)} className="text-right" autoFocus />
                </Field>
              </div>
              <div className="grid gap-3 rounded-md border border-dashed p-3">
                <div className="flex items-center gap-2 text-body font-medium">
                  <Paperclip className="size-4" />
                  {t('statusDlg.confirmationDoc')}
                </div>
                {documents.length > 0 && (
                  <Field label={t('statusDlg.pickExisting')}>
                    <NativeSelect value={docId} onChange={(e) => { setDocId(e.target.value); if (e.target.value) setFile(null) }}>
                      <option value="">—</option>
                      {documents.map((d) => (
                        <option key={d.id} value={d.id}>{d.file_name} · {t(`docType.${d.doc_type}`)} · v{d.version}</option>
                      ))}
                    </NativeSelect>
                  </Field>
                )}
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px]">
                  <Field label={t('statusDlg.orUpload')}>
                    <Input type="file" onChange={(e) => { setFile(e.target.files?.[0] ?? null); if (e.target.files?.[0]) setDocId('') }} />
                  </Field>
                  <Field label={t('fields.docType')}>
                    <NativeSelect value={fileType} onChange={(e) => setFileType(e.target.value as Enums<'doc_type'>)}>
                      {DOC_TYPES.map((d) => <option key={d} value={d}>{t(`docType.${d}`)}</option>)}
                    </NativeSelect>
                  </Field>
                </div>
                {!docId && !file && (
                  <label className="flex items-start gap-2 rounded bg-warning-100 p-2 text-caption text-warning-700">
                    <input type="checkbox" className="mt-0.5" checked={noDocOk} onChange={(e) => setNoDocOk(e.target.checked)} />
                    {t('statusDlg.bindWithoutDoc')}
                  </label>
                )}
              </div>
            </>
          )}

          <Field label={needsReason ? t('statusDlg.reason') : t('statusDlg.comment')} required={needsReason}>
            <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} autoFocus={!isOffer && !isBind} />
          </Field>

          {error && (
            <p className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-body text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button onClick={() => void submit()} disabled={busy} variant={target === 'declined' || target === 'ntu' ? 'destructive' : 'default'}>
            {busy && <Loader2 className="animate-spin" />}
            {t(`statusAction.${target}`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
