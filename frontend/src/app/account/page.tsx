"use client";

import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/header";
import { AuthModal } from "@/components/auth-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Home, LogOut, Shield, Smartphone } from "lucide-react";
import { getCurrentUser, getSessions, logoutAllSessions, logoutSession, getAvatarUpload, type GetUserResponseDTO, type SessionInfo } from "@/api/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export default function AccountPage() {
  const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);
  const [user, setUser] = useState<GetUserResponseDTO | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [loggingOutAll, setLoggingOutAll] = useState<boolean>(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [me, sess] = await Promise.all([getCurrentUser(), getSessions()]);
        if (!active) return;
        setUser(me);
        setSessions(sess);
      } catch (err) {
        if (!active) return;
        setError((err as Error).message || "Failed to load account");
        setUser(null);
        setSessions(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleAvatarChange = (file: File | null) => {
    if (!file) {
      setAvatarFile(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    const MAX_MB = 5;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast({ title: "File too large", description: `Max size is ${MAX_MB}MB.`, variant: "destructive" });
      return;
    }
    setAvatarFile(file);
  };

  const uploadAvatar = async () => {
    if (!avatarFile) return;
    try {
      setUploading(true);
      const presign = await getAvatarUpload();


      const hasFormFields = presign && presign.fields && Object.keys(presign.fields).length > 0;
      let res: Response;
      if (hasFormFields) {
        const form = new FormData();
        Object.entries(presign.fields || {}).forEach(([k, v]) => form.append(k, v));
        if (avatarFile.type && !(presign.fields && Object.prototype.hasOwnProperty.call(presign.fields, "Content-Type"))) {
          form.append("Content-Type", avatarFile.type);
        }
        form.append("file", avatarFile);
        res = await fetch(presign.url, { method: "POST", body: form, cache: "no-store" });
      } else {
        res = await fetch(presign.url, {
          method: "PUT",
          headers: avatarFile.type ? { "Content-Type": avatarFile.type } : undefined,
          body: avatarFile,
          cache: "no-store",
        });
      }
      if (!res.ok) {
        let detail = "";
        try {
          detail = await res.text();
        } catch {
        }
        const hint = res.status === 403 ? " Presigned URL may be expired or signature/headers mismatch." : "";
        throw new Error(`Upload failed (${res.status}). ${detail || ""}${hint}`.trim());
      }
      toast({ title: "Avatar updated", description: "Your avatar was uploaded successfully." });
      try {
        const me = await getCurrentUser();
        setUser(me);
      } catch {
      }
      setAvatarFile(null);
    } catch (e) {
      toast({ title: "Upload error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const gradients = useMemo(
    () => [
      "bg-gradient-to-br from-red-500 to-orange-600",
      "bg-gradient-to-br from-blue-500 to-cyan-600",
      "bg-gradient-to-br from-purple-500 to-pink-600",
      "bg-gradient-to-br from-green-500 to-teal-600",
      "bg-gradient-to-br from-indigo-500 to-blue-600",
      "bg-gradient-to-br from-yellow-500 to-orange-600",
    ],
    [],
  );

  const avatarColor = user ? gradients[(user.username ?? "").length % gradients.length] : gradients[0];

  const handleLogoutAll = async () => {
    try {
      setLoggingOutAll(true);
      await logoutAllSessions();
      setSessions([]);
      setUser(null);
    } finally {
      setLoggingOutAll(false);
    }
  };

  const handleLogoutSession = async (jti: string) => {
    try {
      setRevoking(jti);
      await logoutSession(jti);
      setSessions((prev) => (prev || []).filter((s) => s.jti !== jti));
    } finally {
      setRevoking(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">Loading account...</div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Header onLogin={() => setAuthModal("login")} onRegister={() => setAuthModal("register")} />
        <main className="container mx-auto px-4 py-8">
          <div className="mx-auto max-w-2xl">
            <Card className="border-slate-800 bg-slate-900">
              <CardHeader>
                <CardTitle className="text-white">Sign in required</CardTitle>
                <CardDescription className="text-slate-400">
                  {error?.includes("401") ? "Please login to view your account." : "We couldn't load your account. Please login and try again."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-3">
                <Button variant="outline" className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800" onClick={() => setAuthModal("login")}>
                  Login
                </Button>
                <Button className="bg-red-600 text-white hover:bg-red-700" onClick={() => setAuthModal("register")}>
                  Register
                </Button>
                <Link href="/">
                  <Button variant="outline" className="ml-auto border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800">
                    <Home className="mr-2 h-4 w-4" />
                    Home
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>
        <AuthModal type={authModal} onClose={() => setAuthModal(null)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Header onLogin={() => setAuthModal("login")} onRegister={() => setAuthModal("register")} />

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Breadcrumb/back */}
          <div>
            <Link href="/">
              <Button variant="outline" size="sm" className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800">
                <Home className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>

          {/* Profile card */}
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="text-white">Account</CardTitle>
              <CardDescription className="text-slate-400">Your personal information and security settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className={`flex h-16 w-16 items-center justify-center rounded-full ${avatarColor}`}>
                  <Shield className="h-8 w-8 text-white opacity-80" />
                </div>
                <div>
                  <div className="font-semibold text-white">{user.username}</div>
                  <div className="text-slate-400 text-sm">{user.email}</div>
                  <div className="mt-1 text-slate-400 text-xs">Role: <span className="text-slate-300">{user.role}</span></div>
                </div>
              </div>

              {/* Avatar upload */}
              <div className="mt-6 grid gap-2">
                <Label htmlFor="avatar" className="text-slate-300">Upload avatar</Label>
                <Input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleAvatarChange(e.target.files?.[0] || null)}
                  className="pb-12"
                />
                <div className="flex items-center gap-2">
                  <Button
                    onClick={uploadAvatar}
                    disabled={!avatarFile || uploading}
                    className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {uploading ? "Uploading..." : "Upload"}
                  </Button>
                  {avatarFile ? (
                    <span className="text-xs text-slate-400">{avatarFile.name} • {(avatarFile.size / 1024).toFixed(0)} KB</span>
                  ) : (
                    <span className="text-xs text-slate-500">PNG, JPG up to 5MB</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sessions card */}
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-white">Active Sessions</CardTitle>
                <CardDescription className="text-slate-400">Manage devices that can access your account</CardDescription>
              </div>
              <Button onClick={handleLogoutAll} disabled={loggingOutAll} className="bg-red-600 text-white hover:bg-red-700">
                <LogOut className="mr-2 h-4 w-4" />
                {loggingOutAll ? "Logging out..." : "Log out all"}
              </Button>
            </CardHeader>
            <CardContent>
              {sessions && sessions.length > 0 ? (
                <div className="divide-y divide-slate-800">
                  {sessions.map((s) => (
                    <div key={s.jti} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-800">
                          <Smartphone className="h-4 w-4 text-slate-300" />
                        </div>
                        <div>
                          <div className="text-white text-sm">Device {s.device_id}</div>
                          <div className="text-slate-400 text-xs">
                            Issued {new Date(s.issued_at).toLocaleString()} • Last used {new Date(s.last_used).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
                        onClick={() => handleLogoutSession(s.jti)}
                        disabled={revoking === s.jti}
                      >
                        {revoking === s.jti ? "Revoking..." : "Revoke"}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-400 text-sm">No active sessions.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <AuthModal type={authModal} onClose={() => setAuthModal(null)} />
    </div>
  );
} 