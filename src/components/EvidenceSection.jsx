import { useState, useEffect, useCallback, useRef } from 'react';
import { Paperclip, Loader2, Trash2, ExternalLink, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import useOrganisation from '@/lib/useOrganisation';
import { formatDate } from '@/lib/format';

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.csv,.txt';

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Attach evidence files (certificates, photos, reports) to any record.
 * Uploads go through the uploadEvidence backend function, which validates
 * file type/size and enforces the organisation's storage quota; deletion is
 * a soft redaction that preserves the audit trail.
 *
 * Usage: <EvidenceSection linkedEntityType="skill_assessment" linkedEntityId={assessment.id} />
 * Render only for records that already exist (a saved id is required).
 */
export default function EvidenceSection({ linkedEntityType, linkedEntityId, compact = false }) {
  const { org, user } = useOrganisation();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    if (!org?.id || !linkedEntityId) return;
    try {
      const rows = await base44.entities.EvidenceFile.filter({
        organisation_id: org.id,
        linked_entity_type: linkedEntityType,
        linked_entity_id: linkedEntityId,
      });
      setFiles(rows.filter(f => !f.is_redacted));
    } catch {
      // Listing failure is non-fatal — the section just shows empty.
    }
    setLoading(false);
  }, [org?.id, linkedEntityType, linkedEntityId]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error('Files must be under 25 MB.');
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke('uploadEvidence', {
        file_url,
        file_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        linked_entity_type: linkedEntityType,
        linked_entity_id: linkedEntityId,
      });
      if (res.data?.error) throw new Error(res.data.error);
      toast.success('Evidence attached');
      await load();
    } catch (err) {
      toast.error(err?.message || 'Upload failed — please try again.');
    }
    setUploading(false);
  };

  const handleRemove = async (file) => {
    setRemovingId(file.id);
    try {
      const res = await base44.functions.invoke('deleteEvidence', {
        evidence_file_id: file.id,
        reason: 'Removed by user',
      });
      if (res.data?.error) throw new Error(res.data.error);
      await load();
      toast.success('Evidence removed');
    } catch (err) {
      toast.error(err?.message || 'Could not remove evidence.');
    }
    setRemovingId(null);
  };

  if (!linkedEntityId) return null;

  return (
    <div className={compact ? 'space-y-2' : 'space-y-2 pt-3 border-t border-border'}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
          Evidence {files.length > 0 && <span className="text-muted-foreground font-normal">({files.length})</span>}
        </p>
        <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={handleUpload} />
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading
            ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Uploading…</>
            : <><Upload className="w-3 h-3 mr-1" /> Attach file</>}
        </Button>
      </div>

      {loading ? (
        <div className="h-6 bg-muted animate-pulse rounded" />
      ) : files.length === 0 ? (
        <p className="text-xs text-muted-foreground">No files attached. Certificates, photos and reports up to 25 MB (PDF, images, Office, CSV).</p>
      ) : (
        <ul className="space-y-1">
          {files.map(f => (
            <li key={f.id} className="flex items-center gap-2 text-xs bg-muted/40 rounded-md px-2.5 py-1.5">
              <a href={f.file_url} target="_blank" rel="noreferrer" className="flex-1 min-w-0 flex items-center gap-1.5 text-foreground hover:text-primary">
                <span className="truncate font-medium">{f.file_name}</span>
                <ExternalLink className="w-3 h-3 shrink-0 text-muted-foreground" />
              </a>
              <span className="text-muted-foreground shrink-0">{formatSize(f.size_bytes)}</span>
              {f.created_date && <span className="text-muted-foreground shrink-0 hidden sm:inline">{formatDate(f.created_date)}</span>}
              {(user?.role === 'admin' || f.uploaded_by_user_id === user?.id) && (
                <button
                  type="button"
                  aria-label={`Remove ${f.file_name}`}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  disabled={removingId === f.id}
                  onClick={() => handleRemove(f)}
                >
                  {removingId === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
