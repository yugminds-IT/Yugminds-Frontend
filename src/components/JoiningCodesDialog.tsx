"use client";

import { useCallback, useState } from "react";
import Modal from "./portal/Modal";
import CodesPanel from "./admin/joining-codes/CodesPanel";
import { useCodes } from "./admin/joining-codes/useCodes";
import type { CodeState } from "./admin/joining-codes/utils";
import "./school-admin/students.css"; // sm- chips and forms
import "./admin/joining-codes/codes.css";

interface JoiningCodesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  schoolName: string;
}

/** The school's joining codes in a dialog, opened from the Schools pages. The full page is /lms/admin/joining-codes. */
export default function JoiningCodesDialog({ isOpen, onClose, schoolId, schoolName }: JoiningCodesDialogProps) {
  const { codes, loading, error, refetch, changed } = useCodes(schoolId, isOpen);
  const [filter, setFilter] = useState<CodeState | null>(null);
  const [nested, setNested] = useState(false);
  const [now] = useState(() => Date.now());
  const onNested = useCallback((open: boolean) => setNested(open), []);

  return (
    <Modal
      open={isOpen}
      onClose={() => { if (!nested) onClose(); }}
      wide
      title="Joining codes"
      subtitle={`${schoolName}. Students and teachers type a code when they sign up to land in the right class.`}
      footer={<button className="sd-btn sd-btn--line" onClick={onClose}>Close</button>}
    >
      <div className="jc-dialog">
        <CodesPanel
          schoolId={schoolId}
          schoolName={schoolName}
          codes={codes}
          loading={loading}
          error={error}
          onRetry={() => void refetch()}
          onChanged={changed}
          filter={filter}
          onFilter={setFilter}
          showChips
          now={now}
          onNested={onNested}
        />
      </div>
    </Modal>
  );
}
