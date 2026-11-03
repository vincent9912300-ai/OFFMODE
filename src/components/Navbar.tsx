import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

const LINKS = ['DISCOVER', 'COLLECTIONS', 'STYLES', 'ABOUT'] as const;

interface NavbarProps {
  ready: boolean;
  reduced: boolean;
  onSelectLink?: (link: string) => void;
}

export default function Navbar({ ready, reduced, onSelectLink }: NavbarProps) {
  const headerRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const el = headerRef.current;
    if (!el || !ready) return;
    if (reduced) {
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }
    gsap.fromTo(
      el,
      { opacity: 0, y: -14 },
      { opacity: 1, y: 0, duration: 0.9, delay: 0.9, ease: 'power3.out' },
    );
  }, [ready, reduced]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // lock body scroll while the overlay is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const handleLinkClick = (label: string) => {
    onSelectLink?.(label.toLowerCase());
    closeMenu();
  };

  return (
    <>
      <header
        ref={headerRef}
        className="fixed inset-x-0 top-0 z-40 shadow-[0_14px_40px_-18px_rgba(40,30,0,0.5)]"
        style={{ opacity: 0 }}
      >
        <nav
          className="flex items-center justify-between border-b border-black/15 px-5 pb-4 pt-5 md:px-10"
          aria-label="Main"
        >
          {/* brand */}
          <a
            href="#"
            data-cursor
            onClick={(e) => {
              e.preventDefault();
              handleLinkClick('discover');
            }}
            className="select-none font-display text-sm tracking-[0.18em] md:text-base"
          >
            <span className="inline-block -skew-x-6">OFFMODE</span>
            <span className="align-super text-[8px] opacity-60">®</span>
          </a>

          {/* center links — click navigates to static catalog sections */}
          <ul className="hidden items-center gap-10 text-[11px] font-medium tracking-[0.3em] md:flex">
            {LINKS.map((label, i) => (
              <li key={label}>
                <a
                  href="#"
                  data-cursor
                  onClick={(e) => {
                    e.preventDefault();
                    handleLinkClick(label);
                  }}
                  className="nav-link flex items-center"
                  aria-current={i === 0 ? 'page' : undefined}
                >
                  {i === 0 && <span className="nav-active-dot" aria-hidden="true" />}
                  {label}
                </a>
              </li>
            ))}
          </ul>

          {/* minimal hamburger */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-cursor
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="group flex h-9 w-10 flex-col items-end justify-center gap-[7px] p-2"
            >
              <span
                className={`menu-line ${menuOpen ? 'w-7' : 'w-7'} ${
                  menuOpen ? 'translate-y-[4.5px] rotate-45' : ''
                }`}
              />
              <span
                className={`menu-line ${menuOpen ? 'w-7 -translate-y-[4.5px] -rotate-45' : 'w-4 group-hover:w-7'}`}
              />
            </button>
          </div>
        </nav>
      </header>

      {/* fullscreen menu overlay */}
      <div
        className={`fixed inset-0 z-50 bg-ink transition-[clip-path,opacity] duration-500 ease-[cubic-bezier(0.83,0,0.17,1)] ${
          menuOpen
            ? 'pointer-events-auto opacity-100 [clip-path:inset(0_0_0%_0)]'
            : 'pointer-events-none opacity-0 [clip-path:inset(0_0_100%_0)]'
        }`}
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          data-cursor
          onClick={closeMenu}
          aria-label="Close menu"
          className="absolute right-6 top-6 z-10 flex h-10 w-10 items-center justify-center font-sans text-2xl text-electric md:right-10 md:top-7"
        >
          ✕
        </button>
        <nav
          className="flex h-full flex-col items-center justify-center gap-8"
          aria-label="Menu"
        >
          {LINKS.map((label) => (
            <a
              key={label}
              href="#"
              data-cursor
              onClick={(e) => {
                e.preventDefault();
                closeMenu();
                handleLinkClick(label);
              }}
              className="menu-overlay-link"
            >
              {label}
            </a>
          ))}

          <p className="mt-4 font-sans text-[10px] tracking-[0.5em] text-white/40">
            WEAR YOUR MOOD
          </p>
        </nav>
      </div>
    </>
  );
}
