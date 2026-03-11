import { useEffect, useState } from "react";

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

export function AdminPage() {
  const [items, setItems] = useState<Submission[]>([]);
  const [editedNames, setEditedNames] = useState<Record<string, string>>({});
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/participant-submissions?status=pending");
      if (!res.ok) {
        throw new Error("Kunne ikke hente pending submissions.");
      }

      const data: Submission[] = await res.json();
      setItems(data);

      setEditedNames(
        Object.fromEntries(data.map((x) => [x.id, x.editedName || x.name]))
      );

      setAdminNotes(
        Object.fromEntries(data.map((x) => [x.id, x.adminNote || ""]))
      );
    } catch (err: any) {
      setError(err.message || "Noe gikk galt.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id: string) {
    try {
      setBusyId(id);
      setError("");

      const res = await fetch(`/api/participant-submissions/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editedName: editedNames[id]?.trim() || "",
          isRegular: false,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Kunne ikke godkjenne.");
      }

      await load();
    } catch (err: any) {
      setError(err.message || "Noe gikk galt.");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    try {
      setBusyId(id);
      setError("");

      const res = await fetch(`/api/participant-submissions/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminNote: adminNotes[id]?.trim() || "",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Kunne ikke avvise.");
      }

      await load();
    } catch (err: any) {
      setError(err.message || "Noe gikk galt.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="container u-pb-3xl">
      <div className="admin__header">
        <h1>Admin</h1>
        <div className="admin__subtitle">
          Nye participants som venter på godkjenning.
        </div>
      </div>

      {error && (
        <div className="admin__error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card u-p-xl u-text-center">
          Laster pending submissions...
        </div>
      ) : items.length === 0 ? (
        <div className="card u-p-xl u-text-center u-text-muted">
          Ingen pending submissions akkurat nå.
        </div>
      ) : (
        <div className="admin__grid">
          {items.map((item) => {
            const isBusy = busyId === item.id;

            return (
              <div key={item.id} className="card u-p-lg">
                <div className="admin__card-layout">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="admin__card-img"
                  />

                  <div className="admin__card-body">
                    <div className="admin__card-date">
                      Innsendt {new Date(item.createdAt).toLocaleString()}
                    </div>

                    <div>
                      <label className="admin__field-label">Navn</label>
                      <input
                        className="input u-w-full"
                        value={editedNames[item.id] ?? ""}
                        onChange={(e) =>
                          setEditedNames((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label className="admin__field-label">Admin-notat</label>
                      <textarea
                        value={adminNotes[item.id] ?? ""}
                        onChange={(e) =>
                          setAdminNotes((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        rows={3}
                        className="admin__textarea"
                      />
                    </div>

                    <div className="admin__actions">
                      <button
                        className="btn"
                        onClick={() => approve(item.id)}
                        disabled={isBusy}
                      >
                        {isBusy ? "Jobber..." : "Godkjenn"}
                      </button>

                      <button
                        className="btn admin__reject-btn"
                        onClick={() => reject(item.id)}
                        disabled={isBusy}
                      >
                        {isBusy ? "Jobber..." : "Avvis"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}