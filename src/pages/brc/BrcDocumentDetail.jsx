import BrcModuleGuard from '@/components/BrcModuleGuard';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import useOrganisation from '@/lib/useOrganisation';
import { FileText, ExternalLink, Tag, Calendar, Hash, Pencil, Upload, History } from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb';
import { Button } from '@/components/ui/button';
import { DocumentFormModal, NewVersionModal } from '@/components/brc/DocumentFormModal';
import { formatDate } from '@/lib/format';

const STATUS_COLORS = {
  draft:        { bg: 'bg-gray-100',   text: 'text-gray-700'  },
  under_review: { bg: 'bg-amber-100',  text: 'text-amber-700' },
  approved:     { bg: 'bg-green-100',  text: 'text-green-700' },
  superseded:   { bg: 'bg-blue-100',   text: 'text-blue-700'  },
  retired:      { bg: 'bg-red-100',    text: 'text-red-700'   },
};
const DOC_TYPE_LABELS = {
  procedure: 'Procedure', policy: 'Policy', work_instruction: 'Work Instruction',
  form: 'Form', record_template: 'Record Template', external_standard: 'External Standard',
};

function BrcDocumentDetailContent() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const { org } = useOrganisation();
  const isNew = !documentId || documentId === 'new';
  const [doc, setDoc] = useState(null);
  const [linkedClauses, setLinkedClauses] = useState([]);
  const [versions, setVersions] = useState([]);
  const [versionFiles, setVersionFiles] = useState({});
  const [loading, setLoading] = useState(!isNew);
  const [showEdit, setShowEdit] = useState(false);
  const [showNewVersion, setShowNewVersion] = useState(false);

  const load = useCallback(async () => {
    if (!org || isNew) return;
    const [docs, links, versionRows] = await Promise.all([
      base44.entities.BRCDocument.filter({ id: documentId }),
      base44.entities.BRCClauseEvidenceLink.filter({ organisation_id: org.id, linked_entity_id: documentId }),
      base44.entities.BRCDocumentVersion.filter({ organisation_id: org.id, document_id: documentId }),
    ]);
    const d = docs[0];
    if (d) setDoc(d);

    const sortedVersions = versionRows.sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''));
    setVersions(sortedVersions);

    // Resolve the files behind versions so each row can link to its file
    if (sortedVersions.length > 0) {
      const files = await base44.entities.EvidenceFile.filter({
        organisation_id: org.id, linked_entity_type: 'document_version', linked_entity_id: documentId,
      });
      setVersionFiles(Object.fromEntries(files.map(f => [f.id, f])));
    }

    if (links.length > 0) {
      const clauseIds = [...new Set(links.map(l => l.clause_id))];
      const allClauses = await base44.entities.BRCClause.filter(
        { standard: org.brc_standard || 'brcgs_packaging' }, 'display_order', 200
      );
      setLinkedClauses(allClauses.filter(c => clauseIds.includes(c.id)));
    }
    setLoading(false);
  }, [org?.id, documentId, isNew]);

  useEffect(() => { load(); }, [load]);

  // Create mode: /brc/documents/new renders the create form directly.
  if (isNew) {
    if (!org) return <div className="h-64 bg-muted animate-pulse rounded-xl" />;
    return (
      <DocumentFormModal
        org={org}
        doc={null}
        onClose={() => navigate('/brc/documents')}
        onSaved={(saved) => navigate(saved?.id ? `/brc/documents/${saved.id}` : '/brc/documents')}
      />
    );
  }

  if (loading) return <div className="h-64 bg-muted animate-pulse rounded-xl" />;
  if (!doc) return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: 'Documents', href: '/brc/documents' }, { label: 'Not found' }]} />
      <p className="text-muted-foreground text-sm">Document not found.</p>
    </div>
  );

  const cfg = STATUS_COLORS[doc.status] || STATUS_COLORS.draft;
  const isOverdueReview = doc.next_review_date && new Date(doc.next_review_date) < new Date();

  return (
    <div className="space-y-6 max-w-2xl">
      <Breadcrumb items={[
        { label: 'Documents', href: '/brc/documents' },
        { label: doc.title },
      ]} />
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          {doc.title}
        </h1>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${cfg.bg} ${cfg.text}`}>
          {(doc.status || '').replace('_', ' ')}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowEdit(true)}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
          </Button>
          <Button size="sm" onClick={() => setShowNewVersion(true)}>
            <Upload className="w-3.5 h-3.5 mr-1.5" /> New Version
          </Button>
        </div>
      </div>

      {/* Document metadata */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Document Details</h2>

        {doc.description && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Description</p>
            <p className="text-sm text-foreground">{doc.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-start gap-2">
            <Hash className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Reference</p>
              <p className="text-sm font-mono font-medium text-foreground">{doc.doc_reference || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Tag className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Type</p>
              <p className="text-sm text-foreground">{DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <FileText className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Version</p>
              <p className="text-sm font-mono font-medium text-foreground">{doc.current_version_number}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Next Review</p>
              <p className={`text-sm font-medium ${isOverdueReview ? 'text-red-600' : 'text-foreground'}`}>
                {doc.next_review_date || '—'} {isOverdueReview && '(Overdue)'}
              </p>
            </div>
          </div>
        </div>

        {/* BRC Clause References */}
        {doc.brc_clause_refs && doc.brc_clause_refs.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">BRC Clause References</p>
            <div className="flex flex-wrap gap-1.5">
              {doc.brc_clause_refs.map(ref => (
                <span key={ref} className="text-xs font-mono font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {ref}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Version history */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border bg-muted/30">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <History className="w-4 h-4 text-muted-foreground" /> Version History
          </h2>
        </div>
        {versions.length === 0 ? (
          <p className="text-xs text-muted-foreground px-5 py-4">
            No controlled versions uploaded yet. Use “New Version” to attach the current document file — auditors expect each revision on record.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {versions.map(v => {
              const file = versionFiles[v.evidence_file_id];
              const isCurrent = !v.superseded_date;
              return (
                <div key={v.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`font-mono text-sm font-semibold ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`}>v{v.version_number}</span>
                  {isCurrent
                    ? <span className="text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Current</span>
                    : <span className="text-[10px] font-bold uppercase tracking-wide bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Superseded {v.superseded_date ? formatDate(v.superseded_date) : ''}</span>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{v.change_summary}</p>
                    {v.created_date && <p className="text-xs text-muted-foreground">{formatDate(v.created_date)}</p>}
                  </div>
                  {file && !file.is_redacted && (
                    <a href={file.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary font-medium flex items-center gap-1 shrink-0">
                      Open <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Linked Clauses (navigable) */}
      {linkedClauses.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border bg-muted/30">
            <h2 className="text-sm font-semibold text-foreground">Linked Clauses — Evidence</h2>
            <p className="text-xs text-muted-foreground mt-0.5">This document is linked as evidence for the following clauses</p>
          </div>
          <div className="divide-y divide-border">
            {linkedClauses.map(c => (
              <Link
                key={c.id}
                to={`/brc/clauses/${c.id}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors group"
              >
                <div>
                  <span className="font-mono text-sm font-semibold text-primary">{c.clause_number}</span>
                  {c.is_fundamental && <span className="ml-1.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-1 rounded">★ Fund.</span>}
                  <p className="text-sm text-foreground mt-0.5">{c.title}</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground ml-auto shrink-0 group-hover:text-primary transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {showEdit && (
        <DocumentFormModal
          org={org}
          doc={doc}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load(); }}
        />
      )}
      {showNewVersion && (
        <NewVersionModal
          org={org}
          doc={doc}
          versions={versions}
          onClose={() => setShowNewVersion(false)}
          onSaved={() => { setShowNewVersion(false); load(); }}
        />
      )}
    </div>
  );
}

export default function BrcDocumentDetail() {
  return <BrcModuleGuard><BrcDocumentDetailContent /></BrcModuleGuard>;
}