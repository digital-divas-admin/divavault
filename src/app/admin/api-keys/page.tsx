"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Copy, Check, Key, Trash2, ScrollText } from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

const ALL_SCOPES = [
  { value: "contributors:read", label: "Read contributors" },
  { value: "consent:read", label: "Read consent" },
  { value: "photos:read", label: "Read photos" },
  { value: "usage:write", label: "Write usage events" },
  { value: "webhooks:manage", label: "Manage webhooks" },
];

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [plaintextKey, setPlaintextKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/admin/api-keys");
      if (res.ok && !cancelled) {
        const data = await res.json();
        setKeys(data.keys);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [reloadKey]);

  function reloadKeys() {
    setReloadKey((k) => k + 1);
  }

  async function handleCreate() {
    if (!newKeyName || newKeyScopes.length === 0) return;
    setCreating(true);

    const res = await fetch("/api/admin/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName, scopes: newKeyScopes }),
    });

    if (res.ok) {
      const data = await res.json();
      setPlaintextKey(data.plaintext_key);
      setNewKeyName("");
      setNewKeyScopes([]);
      reloadKeys();
    }
    setCreating(false);
  }

  async function toggleActive(id: string, currentActive: boolean) {
    await fetch(`/api/admin/api-keys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !currentActive }),
    });
    reloadKeys();
  }

  async function deleteKey(id: string) {
    if (!confirm("Delete this API key? This cannot be undone.")) return;
    await fetch(`/api/admin/api-keys/${id}`, { method: "DELETE" });
    reloadKeys();
  }

  function copyKey() {
    if (plaintextKey) {
      navigator.clipboard.writeText(plaintextKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">
            API Keys
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage platform API keys for external integrations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/api-keys/webhook-log">
            <Button variant="outline" size="sm">
              <ScrollText className="h-4 w-4 mr-2" />
              Webhook Log
            </Button>
          </Link>
          <Dialog
            open={createOpen}
            onOpenChange={(open) => {
              setCreateOpen(open);
              if (!open) {
                setPlaintextKey(null);
                setCopied(false);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {plaintextKey ? "API Key Created" : "Create API Key"}
                </DialogTitle>
              </DialogHeader>

              {plaintextKey ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <p className="text-sm text-amber-800 font-medium">
                      Copy this key now. You won&apos;t be able to see it again.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-3 rounded bg-muted text-xs break-all font-mono">
                      {plaintextKey}
                    </code>
                    <Button variant="outline" size="icon" onClick={copyKey}>
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => {
                      setCreateOpen(false);
                      setPlaintextKey(null);
                    }}
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="key-name">Name</Label>
                    <Input
                      id="key-name"
                      placeholder="e.g. castmi.ai production"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Scopes</Label>
                    <div className="space-y-2 mt-2">
                      {ALL_SCOPES.map((scope) => (
                        <div key={scope.value} className="flex items-center gap-2">
                          <Checkbox
                            id={scope.value}
                            checked={newKeyScopes.includes(scope.value)}
                            onCheckedChange={(checked) => {
                              setNewKeyScopes((prev) =>
                                checked
                                  ? [...prev, scope.value]
                                  : prev.filter((s) => s !== scope.value)
                              );
                            }}
                          />
                          <label
                            htmlFor={scope.value}
                            className="text-sm cursor-pointer"
                          >
                            {scope.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleCreate}
                    disabled={creating || !newKeyName || newKeyScopes.length === 0}
                  >
                    {creating ? "Creating..." : "Create API Key"}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : keys.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border/50 rounded-lg">
          <Key className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No API keys yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Create a key to enable external platform access
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between p-4 rounded-lg border border-border/30 bg-card"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{key.name}</p>
                  <Badge
                    variant={key.is_active ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {key.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  {key.key_prefix}...
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {key.scopes.map((s) => (
                    <Badge
                      key={s}
                      variant="outline"
                      className="text-[10px]"
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground/60">
                  Created {new Date(key.created_at).toLocaleDateString()}
                  {key.last_used_at &&
                    ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleActive(key.id, key.is_active)}
                >
                  {key.is_active ? "Disable" : "Enable"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => deleteKey(key.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
