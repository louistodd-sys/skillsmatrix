/**
 * deleteEvidence — Phase 2 (Section 2.5)
 * Soft-delete (redact) an EvidenceFile. Hard delete is forbidden for BRC audit trail integrity.
 * Permitted by: admin, original uploader, or quality_manager role.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { evidence_file_id, reason } = await req.json();
  if (!evidence_file_id) return Response.json({ error: 'evidence_file_id is required' }, { status: 400 });

  const orgId = user.organisation_id;
  if (!orgId) return Response.json({ error: 'No organisation' }, { status: 400 });

  // Fetch the record
  const records = await base44.asServiceRole.entities.EvidenceFile.filter({ id: evidence_file_id });
  if (!records.length) return Response.json({ error: 'Evidence file not found' }, { status: 404 });
  const file = records[0];

  // Tenant isolation
  if (file.organisation_id !== orgId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Already redacted
  if (file.is_redacted) {
    return Response.json({ error: 'File is already redacted' }, { status: 409 });
  }

  // Permission check: admin, quality_manager, or original uploader
  const isAdmin          = user.role === 'admin';
  const isQualityManager = user.role === 'quality_manager';
  const isUploader       = file.uploaded_by_user_id === user.id;

  if (!isAdmin && !isQualityManager && !isUploader) {
    return Response.json({ error: 'Forbidden: insufficient permissions to redact evidence' }, { status: 403 });
  }

  // Soft delete
  await base44.asServiceRole.entities.EvidenceFile.update(evidence_file_id, {
    is_redacted:     true,
    redacted_reason: reason || 'Redacted by user',
  });

  // Audit log
  await base44.asServiceRole.entities.AuditLogEntry.create({
    organisation_id: orgId,
    actor_user_id:   user.id,
    actor_display:   user.full_name || user.email,
    action:          'evidence_redacted',
    target_type:     'evidence_file',
    target_id:       evidence_file_id,
    target_display:  file.file_name,
    detail: JSON.stringify({ reason: reason || 'Redacted by user' }),
  }).catch(() => {});

  return Response.json({ success: true });
});