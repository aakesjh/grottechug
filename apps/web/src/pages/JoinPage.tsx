import { useCallback, useEffect, useMemo, useState } from "react";
import Cropper from "react-easy-crop";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

type Area = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ParticipantSearchHit = {
  id: string;
  name: string;
  isRegular: boolean;
  imageUrl?: string | null;
};

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });
}

async function getCroppedImg(imageSrc: string, crop: Area): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Kunne ikke opprette canvas.");
  }

  canvas.width = crop.width;
  canvas.height = crop.height;

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Kunne ikke lage croppet bilde."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.92
    );
  });
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function firstToken(value: string) {
  return normalizeName(value).split(" ")[0]?.toLowerCase() ?? "";
}

function looksLikeFirstnamePlusInitial(value: string) {
  return /^[A-Za-zÆØÅæøå]+(?:[- ][A-Za-zÆØÅæøå]+)*\s+[A-Za-zÆØÅæøå]\.?$/.test(
    normalizeName(value)
  );
}

function getInitials(name: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function JoinPage() {
  const [nameInput, setNameInput] = useState("");
  const [, setRawFile] = useState<File | null>(null);
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const [searching, setSearching] = useState(false);
  const [nameMatches, setNameMatches] = useState<ParticipantSearchHit[]>([]);
  const [identityAnswered, setIdentityAnswered] = useState<"yes" | "no" | null>(null);

  const normalizedInput = useMemo(() => normalizeName(nameInput), [nameInput]);
  const inputFirstName = useMemo(() => firstToken(normalizedInput), [normalizedInput]);

  const hasImage = !!rawImageUrl;

  const exactFirstNameMatches = useMemo(() => {
    if (!inputFirstName) return [];
    return nameMatches.filter((p) => firstToken(p.name) === inputFirstName);
  }, [nameMatches, inputFirstName]);

  const hasFirstnameConflict = exactFirstNameMatches.length > 0;

  const oneExactMatch = exactFirstNameMatches.length === 1 ? exactFirstNameMatches[0] : null;
  const multipleExactMatches = exactFirstNameMatches.length > 1;

  const mustUseInitial =
    hasFirstnameConflict &&
    identityAnswered === "no" &&
    !looksLikeFirstnamePlusInitial(normalizedInput);

  const isBlockedBecauseAlreadyRegistered =
    oneExactMatch && identityAnswered === "yes";

  const canSubmit =
    normalizedInput &&
    rawImageUrl &&
    croppedAreaPixels &&
    !saving &&
    !isBlockedBecauseAlreadyRegistered &&
    !mustUseInitial;

  useEffect(() => {
    setIdentityAnswered(null);
  }, [normalizedInput]);

  useEffect(() => {
    const q = inputFirstName.trim();
    if (!q) {
      setNameMatches([]);
      return;
    }

    let alive = true;
    setSearching(true);

    const t = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/participants/search?query=${encodeURIComponent(q)}`);
        const data: ParticipantSearchHit[] = await res.json();

        if (!alive) return;
        setNameMatches(data);
      } catch (err) {
        console.error(err);
        if (!alive) return;
        setNameMatches([]);
      } finally {
        if (!alive) return;
        setSearching(false);
      }
    }, 250);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [inputFirstName]);

  const onCropComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixelsValue: Area) => {
      setCroppedAreaPixels(croppedAreaPixelsValue);
    },
    []
  );

  async function onSelectFile(file: File | null) {
    setError("");
    setCroppedBlob(null);
    setCroppedPreviewUrl(null);

    if (!file) {
      setRawFile(null);
      setRawImageUrl(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Filen må være et bilde.");
      return;
    }

    setRawFile(file);
    const url = URL.createObjectURL(file);
    setRawImageUrl(url);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!normalizedInput) {
      setError("Skriv inn fornavn.");
      return;
    }

    if (isBlockedBecauseAlreadyRegistered) {
      setError("Du er allerede registrert.");
      return;
    }

    if (mustUseInitial) {
      setError("Legg til første bokstav i etternavnet ditt, for eksempel Tobias A.");
      return;
    }

    if (!rawImageUrl || !croppedAreaPixels) {
      setError("Du må velge et bilde først.");
      return;
    }

    setSaving(true);

    try {
      let blobToUpload = croppedBlob;
      if (!blobToUpload) {
        blobToUpload = await getCroppedImg(rawImageUrl, croppedAreaPixels);
      }

      const fileToUpload = new File([blobToUpload], "participant.jpg", {
        type: "image/jpeg",
      });

      const form = new FormData();
      form.append("name", normalizedInput);
      form.append("image", fileToUpload);

      const res = await apiFetch("/api/participant-submissions", {
        method: "POST",
        body: form,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Kunne ikke sende inn.");
      }

      setDone(true);
    } catch (err: any) {
      setError(err.message || "Noe gikk galt.");
    } finally {
      setSaving(false);
    }
  }

  const preview = useMemo(() => {
    if (croppedPreviewUrl) return croppedPreviewUrl;
    return null;
  }, [croppedPreviewUrl]);

  if (done) {
    return (
      <div className="container join join--done">
        <div className="card join__card--done">
          <div className="join__done-icon">🎉</div>
          <h1 className="join__title--done">Du er med!</h1>
          <p className="join__done-text">
            Registreringen din er sendt inn og venter på godkjenning fra en admin. Du får tilgang så snart den er godkjent.
          </p>
          <p className="join__done-text">
            I mellomtiden kan du <Link to="/howto" className="join__howto-link">lese hvordan man chugger →</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container join">
      <div className="card join__card">
        <div className="join__header">
          <div className="join__header-icon">🍺</div>
          <h1 className="join__title">Bli med på grottechug</h1>
          <p className="join__subtitle">Fyll ut skjemaet for å registrere deg som deltaker</p>
        </div>

        <form onSubmit={onSubmit} className="join__form">
          {/* Step 1: Name */}
          <div className="join__step">
            <div className="join__step-header">
              <span className="join__step-number">1</span>
              <label className="join__label">Hva heter du?</label>
            </div>
            <input
              className="input join__input"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Skriv inn fornavnet ditt"
              autoComplete="given-name"
            />
            <div className="join__field-hint">Eventuelt et kallenavn om det er det alle kaller deg </div>
          </div>

          {searching && normalizedInput && (
            <div className="join__banner--search">
              Sjekker om fornavnet finnes...
            </div>
          )}

          {oneExactMatch && (
            <div className="join__identity-panel">
              <div className="join__identity-heading">Er dette deg?</div>

              <div className="join__identity-row">
                {oneExactMatch.imageUrl ? (
                  <img
                    src={oneExactMatch.imageUrl}
                    alt={oneExactMatch.name}
                    className="join__identity-img"
                  />
                ) : (
                  <div className="join__identity-initials">
                    {getInitials(oneExactMatch.name)}
                  </div>
                )}

                <div>
                  <div className="join__identity-name">{oneExactMatch.name}</div>
                  <div className="join__identity-role">
                    {oneExactMatch.isRegular ? "Fast deltaker" : "Deltaker"}
                  </div>
                </div>
              </div>

              <div className="join__identity-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setIdentityAnswered("yes")}
                >
                  Ja
                </button>
                <button
                  type="button"
                  className="btn btnGhost"
                  onClick={() => setIdentityAnswered("no")}
                >
                  Nei
                </button>
              </div>

              {identityAnswered === "yes" && (
                <div className="join__banner--warn">
                  Du er allerede registrert.
                </div>
              )}

              {identityAnswered === "no" && (
                <div className="join__banner--info">
                  Legg til første bokstav i etternavnet ditt, for eksempel{" "}
                  <b>{oneExactMatch.name.split(" ")[0]} A.</b>
                </div>
              )}
            </div>
          )}

          {multipleExactMatches && (
            <div className="join__identity-panel">
              <div className="join__identity-heading">
                Det finnes allerede flere med dette fornavnet.
              </div>

              <div className="join__match-hint">
                Er du en av disse? Hvis ikke, skriv fornavn og første bokstav i etternavnet ditt,
                for eksempel <b>{inputFirstName ? `${inputFirstName[0].toUpperCase()}${inputFirstName.slice(1)} A.` : "Tobias A."}</b>
              </div>

              <div className="join__match-list">
                {exactFirstNameMatches.map((person) => (
                  <div key={person.id} className="join__identity-row">
                    {person.imageUrl ? (
                      <img
                        src={person.imageUrl}
                        alt={person.name}
                        className="join__identity-img join__identity-img--sm"
                      />
                    ) : (
                      <div className="join__identity-initials join__identity-initials--sm">
                        {getInitials(person.name)}
                      </div>
                    )}

                    <div>
                      <div className="join__match-name">{person.name}</div>
                      <div className="join__identity-role">
                        {person.isRegular ? "Fast deltaker" : "Deltaker"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {mustUseInitial && (
                <div className="join__banner--info">
                  Skriv navnet ditt som fornavn + første bokstav i etternavnet, for eksempel{" "}
                  <b>{inputFirstName ? `${inputFirstName[0].toUpperCase()}${inputFirstName.slice(1)} A.` : "Tobias A."}</b>
                </div>
              )}
            </div>
          )}

          <div className="join__step">
            <div className="join__step-header">
              <span className="join__step-number">2</span>
              <label className="join__label">Last opp et bilde</label>
            </div>

            {!hasImage ? (
              <label className="join__upload-zone">
                <input
                  type="file"
                  accept="image/*"
                  className="join__file-input"
                  onChange={(e) => onSelectFile(e.target.files?.[0] || null)}
                />
                <svg className="join__upload-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="8" width="40" height="32" rx="6" stroke="currentColor" strokeWidth="2.5" fill="none" />
                  <circle cx="16" cy="20" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
                  <path d="M4 32 L16 22 L24 28 L34 18 L44 28 V34 C44 37.3137 41.3137 40 38 40 H10 C6.68629 40 4 37.3137 4 34 Z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
                <span className="join__upload-text">Trykk for å velge bilde</span>
                <span className="join__upload-hint">Selfie, stygt bilde, morsomt bilde. Hvertfall av deg</span>
              </label>
            ) : (
              <div className="join__upload-chosen">
                <button type="button" className="join__upload-change" onClick={() => { setRawImageUrl(null); setCroppedBlob(null); setCroppedPreviewUrl(null); }}>
                  Bytt bilde
                </button>
              </div>
            )}
          </div>

          {hasImage && (
            <div className="join__crop-section">
              <div className="join__crop-label">Dra for å justere utsnittet</div>
              <div className="join__cropper-wrap">
                <Cropper
                  image={rawImageUrl!}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="rect"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>

              <div className="join__zoom-row">
                <span className="join__zoom-label">🔍</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="join__zoom-slider"
                />
              </div>
            </div>
          )}

          {preview && (
            <div className="join__preview">
              <div className="join__preview-label">Forhåndsvisning</div>
              <img
                src={preview}
                alt="Croppet forhåndsvisning"
                className="join__preview-img"
              />
            </div>
          )}

          {error && (
            <div className="join__banner--error">
              {error}
            </div>
          )}

          <button className="btn btnPrimary join__submit" type="submit" disabled={!canSubmit}>
            {saving ? "Sender inn..." : "🚀 Registrer meg"}
          </button>

          <div className="join__footer-hint">
            En admin godkjenner registreringen din. Purr på Åke eller Morten før chuggen settes i gang 15:15 på fredag.
          </div>
          <div className="join__footer-hint">
            Usikker på hvordan man chugger? <Link to="/howto" className="join__howto-link">Sjekk guiden vår →</Link>
          </div>
        </form>
      </div>
    </div>
  );
}