import { useState } from 'react';
import { Search } from 'lucide-react';
import { LOOKS } from '../depth/galleryData';
import { type OpenLook } from './LookDetail';

interface StaticWebsiteProps {
  onOpenLook: (look: OpenLook) => void;
  onSearch?: () => void;
}

export default function StaticWebsite({ onOpenLook, onSearch }: StaticWebsiteProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'duo' | 'boy' | 'girl'>('all');
  const [activeNav, setActiveNav] = useState<'discover' | 'collections' | 'styles' | 'about'>('discover');

  const filteredLooks = activeTab === 'all'
    ? LOOKS
    : LOOKS.filter((l) => l.id.startsWith(activeTab));

  const scrollToSection = (id: 'discover' | 'collections' | 'styles' | 'about') => {
    setActiveNav(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleLookClick = (look: typeof LOOKS[0], index: number) => {
    onOpenLook({
      src: look.image,
      index,
      hero: look.hero,
      title: look.title,
      word: look.title,
      details: look.subtitle,
      palette: look.palette,
      accent: look.accent,
      paletteColors: look.paletteColors,
    });
  };

  return (
    <div className="relative min-h-screen w-full bg-electric text-ink font-sans selection:bg-black selection:text-[#ffe500]">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-black/15 bg-electric/95 px-5 py-4 backdrop-blur-md md:px-10">
        <a
          href="#discover"
          onClick={(e) => {
            e.preventDefault();
            scrollToSection('discover');
          }}
          className="select-none font-display text-base tracking-[0.18em] md:text-lg"
        >
          <span className="inline-block -skew-x-6 font-bold">OFFMODE</span>
          <span className="align-super text-[9px] opacity-60 ml-0.5">®</span>
        </a>

        {/* Center Nav Links */}
        <nav className="hidden items-center gap-8 text-[11px] font-semibold tracking-[0.25em] uppercase md:flex">
          {(['discover', 'collections', 'styles', 'about'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => scrollToSection(key)}
              className={`relative py-1 transition-opacity hover:opacity-100 ${
                activeNav === key ? 'opacity-100 font-bold' : 'opacity-55'
              }`}
            >
              {key}
              {activeNav === key && (
                <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-black" />
              )}
            </button>
          ))}
        </nav>

        <button
          type="button"
          data-cursor
          onClick={onSearch}
          aria-label="Search the archive"
          className="group flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.3em]"
        >
          <Search size={14} strokeWidth={2.2} aria-hidden="true" />
          <span className="hidden sm:inline">Search</span>
          <span className="hidden border border-black/25 px-1.5 py-0.5 text-[9px] text-black/50 md:inline-block">
            /
          </span>
        </button>
      </header>

      {/* ────────────────────────── SECTION 1: DISCOVER ────────────────────────── */}
      <section
        id="discover"
        className="relative flex min-h-[90vh] flex-col justify-between px-6 pb-16 pt-12 md:px-14 md:pt-20"
      >
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.35em] text-black/60 mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-black" />
            <span>FW26 PERMANENT ARCHIVE</span>
            <span className="text-black/30">•</span>
            <span>SYSTEM:OFFMODE</span>
          </div>

          <h1 className="font-display text-[clamp(2.8rem,9vw,8rem)] leading-[0.88] tracking-tight uppercase -skew-x-6 drop-shadow-sm mb-6">
            WEAR YOUR <br /> MOOD.
          </h1>

          <p className="max-w-2xl font-sans text-[clamp(0.95rem,1.4vw,1.25rem)] font-medium leading-relaxed tracking-wide text-black/85 mb-8">
            OFFMODE is an experimental fashion system engineered in darkness and worn in daylight.
            13 distinct silhouettes across Duos, Boys, and Girls tailored with sculptural lines,
            cyber-utility techwear, and romantic gothic eveningwear.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => scrollToSection('collections')}
              className="rounded-full bg-black px-6 py-3 text-[11px] font-bold tracking-[0.25em] uppercase text-[#ffe500] transition-transform hover:scale-105 active:scale-95"
            >
              BROWSE COLLECTIONS (13 LOOKS)
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('styles')}
              className="rounded-full border border-black/40 px-6 py-3 text-[11px] font-bold tracking-[0.25em] uppercase text-black transition-colors hover:bg-black/10"
            >
              EXPLORE STYLE CATALOG
            </button>
          </div>
        </div>

        {/* Featured Teaser Strip */}
        <div className="mt-14 grid grid-cols-1 gap-6 border-t border-black/15 pt-8 sm:grid-cols-3">
          {LOOKS.slice(0, 3).map((look, i) => (
            <div
              key={look.id}
              onClick={() => handleLookClick(look, i)}
              className="group cursor-pointer rounded-2xl border border-black/10 bg-black/5 p-4 transition-all hover:bg-black hover:text-[#ffe500]"
            >
              <div className="relative mb-3 h-52 w-full overflow-hidden rounded-xl bg-black/10 flex items-center justify-center">
                <img
                  src={look.image}
                  alt={look.hero}
                  className="h-full w-full object-contain object-center drop-shadow-md group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <span className="font-mono text-[9px] tracking-[0.3em] uppercase opacity-60">
                {look.hero}
              </span>
              <h3
                className="font-display text-base uppercase leading-tight tracking-tight mt-1 line-clamp-1"
                style={{ color: look.accent }}
              >
                {look.title}
              </h3>
            </div>
          ))}
        </div>
      </section>

      {/* ────────────────────────── SECTION 2: COLLECTIONS ────────────────────────── */}
      <section
        id="collections"
        className="relative min-h-screen border-t border-black/15 px-6 py-16 md:px-14"
      >
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end mb-10">
          <div>
            <span className="font-mono text-[10px] tracking-[0.4em] uppercase text-black/50">
              COLLECTIONS GRID
            </span>
            <h2 className="font-display text-4xl uppercase tracking-tight -skew-x-3 md:text-6xl mt-1">
              THE 13 LOOKS
            </h2>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'all', label: 'ALL (13)' },
                { id: 'duo', label: 'DUOS (5)' },
                { id: 'boy', label: 'BOYS (5)' },
                { id: 'girl', label: 'GIRLS (3)' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-4 py-2 text-[10px] font-bold tracking-[0.2em] uppercase transition-all ${
                  activeTab === tab.id
                    ? 'bg-black text-[#ffe500]'
                    : 'border border-black/20 bg-black/5 text-black hover:bg-black/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Looks Grid with Simple Normal Scrolling */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredLooks.map((look, i) => (
            <div
              key={look.id}
              onClick={() => handleLookClick(look, i)}
              className="group cursor-pointer rounded-2xl border border-black/15 bg-black/[0.04] p-4 transition-all hover:border-black hover:bg-black hover:text-white hover:shadow-xl flex flex-col justify-between"
            >
              <div>
                {/* Look Model Image Card */}
                <div className="relative mb-4 h-72 w-full overflow-hidden rounded-xl bg-black/[0.06] flex items-center justify-center p-3">
                  <img
                    src={look.image}
                    alt={`${look.hero} - ${look.title}`}
                    className="h-full w-full object-contain object-bottom drop-shadow-md group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute top-3 left-3 rounded-md bg-black/70 px-2 py-1 text-[9px] font-mono tracking-wider text-white backdrop-blur-sm">
                    {look.hero}
                  </div>
                </div>

                {/* Style Name with matching data accent color */}
                <h3
                  className="font-display text-lg uppercase leading-tight tracking-tight -skew-x-2 mb-2 line-clamp-2"
                  style={{ color: look.accent }}
                >
                  {look.title}
                </h3>

                {/* Colour Palette Swatches */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {look.paletteColors.map((c) => (
                    <span
                      key={c.name}
                      className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-black/5 group-hover:border-white/20 group-hover:bg-white/10 px-2 py-0.5 text-[9px] font-mono"
                    >
                      <span
                        className="h-2 w-2 rounded-full border border-black/20"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span className="opacity-75">{c.name}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Hint */}
              <div className="border-t border-black/10 group-hover:border-white/15 pt-3 flex items-center justify-between text-[9px] font-mono tracking-widest uppercase opacity-60 group-hover:opacity-100">
                <span>CLICK FOR DETAILS</span>
                <span>→</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ────────────────────────── SECTION 3: STYLES ────────────────────────── */}
      <section
        id="styles"
        className="relative min-h-screen border-t border-black/15 px-6 py-16 md:px-14"
      >
        <div className="mb-10">
          <span className="font-mono text-[10px] tracking-[0.4em] uppercase text-black/50">
            STYLE CATALOG
          </span>
          <h2 className="font-display text-4xl uppercase tracking-tight -skew-x-3 md:text-6xl mt-1">
            STYLES & DRESSING
          </h2>
          <p className="mt-2 max-w-xl font-sans text-sm text-black/70">
            Every style in the OFFMODE collection features data-matched color coding and exact character dressing specifications.
          </p>
        </div>

        {/* Editorial Styles List */}
        <div className="divide-y divide-black/15 border-y border-black/15">
          {LOOKS.map((look, i) => (
            <div
              key={look.id}
              className="group py-8 transition-colors hover:bg-black/[0.03] flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between"
            >
              <div className="max-w-2xl">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-[10px] font-bold tracking-[0.3em] uppercase bg-black text-[#ffe500] px-2 py-0.5 rounded">
                    {look.hero}
                  </span>
                  <span className="font-mono text-[10px] tracking-widest text-black/50">
                    ID: {look.id.toUpperCase()}
                  </span>
                </div>

                {/* Style Name with matching data color */}
                <h3
                  className="font-display text-2xl uppercase tracking-tight -skew-x-3 mb-3 md:text-3xl"
                  style={{ color: look.accent }}
                >
                  {look.title}
                </h3>

                {/* Dressing Details */}
                <p className="font-sans text-sm leading-relaxed text-black/85 mb-4">
                  {look.subtitle}
                </p>

                {/* Palette */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] tracking-wider uppercase text-black/50 mr-1">
                    PALETTE:
                  </span>
                  {look.paletteColors.map((c) => (
                    <span
                      key={c.name}
                      className="inline-flex items-center gap-1.5 rounded-full border border-black/15 bg-black/5 px-2.5 py-1 text-[10px] font-mono font-medium"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-black/20"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span>{c.name}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Thumbnail + View Action */}
              <div className="flex items-center gap-5 shrink-0">
                <div
                  onClick={() => handleLookClick(look, i)}
                  className="h-24 w-20 overflow-hidden rounded-lg bg-black/10 p-1 cursor-pointer border border-black/15 hover:border-black transition-colors"
                >
                  <img
                    src={look.image}
                    alt={look.hero}
                    className="h-full w-full object-contain object-bottom"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleLookClick(look, i)}
                  className="rounded-full bg-black px-5 py-2.5 text-[10px] font-bold tracking-[0.2em] uppercase text-[#ffe500] hover:scale-105 active:scale-95 transition-transform"
                >
                  VIEW DETAIL
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ────────────────────────── SECTION 4: ABOUT ────────────────────────── */}
      <section
        id="about"
        className="relative min-h-[70vh] border-t border-black/15 px-6 py-20 md:px-14 bg-electric"
      >
        <div className="max-w-3xl">
          <span className="font-mono text-[10px] tracking-[0.4em] uppercase text-black/50">
            SYSTEM MANIFESTO
          </span>
          <h2 className="font-display text-4xl uppercase tracking-tight -skew-x-3 md:text-6xl mt-1 mb-6">
            ABOUT OFFMODE
          </h2>

          <p className="font-sans text-lg font-medium leading-relaxed text-black/90 mb-6">
            OFFMODE IS A MOOD SYSTEM — LOOKS BUILT IN THE DARK AND WORN IN THE LIGHT.
            WEAR YOUR MOOD, NOT THE MOMENT.
          </p>

          <p className="font-sans text-sm leading-relaxed text-black/75 mb-8">
            Created for FW26, the collection spans 13 tailored pieces exploring quiet luxury,
            y2k streetwear, cyberpunk utility, and high-fashion red carpet silhouettes.
            Each piece is cut in limited runs and archived permanently.
          </p>
        </div>

        {/* Footer info */}
        <footer className="mt-20 flex flex-col justify-between gap-4 border-t border-black/15 pt-8 font-mono text-[10px] tracking-widest uppercase text-black/50 sm:flex-row">
          <span>© 2026 OFFMODE FW26 // ALL RIGHTS RESERVED</span>
          <span>ARCHIVE // FW26</span>
        </footer>
      </section>
    </div>
  );
}
