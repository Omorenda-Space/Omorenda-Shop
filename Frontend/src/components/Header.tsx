import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type HeaderProps = {
  title: string;
  titleHref?: string;
  logoSrc?: string;
  logoAlt?: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
};

export function Header({
  title,
  titleHref = "/",
  logoSrc,
  logoAlt = "Logo",
  subtitle,
  left,
  right,
}: HeaderProps) {
  return (
    <header className="sh-header">
      <div className="sh-headerMain">
        <div className="sh-titleRow">
          <div className="sh-brand">
            {logoSrc ? (
              <Link to={titleHref} aria-label="Home">
                <img className="sh-logo" src={logoSrc} alt={logoAlt} />
              </Link>
            ) : null}
            <h1 className="sh-pageTitle" style={{ margin: 0, minWidth: 0 }}>
              <Link to={titleHref} className="sh-titleLink">
                {title}
              </Link>
            </h1>
          </div>
          {right ? <div className="sh-menu">{right}</div> : null}
        </div>
        {subtitle ? <p className="sh-subtitle">{subtitle}</p> : null}
        {left ? <div style={{ marginTop: 10 }}>{left}</div> : null}
      </div>
    </header>
  );
}

