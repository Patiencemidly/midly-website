#!/usr/bin/env python3
"""Backfill the mobile menu drawer onto pages that have a <nav> but no drawer.

The marketing site is plain HTML — no shared template — so every page that got
added after the initial mobile-menu implementation in index.html has been
missing the drawer. Pages built between then and the most recent update show
nav-links hidden on mobile (the simple fix from earlier today) but with no
hamburger to open them, so users see just the logo + Log in + Book a demo
crammed in the bar.

This script:
  1. Injects the canonical mobile-menu CSS block before the first </style>
  2. Inserts the hamburger button as the last child of <div class="nav-actions">
  3. Drops the mobile-menu drawer markup right after </nav>
  4. Adds the open/close JS at the bottom of <body>

The drawer's link list is auto-generated from each page's existing nav-links UL
so per-page nav variations (e.g. an "active" class) survive.

Idempotent — checks for `id="mobileMenu"` first and skips if it's already there.
"""
import re
import sys
from pathlib import Path

REPO = Path("/Users/patiencebabajide/midly-website")

CSS_BLOCK = """
  /* ── MOBILE MENU (backfilled by patch-mobile-nav.py) ── */
  .mobile-menu-btn {
    display: none;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 6px;
    padding: 7px 8px;
    cursor: pointer;
    color: rgba(255,255,255,0.7);
    align-items: center;
    justify-content: center;
    transition: border-color 0.2s, color 0.2s;
  }
  .mobile-menu-btn:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
  [data-theme="light"] .mobile-menu-btn {
    border-color: rgba(0,0,0,0.15);
    color: rgba(0,0,0,0.5);
  }
  [data-theme="light"] .mobile-menu-btn:hover {
    border-color: rgba(0,0,0,0.3);
    color: #0a0a0a;
  }
  .mobile-menu {
    display: none;
    position: fixed;
    top: 64px;
    left: 0; right: 0;
    bottom: 0;
    background: rgba(10,10,10,0.97);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(255,255,255,0.1);
    z-index: 99;
    flex-direction: column;
    padding: 8px 24px 20px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  .mobile-menu.open { display: flex; }
  [data-theme="light"] .mobile-menu {
    background: rgba(248,248,246,0.98);
  }
  .mobile-menu-item {
    display: flex;
    align-items: center;
    padding: 14px 0;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    color: inherit;
    text-decoration: none;
    font-size: 15px;
    font-weight: 500;
    transition: color 0.15s;
  }
  .mobile-menu-item:hover { color: #C8F041; }
  .mobile-menu-demo-btn {
    display: block;
    margin-top: 16px;
    background: #C8F041;
    color: #0A0A0A;
    font-size: 14px;
    font-weight: 700;
    padding: 12px 20px;
    border-radius: 8px;
    text-decoration: none;
    text-align: center;
    transition: background 0.15s;
  }
  .mobile-menu-demo-btn:hover { background: #b8e030; }
  @media (max-width: 900px) {
    /* Hide every nav-actions child except the hamburger so we don't
       have to touch each existing button's class. */
    .nav-actions > *:not(.mobile-menu-btn) { display: none !important; }
    .mobile-menu-btn { display: flex; }
  }
"""

# Blog posts are a different template: no .nav-actions container, a dark nav
# sitting over a light page body, and .nav-links hidden at 768px rather than
# 900px. Inheriting body's colour here would paint near-black text onto the
# dark drawer, so the drawer states its own colours.
BLOG_CSS_BLOCK = """
  /* ── MOBILE MENU (backfilled by patch-mobile-nav.py) ── */
  /* Blog posts run a dark nav over a light page body, so the drawer sets its
     own light-on-dark colours instead of inheriting body's near-black text. */
  .mobile-menu-btn {
    display: none;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 6px;
    padding: 7px 8px;
    cursor: pointer;
    color: rgba(255,255,255,0.75);
    align-items: center;
    justify-content: center;
    transition: border-color 0.2s, color 0.2s;
  }
  .mobile-menu-btn:hover { border-color: rgba(255,255,255,0.4); color: #fff; }
  .mobile-menu {
    display: none;
    position: fixed;
    top: 64px;               /* 32px logo + 16px padding top and bottom */
    left: 0; right: 0;
    bottom: 0;
    background: rgba(10,10,10,0.98);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    z-index: 99;
    flex-direction: column;
    padding: 8px 24px 20px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  .mobile-menu.open { display: flex; }
  .mobile-menu-item {
    display: flex;
    align-items: center;
    padding: 14px 0;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.85);
    text-decoration: none;
    font-size: 15px;
    font-weight: 500;
    transition: color 0.15s;
  }
  .mobile-menu-item:hover { color: #C8F041; }
  .mobile-menu-demo-btn {
    display: block;
    margin-top: 16px;
    background: #C8F041;
    color: #0A0A0A;
    font-size: 14px;
    font-weight: 700;
    padding: 12px 20px;
    border-radius: 8px;
    text-decoration: none;
    text-align: center;
    transition: background 0.15s;
  }
  .mobile-menu-demo-btn:hover { background: #b8e030; }
  /* 768px, matching the breakpoint where this template hides .nav-links —
     at 900px the links are still showing and two navs would overlap. */
  @media (max-width: 768px) {
    .mobile-menu-btn { display: flex; }
  }
"""

HAMBURGER_BTN = '''    <button class="mobile-menu-btn" id="mobileMenuBtn" aria-label="Open menu" aria-expanded="false">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
'''

JS_BLOCK = """
<script>
  // Mobile menu toggle (backfilled by patch-mobile-nav.py)
  (function() {
    var btn = document.getElementById('mobileMenuBtn');
    var menu = document.getElementById('mobileMenu');
    if (!btn || !menu) return;
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var isOpen = menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', isOpen);
      menu.setAttribute('aria-hidden', !isOpen);
    });
    document.addEventListener('click', function(e) {
      if (menu.classList.contains('open') &&
          !menu.contains(e.target) &&
          !btn.contains(e.target)) {
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        menu.setAttribute('aria-hidden', 'true');
      }
    });
  })();
</script>
"""

# Pages that don't have <nav> at all — skip them
NO_NAV_PAGES = {"og-sprint.html", "sprint.html", "tracking.html"}


def extract_nav_links(html: str) -> list[tuple[str, str]]:
    """Return [(href, label)] for the drawer.

    Preferred source is the <ul class="nav-links">. Half the blog posts use a
    second template that has no such UL and instead puts .nav-link anchors
    straight into .nav-actions, so fall back to those. Either way the
    accent-styled sign-up is left out, since the drawer appends its own CTA
    button and would otherwise show it twice.
    """
    m = re.search(r'<ul class="nav-links">(.*?)</ul>', html, re.DOTALL)
    if m:
        return re.findall(r'<a href="([^"]+)"[^>]*>([^<]+)</a>', m.group(1))

    m = re.search(r'<div class="nav-actions">(.*?)</div>', html, re.DOTALL)
    if not m:
        return []
    return [
        (href, label)
        for tag, href, label in re.findall(
            r'(<a href="([^"]+)"[^>]*>)([^<]+)</a>', m.group(1)
        )
        if "btn-accent" not in tag
    ]


def extract_nav_links_with_cta(html: str) -> list[tuple[str, str, bool]]:
    """Like extract_nav_links, but flags the link styled as the CTA.

    Blog posts carry their "Try free" inside nav-links as .nav-cta, so without
    this it would appear twice in the drawer: once as a plain row and again as
    the button the drawer always appends.
    """
    m = re.search(r'<ul class="nav-links">(.*?)</ul>', html, re.DOTALL)
    if not m:
        return []
    out = []
    for tag, href, label in re.findall(
        r'(<a href="([^"]+)"[^>]*>)([^<]+)</a>', m.group(1)
    ):
        out.append((href, label, "nav-cta" in tag))
    return out


def build_drawer(links: list[tuple[str, str]]) -> str:
    """Build the mobile-menu drawer HTML with one item per nav link plus Try free CTA."""
    items = []
    for href, label in links:
        items.append(
            f'  <a href="{href}" class="mobile-menu-item" '
            f'onclick="document.getElementById(\'mobileMenu\').classList.remove(\'open\');'
            f'document.getElementById(\'mobileMenuBtn\').setAttribute(\'aria-expanded\',\'false\');"'
            f'>{label}</a>'
        )
    # Always include the Try free CTA at the bottom so the drawer feels complete
    items.append(
        '  <a href="https://app.midly.ai/sign-up" class="mobile-menu-demo-btn">Try free</a>'
    )
    item_html = "\n".join(items)
    return f"""
<!-- MOBILE MENU DRAWER (backfilled) -->
<div class="mobile-menu" id="mobileMenu" aria-hidden="true">
{item_html}
</div>
"""


def patch_blog_post(path: Path, html: str) -> str:
    """Blog posts: no .nav-actions, so the hamburger goes straight into <nav>.

    nav is display:flex/space-between with the logo and the links UL. The
    button becomes a third child, which changes nothing above 768px because
    it is display:none there and so is out of flex layout entirely; below it,
    the UL is hidden and space-between leaves logo on the left, button right.
    """
    if "</style>" not in html:
        return "skip: no </style> to anchor CSS"
    html = html.replace("</style>", BLOG_CSS_BLOCK + "</style>", 1)

    # Hamburger as the last child of <nav>, right after the links UL.
    if "</ul>\n</nav>" not in html:
        return "skip: couldn't locate the nav's closing </ul></nav>"
    html = html.replace(
        "</ul>\n</nav>",
        "</ul>\n" + HAMBURGER_BTN.rstrip() + "\n</nav>",
        1,
    )

    links = extract_nav_links_with_cta(html)
    if not links:
        return "skip: no nav links to build a drawer from"
    items = []
    for href, label, is_cta in links:
        if is_cta:
            continue  # the drawer appends its own CTA button below
        items.append(
            f'  <a href="{href}" class="mobile-menu-item" '
            f"onclick=\"document.getElementById('mobileMenu').classList.remove('open');"
            f"document.getElementById('mobileMenuBtn').setAttribute('aria-expanded','false');\""
            f">{label}</a>"
        )
    items.append(
        '  <a href="https://app.midly.ai/sign-up" class="mobile-menu-demo-btn">Try free</a>'
    )
    drawer = (
        '\n<!-- MOBILE MENU DRAWER (backfilled) -->\n'
        '<div class="mobile-menu" id="mobileMenu" aria-hidden="true">\n'
        + "\n".join(items)
        + "\n</div>\n"
    )
    html = html.replace("</nav>", "</nav>" + drawer, 1)

    if "</body>" not in html:
        return "skip: no </body> to anchor JS"
    html = html.replace("</body>", JS_BLOCK + "</body>", 1)

    path.write_text(html)
    return "patched (blog post)"


def patch_file(path: Path) -> str:
    html = path.read_text()

    if 'id="mobileMenu"' in html:
        return "skip: already has drawer"

    if path.name in NO_NAV_PAGES:
        return "skip: page has no nav"

    if "<nav>" not in html:
        return "skip: no <nav> found"

    # Blog posts come in two templates. One has a nav-links UL and no
    # nav-actions, and needs its own colours; the other is the ordinary
    # token-based nav and goes down the normal path below.
    if path.parent.name == "blog" and 'class="nav-actions"' not in html:
        return patch_blog_post(path, html)

    if 'class="nav-actions"' not in html:
        return "skip: no nav-actions container"

    # 1. Inject CSS before the FIRST </style> closing tag
    if "</style>" not in html:
        return "skip: no </style> to anchor CSS"
    html = html.replace("</style>", CSS_BLOCK + "  </style>", 1)

    # 2. Insert hamburger button as last child of nav-actions.
    # Find the FIRST <div class="nav-actions"> ... </div> block and inject
    # the button right before its closing </div>. We do this with a tolerant
    # regex that captures up to the matching </div> assuming nav-actions
    # doesn't contain nested <div>s (true for every page on the marketing
    # site).
    pattern = re.compile(
        r'(<div class="nav-actions">[\s\S]*?)(\n\s*</div>\s*</nav>)',
        re.MULTILINE,
    )
    if not pattern.search(html):
        return "skip: couldn't locate nav-actions closing"
    html = pattern.sub(r"\1\n" + HAMBURGER_BTN.rstrip() + r"\2", html, count=1)

    # 3. Drop the drawer markup right after </nav>
    links = extract_nav_links(html)
    drawer = build_drawer(links)
    html = html.replace("</nav>", "</nav>" + drawer, 1)

    # 4. Add JS block before </body>
    if "</body>" not in html:
        return "skip: no </body> to anchor JS"
    html = html.replace("</body>", JS_BLOCK + "</body>", 1)

    path.write_text(html)
    return "patched"


def main():
    targets = sorted(
        p
        for p in list(REPO.glob("*.html")) + list(REPO.glob("blog/*.html"))
        if p.name not in NO_NAV_PAGES
    )
    results = []
    for p in targets:
        result = patch_file(p)
        results.append((p.name, result))

    width = max(len(name) for name, _ in results)
    for name, result in results:
        print(f"  {name.ljust(width)}  {result}")

    patched = sum(1 for _, r in results if r.startswith("patched"))
    skipped = len(results) - patched
    print(f"\n{patched} patched, {skipped} skipped (already had drawer or N/A)")


if __name__ == "__main__":
    main()
