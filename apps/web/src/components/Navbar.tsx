import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === "/";

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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