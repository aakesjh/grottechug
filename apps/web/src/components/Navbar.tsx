import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { authClient } from "../auth/client";
import { useAuthSession } from "../auth/useAuthSession";
import { apiFetch } from "../lib/api";
import { ThemeToggle } from "./ThemeToggle";

type SearchPerson = {
  id: string;
  name: string;
  isRegular: boolean;
  imageUrl?: string | null;
};

type SearchSession = {
  id: string;
  dateISO: string;
  semester: string;
  note?: string | null;
};

type SearchItem = {
  id: string;
  label: string;
  subtitle: string;
  to: string;
  type: "person" | "session" | "page";
  imageUrl?: string | null;
};

const NAV_SEARCH_PAGES: Array<{ id: string; label: string; subtitle: string; to: string }> = [
  { id: "page-home", label: "Hjem", subtitle: "Side", to: "/" },
  { id: "page-wheel", label: "Hjulet", subtitle: "Side", to: "/wheel" },
  { id: "page-chug", label: "Chuggelista", subtitle: "Side", to: "/chug" },
  { id: "page-violations", label: "Kryssliste", subtitle: "Side", to: "/violations" },
  { id: "page-rules", label: "Regler", subtitle: "Side", to: "/rules" },
  { id: "page-leaderboard", label: "Toppliste", subtitle: "Side", to: "/leaderboard" },
  { id: "page-stats", label: "Statistikk", subtitle: "Side", to: "/stats" },
  { id: "page-wrapped", label: "Wrapped", subtitle: "Side", to: "/wrapped" },
  { id: "page-grotta", label: "Grotta", subtitle: "Side", to: "/grotta" },
  { id: "page-join", label: "Join", subtitle: "Side", to: "/join" },
  { id: "page-howto", label: "How To", subtitle: "Side", to: "/howto" },
];

function fmtDate(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, isAuthenticated, isPending, user } = useAuthSession();
  const isHome = location.pathname === "/";
  const [participantName, setParticipantName] = useState<string | null>(null);
  const [participantImage, setParticipantImage] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPeopleLoading, setSearchPeopleLoading] = useState(false);
  const [searchSessionsLoading, setSearchSessionsLoading] = useState(false);
  const [searchPeople, setSearchPeople] = useState<SearchPerson[]>([]);
  const [searchSessions, setSearchSessions] = useState<SearchSession[]>([]);
  const [songPlaying, setSongPlaying] = useState(false);
  const [songPanelOpen, setSongPanelOpen] = useState(false);
  const [songCurrentTime, setSongCurrentTime] = useState(0);
  const [songDuration, setSongDuration] = useState(0);
  const [songVolume, setSongVolume] = useState(0.8);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchDesktopRef = useRef<HTMLDivElement>(null);
  const searchDrawerRef = useRef<HTMLDivElement>(null);
  const songDesktopRef = useRef<HTMLDivElement>(null);
  const songDrawerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const drawerSearchInputRef = useRef<HTMLInputElement>(null);
  const songAudioRef = useRef<HTMLAudioElement | null>(null);

  // LØSNINGEN: Er vi på forsiden, er den ALLTID i hero-modus (låst).
  // På andre sider bytter den til kompakt.
  const isHeroMode = isHome;
  const displayParticipantName = user?.participantId ? participantName : null;
  const displayParticipantImage = user?.participantId ? participantImage : null;

  useEffect(() => {
    let cancelled = false;

    if (!user?.participantId) {
      return () => {
        cancelled = true;
      };
    }

    apiFetch(`/api/participants/${user.participantId}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load participant");
        }

        return response.json() as Promise<{ name?: string; imageUrl?: string | null }>;
      })
      .then((participant) => {
        if (!cancelled) {
          setParticipantName(participant.name ?? null);
          setParticipantImage(participant.imageUrl ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setParticipantName(null);
          setParticipantImage(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.participantId]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchPeople([]);
      setSearchPeopleLoading(false);
      return;
    }

    let alive = true;
    setSearchPeopleLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/participants/search?query=${encodeURIComponent(q)}`);
        const people: SearchPerson[] = await res.json();
        if (alive) setSearchPeople(Array.isArray(people) ? people : []);
      } catch {
        if (alive) setSearchPeople([]);
      } finally {
        if (alive) setSearchPeopleLoading(false);
      }
    }, 140);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    const audio = new Audio("/GrotteChug.wav");
    audio.preload = "metadata";
    audio.volume = 0.8;

    const handlePlay = () => setSongPlaying(true);
    const handlePause = () => setSongPlaying(false);
    const handleEnded = () => setSongPlaying(false);
    const handleTimeUpdate = () => setSongCurrentTime(audio.currentTime || 0);
    const handleDurationChange = () => setSongDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const handleVolumeChange = () => setSongVolume(audio.volume);

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleDurationChange);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("volumechange", handleVolumeChange);

    songAudioRef.current = audio;
    setSongVolume(audio.volume);

    return () => {
      audio.pause();
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleDurationChange);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("volumechange", handleVolumeChange);
      songAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchSessions([]);
      setSearchSessionsLoading(false);
      return;
    }

    let alive = true;
    setSearchSessionsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/sessions?semester=all`);
        const sessions: SearchSession[] = await res.json();
        if (!alive) return;

        const queryLower = q.toLowerCase();
        const matches = (Array.isArray(sessions) ? sessions : [])
          .filter((session) => {
            const dateText = fmtDate(session.dateISO).toLowerCase();
            const semesterText = (session.semester ?? "").toLowerCase();
            const noteText = (session.note ?? "").toLowerCase();
            return (`${dateText} ${semesterText} ${noteText}`).includes(queryLower);
          })
          .sort((a, b) => b.dateISO.localeCompare(a.dateISO))
          .slice(0, 6);

        setSearchSessions(matches);
      } catch {
        if (alive) setSearchSessions([]);
      } finally {
        if (alive) setSearchSessionsLoading(false);
      }
    }, 140);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const pageMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const pages = !q
      ? []
      : NAV_SEARCH_PAGES.filter((page) => `${page.label} ${page.subtitle}`.toLowerCase().includes(q));
    return pages.map((page): SearchItem => ({
      id: page.id,
      label: page.label,
      subtitle: page.subtitle,
      to: page.to,
      type: "page",
    }));
  }, [searchQuery]);

  const peopleMatches = useMemo(() => {
    return searchPeople.map((person): SearchItem => ({
      id: `person-${person.id}`,
      label: person.name,
      subtitle: person.isRegular ? "Person" : "Gjest",
      to: `/person/${person.id}`,
      type: "person",
      imageUrl: person.imageUrl,
    }));
  }, [searchPeople]);

  const sessionMatches = useMemo(() => {
    return searchSessions.map((session): SearchItem => ({
      id: `session-${session.id}`,
      label: fmtDate(session.dateISO),
      subtitle: `Session ${session.semester}`,
      to: `/session/${session.id}`,
      type: "session",
    }));
  }, [searchSessions]);

  const searchResults = useMemo(
    () => [...peopleMatches, ...sessionMatches, ...pageMatches].slice(0, 10),
    [peopleMatches, sessionMatches, pageMatches]
  );

  const searchLoading = searchPeopleLoading || searchSessionsLoading;

  function handleSearchSelect(to: string) {
    setSearchOpen(false);
    setSearchQuery("");
    setDrawerOpen(false);
    navigate(to);
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      const inDesktopSearch = !!searchDesktopRef.current?.contains(e.target as Node);
      const inDrawerSearch = !!searchDrawerRef.current?.contains(e.target as Node);
      const inDesktopSong = !!songDesktopRef.current?.contains(e.target as Node);
      const inDrawerSong = !!songDrawerRef.current?.contains(e.target as Node);
      if (!inDesktopSearch && !inDrawerSearch) {
        setSearchOpen(false);
      }
      if (!inDesktopSong && !inDrawerSong) {
        setSongPanelOpen(false);
      }
    }
    if (menuOpen || searchOpen || songPanelOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen, searchOpen, songPanelOpen]);

  async function handleSignOut() {
    await authClient.signOut();
    navigate("/");
  }

  function fmtSongTime(value: number) {
    if (!Number.isFinite(value) || value < 0) return "0:00";
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function handleSongPanelToggle() {
    setSongPanelOpen((isOpen) => !isOpen);
  }

  async function handleSongToggle() {
    const audio = songAudioRef.current;
    if (!audio) return;

    try {
      setSongPanelOpen(true);
      if (audio.paused) {
        if (audio.ended) {
          audio.currentTime = 0;
        }
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (error) {
      console.error("Kunne ikke spille av GrotteChug-sangen", error);
    }
  }

  async function handleSongRestart() {
    const audio = songAudioRef.current;
    if (!audio) return;

    audio.currentTime = 0;
    setSongCurrentTime(0);
    setSongPanelOpen(true);

    try {
      await audio.play();
    } catch (error) {
      console.error("Kunne ikke starte GrotteChug-sangen på nytt", error);
    }
  }

  function handleSongStop() {
    const audio = songAudioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setSongCurrentTime(0);
  }

  function handleSongSeek(nextValue: number) {
    const audio = songAudioRef.current;
    if (!audio) return;

    audio.currentTime = nextValue;
    setSongCurrentTime(nextValue);
  }

  function handleSongVolume(nextValue: number) {
    const audio = songAudioRef.current;
    if (!audio) return;

    audio.volume = nextValue;
    setSongVolume(nextValue);
  }

  const songButtonLabel = songPanelOpen ? "Lukk GrotteChug-spilleren" : "Åpne GrotteChug-spilleren";

  function renderSongPlayer(panelClassName?: string) {
    return (
      <div className={`navSongPlayer${panelClassName ? ` ${panelClassName}` : ""}`}>
        <div className="navSongPlayerHeader">
          <div className="navSongPlayerText">
            <div className="navSongPlayerTitle">GrotteChug</div>
            <div className="navSongPlayerArtist">KNUT • Uberliga</div>
          </div>
        </div>

        <div className="navSongControls">
          <button
            type="button"
            className="navSongControlBtn"
            onClick={handleSongToggle}
            aria-label={songPlaying ? "Pause sangen" : "Spill sangen"}
            title={songPlaying ? "Pause sangen" : "Spill sangen"}
          >
            {songPlaying ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="navSongControlBtn"
            onClick={handleSongStop}
            aria-label="Stopp sangen"
            title="Stopp sangen"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
          <button
            type="button"
            className="navSongControlBtn"
            onClick={handleSongRestart}
            aria-label="Start sangen på nytt"
            title="Start sangen på nytt"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.708" />
              <path d="M3 3v6h6" />
            </svg>
          </button>

          <div className="navSongVolumeControl">
            <button
              type="button"
              className="navSongControlBtn"
              aria-label="Volumkontroll"
              title="Volum"
            >
              {songVolume > 0 ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                  <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="m23 9-6 6" />
                  <path d="m17 9 6 6" />
                </svg>
              )}
            </button>

            <div className="navSongVolumePopover">
              <input
                className="navSongRange navSongRange--volume"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={songVolume}
                onChange={(event) => handleSongVolume(Number(event.target.value))}
                aria-label="Endre volum"
              />
            </div>
          </div>
        </div>

        <div className="navSongTimeline">
          <span className="navSongTime">{fmtSongTime(songCurrentTime)}</span>
          <input
            className="navSongRange"
            type="range"
            min={0}
            max={songDuration > 0 ? songDuration : 0}
            step={0.1}
            value={Math.min(songCurrentTime, songDuration || 0)}
            onChange={(event) => handleSongSeek(Number(event.target.value))}
            aria-label="Spol i sangen"
          />
          <span className="navSongTime">{fmtSongTime(songDuration)}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`navPlaceholder ${isHeroMode ? "hero" : "compact"}`} />

      <nav className={`navWrap ${isHeroMode ? "heroMode" : "compactMode"}`}>
        <div className="navBar">
          <div className="container navInner">
            <div className="navLogoContainer">
              <NavLink to="/">
                <img
                  src="/grottalogo.png"
                  alt="Grotta Logo"
                  className="navLogo"
                />
              </NavLink>
              {!isHome && (
                <NavLink
                  to="/wrapped"
                  className={({ isActive }) =>
                    `navWrappedBadge ${isActive ? "navWrappedBadge--active" : ""}`
                  }
                >
                  🎁 Wrapped
                </NavLink>
              )}
            </div>

            <div className="navControls">
              <div className="navLinks">
                <NavLink
                  to="/wheel"
                  className={({ isActive }) =>
                    `navLink ${isActive ? "navLinkActive" : ""}`
                  }
                >
                  Hjulet
                </NavLink>
                <NavLink
                  to="/chug"
                  className={({ isActive }) =>
                    `navLink ${isActive ? "navLinkActive" : ""}`
                  }
                >
                  Chuggelista
                </NavLink>
                <NavLink
                  to="/violations"
                  className={({ isActive }) =>
                    `navLink ${isActive ? "navLinkActive" : ""}`
                  }
                >
                  Kryssliste
                </NavLink>
                <NavLink
                  to="/rules"
                  className={({ isActive }) =>
                    `navLink ${isActive ? "navLinkActive" : ""}`
                  }
                >
                  Regler
                </NavLink>
                <NavLink
                  to="/leaderboard"
                  className={({ isActive }) =>
                    `navLink ${isActive ? "navLinkActive" : ""}`
                  }
                >
                  Toppliste
                </NavLink>
                <NavLink
                  to="/stats"
                  className={({ isActive }) =>
                    `navLink ${isActive ? "navLinkActive" : ""}`
                  }
                >
                  Statistikk
                </NavLink>
                <NavLink
                  to="/grotta"
                  className={({ isActive }) =>
                    `navLink ${isActive ? "navLinkActive" : ""}`
                  }
                >
                  Grotta
                </NavLink>
              </div>

              <div className="navSearch" ref={searchDesktopRef}>
                <div className="navSearchFieldWrap">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    ref={searchInputRef}
                    id="navbar-global-search"
                    name="navbarGlobalSearch"
                    className="navSearchField"
                    type="text"
                    placeholder="Søk"
                    value={searchQuery}
                    onFocus={() => setSearchOpen(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setSearchOpen(false);
                        searchInputRef.current?.blur();
                      }
                      if (e.key === "Enter" && searchResults.length > 0) {
                        handleSearchSelect(searchResults[0].to);
                      }
                    }}
                  />
                </div>

                {searchOpen && (
                  <div className="navSearchPanel">
                    <div className="navSearchList">
                      {!searchQuery.trim() && <div className="navSearchHint">Søk etter person, dato eller side</div>}
                      {searchLoading && <div className="navSearchHint">Søker...</div>}
                      {!searchLoading && searchQuery.trim() && searchResults.length === 0 && <div className="navSearchHint">Ingen treff</div>}
                      {!searchLoading && searchResults.map((item) => (
                        <button
                          key={item.id}
                          className="navSearchItem"
                          onClick={() => handleSearchSelect(item.to)}
                        >
                          <span className="navSearchItemMain">{item.label}</span>
                          <span className="navSearchItemMeta">{item.subtitle}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="navSong navSong--desktop" ref={songDesktopRef}>
                <button
                  type="button"
                  className={`navSongBtn navSongBtn--desktop ${songPlaying ? "navSongBtnActive" : ""}`}
                  onClick={handleSongPanelToggle}
                  aria-label={songButtonLabel}
                  aria-pressed={songPanelOpen}
                >
                  <svg
                    className="navSongBtnIcon"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9 18V5l10-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                </button>
                {songPanelOpen && renderSongPlayer()}
              </div>
            </div>

            {!isPending && !isAuthenticated && (
              <div className="profileMenu profileMenu--themeOnly">
                <ThemeToggle className="profileMenuThemeToggle" variant="compact" />
              </div>
            )}

            {!isPending && isAuthenticated && (
              <div className="profileMenu" ref={menuRef}>
                <button
                  className="profileBlob"
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  {displayParticipantImage ? (
                    <img
                      src={displayParticipantImage}
                      alt={displayParticipantName ?? ""}
                      className="profileImg"
                    />
                  ) : (
                    <span className="profileInitial">
                      {(displayParticipantName ?? user?.name ?? "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="profileBlobInfo">
                    <span className="profileBlobName">{displayParticipantName ?? user?.name}</span>
                    <span className={`profileBlobRole ${isAdmin ? "authRoleAdmin" : "authRoleMember"}`}>
                      {isAdmin ? "Admin" : "Medlem"}
                    </span>
                  </span>
                </button>

                {menuOpen && (
                  <div className="profileDropdown">
                    <div
                      className="profileDropdownHeader profileDropdownLink"
                      onClick={() => {
                        setMenuOpen(false);
                        if (user?.participantId) navigate(`/person/${user.participantId}`);
                      }}
                    >
                      <div className="profileDropdownHeaderMain">
                        <span className="profileDropdownName">
                          {displayParticipantName ?? user?.name}
                        </span>
                        <span className={`authRole ${isAdmin ? "authRoleAdmin" : "authRoleMember"}`}>
                          {isAdmin ? "Admin" : "Medlem"}
                        </span>
                      </div>
                      {isAdmin && (
                        <div
                          className="profileDropdownThemeToggleWrap"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <ThemeToggle className="profileDropdownThemeToggle" variant="compact" />
                        </div>
                      )}
                    </div>
                    <div className="profileDropdownDivider" />
                    {isAdmin && (
                      <button
                        className="profileDropdownItem"
                        onClick={() => {
                          setMenuOpen(false);
                          navigate("/admin");
                        }}
                      >
                        Admin
                      </button>
                    )}
                    <button
                      className="profileDropdownItem profileDropdownDanger"
                      onClick={() => { setMenuOpen(false); handleSignOut(); }}
                    >
                      Logg ut
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              className={`hamburger ${drawerOpen ? "hamburgerOpen" : ""}`}
              onClick={() => setDrawerOpen((v) => !v)}
              aria-label="Meny"
            >
              <span className="hamburgerLine" />
              <span className="hamburgerLine" />
              <span className="hamburgerLine" />
            </button>

          </div>
        </div>

        {drawerOpen && (
          <div className="mobileOverlay" onClick={() => setDrawerOpen(false)} />
        )}
        <div className={`mobileDrawer ${drawerOpen ? "mobileDrawerOpen" : ""}`}>
          {!isPending && !isAuthenticated && (
            <div className="mobileDrawerProfile mobileDrawerProfile--themeOnly">
              <div className="mobileDrawerProfileInfo mobileDrawerProfileInfo--static">
                <div className="mobileDrawerProfileMeta">
                  <span className="mobileDrawerThemeInfo">
                    <span className="mobileDrawerThemeLabel">Fargetema</span>
                  </span>
                </div>
                <span className="mobileDrawerThemeToggleWrap">
                  <ThemeToggle className="mobileDrawerThemeToggle" variant="compact" />
                </span>
              </div>
            </div>
          )}
          {!isPending && isAuthenticated && (
            <div className="mobileDrawerProfile">
              <div
                className="mobileDrawerProfileInfo"
                onClick={() => {
                  setDrawerOpen(false);
                  if (user?.participantId) navigate(`/person/${user.participantId}`);
                }}
              >
                <div className="mobileDrawerProfileMeta">
                  {displayParticipantImage ? (
                    <img src={displayParticipantImage} alt={displayParticipantName ?? ""} className="profileImg" />
                  ) : (
                    <span className="profileInitial">
                      {(displayParticipantName ?? user?.name ?? "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="profileBlobInfo">
                    <span className="profileBlobName">{displayParticipantName ?? user?.name}</span>
                    <span className={`profileBlobRole ${isAdmin ? "authRoleAdmin" : "authRoleMember"}`}>
                      {isAdmin ? "Admin" : "Medlem"}
                    </span>
                  </span>
                </div>
                {isAdmin && (
                  <span
                    className="mobileDrawerThemeToggleWrap"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <ThemeToggle className="mobileDrawerThemeToggle" variant="compact" />
                  </span>
                )}
              </div>
            </div>
          )}
          <div className="mobileDrawerSearch" ref={searchDrawerRef}>
            <div className="navSearchFieldWrap mobileDrawerSearchFieldWrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={drawerSearchInputRef}
                id="navbar-global-search-drawer"
                name="navbarGlobalSearchDrawer"
                className="navSearchField"
                type="text"
                placeholder="Søk"
                value={searchQuery}
                onFocus={() => setSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchOpen(false);
                    drawerSearchInputRef.current?.blur();
                  }
                  if (e.key === "Enter" && searchResults.length > 0) {
                    handleSearchSelect(searchResults[0].to);
                  }
                }}
              />
            </div>

            {searchOpen && (
              <div className="navSearchPanel mobileDrawerSearchPanel">
                <div className="navSearchList">
                  {!searchQuery.trim() && <div className="navSearchHint">Søk etter person, dato eller side</div>}
                  {searchLoading && <div className="navSearchHint">Søker...</div>}
                  {!searchLoading && searchQuery.trim() && searchResults.length === 0 && <div className="navSearchHint">Ingen treff</div>}
                  {!searchLoading && searchResults.map((item) => (
                    <button
                      key={item.id}
                      className="navSearchItem"
                      onClick={() => handleSearchSelect(item.to)}
                    >
                      <span className="navSearchItemMain">{item.label}</span>
                      <span className="navSearchItemMeta">{item.subtitle}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="mobileDrawerSong" ref={songDrawerRef}>
            <div className="navSong navSong--drawer">
              <button
                type="button"
                className={`navSongBtn navSongBtn--drawer ${songPlaying ? "navSongBtnActive" : ""}`}
                onClick={handleSongPanelToggle}
                aria-label={songButtonLabel}
                aria-pressed={songPanelOpen}
              >
                <svg
                  className="navSongBtnIcon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 18V5l10-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </button>
            </div>
            {songPanelOpen && renderSongPlayer("navSongPlayer--drawer")}
          </div>
          <div className="mobileDrawerLinks">
            <NavLink to="/wheel" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`} onClick={() => setDrawerOpen(false)}>Hjulet</NavLink>
            <NavLink to="/chug" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`} onClick={() => setDrawerOpen(false)}>Chuggelista</NavLink>
            <NavLink to="/violations" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`} onClick={() => setDrawerOpen(false)}>Kryssliste</NavLink>
            <NavLink to="/rules" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`} onClick={() => setDrawerOpen(false)}>Regler</NavLink>
            <NavLink to="/leaderboard" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`} onClick={() => setDrawerOpen(false)}>Toppliste</NavLink>
            <NavLink to="/stats" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`} onClick={() => setDrawerOpen(false)}>Statistikk</NavLink>
            <NavLink to="/grotta" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`} onClick={() => setDrawerOpen(false)}>Grotta</NavLink>
            {isAdmin && (
              <NavLink to="/admin" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`} onClick={() => setDrawerOpen(false)}>Admin</NavLink>
            )}
          </div>
          {!isPending && isAuthenticated && (
            <div className="mobileDrawerFooter">
              <button
                className="mobileDrawerBtn mobileDrawerDanger"
                onClick={() => { setDrawerOpen(false); handleSignOut(); }}
              >
                Logg ut
              </button>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
