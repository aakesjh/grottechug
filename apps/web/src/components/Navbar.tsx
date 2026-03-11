import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { authClient } from "../auth/client";
import { useAuthSession } from "../auth/useAuthSession";
import { apiFetch } from "../lib/api";
import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, isAuthenticated, isPending, user } = useAuthSession();
  const isHome = location.pathname === "/";
  const [participantName, setParticipantName] = useState<string | null>(null);
  const [participantImage, setParticipantImage] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // LØSNINGEN: Er vi på forsiden, er den ALLTID i hero-modus (låst).
  // På andre sider bytter den til kompakt.
  const isHeroMode = isHome;

  useEffect(() => {
    let cancelled = false;

    if (!user?.participantId) {
      setParticipantName(null);
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
  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  // Close menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuOpen) setMenuOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  const toggleMenu = useCallback(() => setMenuOpen(prev => !prev), []);

  const isHeroMode = isHome;

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
  const navLinks = (
    <>
      <NavLink to="/wheel" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
        Hjulet
      </NavLink>
      <NavLink to="/chug" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
        Chuggelista
      </NavLink>
      <NavLink to="/violations" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
        Kryssliste
      </NavLink>
      <NavLink to="/rules" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
        Regler
      </NavLink>
      <NavLink to="/leaderboard" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
        Toppliste
      </NavLink>
      <NavLink to="/stats" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
        Statistikk
      </NavLink>
      <NavLink to="/grotta" className={({ isActive }) => `navLink ${isActive ? "navLinkActive" : ""}`}>
        Grotta
      </NavLink>
    </>
  );

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

            {!isPending && isAuthenticated && (
              <div className="profileMenu" ref={menuRef}>
                <button
                  className="profileBlob"
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  {participantImage ? (
                    <img
                      src={participantImage}
                      alt={participantName ?? ""}
                      className="profileImg"
                    />
                  ) : (
                    <span className="profileInitial">
                      {(participantName ?? user?.name ?? "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="profileBlobInfo">
                    <span className="profileBlobName">{participantName ?? user?.name}</span>
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
                      <span className="profileDropdownName">
                        {participantName ?? user?.name}
                      </span>
                      <span className={`authRole ${isAdmin ? "authRoleAdmin" : "authRoleMember"}`}>
                        {isAdmin ? "Admin" : "Medlem"}
                      </span>
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


            {/* Hamburger button - visible on mobile only */}
            <button
              className={`hamburger ${menuOpen ? "hamburgerOpen" : ""}`}
              onClick={toggleMenu}
              aria-label={menuOpen ? "Lukk meny" : "Åpne meny"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
            >
              <span className="hamburgerLine" />
              <span className="hamburgerLine" />
              <span className="hamburgerLine" />
            </button>
            
            {/* Desktop nav links */}
            <div className="navLinks">
              {navLinks}
            </div>
          </div>
        </div>

        {/* Mobile drawer overlay */}
        {menuOpen && (
          <div className="mobileOverlay" onClick={() => setMenuOpen(false)} aria-hidden="true" />
        )}

        {/* Mobile drawer menu */}
        <div
          id="mobile-menu"
          className={`mobileDrawer ${menuOpen ? "mobileDrawerOpen" : ""}`}
          role="navigation"
          aria-label="Mobilmeny"
        >
          <div className="mobileDrawerLinks">
            {navLinks}
          </div>
        </div>
      </nav>
    </>
  );
}
