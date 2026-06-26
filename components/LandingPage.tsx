"use client";

import { useEffect, useState, useRef } from "react";
import { useTheme } from "next-themes";

export function LandingPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const hasSyncedInitialTheme = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !hasSyncedInitialTheme.current) {
      // Sync with saily-theme localStorage if it exists
      const savedTheme = localStorage.getItem('saily-theme');
      if (savedTheme && savedTheme !== theme) {
        setTheme(savedTheme);
      }
      hasSyncedInitialTheme.current = true;
    }
  }, [mounted, setTheme, theme]);

  useEffect(() => {
    // Sync to saily-theme for landing page compatibility
    if (mounted && theme && hasSyncedInitialTheme.current) {
      const currentSailyTheme = localStorage.getItem('saily-theme');
      const newSailyTheme = theme === 'light' ? 'light' : 'dark';
      if (currentSailyTheme !== newSailyTheme) {
        localStorage.setItem('saily-theme', newSailyTheme);
      }
    }
  }, [theme, mounted]);

  // Toggle product menu
  const [productMenuOpen, setProductMenuOpen] = useState(false);

  // Handle start demo
  const handleStartDemo = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    localStorage.setItem('guestMode', 'true');
    localStorage.setItem('token', 'guest');
    document.cookie = 'guestMode=true; Path=/; SameSite=Lax';
    document.cookie = 'token=guest; Path=/; SameSite=Lax';
    window.location.href = '/en/crm/dashboard';
  };

  if (!mounted) return null;

  return (
    <>
      <style>{`
        :root {
          color-scheme: dark;
          --bg: #0b0f14;
          --panel: #111820;
          --panel-2: #16202b;
          --text: #f7fafc;
          --muted: #a8b3c2;
          --line: #293340;
          --violet: #7c3aed;
          --cyan: #22d3ee;
          --green: #22c55e;
          --amber: #f59e0b;
          --white: #ffffff;
          --shadow: 0 24px 70px rgba(0, 0, 0, .32);
        }

        .light {
          color-scheme: light;
          --bg: #f6f8fb;
          --panel: #ffffff;
          --panel-2: #eef3f8;
          --text: #111827;
          --muted: #536273;
          --line: #d8e0ea;
          --violet: #6d28d9;
          --cyan: #0891b2;
          --green: #16a34a;
          --amber: #d97706;
          --white: #ffffff;
          --shadow: 0 24px 70px rgba(15, 23, 42, .14);
        }

        .light .landing-page-body {
          background:
            radial-gradient(circle at 18% 12%, rgba(8, 145, 178, .15), transparent 30rem),
            radial-gradient(circle at 82% 4%, rgba(109, 40, 217, .12), transparent 28rem),
            linear-gradient(180deg, #f6f8fb 0%, #ffffff 48%, #eef3f8 100%);
        }

        * { box-sizing: border-box; }

        .landing-page-body {
          margin: 0;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
          line-height: 1.5;
          color: var(--text);
          background:
            radial-gradient(circle at 18% 12%, rgba(34, 211, 238, .14), transparent 30rem),
            radial-gradient(circle at 82% 4%, rgba(124, 58, 237, .18), transparent 28rem),
            linear-gradient(180deg, #0b0f14 0%, #0e141b 48%, #0b0f14 100%);
        }

        a { color: inherit; text-decoration: none; }
        img, svg { display: block; max-width: 100%; }

        .skip-link {
          position: absolute;
          left: 1rem;
          top: -4rem;
          z-index: 100;
          padding: .75rem 1rem;
          border-radius: .5rem;
          background: var(--white);
          color: #0b0f14;
          font-weight: 800;
        }

        .skip-link:focus { top: 1rem; }

        .container {
          width: min(1120px, calc(100% - 32px));
          margin: 0 auto;
        }

        .site-header {
          position: sticky;
          top: 0;
          z-index: 20;
          border-bottom: 1px solid rgba(255, 255, 255, .08);
          background: rgba(11, 15, 20, .86);
          backdrop-filter: blur(16px);
        }

        .light .site-header {
          background: rgba(255, 255, 255, .9);
          border-bottom-color: rgba(17, 24, 39, .1);
        }

        .nav {
          min-height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: .7rem;
          font-size: 1.1rem;
          font-weight: 800;
          letter-spacing: 0;
        }

        .brand-mark {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, .16);
          border-radius: 50%;
          background: #090d12;
          color: var(--white);
          font-weight: 900;
        }

        .light .brand-mark {
          background: #111827;
          border-color: rgba(17, 24, 39, .16);
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 1.4rem;
          color: var(--muted);
          font-size: .94rem;
          font-weight: 650;
        }

        .nav-actions {
          display: flex;
          align-items: center;
          gap: .7rem;
        }

        .product-menu {
          position: relative;
        }

        .product-trigger,
        .theme-toggle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: .45rem;
          min-height: 46px;
          border: 1px solid rgba(255, 255, 255, .14);
          border-radius: .55rem;
          background: rgba(255, 255, 255, .04);
          color: var(--text);
          font: inherit;
          font-weight: 800;
          cursor: pointer;
        }

        .product-trigger {
          padding: .76rem .9rem;
        }

        .theme-toggle {
          width: 46px;
          padding: 0;
        }

        .light .product-trigger,
        .light .theme-toggle {
          border-color: rgba(17, 24, 39, .14);
          background: rgba(17, 24, 39, .04);
        }

        .product-panel {
          position: absolute;
          top: calc(100% + .7rem);
          right: 0;
          width: min(330px, calc(100vw - 32px));
          padding: .55rem;
          border: 1px solid rgba(255, 255, 255, .12);
          border-radius: .7rem;
          background: rgba(17, 24, 32, .98);
          box-shadow: var(--shadow);
          opacity: 0;
          visibility: hidden;
          transform: translateY(-6px);
          transition: opacity .18s ease, transform .18s ease, visibility .18s ease;
        }

        .light .product-panel {
          background: rgba(255, 255, 255, .98);
          border-color: rgba(17, 24, 39, .12);
        }

        .product-menu.open .product-panel {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }

        .product-link {
          display: grid;
          gap: .2rem;
          padding: .8rem;
          border-radius: .55rem;
        }

        .product-link:hover,
        .product-link:focus-visible {
          background: rgba(124, 58, 237, .14);
          outline: none;
        }

        .product-link strong {
          color: var(--text);
          font-size: .95rem;
        }

        .product-link span {
          color: var(--muted);
          font-size: .82rem;
          line-height: 1.35;
        }

        .nav-links a:hover,
        .nav-links a:focus-visible { color: var(--text); }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: .55rem;
          min-height: 46px;
          padding: .82rem 1rem;
          border: 1px solid transparent;
          border-radius: .55rem;
          font-weight: 800;
          line-height: 1;
          cursor: pointer;
          transition: transform .18s ease, border-color .18s ease, background .18s ease;
        }

        .btn:hover { transform: translateY(-1px); }
        .btn:focus-visible { outline: 3px solid rgba(34, 211, 238, .5); outline-offset: 3px; }

        .btn-primary {
          background: var(--violet);
          color: var(--white);
          box-shadow: 0 14px 28px rgba(124, 58, 237, .28);
        }

        .btn-secondary {
          border-color: rgba(255, 255, 255, .16);
          background: rgba(255, 255, 255, .04);
          color: var(--white);
        }

        .light .btn-secondary {
          border-color: rgba(17, 24, 39, .16);
          background: rgba(17, 24, 39, .04);
          color: var(--text);
        }

        .hero {
          padding: 76px 0 72px;
        }

        .hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(420px, .92fr);
          gap: 42px;
          align-items: center;
        }

        .eyebrow {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: .5rem;
          padding: .42rem .7rem;
          margin: 0 0 1.1rem;
          border: 1px solid rgba(34, 211, 238, .28);
          border-radius: 999px;
          background: rgba(34, 211, 238, .08);
          color: #a7f3ff;
          font-size: .88rem;
          font-weight: 800;
        }

        .dot {
          width: .48rem;
          height: .48rem;
          border-radius: 50%;
          background: var(--green);
        }

        h1, h2, h3, p { margin-top: 0; }

        h1 {
          max-width: 780px;
          margin-bottom: 1rem;
          font-size: clamp(2.55rem, 6vw, 4.85rem);
          line-height: .98;
          letter-spacing: 0;
        }

        .hero-copy {
          max-width: 620px;
          margin-bottom: 1.7rem;
          color: var(--muted);
          font-size: clamp(1rem, 1.6vw, 1.16rem);
        }

        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: .8rem;
          margin-bottom: 1.8rem;
        }

        .trust-row {
          display: flex;
          flex-wrap: wrap;
          gap: .75rem;
          color: var(--muted);
          font-size: .92rem;
          font-weight: 700;
        }

        .trust-row span {
          padding: .35rem .62rem;
          border: 1px solid rgba(255, 255, 255, .1);
          border-radius: 999px;
          background: rgba(255, 255, 255, .035);
        }

        .product-shot {
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, .14);
          border-radius: .75rem;
          background: #070a0e;
          box-shadow: var(--shadow);
        }

        .light .product-shot,
        .light .table-shot {
          background: #ffffff;
          border-color: rgba(17, 24, 39, .12);
        }

        .shot-topbar {
          display: flex;
          align-items: center;
          gap: .45rem;
          min-height: 38px;
          padding: 0 .85rem;
          border-bottom: 1px solid rgba(255, 255, 255, .09);
          background: #0c1118;
        }

        .light .shot-topbar {
          background: #eef3f8;
          border-bottom-color: rgba(17, 24, 39, .1);
        }

        .window-dot {
          width: .58rem;
          height: .58rem;
          border-radius: 50%;
          background: #3a4654;
        }

        .shot-body {
          display: grid;
          grid-template-columns: 156px 1fr;
          min-height: 430px;
        }

        .sidebar {
          padding: 1rem .8rem;
          border-right: 1px solid rgba(255, 255, 255, .08);
          background: #090d12;
        }

        .light .sidebar {
          background: #f8fafc;
          border-right-color: rgba(17, 24, 39, .1);
        }

        .side-brand {
          display: flex;
          align-items: center;
          gap: .65rem;
          margin-bottom: 1.3rem;
          font-weight: 850;
        }

        .side-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: .75rem;
          padding: .5rem .58rem;
          margin-bottom: .25rem;
          border-radius: .45rem;
          color: #e8edf4;
          font-size: .82rem;
          font-weight: 750;
        }

        .side-item.active { background: rgba(255, 255, 255, .12); }
        .badge { color: #d7dee8; background: #232a33; padding: .08rem .4rem; border-radius: 999px; font-size: .68rem; }

        .light .side-item { color: #111827; }
        .light .side-item.active { background: rgba(17, 24, 39, .08); }
        .light .badge { color: #111827; background: #e5eaf0; }

        .app-main { padding: 1rem; }

        .searchbar {
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: .7rem;
          margin-bottom: 1.05rem;
        }

        .searchbar span:first-child {
          flex: 1;
          height: 100%;
          display: flex;
          align-items: center;
          padding: 0 .85rem;
          border: 1px solid rgba(255, 255, 255, .1);
          border-radius: .45rem;
          color: #909baa;
          background: #070a0e;
          font-size: .8rem;
        }

        .light .searchbar span:first-child {
          background: #ffffff;
          border-color: rgba(17, 24, 39, .12);
          color: #64748b;
        }

        .mini-btn {
          min-width: 76px;
          height: 40px;
          display: grid;
          place-items: center;
          border-radius: .45rem;
          background: var(--violet);
          font-size: .78rem;
          font-weight: 850;
        }

        .metrics {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: .75rem;
          margin-bottom: 1rem;
        }

        .metric {
          min-height: 86px;
          padding: .85rem;
          border: 1px solid rgba(255, 255, 255, .09);
          border-radius: .55rem;
          background: rgba(255, 255, 255, .035);
        }

        .metric strong { display: block; margin-top: .4rem; font-size: 1.45rem; }
        .metric span { color: var(--muted); font-size: .78rem; font-weight: 750; }

        .kanban {
          display: grid;
          grid-template-columns: repeat(3, minmax(120px, 1fr));
          gap: .75rem;
        }

        .lane h3 {
          margin: 0 0 .45rem;
          font-size: .78rem;
          line-height: 1.25;
        }

        .deal-card {
          min-height: 126px;
          padding: .8rem;
          margin-bottom: .65rem;
          border-radius: .55rem;
          background: #d6dae0;
          color: #1f2937;
        }

        .deal-card.purple { background: #d8cfe0; }
        .deal-card strong { display: block; margin-bottom: .6rem; font-size: .82rem; }
        .deal-card p { margin-bottom: .55rem; font-size: .76rem; font-weight: 800; }

        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: .35rem;
        }

        .chip {
          padding: .18rem .44rem;
          border-radius: 999px;
          background: #edf0ff;
          color: #4f46e5;
          font-size: .66rem;
          font-weight: 850;
        }

        .section {
          padding: 72px 0;
        }

        .section-head {
          max-width: 720px;
          margin-bottom: 2rem;
        }

        .section-head.center { margin-inline: auto; text-align: center; }

        h2 {
          margin-bottom: .7rem;
          font-size: clamp(2rem, 4vw, 3.05rem);
          line-height: 1.05;
          letter-spacing: 0;
        }

        .section-head p,
        .lead {
          color: var(--muted);
          font-size: 1.06rem;
        }

        .feature-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
        }

        .feature {
          padding: 1.1rem;
          border: 1px solid rgba(255, 255, 255, .1);
          border-radius: .65rem;
          background: rgba(255, 255, 255, .04);
        }

        .icon {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          margin-bottom: .9rem;
          border-radius: .55rem;
          background: rgba(34, 211, 238, .12);
          color: var(--cyan);
        }

        .feature h3 {
          margin-bottom: .45rem;
          font-size: 1rem;
          line-height: 1.25;
        }

        .feature p {
          margin: 0;
          color: var(--muted);
          font-size: .92rem;
        }

        .split {
          display: grid;
          grid-template-columns: .9fr 1.1fr;
          gap: 42px;
          align-items: center;
        }

        .process {
          display: grid;
          gap: .8rem;
        }

        .process-item {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: .85rem;
          padding: 1rem;
          border: 1px solid rgba(255, 255, 255, .1);
          border-radius: .65rem;
          background: rgba(255, 255, 255, .035);
        }

        .step {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(124, 58, 237, .18);
          color: #d8c8ff;
          font-weight: 900;
        }

        .process-item h3 { margin-bottom: .2rem; font-size: 1rem; }
        .process-item p { margin: 0; color: var(--muted); }

        .table-shot {
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, .12);
          border-radius: .75rem;
          background: #070a0e;
          box-shadow: var(--shadow);
        }

        .light .table-shot {
          background: #ffffff;
        }

        .light .table-title {
          border-bottom-color: rgba(17, 24, 39, .1);
        }

        .table-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, .08);
          font-weight: 850;
        }

        .table-row {
          display: grid;
          grid-template-columns: 1.2fr 1fr .8fr .8fr;
          gap: 1rem;
          padding: .9rem 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, .08);
          color: #dce4ed;
          font-size: .88rem;
          font-weight: 700;
        }

        .light .table-row {
          color: #111827;
          border-bottom-color: rgba(17, 24, 39, .1);
        }

        .table-row.header {
          color: var(--muted);
          font-size: .78rem;
          text-transform: uppercase;
        }

        .status {
          width: fit-content;
          padding: .14rem .48rem;
          border-radius: 999px;
          background: rgba(34, 197, 94, .16);
          color: #86efac;
          font-size: .78rem;
          font-weight: 850;
        }

        .report-band {
          border-top: 1px solid rgba(255, 255, 255, .1);
          border-bottom: 1px solid rgba(255, 255, 255, .1);
          background: rgba(255, 255, 255, .035);
        }

        .stat-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
        }

        .stat {
          padding: 1.2rem;
          border-radius: .65rem;
          background: #0b0f14;
          border: 1px solid rgba(255, 255, 255, .1);
        }

        .light .stat {
          background: #ffffff;
          border-color: rgba(17, 24, 39, .1);
        }

        .stat strong {
          display: block;
          margin-bottom: .25rem;
          font-size: 2rem;
          line-height: 1;
        }

        .stat span { color: var(--muted); font-size: .9rem; font-weight: 750; }

        .cta {
          padding: 72px 0 84px;
          text-align: center;
        }

        .cta-box {
          padding: clamp(2rem, 5vw, 4rem);
          border: 1px solid rgba(255, 255, 255, .12);
          border-radius: .85rem;
          background:
            linear-gradient(135deg, rgba(124, 58, 237, .22), rgba(34, 211, 238, .08)),
            #111820;
          box-shadow: var(--shadow);
        }

        .light .cta-box {
          background:
            linear-gradient(135deg, rgba(109, 40, 217, .12), rgba(8, 145, 178, .08)),
            #ffffff;
          border-color: rgba(17, 24, 39, .12);
        }

        .cta p {
          max-width: 640px;
          margin: 0 auto 1.5rem;
          color: var(--muted);
          font-size: 1.06rem;
        }

        footer {
          padding: 28px 0;
          border-top: 1px solid rgba(255, 255, 255, .09);
          color: var(--muted);
        }

        .footer-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          font-size: .92rem;
        }

        .powered-by {
          display: inline-flex;
          align-items: center;
          gap: .55rem;
          font-weight: 750;
          white-space: nowrap;
        }

        .powered-by img {
          width: 34px;
          height: 34px;
          object-fit: contain;
          border-radius: .35rem;
        }

        .whatsapp-float {
          position: fixed;
          right: 22px;
          bottom: 22px;
          z-index: 30;
          display: inline-flex;
          align-items: center;
          gap: .65rem;
        }

        .query-bubble {
          position: relative;
          padding: .62rem .82rem;
          border: 1px solid rgba(255, 255, 255, .12);
          border-radius: .65rem;
          background: rgba(17, 24, 32, .98);
          color: var(--text);
          box-shadow: 0 14px 36px rgba(0, 0, 0, .22);
          font-size: .9rem;
          font-weight: 850;
          white-space: nowrap;
        }

        .light .query-bubble {
          background: rgba(255, 255, 255, .98);
          border-color: rgba(17, 24, 39, .12);
        }

        .query-bubble::after {
          content: "";
          position: absolute;
          right: -7px;
          top: 50%;
          width: 12px;
          height: 12px;
          background: inherit;
          border-right: 1px solid rgba(255, 255, 255, .12);
          border-top: 1px solid rgba(255, 255, 255, .12);
          transform: translateY(-50%) rotate(45deg);
        }

        .light .query-bubble::after {
          border-color: rgba(17, 24, 39, .12);
        }

        .whatsapp-button {
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #25d366;
          color: #ffffff;
          box-shadow: 0 16px 34px rgba(37, 211, 102, .35);
          transition: transform .18s ease, box-shadow .18s ease;
        }

        .whatsapp-button:hover,
        .whatsapp-button:focus-visible {
          transform: translateY(-2px) scale(1.03);
          box-shadow: 0 18px 40px rgba(37, 211, 102, .45);
          outline: none;
        }

        @media (max-width: 980px) {
          .hero-grid,
          .split {
            grid-template-columns: 1fr;
          }

          .product-shot { max-width: 760px; }
          .feature-grid { grid-template-columns: repeat(2, 1fr); }
          .stat-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 720px) {
          .nav { min-height: 64px; }
          .nav-links { display: none; }
          .product-trigger span { display: none; }
          .hero { padding-top: 48px; }
          .hero-actions .btn { width: 100%; }
          .shot-body { grid-template-columns: 1fr; min-height: auto; }
          .sidebar { display: none; }
          .metrics { grid-template-columns: 1fr; }
          .kanban { grid-template-columns: 1fr; }
          .feature-grid,
          .stat-grid { grid-template-columns: 1fr; }
          .table-row { grid-template-columns: 1fr 1fr; }
          .table-row.header { display: none; }
          .footer-row { flex-direction: column; align-items: flex-start; }
          .whatsapp-float { right: 16px; bottom: 16px; }
          .query-bubble { font-size: .82rem; padding: .55rem .7rem; }
          .whatsapp-button { width: 54px; height: 54px; }
        }
      `}</style>

      <div className="landing-page-body">
        <a className="skip-link" href="#main">Skip to content</a>

        <header className="site-header">
          <div className="container nav" aria-label="Main navigation">
            <a className="brand" href="#" aria-label="Saily CRM home">
              <span className="brand-mark">S</span>
              <span>Saily CRM</span>
            </a>
            <nav className="nav-links" aria-label="Page sections">
              <a href="#features">Features</a>
              <a href="#pipeline">Pipeline</a>
              <a href="#analytics">Analytics</a>
              <a href="#contact">Contact</a>
            </nav>
            <div className="nav-actions">
              <div className={`product-menu ${productMenuOpen ? 'open' : ''}`}>
                <button
                  className="product-trigger"
                  type="button"
                  aria-expanded={productMenuOpen}
                  aria-controls="productPanel"
                  onClick={() => setProductMenuOpen(!productMenuOpen)}
                >
                  <span>Our Products</span>
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div className="product-panel" id="productPanel" role="menu" aria-label="Other Signimus products">
                  <a className="product-link" href="https://outreach-demo-neon.vercel.app/#" target="_blank" rel="noopener" role="menuitem">
                    <strong>Facebook Extension</strong>
                    <span>Automate Facebook outreach, lead engagement, and follow-up workflows.</span>
                  </a>
                  <a className="product-link" href="#" target="_blank" rel="noopener" role="menuitem">
                    <strong>TikTok Extension</strong>
                    <span>Discover prospects, manage creator outreach, and streamline TikTok engagement.</span>
                  </a>
                  <a className="product-link" href="#" target="_blank" rel="noopener" role="menuitem">
                    <strong>Instagram Extension</strong>
                    <span>Manage Instagram prospecting, messaging, and social selling activities.</span>
                  </a>
                  <a className="product-link" href="#" target="_blank" rel="noopener" role="menuitem">
                    <strong>LinkedIn Extension</strong>
                    <span>Automate LinkedIn lead generation, connection requests, and personalized messages.</span>
                  </a>
                  <a className="product-link" href="#" target="_blank" rel="noopener" role="menuitem">
                    <strong>Zenith</strong>
                    <span>A productivity-focused sales tool for smarter workflows and team execution.</span>
                  </a>
                </div>
              </div>
              <button
                className="theme-toggle"
                type="button"
                aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
                title="Toggle theme"
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              >
                <svg className={theme === 'dark' ? '' : 'hidden'} aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none">
                  <path d="M12 4V2m0 20v-2m8-8h2M2 12h2m14.4-6.4 1.4-1.4M4.2 19.8l1.4-1.4m0-12.8L4.2 4.2m15.6 15.6-1.4-1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <svg className={theme === 'light' ? '' : 'hidden'} aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none">
                  <path d="M20 15.3A8.5 8.5 0 0 1 8.7 4 8.5 8.5 0 1 0 20 15.3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <a className="btn btn-primary" href="#contact" aria-label="Book a Saily CRM demo">
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M8 5v14l11-7-11-7Z" fill="currentColor"/>
                </svg>
                Book Demo
              </a>
            </div>
          </div>
        </header>

        <main id="main">
          <section className="hero">
            <div className="container hero-grid">
              <div>
                <p className="eyebrow"><span className="dot" aria-hidden="true"></span>AI-ready sales CRM for growing teams</p>
                <h1>Manage every lead, customer, and sales activity in one secure workspace.</h1>
                <p className="hero-copy">
                  Saily CRM brings lead management, contacts, companies, opportunities, activities, campaigns, AI insights, and reports into one clean platform built for modern sales teams.
                </p>
                <div className="hero-actions">
                  <a className="btn btn-primary" href="#contact">Start Free Trial</a>
                  <a className="btn btn-secondary" href="#pipeline">View CRM Preview</a>
                </div>
                <div className="trust-row" aria-label="Product highlights">
                  <span>Multi-organization support</span>
                  <span>AI activity tracking</span>
                  <span>Secure customer data</span>
                </div>
              </div>

              <div className="product-shot" aria-label="Saily CRM dashboard preview">
                <div className="shot-topbar" aria-hidden="true">
                  <span className="window-dot"></span><span className="window-dot"></span><span className="window-dot"></span>
                </div>
                <div className="shot-body">
                  <aside className="sidebar" aria-label="Preview sidebar">
                    <div className="side-brand"><span className="brand-mark">S</span><span>Saily</span></div>
                    <div className="side-item active"><span>Dashboard</span><span className="badge">99+</span></div>
                    <div className="side-item"><span>Opportunities</span><span className="badge">24</span></div>
                    <div className="side-item"><span>Company</span><span className="badge">16</span></div>
                    <div className="side-item"><span>Products</span><span className="badge">7</span></div>
                    <div className="side-item"><span>Leads</span><span className="badge">55</span></div>
                    <div className="side-item"><span>Activities</span><span className="badge">8</span></div>
                    <div className="side-item"><span>AI Activities</span><span className="badge">8</span></div>
                  </aside>
                  <div className="app-main">
                    <div className="searchbar">
                      <span>Search customers, deals, products...</span>
                      <span className="mini-btn">Search</span>
                    </div>
                    <div className="metrics">
                      <div className="metric"><span>Expected revenue</span><strong>$125K</strong></div>
                      <div className="metric"><span>Active users</span><strong>12</strong></div>
                      <div className="metric"><span>Contacts</span><strong>346</strong></div>
                    </div>
                    <div className="kanban">
                      <div className="lane">
                        <h3>New Lead Intake</h3>
                        <div className="deal-card"><strong>New Client</strong><p>Assigned to Manas Soni</p><div className="chips"><span className="chip">$0</span><span className="chip">No close date</span></div></div>
                        <div className="deal-card"><strong>Insurance Review</strong><p>Unassigned</p><div className="chips"><span className="chip">Follow-up</span></div></div>
                      </div>
                      <div className="lane">
                        <h3>Marketing Qualified</h3>
                        <div className="deal-card purple"><strong>Hello Opportunity</strong><p>Assigned to Ashutosh</p><div className="chips"><span className="chip">30 May</span><span className="chip">$0</span></div></div>
                        <div className="deal-card"><strong>Jawahar Opportunity</strong><p>Proposal pending</p><div className="chips"><span className="chip">Qualified</span></div></div>
                      </div>
                      <div className="lane">
                        <h3>Sales Ready</h3>
                        <div className="deal-card"><strong>BlueTide Financial</strong><p>Assigned to Jennifer</p><div className="chips"><span className="chip">$125K</span><span className="chip">Won</span></div></div>
                        <div className="deal-card"><strong>Term Life Insurance</strong><p>Next meeting booked</p><div className="chips"><span className="chip">Proposal</span></div></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="section" id="features">
            <div className="container">
              <div className="section-head center">
                <h2>Everything your CRM needs to move sales forward.</h2>
                <p>Saily CRM is designed to reduce scattered work, improve follow-ups, and give every organization a clear view of its sales pipeline.</p>
              </div>
              <div className="feature-grid">
                <article className="feature">
                  <div className="icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 5h16M4 12h10M4 19h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></div>
                  <h3>Leads Management</h3>
                  <p>Store, filter, assign, and track new leads from first contact to qualified opportunity.</p>
                </article>
                <article className="feature">
                  <div className="icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></div>
                  <h3>Contacts & Companies</h3>
                  <p>Keep customer profiles, company details, owners, and relationship history organized.</p>
                </article>
                <article className="feature">
                  <div className="icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 19V5m0 14h16M8 15l3-4 3 2 5-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                  <h3>Opportunity Tracking</h3>
                  <p>Monitor every deal stage from New and Qualified to Proposal, Won, or Lost.</p>
                </article>
                <article className="feature">
                  <div className="icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 8h12M6 12h12M6 16h8M4 4h16v16H4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></div>
                  <h3>Activities Management</h3>
                  <p>Record calls, emails, meetings, follow-ups, outcomes, and next actions.</p>
                </article>
                <article className="feature">
                  <div className="icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 13l16-8v14L4 13Zm0 0v5l5-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></div>
                  <h3>Campaign Management</h3>
                  <p>Create, run, and monitor marketing campaigns connected to leads and outcomes.</p>
                </article>
                <article className="feature">
                  <div className="icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 3v3m0 12v3m9-9h-3M6 12H3m14-5-2 2M9 15l-2 2m10 0-2-2M9 9 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></div>
                  <h3>AI Activities</h3>
                  <p>Use AI to analyze lead interest, summarize activity, and highlight sales signals.</p>
                </article>
                <article className="feature">
                  <div className="icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5 19V9m7 10V5m7 14v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></div>
                  <h3>Reports & Analytics</h3>
                  <p>Measure revenue, pipeline value, sales performance, and team productivity.</p>
                </article>
                <article className="feature">
                  <div className="icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></div>
                  <h3>Multi-Organization Security</h3>
                  <p>Keep every organization's data separate, private, and safely managed.</p>
                </article>
              </div>
            </div>
          </section>

          <section className="section" id="pipeline">
            <div className="container split">
              <div>
                <div className="section-head">
                  <h2>Turn scattered sales work into a clear pipeline.</h2>
                  <p>Teams can track the entire customer journey, assign ownership, and see exactly what needs attention next.</p>
                </div>
                <div className="process">
                  <div className="process-item"><span className="step">1</span><div><h3>Capture and qualify leads</h3><p>Add new leads, assign them to team members, and qualify them with structured fields.</p></div></div>
                  <div className="process-item"><span className="step">2</span><div><h3>Move opportunities by stage</h3><p>Track status, budget, expected close dates, company ownership, and next step.</p></div></div>
                  <div className="process-item"><span className="step">3</span><div><h3>Log every activity</h3><p>Keep meetings, calls, emails, follow-ups, outcomes, and AI attached to the right customer.</p></div></div>
                </div>
              </div>
              <div className="table-shot" aria-label="Opportunity table preview">
                <div className="table-title"><span>Opportunities</span><span className="status">Live pipeline</span></div>
                <div className="table-row header"><span>Name</span><span>Assigned to</span><span>Budget</span><span>Stage</span></div>
                <div className="table-row"><span>BlueTide Financial</span><span>Jennifer</span><span>$125K</span><span className="status">Won</span></div>
                <div className="table-row"><span>Term Life Insurance</span><span>Mahul Sharma</span><span>$42K</span><span>Proposal</span></div>
                <div className="table-row"><span>Patil Opportunity</span><span>Manas Soni</span><span>$18K</span><span>Qualified</span></div>
                <div className="table-row"><span>New Client</span><span>Oscar</span><span>-</span><span>New</span></div>
                <div className="table-row"><span>Retail AI Review</span><span>Unassigned</span><span>$63K</span><span>Discovery</span></div>
              </div>
            </div>
          </section>

          <section className="section report-band" id="analytics">
            <div className="container">
              <div className="section-head center">
                <h2>Reports that help managers act faster.</h2>
                <p>Understand pipeline health, customer activity, active users, lead volume, and team performance without switching tools.</p>
              </div>
              <div className="stat-grid">
                <div className="stat"><strong>346</strong><span>Contacts managed</span></div>
                <div className="stat"><strong>55</strong><span>Leads tracked</span></div>
                <div className="stat"><strong>24</strong><span>Open opportunities</span></div>
                <div className="stat"><strong>8</strong><span>AI activity records</span></div>
              </div>
            </div>
          </section>

          <section className="cta" id="contact">
            <div className="container">
              <div className="cta-box">
                <h2>Ready to organize your customer and sales process?</h2>
                <p>Saily CRM gives your team one place to manage leads, relationships, opportunities, activity history, campaigns, AI insights, and secure organization-level data.</p>
                <a className="btn btn-primary" href="mailto:sales@example.com?subject=Saily%20CRM%20Demo%20Request">Book a Demo</a>
              </div>
            </div>
          </section>
        </main>

        <footer>
          <div className="container footer-row">
            <div className="brand"><span className="brand-mark">S</span><span>Saily CRM</span></div>
            <span className="powered-by">
              <a href="https://signimus.com/">
                Powered by Signimus 
              </a>
              <img src="https://signimus.com/wp-content/uploads/2024/08/cropped-signlogopure.png" alt="Signimus logo" width="34" height="34" loading="lazy" />
            </span>
          </div>
        </footer>
        <div className="whatsapp-float" aria-label="WhatsApp support">
          <span className="query-bubble">Any Query?</span>
          <a className="whatsapp-button" href="https://wa.me/918225998112?text=Hi%21%20I%20want%20to%20know%20about%20the%20extensions" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">
            <svg aria-hidden="true" width="31" height="31" viewBox="0 0 32 32" fill="none">
              <path fill="currentColor" d="M16.03 4.01A11.84 11.84 0 0 0 5.94 22.06L4.34 28l6.08-1.55a11.86 11.86 0 1 0 5.61-22.44Zm0 21.68c-1.85 0-3.56-.52-5.04-1.42l-.36-.22-3.61.92.96-3.52-.24-.37a9.75 9.75 0 1 1 8.29 4.61Zm5.36-7.3c-.29-.15-1.72-.85-1.99-.95-.27-.1-.46-.15-.66.15-.19.29-.76.95-.93 1.15-.17.2-.34.22-.63.07-.29-.15-1.23-.45-2.35-1.44-.87-.77-1.45-1.72-1.62-2.01-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.19-.29.29-.49.1-.2.05-.37-.02-.52-.07-.15-.66-1.59-.9-2.18-.24-.57-.48-.49-.66-.5h-.56c-.2 0-.51.07-.78.37-.27.29-1.02 1-1.02 2.43 0 1.44 1.05 2.83 1.2 3.02.15.2 2.07 3.16 5.02 4.43.7.3 1.25.48 1.68.62.71.22 1.35.19 1.86.12.57-.09 1.72-.7 1.97-1.38.24-.68.24-1.26.17-1.38-.07-.12-.27-.19-.56-.34Z"/>
            </svg>
          </a>
        </div>
      </div>
    </>
  );
}
