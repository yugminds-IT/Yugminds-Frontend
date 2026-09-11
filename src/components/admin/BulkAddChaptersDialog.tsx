"use client";

import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { BULK_CHAPTER_MAX, parseChapterNames } from "./bulkChapters";

interface BulkAddChaptersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with parsed names when the user confirms. */
  onAdd: (names: string[]) => void;
}

export function BulkAddChaptersDialog({
  open,
  onOpenChange,
  onAdd,
}: BulkAddChaptersDialogProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const names = useMemo(() => parseChapterNames(text), [text]);
  const count = names.length;
  const overMax = count > BULK_CHAPTER_MAX;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setText("");
      setError(null);
    }
    onOpenChange(next);
  };

  const handleSubmit = () => {
    if (count === 0) {
      setError("Enter at least one chapter name.");
      return;
    }
    if (overMax) {
      setError(`You can add at most ${BULK_CHAPTER_MAX} chapters at a time.`);
      return;
    }
    onAdd(names);
    setText("");
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add multiple chapters</DialogTitle>
          <DialogDescription>
            Paste or type one chapter name per line. Empty lines are ignored.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="bulk-chapter-names">Chapter names</Label>
          <Textarea
            id="bulk-chapter-names"
            rows={10}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            placeholder={"Introduction\nGetting Started\nFinal Project"}
            className="font-mono text-sm"
          />
          <p className="text-xs text-gray-500">
            {count === 0
              ? "No chapters yet."
              : overMax
                ? `${count} names — max is ${BULK_CHAPTER_MAX}.`
                : `${count} chapter${count === 1 ? "" : "s"} will be added.`}
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={count === 0 || overMax}>
            {count > 0 ? `Add ${count} chapter${count === 1 ? "" : "s"}` : "Add chapters"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
