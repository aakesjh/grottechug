import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { authClient } from "../auth/client";
import { useAuthSession } from "../auth/useAuthSession";
import { apiFetch } from "../lib/api";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, isAuthenticated, isPending, user } = useAuthSession();
  const isHome = location.pathname === "/";
  const [participantName, setParticipantName] = useState<string | null>(null);
  const [participantImage, setParticipantImage] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  async function handleSignOut() {
    await authClient.signOut();
    navigate("/");
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
