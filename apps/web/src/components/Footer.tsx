import { useLocation } from "react-router-dom";

const HIDDEN_ON = new Set(["/wheel", "/login", "/join"]);

export function Footer() {
  const { pathname } = useLocation();

  if (HIDDEN_ON.has(pathname) || pathname.startsWith("/session/")) return null;

  return (
    <footer className="siteFooter">
      <div className="container footerInner">
        <div className="footerContact">
          <a href="mailto:aake@grottechug.no" className="footerLink">
            aake@grottechug.no
          </a>
          <span className="footerDot" />
          <a href="mailto:morten@grottechug.no" className="footerLink">
            morten@grottechug.no
          </a>
        </div>
        <span className="footerBrand">
          © {new Date().getFullYear()} Grottechug
        </span>
      </div>
    </footer>
  );
}
