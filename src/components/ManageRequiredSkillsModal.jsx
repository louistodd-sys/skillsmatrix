import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import useModal from '@/hooks/useModal';

// Requirement levels an admin can demand for a levelled skill (0 "Not Trained"
// makes no sense as a requirement).
const LEVEL_OPTIONS = [
  { value: 1, label: '1 — Awareness' },
  { value: 2, label: '2 — Working Knowledge' },
  { value: 3, label: '3 — Competent' },
  { value: 4, label: '4 — Expert' },
];

export default function ManageRequiredSkillsModal({ teamId, orgId, existingReqSkills, onClose, onSaved }) {
  const dialogRef = useModal(onClose);
  const [skills, setSkills] = useState([]);
  const [categories, setCategories] = useState([]);
  // skill_id → minimum_proficiency for every required skill
  const [selected, setSelected] = useState(() => new Map(
    existingReqSkills.filter(r => r.is_required).map(r => [r.skill_id, Number(r.minimum_proficiency ?? 1)])
  ));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.Skill.filter({ organisation_id: orgId, status: 'active' }),
      base44.entities.SkillCategory.filter({ organisation_id: orgId }),
    ]).then(([s, c]) => {
      setSkills(s);
      setCategories(c);
    });
  }, [orgId]);

  const toggle = (skillId) => {
    const next = new Map(selected);
    if (next.has(skillId)) next.delete(skillId);
    else next.set(skillId, 1);
    setSelected(next);
  };

  const setLevel = (skillId, level) => {
    const next = new Map(selected);
    next.set(skillId, Number(level));
    setSelected(next);
  };

  const handleSave = async () => {
    setSaving(true);
    // Diff against the existing requirements instead of delete-and-recreate,
    // so a failure mid-save can't wipe the team's whole requirement set.
    const existingBySkill = new Map(existingReqSkills.map(r => [r.skill_id, r]));

    const toDelete = existingReqSkills.filter(r => !selected.has(r.skill_id));
    const toCreate = [];
    const toUpdate = [];
    for (const [skillId, level] of selected) {
      const existing = existingBySkill.get(skillId);
      if (!existing) {
        toCreate.push({
          organisation_id: orgId,
          team_id: teamId,
          skill_id: skillId,
          is_required: true,
          minimum_proficiency: level,
        });
      } else if (Number(existing.minimum_proficiency ?? 1) !== level || !existing.is_required) {
        toUpdate.push({ id: existing.id, minimum_proficiency: level, is_required: true });
      }
    }

    if (toCreate.length > 0) await base44.entities.TeamRequiredSkill.bulkCreate(toCreate);
    await Promise.all(toUpdate.map(u => base44.entities.TeamRequiredSkill.update(u.id, { minimum_proficiency: u.minimum_proficiency, is_required: u.is_required })));
    await Promise.all(toDelete.map(r => base44.entities.TeamRequiredSkill.delete(r.id)));

    setSaving(false);
    onSaved();
    onClose();
  };

  const grouped = categories.map(cat => ({
    ...cat,
    skills: skills.filter(s => s.category_id === cat.id),
  })).filter(g => g.skills.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1} className="bg-card rounded-xl border border-border shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold">Required Skills for Team</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 -m-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-sm text-muted-foreground">Select which skills are required for this team. For levelled skills, choose the minimum level members must reach — anyone below it shows as a gap in the matrix and gap analysis.</p>
          {grouped.map(cat => (
            <div key={cat.id}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.colour || '#6B7280' }} />
                <span className="text-sm font-semibold text-foreground">{cat.name}</span>
              </div>
              <div className="space-y-1 ml-4">
                {cat.skills.map(skill => (
                  <div key={skill.id} className="flex items-center gap-3 py-1.5">
                    <label className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0" onClick={() => toggle(skill.id)}>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${selected.has(skill.id) ? 'bg-primary border-primary' : 'border-border group-hover:border-muted-foreground'}`}>
                        {selected.has(skill.id) && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <span className="text-sm text-foreground truncate">{skill.name}</span>
                    </label>
                    {selected.has(skill.id) && skill.scale_type === 'levelled' && (
                      <select
                        value={selected.get(skill.id)}
                        onChange={e => setLevel(skill.id, e.target.value)}
                        onClick={e => e.stopPropagation()}
                        aria-label={`Minimum level for ${skill.name}`}
                        className="text-xs rounded-md border border-input bg-background px-2 py-1 shrink-0"
                      >
                        {LEVEL_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center px-5 py-4 border-t border-border shrink-0">
          <span className="text-xs text-muted-foreground">{selected.size} skills selected</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}