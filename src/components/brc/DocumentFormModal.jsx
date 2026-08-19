import { useState, useRef } from 'react';
import { X, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import useOrganisation from '@/lib/useOrganisation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const DOC_TYPES = [
  ['procedure', 'Procedure'],
  ['policy', 'Policy'],
  ['work_instruction', 'Work Instruction'],
  ['form', 'Form'],
  ['record_template', 'Record Template'],
  ['external_standard', 'External Standard'],
];
const STATUSES = ['draft', 'under_review', 'approved', 'retired'];

/** Create or edit a BRCDocument register entry. */
export function DocumentFormModal({ org, doc, onClose, onSaved }) {
  const { user } = useOrganisation();
  const [form, setForm] = useState(doc ? { ...doc } : {
    title: '', doc_type: 'procedure', doc_reference: '', description: '',
    status: 'draft', current_version_number: '1.0',
    next_review_date: '', review_interval_months: 12,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };

  const handleSave = async () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      let saved;
      if (doc?.id) {
        const { id: _id, ...payload } = form;
        saved = await base44.entities.BRCDocument.update(doc.id, { ...payload, organisation_id: org.id });
      } else {
        saved = await base44.entities.BRCDocument.create({
          ...form,
          organisation_id: org.id,
          owner_user_id: user?.id,
          approver_user_id: user?.id,
          review_interval_months: Number(form.review_interval_months) || 12,
        });
      }
      toast.success(doc ? 'Document updated' : 'Document created');
      onSaved(saved);
    } catch {
      toast.error('Failed to save document');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-card-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold font-jakarta">{doc ? 'Edit Document' : 'New Document'}</h2>
          <button onClick={onClose} aria-label="Close"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title *</label>
            <Input className={`mt-1 ${errors.title ? 'border-destructive' : ''}`} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Glass & Brittle Plastic Procedure" />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</label>
              <select className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.doc_type} onChange={e => set('doc_type', e.target.value)}>
                {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reference</label>
              <Input className="mt-1" value={form.doc_reference || ''} onChange={e => set('doc_reference', e.target.value)} placeholder="e.g. QMS-PRO-004" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</label>
              <select className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            {!doc && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Version</label>
                <Input className="mt-1 font-mono" value={form.current_version_number} onChange={e => set('current_version_number', e.target.value)} placeholder="1.0" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Next Review Date</label>
              <Input type="date" className="mt-1" value={form.next_review_date || ''} onChange={e => set('next_review_date', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Review Interval (months)</label>
              <Input type="number" min="1" max="60" className="mt-1" value={form.review_interval_months ?? 12} onChange={e => set('review_interval_months', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
            <textarea className="mt-1 w-full h-16 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" value={form.description || ''} onChange={e => set('description', e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Saving…</> : 'Save Document'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function suggestNextVersion(current) {
  const m = String(current || '0.1').match(/^(\d+)\.(\d+)$/);
  if (!m) return '';
  return `${Number(m[1]) + 1}.0`;
}

/**
 * Upload a new controlled version of a document: the file becomes an
 * EvidenceFile, a BRCDocumentVersion records it, the previous version is
 * marked superseded and the document's current version number is bumped.
 */
export function NewVersionModal({ org, doc, versions, onClose, onSaved }) {
  const { user } = useOrganisation();
  const [versionNumber, setVersionNumber] = useState(suggestNextVersion(doc.current_version_number));
  const [changeSummary, setChangeSummary] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const handleSave = async () => {
    if (!versionNumber.trim()) { toast.error('Version number is required'); return; }
    if (!changeSummary.trim()) { toast.error('Change summary is required'); return; }
    if (!file) { toast.error('Attach the new version of the document file'); return; }
    setSaving(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const uploadRes = await base44.functions.invoke('uploadEvidence', {
        file_url,
        file_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        linked_entity_type: 'document_version',
        linked_entity_id: doc.id,
        description: `Version ${versionNumber.trim()} of ${doc.title}`,
      });
      if (uploadRes.data?.error) throw new Error(uploadRes.data.error);

      const now = new Date().toISOString();
      await base44.entities.BRCDocumentVersion.create({
        organisation_id: org.id,
        document_id: doc.id,
        version_number: versionNumber.trim(),
        evidence_file_id: uploadRes.data.id,
        change_summary: changeSummary.trim(),
        created_by_user_id: user?.id,
      });

      // Supersede the previous latest version
      const latest = (versions || [])
        .filter(v => !v.superseded_date)
        .sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''))[0];
      if (latest) {
        await base44.entities.BRCDocumentVersion.update(latest.id, { superseded_date: now });
      }

      await base44.entities.BRCDocument.update(doc.id, {
        current_version_number: versionNumber.trim(),
      });

      await base44.entities.AuditLogEntry.create({
        organisation_id: org.id,
        actor_user_id: user?.id,
        actor_display: user?.full_name || user?.email,
        action: 'brc_document.version_uploaded',
        target_type: 'brc_document',
        target_id: doc.id,
        target_display: doc.title,
        detail: JSON.stringify({ version_number: versionNumber.trim(), change_summary: changeSummary.trim() }),
      }).catch(() => {});

      toast.success(`Version ${versionNumber.trim()} uploaded`);
      onSaved();
    } catch (err) {
      toast.error(err?.message || 'Failed to upload new version');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-card-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold font-jakarta">Upload New Version</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{doc.title} — currently v{doc.current_version_number}</p>
          </div>
          <button onClick={onClose} aria-label="Close"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Version Number *</label>
            <Input className="mt-1 font-mono" value={versionNumber} onChange={e => setVersionNumber(e.target.value)} placeholder="2.0" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Change Summary *</label>
            <textarea className="mt-1 w-full h-16 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" value={changeSummary} onChange={e => setChangeSummary(e.target.value)} placeholder="What changed and why" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Document File *</label>
            <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.csv,.txt" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            <Button type="button" variant="outline" size="sm" className="mt-1 w-full justify-start" onClick={() => inputRef.current?.click()}>
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              {file ? file.name : 'Choose file…'}
            </Button>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Uploading…</> : 'Upload Version'}
          </Button>
        </div>
      </div>
    </div>
  );
}
