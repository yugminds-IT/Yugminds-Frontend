"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SlidersHorizontal,
  Megaphone,
  Wrench,
  Flag,
  Loader2,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { adminApi } from "@/lib/api/admin.api";

interface Announcement {
  enabled: boolean;
  text: string;
  level: "info" | "warning" | "critical";
}

interface Controls {
  maintenance_mode: boolean;
  maintenance_message: string;
  announcement: Announcement;
  feature_flags: Record<string, boolean>;
}

const EMPTY: Controls = {
  maintenance_mode: false,
  maintenance_message: "",
  announcement: { enabled: false, text: "", level: "info" },
  feature_flags: {},
};

export default function SystemControlsPage() {
  const [controls, setControls] = useState<Controls>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [newFlagName, setNewFlagName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.systemControls.get();
      setControls({ ...EMPTY, ...(data as Controls) });
    } catch {
      setMessage({ kind: "err", text: "Failed to load system controls." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const { data } = await adminApi.systemControls.update(controls as unknown as Record<string, unknown>);
      setControls({ ...EMPTY, ...(data as Controls) });
      setMessage({ kind: "ok", text: "System controls saved." });
    } catch {
      setMessage({ kind: "err", text: "Failed to save. Try again." });
    } finally {
      setSaving(false);
    }
  };

  const addFlag = () => {
    const name = newFlagName.trim().toLowerCase().replace(/\s+/g, "_");
    if (!name || !/^[\w.-]{1,64}$/.test(name)) return;
    setControls((c) => ({
      ...c,
      feature_flags: { ...c.feature_flags, [name]: false },
    }));
    setNewFlagName("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500" style={{ backgroundColor: "#f9fafb" }}>
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading system controls…
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8" style={{ minHeight: "100vh", backgroundColor: "#f9fafb" }}>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <SlidersHorizontal className="h-7 w-7 text-blue-600" />
            System Controls
          </h1>
          <p className="text-gray-600 mt-2">
            Platform-wide switches: maintenance mode, announcements, and feature flags.
          </p>
        </div>
        <Button onClick={save} disabled={saving} className="flex items-center gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
          Save changes
        </Button>
      </div>

      {message && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            message.kind === "ok"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.kind === "ok" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Maintenance mode */}
        <Card className={controls.maintenance_mode ? "border-red-300" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wrench className="h-5 w-5 text-red-500" />
              Maintenance Mode
              {controls.maintenance_mode && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Active</Badge>
              )}
            </CardTitle>
            <CardDescription>
              While active, students, teachers, and school admins cannot sign in. Admin
              sign-in and already-active sessions keep working.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="maintenance-toggle" className="font-medium">
                Block non-admin sign-ins
              </Label>
              <Switch
                id="maintenance-toggle"
                checked={controls.maintenance_mode}
                onCheckedChange={(v: boolean) =>
                  setControls((c) => ({ ...c, maintenance_mode: v }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maintenance-message">Message shown at sign-in</Label>
              <Textarea
                id="maintenance-message"
                value={controls.maintenance_message}
                maxLength={500}
                onChange={(e) =>
                  setControls((c) => ({ ...c, maintenance_message: e.target.value }))
                }
                placeholder="Yugminds is undergoing scheduled maintenance…"
              />
            </div>
          </CardContent>
        </Card>

        {/* Announcement */}
        <Card className={controls.announcement.enabled ? "border-blue-300" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Megaphone className="h-5 w-5 text-blue-500" />
              Announcement Banner
              {controls.announcement.enabled && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Live</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Shown as a banner to every signed-in user across all dashboards.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="announcement-toggle" className="font-medium">
                Show announcement
              </Label>
              <Switch
                id="announcement-toggle"
                checked={controls.announcement.enabled}
                onCheckedChange={(v: boolean) =>
                  setControls((c) => ({ ...c, announcement: { ...c.announcement, enabled: v } }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="announcement-text">Announcement text</Label>
              <Textarea
                id="announcement-text"
                value={controls.announcement.text}
                maxLength={500}
                onChange={(e) =>
                  setControls((c) => ({ ...c, announcement: { ...c.announcement, text: e.target.value } }))
                }
                placeholder="e.g. Report cards will be published on Friday."
              />
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select
                value={controls.announcement.level}
                onValueChange={(v) =>
                  setControls((c) => ({
                    ...c,
                    announcement: { ...c.announcement, level: v as Announcement["level"] },
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info (blue)</SelectItem>
                  <SelectItem value="warning">Warning (amber)</SelectItem>
                  <SelectItem value="critical">Critical (red)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Feature flags */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Flag className="h-5 w-5 text-purple-500" />
              Feature Flags
            </CardTitle>
            <CardDescription>
              Free-form on/off switches your code can read from GET /system-status or
              /admin/system-controls to gate features without a deploy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newFlagName}
                onChange={(e) => setNewFlagName(e.target.value)}
                placeholder="new_flag_name"
                className="max-w-xs"
                onKeyDown={(e) => e.key === "Enter" && addFlag()}
              />
              <Button variant="outline" onClick={addFlag} disabled={!newFlagName.trim()}>
                <Plus className="h-4 w-4 mr-1" /> Add flag
              </Button>
            </div>
            {Object.keys(controls.feature_flags).length === 0 ? (
              <p className="text-sm text-gray-500">No feature flags defined yet.</p>
            ) : (
              <div className="divide-y rounded-lg border">
                {Object.entries(controls.feature_flags).map(([name, on]) => (
                  <div key={name} className="flex items-center justify-between px-4 py-2.5">
                    <code className="text-sm text-gray-800">{name}</code>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={on}
                        onCheckedChange={(v: boolean) =>
                          setControls((c) => ({
                            ...c,
                            feature_flags: { ...c.feature_flags, [name]: v },
                          }))
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={() =>
                          setControls((c) => {
                            const next = { ...c.feature_flags };
                            delete next[name];
                            return { ...c, feature_flags: next };
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
