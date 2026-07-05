"use client";

import { useState } from "react";
import { useAdminSchools } from "@/hooks/useAdminSchools";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Key, School } from "lucide-react";
import JoiningCodesDialog from "@/components/JoiningCodesDialog";

export default function JoiningCodesPage() {
  const { schools, isLoading: schoolsLoading } = useAdminSchools();
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const selectedSchool = (schools ?? []).find((s) => s.id === selectedSchoolId);

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Key className="h-6 w-6" />
          Joining Codes
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Generate and manage student joining codes per school and grade.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <School className="h-5 w-5" />
            Select School
          </CardTitle>
          <CardDescription>
            Choose a school to view or manage its joining codes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Select
                value={selectedSchoolId}
                onValueChange={setSelectedSchoolId}
                disabled={schoolsLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={schoolsLoading ? "Loading schools…" : "Select a school"}
                  />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {(schools ?? []).map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              disabled={!selectedSchoolId}
              onClick={() => setDialogOpen(true)}
              className="shrink-0"
            >
              <Key className="h-4 w-4 mr-2" />
              Manage Codes
            </Button>
          </div>

          {!selectedSchoolId && !schoolsLoading && (
            <p className="text-sm text-gray-400 text-center py-6">
              Select a school above to view and manage its joining codes.
            </p>
          )}
        </CardContent>
      </Card>

      {selectedSchool && (
        <JoiningCodesDialog
          isOpen={dialogOpen}
          onClose={() => setDialogOpen(false)}
          schoolId={selectedSchool.id}
          schoolName={selectedSchool.name}
        />
      )}
    </div>
  );
}
