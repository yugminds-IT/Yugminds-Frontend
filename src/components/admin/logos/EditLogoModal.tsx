import Image from "next/image";
import { Loader2, TriangleAlert } from "lucide-react";
import Modal from "../../portal/Modal";

export interface LogoItem {
  id: string;
  school_id?: string | null;
  school_name: string;
  description?: string | null;
  image_url: string;
  upload_date?: string;
}

export interface SchoolOption {
  id: string;
  name: string;
}

/** Change which school a logo belongs to, or its description. The image itself is replaced from the card menu. */
export default function EditLogoModal({
  logo,
  schools,
  withLogo,
  schoolId,
  description,
  onSchool,
  onDescription,
  saving,
  onSave,
  onClose,
}: {
  logo: LogoItem | null;
  schools: SchoolOption[];
  withLogo: Set<string>;
  schoolId: string;
  description: string;
  onSchool: (id: string) => void;
  onDescription: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const clash = !!logo && !!schoolId && schoolId !== logo.school_id && withLogo.has(schoolId);
  return (
    <Modal
      open={!!logo}
      onClose={() => { if (!saving) onClose(); }}
      title="Edit logo"
      subtitle={logo?.school_name}
      footer={
        <>
          <button className="sd-btn sd-btn--line" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="sd-btn sd-btn--amber" onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
            Save changes
          </button>
        </>
      }
    >
      {logo && (
        <>
          <div className="lg-tile lg-tile--wide">
            <Image src={logo.image_url} alt={`${logo.school_name} logo`} fill sizes="480px" className="lg-img" unoptimized />
          </div>
          <div className="sd-field-wrap">
            <label htmlFor="lg-edit-school">School</label>
            <select id="lg-edit-school" className="sd-field" value={schoolId} onChange={(e) => onSchool(e.target.value)}>
              {!logo.school_id && <option value="">Not linked to a school</option>}
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{withLogo.has(s.id) && s.id !== logo.school_id ? " (already has a logo)" : ""}</option>
              ))}
            </select>
            {clash && <p className="lg-warn"><TriangleAlert aria-hidden="true" />That school already has its own logo. Moving this one will not replace it.</p>}
          </div>
          <div className="sd-field-wrap">
            <label htmlFor="lg-edit-desc">Description</label>
            <input id="lg-edit-desc" className="sd-field" value={description} onChange={(e) => onDescription(e.target.value)} placeholder="e.g. Official school logo" />
          </div>
        </>
      )}
    </Modal>
  );
}
