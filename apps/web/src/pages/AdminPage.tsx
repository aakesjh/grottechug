import { useCallback, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import Cropper from "react-easy-crop";
import { useAuthSession } from "../auth/useAuthSession";
import { apiFetch } from "../lib/api";

type CropArea = { x: number; y: number; width: number; height: number };

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (e) => reject(e));
    img.src = url;
  });
}

async function getCroppedImg(src: string, crop: CropArea): Promise<Blob> {
  const image = await createImage(src);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  canvas.width = crop.width;
  canvas.height = crop.height;
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))),
      "image/jpeg",
      0.92
    );
  });
}

type Submission = {
  id: string;
  name: string;
  nameLower: string;
  imageUrl: string;
  status: string;
  adminNote: string | null;
  editedName: string | null;
  createdAt: string;
  reviewedAt: string | null;
  approvedParticipantId: string | null;
};

type Participant = {
  id: string;
  name: string;
  isRegular: boolean;
  imageUrl: string | null;
  attempts: number;
};

type Tab = "pending" | "participants" | "history";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ── Pending submissions tab ───────────────────────────── */

function PendingTab() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editNames, setEditNames] = useState<Record<string, string>>({});
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/participant-submissions?status=pending");
      if (!res.ok) throw new Error("Kunne ikke hente innmeldinger");
      setSubmissions(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approve(sub: Submission) {
    setBusy((b) => ({ ...b, [sub.id]: true }));
    setError("");
    try {
      const editedName = editNames[sub.id]?.trim() || "";
      const res = await apiFetch(`/api/participant-submissions/${sub.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editedName: editedName || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Kunne ikke godkjenne");
      setSubmissions((s) => s.filter((x) => x.id !== sub.id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy((b) => ({ ...b, [sub.id]: false }));
    }
  }

  async function reject(sub: Submission) {
    setBusy((b) => ({ ...b, [sub.id]: true }));
    setError("");
    try {
      const adminNote = rejectNotes[sub.id]?.trim() || "";
      const res = await apiFetch(`/api/participant-submissions/${sub.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNote: adminNote || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Kunne ikke avvise");
      setSubmissions((s) => s.filter((x) => x.id !== sub.id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy((b) => ({ ...b, [sub.id]: false }));
    }
  }

  if (loading) return <p>Laster innmeldinger…</p>;

  return (
    <div className="admin__grid">
      {error && <div className="admin__error">{error}</div>}

      {submissions.length === 0 && (
        <p className="u-text-muted">Ingen ventende innmeldinger.</p>
      )}

      {submissions.map((sub) => (
        <div key={sub.id} className="card admin__submission-card">
          <div className="admin__card-layout">
            <img src={sub.imageUrl} alt={sub.name} className="admin__card-img" />
            <div className="admin__card-body">
              <div>
                <h2 className="u-mb-0">{sub.name}</h2>
                <span className="admin__card-date">
                  Sendt inn {formatDate(sub.createdAt)}
                </span>
              </div>

              <div>
                <label className="admin__field-label">Endre navn (valgfritt)</label>
                <input
                  className="input"
                  placeholder={sub.name}
                  value={editNames[sub.id] ?? ""}
                  onChange={(e) =>
                    setEditNames((n) => ({ ...n, [sub.id]: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="admin__field-label">Avvisningsgrunn (valgfritt)</label>
                <textarea
                  className="admin__textarea"
                  rows={2}
                  placeholder="Grunn til avvisning…"
                  value={rejectNotes[sub.id] ?? ""}
                  onChange={(e) =>
                    setRejectNotes((n) => ({ ...n, [sub.id]: e.target.value }))
                  }
                />
              </div>

              <div className="admin__actions">
                <button
                  className="btn btnPrimary"
                  disabled={busy[sub.id]}
                  onClick={() => approve(sub)}
                >
                  Godkjenn
                </button>
                <button
                  className="btn admin__reject-btn"
                  disabled={busy[sub.id]}
                  onClick={() => reject(sub)}
                >
                  Avvis
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Participants management tab ───────────────────────── */

function ParticipantsTab() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // Crop modal state
  const [cropTarget, setCropTarget] = useState<Participant | null>(null);
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function openCropModal(p: Participant, file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Filen må være et bilde.");
      return;
    }
    setCropTarget(p);
    setRawImageUrl(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCroppedPreview(null);
  }

  function closeCropModal() {
    if (rawImageUrl) URL.revokeObjectURL(rawImageUrl);
    if (croppedPreview) URL.revokeObjectURL(croppedPreview);
    setCropTarget(null);
    setRawImageUrl(null);
    setCroppedPreview(null);
    setCroppedAreaPixels(null);
  }

  const onCropComplete = useCallback(
    (_: CropArea, pixels: CropArea) => setCroppedAreaPixels(pixels),
    []
  );

  async function finalizeCrop() {
    if (!rawImageUrl || !croppedAreaPixels) return;
    try {
      const blob = await getCroppedImg(rawImageUrl, croppedAreaPixels);
      if (croppedPreview) URL.revokeObjectURL(croppedPreview);
      setCroppedPreview(URL.createObjectURL(blob));
    } catch {
      setError("Kunne ikke croppe bildet.");
    }
  }

  async function confirmUpload() {
    if (!cropTarget || !croppedPreview || !croppedAreaPixels || !rawImageUrl) return;
    setUploading(true);
    setError("");
    try {
      const blob = await getCroppedImg(rawImageUrl, croppedAreaPixels);
      const file = new File([blob], "image.jpg", { type: "image/jpeg" });
      const form = new FormData();
      form.append("image", file);
      const res = await apiFetch(`/api/participants/${cropTarget.id}/image`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Kunne ikke oppdatere bilde");
      setParticipants((list) =>
        list.map((x) => (x.id === cropTarget.id ? { ...x, imageUrl: data.imageUrl } : x))
      );
      closeCropModal();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/participants?includeGuests=true");
      if (!res.ok) throw new Error("Kunne ikke hente deltakere");
      setParticipants(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function hardDelete(id: string) {
    setBusy((b) => ({ ...b, [id]: true }));
    setError("");
    try {
      const res = await apiFetch(`/api/participants/${id}/hard`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Kunne ikke slette");
      }
      setParticipants((p) => p.filter((x) => x.id !== id));
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  async function saveRename(id: string) {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setBusy((b) => ({ ...b, [id]: true }));
    setError("");
    try {
      const res = await apiFetch(`/api/participants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Kunne ikke endre navn");
      setParticipants((list) =>
        list.map((x) => (x.id === id ? { ...x, name: data.name } : x))
      );
      setEditingId(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  const filtered = participants.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p>Laster deltakere…</p>;

  return (
    <div className="admin__grid">
      {error && <div className="admin__error">{error}</div>}

      <input
        className="input"
        placeholder="Søk etter deltaker…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="admin__participant-count">
        {filtered.length} deltaker{filtered.length !== 1 ? "e" : ""}
        {search && ` (av ${participants.length})`}
      </div>

      <div className="admin__participant-list">
        {filtered.map((p) => (
          <div key={p.id} className="admin__participant-row">
            <div className="admin__participant-info">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="admin__participant-avatar" />
              ) : (
                <div className="admin__participant-initials">
                  {getInitials(p.name)}
                </div>
              )}
              <div>
                {editingId === p.id ? (
                  <span className="admin__participant-name-edit">
                    <input
                      className="input input--sm"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename(p.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                    />
                    <button className="btn btn--sm btnPrimary" disabled={busy[p.id]} onClick={() => saveRename(p.id)}>Lagre</button>
                    <button className="btn btn--sm" onClick={() => setEditingId(null)}>Avbryt</button>
                  </span>
                ) : (
                  <span
                    className="admin__participant-name"
                    onClick={() => { setEditingId(p.id); setEditName(p.name); }}
                    title="Klikk for å endre navn"
                    style={{ cursor: "pointer" }}
                  >
                    {p.name} ✏️
                  </span>
                )}
                <span className="admin__participant-meta">
                  {p.isRegular ? "Fast" : "Gjest"} · {p.attempts} forsøk
                </span>
              </div>
            </div>

            <div className="admin__participant-actions">
              <label className="btn admin__upload-btn">
                Endre bilde
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) openCropModal(p, file);
                    e.target.value = "";
                  }}
                />
              </label>
              {deleteConfirm === p.id ? (
                <>
                  <button
                    className="btn btnDanger"
                    disabled={busy[p.id]}
                    onClick={() => hardDelete(p.id)}
                  >
                    Bekreft slett
                  </button>
                  <button
                    className="btn"
                    onClick={() => setDeleteConfirm(null)}
                  >
                    Avbryt
                  </button>
                </>
              ) : (
                <button
                  className="btn btnDanger"
                  onClick={() => setDeleteConfirm(p.id)}
                >
                  Slett
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Crop modal */}
      {cropTarget && rawImageUrl && (
        <div className="modalOverlay" onClick={(e) => { if (e.target === e.currentTarget) closeCropModal(); }}>
          <div className="card modalCard admin__crop-modal">
            <h2 className="u-mb-sm">Endre bilde for {cropTarget.name}</h2>

            {!croppedPreview ? (
              <>
                <div className="admin__crop-area">
                  <Cropper
                    image={rawImageUrl}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />
                </div>
                <label className="admin__zoom-label">
                  Zoom
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.05}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="admin__zoom-slider"
                  />
                </label>
                <div className="admin__actions">
                  <button className="btn btnPrimary" onClick={finalizeCrop}>Forhåndsvis</button>
                  <button className="btn" onClick={closeCropModal}>Avbryt</button>
                </div>
              </>
            ) : (
              <>
                <div className="admin__preview-wrap">
                  <img src={croppedPreview} alt="Forhåndsvisning" className="admin__preview-img" />
                </div>
                <div className="admin__actions">
                  <button className="btn btnPrimary" disabled={uploading} onClick={confirmUpload}>
                    {uploading ? "Laster opp…" : "Bekreft"}
                  </button>
                  <button className="btn" disabled={uploading} onClick={() => setCroppedPreview(null)}>
                    Tilbake
                  </button>
                  <button className="btn" disabled={uploading} onClick={closeCropModal}>
                    Avbryt
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Submission history tab ────────────────────────────── */

function HistoryTab() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"approved" | "rejected">("approved");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/participant-submissions?status=${filter}`);
      if (!res.ok) throw new Error("Kunne ikke hente historikk");
      setSubmissions(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function deleteSubmission(id: string) {
    setBusy((b) => ({ ...b, [id]: true }));
    setError("");
    try {
      const res = await apiFetch(`/api/participant-submissions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Kunne ikke slette");
      }
      setSubmissions((s) => s.filter((x) => x.id !== id));
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  return (
    <div className="admin__grid">
      {error && <div className="admin__error">{error}</div>}

      <div className="tabs">
        <button
          className={`tab ${filter === "approved" ? "tabActive" : ""}`}
          onClick={() => setFilter("approved")}
        >
          Godkjente
        </button>
        <button
          className={`tab ${filter === "rejected" ? "tabActive" : ""}`}
          onClick={() => setFilter("rejected")}
        >
          Avviste
        </button>
      </div>

      {loading && <p>Laster…</p>}

      {!loading && submissions.length === 0 && (
        <p className="u-text-muted">Ingen {filter === "approved" ? "godkjente" : "avviste"} innmeldinger.</p>
      )}

      {!loading && submissions.map((sub) => (
        <div key={sub.id} className="card admin__history-card">
          <div className="admin__card-layout">
            <img src={sub.imageUrl} alt={sub.name} className="admin__card-img" />
            <div className="admin__card-body">
              <div>
                <h2 className="u-mb-0">
                  {sub.editedName || sub.name}
                  {sub.editedName && sub.editedName !== sub.name && (
                    <span className="admin__original-name"> (opprinnelig: {sub.name})</span>
                  )}
                </h2>
                <span className="admin__card-date">
                  Sendt inn {formatDate(sub.createdAt)}
                  {sub.reviewedAt && <> · Behandlet {formatDate(sub.reviewedAt)}</>}
                </span>
              </div>
              <div className="u-flex u-gap-sm">
                <span className={`badge admin__status-badge admin__status-badge--${sub.status}`}>
                  {sub.status === "approved" ? "Godkjent" : "Avvist"}
                </span>
              </div>
              {sub.adminNote && (
                <div className="admin__note">
                  <strong>Notat:</strong> {sub.adminNote}
                </div>
              )}
              <div className="admin__actions">
                {deleteConfirm === sub.id ? (
                  <>
                    <button
                      className="btn btnDanger"
                      disabled={busy[sub.id]}
                      onClick={() => deleteSubmission(sub.id)}
                    >
                      Bekreft slett
                    </button>
                    <button className="btn" onClick={() => setDeleteConfirm(null)}>
                      Avbryt
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btnDanger"
                    onClick={() => setDeleteConfirm(sub.id)}
                  >
                    Fjern fra historikk
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main admin page ───────────────────────────────────── */

export function AdminPage() {
  const location = useLocation();
  const { isAdmin, isAuthenticated, isPending } = useAuthSession();
  const nextPath = `${location.pathname}${location.search}${location.hash}`;
  const [activeTab, setActiveTab] = useState<Tab>("pending");

  if (isPending) {
    return (
      <div className="container admin">
        <div className="card">
          <h1>Admin</h1>
          <p>Sjekker tilgang…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/login?next=${encodeURIComponent(nextPath)}`} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container admin">
      <section className="card admin__header">
        <h1>Admin</h1>
        <p className="admin__subtitle">
          Administrasjonspanel. Her kan du godkjenne eller avvise innmeldinger, redigere deltakere og se historikk. Vær forsiktig med endringer her, spesielt sletting av deltakere, da det kan påvirke statistikk og historiske data!
        </p>
      </section>

      <nav className="admin__nav">
        <button
          className={`admin__nav-btn ${activeTab === "pending" ? "admin__nav-btn--active" : ""}`}
          onClick={() => setActiveTab("pending")}
        >
          Innmeldinger
        </button>
        <button
          className={`admin__nav-btn ${activeTab === "participants" ? "admin__nav-btn--active" : ""}`}
          onClick={() => setActiveTab("participants")}
        >
          Deltakere
        </button>
        <button
          className={`admin__nav-btn ${activeTab === "history" ? "admin__nav-btn--active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          Historikk
        </button>
      </nav>

      <section className="admin__content">
        {activeTab === "pending" && <PendingTab />}
        {activeTab === "participants" && <ParticipantsTab />}
        {activeTab === "history" && <HistoryTab />}
      </section>
    </div>
  );
}
