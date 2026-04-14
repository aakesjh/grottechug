import { Link } from "react-router-dom";
import { useEffect } from "react";

export function HomePage() {
  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="home">
      {/* Velkomst */}
      <div className="home__welcome">
        <h1 className="home__title">Grottechug</h1>

        <p className="home__subtitle">
          Den offisielle plattformen for chugge-statistikk, hjulet og de harde
          fakta fra Grotta.
        </p>

        <div className="home__actions">
          <Link to="/wheel" className="btn btnPrimary home__action-btn">
            Spinn Hjulet
          </Link>
          <Link to="/leaderboard" className="btn home__action-btn">
            Toppliste
          </Link>
        </div>
      </div>

      {/* Oversikt over funksjoner */}
      <div className="home__features">
        <Link to="/grotta" className="card cardCard home__feature-card">
          <h2 className="home__feature-title u-text-accent2">Grotta</h2>
          <p className="home__feature-desc">
            Se medlemmer og gjester på Grotta, samt individuelle statistikker.
          </p>
        </Link>

        <Link to="/stats" className="card cardCard home__feature-card">
          <h2 className="home__feature-title u-text-accent">Statistikk</h2>
          <p className="home__feature-desc">
            Følg med på utvikling og personlige rekorder.
          </p>
        </Link>

        <Link to="/rules" className="card cardCard home__feature-card">
          <h2 className="home__feature-title u-text-danger">Regelverk</h2>
          <p className="home__feature-desc">
            Lær deg forskjellen på de ulike chugge-typene.
          </p>
        </Link>
      </div>
    </div>
  );
}
