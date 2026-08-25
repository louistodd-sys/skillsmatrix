/* Skills Matrix App — marketing site
   Progressive enhancement only. Every word of content is in the HTML; this
   file adds a mobile menu, the pricing toggle, a sticky-header hairline and
   a light scroll reveal. The page is complete and readable with JS disabled. */
(function () {
  'use strict';

  var header = document.getElementById('site-header');
  var toggle = document.querySelector('.nav-toggle');

  /* ---------------------------------------------------------- mobile nav */
  if (header && toggle) {
    var closeNav = function () {
      header.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
    };

    toggle.addEventListener('click', function () {
      var open = header.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });

    // Close after choosing a destination, or on Escape.
    header.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeNav();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('is-open')) {
        closeNav();
        toggle.focus();
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) closeNav();
    });
  }

  /* ------------------------------------------------ sticky header hairline */
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ----------------------------------------------------- pricing toggle */
  // Annual = ten months' price (two months free), matching TIER_PRICING and
  // BRC_PRICING in src/lib/tierConfig.js. Keep these in step with the app.
  var PRICING = {
    starter: { monthly: 39,  annual: 390  },
    growth:  { monthly: 79,  annual: 790  },
    scale:   { monthly: 149, annual: 1490 },
    brc:     { monthly: 49,  annual: 490  }
  };

  var buttons = document.querySelectorAll('.toggle [data-interval]');
  var amounts = document.querySelectorAll('[data-price]');
  var billeds = document.querySelectorAll('[data-billed]');

  function renderPricing(interval) {
    amounts.forEach(function (el) {
      var plan = PRICING[el.getAttribute('data-price')];
      if (!plan) return;
      el.textContent = '£' + (interval === 'annual'
        ? Math.round(plan.annual / 12)
        : plan.monthly);
    });

    billeds.forEach(function (el) {
      var plan = PRICING[el.getAttribute('data-billed')];
      if (!plan) return;
      el.textContent = interval === 'annual'
        ? 'Billed £' + plan.annual + '/year + VAT'
        : 'Billed monthly.';
    });

    buttons.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-interval') === interval));
    });
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      renderPricing(b.getAttribute('data-interval'));
    });
  });

  /* ------------------------------------------------------- scroll reveal */
  var reveals = document.querySelectorAll('.section-head, .card, .pain, .step, .plan, .industry, .trust__item, .panel, .addon');
  if ('IntersectionObserver' in window &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });

    reveals.forEach(function (el, i) {
      el.classList.add('reveal');
      el.style.transitionDelay = (Math.min(i % 4, 3) * 55) + 'ms';
      io.observe(el);
    });
  }

  /* ------------------------------------------------------------- footer */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
