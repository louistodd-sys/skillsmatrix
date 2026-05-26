/**
 * uploadEvidence — Phase 2 (Section 2.4)
 * Validates mime type, file size, per-org quota, creates EvidenceFile record.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
]);

const ALLOWED_EXTENSIONS = new Set(['pdf','png','jpg','jpeg','webp','docx','xlsx','csv','txt']);

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

// Quota limits in bytes per tier
const QUOTA_BYTES = {
  free:    100  * 1024 * 1024,
  starter: 2    * 1024 * 1024 * 1024,
  growth:  10   * 1024 * 1024 * 1024,
  scale:   50   * 1024 * 1024 * 1024,
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = user.organisation_id;
  if (!orgId) return Response.json({ error: 'No organisation' }, { status: 400 });

  const body = await req.json();
  const { file_url, file_name, mime_type, size_bytes, linked_entity_type, linked_entity_id, description, tags } = body;

  if (!file_url || !file_name || !mime_type || !size_bytes) {
    return Response.json({ error: 'Missing required fields: file_url, file_name, mime_type, size_bytes' }, { status: 400 });
  }

  // Validate mime type
  if (!ALLOWED_MIME_TYPES.has(mime_type)) {
    return Response.json({ error: `File type not allowed. Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}` }, { status: 422 });
  }

  // Validate extension
  const ext = (file_name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return Response.json({ error: `File extension .${ext} not allowed.` }, { status: 422 });
  }

  // Validate size
  if (size_bytes > MAX_FILE_BYTES) {
    return Response.json({ error: 'File exceeds 25 MB limit.' }, { status: 422 });
  }

  // Quota check
  const orgs = await base44.asServiceRole.entities.Organisation.filter({ id: orgId });
  if (!orgs.length) return Response.json({ error: 'Organisation not found' }, { status: 404 });
  const org = orgs[0];
  const tier = org.subscription_tier || 'free';
  const quotaBytes = QUOTA_BYTES[tier] ?? QUOTA_BYTES.free;

  const existingFiles = await base44.asServiceRole.entities.EvidenceFile.filter({
    organisation_id: orgId,
    is_redacted: false,
  });
  const usedBytes = existingFiles.reduce((sum, f) => sum + (f.size_bytes || 0), 0);

  if (usedBytes + size_bytes > quotaBytes) {
    const usedMB = (usedBytes / (1024 * 1024)).toFixed(1);
    const quotaMB = (quotaBytes / (1024 * 1024)).toFixed(0);
    return Response.json({
      error: `Storage quota exceeded. Used: ${usedMB} MB of ${quotaMB} MB. Upgrade your plan for more storage.`,
      code: 'quota_exceeded',
    }, { status: 422 });
  }

  // Create EvidenceFile record
  const record = await base44.asServiceRole.entities.EvidenceFile.create({
    organisation_id:      orgId,
    uploaded_by_user_id:  user.id,
    uploaded_by_name:     user.full_name || user.email,
    file_url,
    file_name,
    mime_type,
    size_bytes,
    linked_entity_type:   linked_entity_type || null,
    linked_entity_id:     linked_entity_id   || null,
    description:          description        || null,
    tags:                 Array.isArray(tags) ? tags : [],
    is_redacted:          false,
  });

  // Audit log
  await base44.asServiceRole.entities.AuditLogEntry.create({
    organisation_id: orgId,
    actor_user_id:   user.id,
    actor_display:   user.full_name || user.email,
    action:          'evidence_uploaded',
    target_type:     'evidence_file',
    target_id:       record.id,
    target_display:  file_name,
    detail: JSON.stringify({ linked_entity_type, linked_entity_id, size_bytes }),
  }).catch(() => {});

  return Response.json({ id: record.id, file_url: record.file_url });
});