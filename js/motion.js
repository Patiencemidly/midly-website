/* ===========================================================================
   Midly motion engine — shared across all pages. Vanilla JS, no deps.

   Drives: shrink-on-scroll nav, scroll-reveal entrance animations + staggered
   cards (via IntersectionObserver), and animated stat counters. Pairs with
   css/motion.css.

   Safety:
   - Respects prefers-reduced-motion: if the user opts out, we do nothing but
     the (instant) nav state class — no hiding, no animation.
   - Reveal targets are only hidden once we've added <html class="motion">, and
     a failsafe reveals anything still hidden shortly after load, so content
     can never get stuck invisible.
   - Above-the-fold elements are never hidden (protects LCP / no flash).
   - A page can opt out entirely by putting data-no-motion on <body> or <html>
     (still gets the nav shrink). Opt out one subtree with data-no-reveal.
   =========================================================================== */
(function () {
  "use strict";
  var doc = document;
  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 1) Shrink-on-scroll nav — a state class, safe even under reduced motion
  //    (CSS disables the transition there, so it just snaps).
  var nav = doc.querySelector("nav");
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle("scrolled", window.scrollY > 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  var noMotion =
    doc.documentElement.hasAttribute("data-no-motion") ||
    (doc.body && doc.body.hasAttribute("data-no-motion"));
  if (reduce || noMotion) return;

  doc.documentElement.classList.add("motion");

  // ---- helpers ------------------------------------------------------------
  function inViewport(el) {
    var r = el.getBoundingClientRect();
    // Treat the top 90% of the viewport as "above the fold" at load — don't
    // hide/animate those, so the first paint is complete and LCP is safe.
    return r.top < window.innerHeight * 0.9 && r.bottom > 0;
  }
  function tag(el, delay) {
    if (!el || el.hasAttribute("data-reveal")) return;
    if (el.closest("[data-no-reveal]")) return;
    if (inViewport(el)) return; // above the fold → leave visible
    el.setAttribute("data-reveal", "");
    if (delay) el.style.setProperty("--reveal-delay", delay + "ms");
  }

  // 2) Auto-tag reveal targets from the site's existing structure, so every
  //    page animates without hand-editing markup. Authors can still add
  //    data-reveal manually for finer control.
  var sections = doc.querySelectorAll("section, .section");
  for (var i = 0; i < sections.length; i++) {
    var sec = sections[i];
    if (sec.classList.contains("hero")) continue; // never hide the hero
    if (sec.closest("[data-no-reveal]")) continue;
    tag(sec.querySelector(".section-eyebrow, .section-title, h2"), 0);
    tag(sec.querySelector(".section-sub"), 90);
    // Staggered cascade across a card grid.
    var cards = sec.querySelectorAll(".card, .feature-card");
    for (var c = 0; c < cards.length; c++) tag(cards[c], 120 + c * 90);
  }

  // 3) Reveal on scroll via IntersectionObserver (+ failsafe).
  var targets = doc.querySelectorAll("[data-reveal]");
  if (!("IntersectionObserver" in window)) {
    for (var t = 0; t < targets.length; t++)
      targets[t].classList.add("is-visible");
  } else {
    var io = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    targets.forEach(function (el) {
      io.observe(el);
    });
    // Failsafe: never leave on-screen content invisible if something went
    // sideways (observer hiccup, layout shift, etc.).
    window.setTimeout(function () {
      doc
        .querySelectorAll("[data-reveal]:not(.is-visible)")
        .forEach(function (el) {
          if (el.getBoundingClientRect().top < window.innerHeight)
            el.classList.add("is-visible");
        });
    }, 3500);
  }

  // 4) Count-up for [data-count] (value read from the attribute, or parsed
  //    from the element's text). Preserves any prefix/suffix like $ or %.
  function runCount(el) {
    var raw = el.getAttribute("data-count");
    var source = raw != null && raw !== "" ? raw : el.textContent;
    var m = String(source).match(/-?[\d,]*\.?\d+/);
    if (!m) return;
    var target = parseFloat(m[0].replace(/,/g, ""));
    if (!isFinite(target)) return;
    var prefix = String(source).slice(0, m.index);
    var suffix = String(source).slice(m.index + m[0].length);
    var decimals = (m[0].split(".")[1] || "").length;
    var dur = 1400;
    var startTs = null;
    function frame(ts) {
      if (startTs === null) startTs = ts;
      var p = Math.min((ts - startTs) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = (target * eased).toFixed(decimals);
      el.textContent =
        prefix + Number(val).toLocaleString("en-US") + suffix;
      if (p < 1) requestAnimationFrame(frame);
      else
        el.textContent =
          prefix + target.toLocaleString("en-US") + suffix;
    }
    requestAnimationFrame(frame);
  }
  var counters = doc.querySelectorAll("[data-count]");
  if (counters.length) {
    if ("IntersectionObserver" in window) {
      var cio = new IntersectionObserver(
        function (entries, obs) {
          entries.forEach(function (e) {
            if (e.isIntersecting) {
              runCount(e.target);
              obs.unobserve(e.target);
            }
          });
        },
        { threshold: 0.6 }
      );
      counters.forEach(function (el) {
        cio.observe(el);
      });
    } else {
      counters.forEach(runCount);
    }
  }
})();
