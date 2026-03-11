import { Link } from "react-router-dom";
import { useEffect } from "react";

export function HomePage() {
  
  useEffect(() => {
    // Vi låser scrolling på BÅDE body og html for å overstyre global.css
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    
    return () => {
      // Setter tilbake til scroll når man forlater forsiden
      document.documentElement.style.overflow = "scroll"; 
      document.body.style.overflow = "auto";
    };
  }, []);

  return (
    <div className="home">
      {/* Velkomst */}
      <div className="home__welcome">
        <h1 className="home__title">Grottechug</h1>

        <p className="home__subtitle">
          Den offisielle plattformen for chugge-statistikk, hjulet og de harde fakta fra Grotta.
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
        <Link to="/wheel" className="card cardCard home__feature-card">
          <h2 className="home__feature-title u-text-accent2">Hjulet</h2>
          <p className="home__feature-desc">Trekk neste chugger på en rettferdig måte.</p>
        </Link>

        <Link to="/stats" className="card cardCard home__feature-card">
          <h2 className="home__feature-title u-text-accent">Statistikk</h2>
          <p className="home__feature-desc">Følg med på utvikling og personlige rekorder.</p>
        </Link>

        <Link to="/rules" className="card cardCard home__feature-card">
          <h2 className="home__feature-title u-text-danger">Regelverk</h2>
          <p className="home__feature-desc">Lær deg forskjellen på de ulike chugge-typene.</p>
        </Link>
      </div>
    </div>
  );
}