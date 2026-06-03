/* ============================================================
   heal-fx.js — 회복/버프(상태 변화) 이펙트 엔진 (의존성 없음)
   ------------------------------------------------------------
   attack-fx.js 와 같은 패턴. 파티 칩(.chip)에 재생한다.

   사용법:
     const fx = HealFX.create({ chip });          // 대상 칩 1개
     fx.play('heal',   { label: '+5',  bars: [hpFillEl] });
     fx.play('action', { label: '특수액션 +1', bars: [actFillEl] });

   전체 회복(전원)은 칩마다 create→play 를 반복하면 된다.

   type 팔레트: 'heal'(초록) · 'allheal'(청록) · 'action'(파랑)
   opts:
     label : 떠오르는 텍스트(+5 등). 생략 가능
     bars  : 충전 광택을 줄 .hp-bar-fill 요소 배열. 생략 가능
     count : 입자 수(기본 8 — 은은)
   ============================================================ */
(function (global) {
  'use strict';

  const PALETTE = {
    heal:    { core: '#9fe59a', soft: '#5cbf7d', text: '#aef0a2' },
    allheal: { core: '#a9e8cb', soft: '#5cc09a', text: '#bdf0d4' },
    action:  { core: '#bcd6ff', soft: '#79a4da', text: '#c8dcff' },
  };
  const GLYPHS = ['✦', '✧', '❖', '＋'];

  function rand(a, b) { return Math.random() * (b - a) + a; }
  function irand(a, b) { return Math.floor(rand(a, b + 1)); }

  function el(cls, html) {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }

  function ensureLayer(chip) {
    chip.classList.add('heal-fx-host');
    let layer = chip.querySelector(':scope > .heal-fx-layer');
    if (!layer) { layer = el('heal-fx-layer'); chip.appendChild(layer); }
    return layer;
  }

  function spawn(parent, node, ms) {
    parent.appendChild(node);
    if (ms) setTimeout(() => node.remove(), ms);
    return node;
  }

  /* ── 충전 광택: HP/액션 바 ───────────────────────── */
  function surgeBar(fill, pal) {
    if (!fill) return;
    fill.classList.remove('heal-surge'); void fill.offsetWidth;
    fill.classList.add('heal-surge');
    setTimeout(() => fill.classList.remove('heal-surge'), 640);

    const track = fill.parentElement;
    if (!track) return;
    if (getComputedStyle(track).position === 'static') track.style.position = 'relative';
    const sheen = el('heal-bar-sheen');
    sheen.style.setProperty('--heal-core', pal.core);
    track.appendChild(sheen);
    void sheen.offsetWidth; sheen.classList.add('go');
    setTimeout(() => sheen.remove(), 640);
  }

  function runSurge(chip, layer, pal, opts) {
    layer.style.setProperty('--heal-core', pal.core);
    layer.style.setProperty('--heal-soft', pal.soft);
    layer.style.setProperty('--heal-text', pal.text);

    // 앵커: 아바타 중심 (없으면 좌측 기준)
    const av = chip.querySelector('.pav, .av, .pav img');
    const cw = chip.clientWidth || 240;
    const ch = chip.clientHeight || 70;
    let ax = cw * 0.18, ay = ch * 0.5;
    if (av && av.offsetWidth) { ax = av.offsetLeft + av.offsetWidth / 2; ay = av.offsetTop + av.offsetHeight / 2; }

    // 1) 오라 — 칩 안쪽 글로우
    const aura = el('heal-aura');
    aura.style.setProperty('--heal-soft', pal.soft);
    chip.insertBefore(aura, chip.firstChild);
    void aura.offsetWidth; aura.classList.add('go');
    setTimeout(() => aura.remove(), 700);

    // 2) 칩 살짝 들썩
    chip.classList.remove('heal-lift'); void chip.offsetWidth;
    chip.classList.add('heal-lift');
    setTimeout(() => chip.classList.remove('heal-lift'), 640);

    // 3) 빛 입자
    const count = opts.count != null ? opts.count : 8;
    for (let i = 0; i < count; i++) {
      const isGlyph = i % 3 === 0;
      const p = isGlyph
        ? el('heal-particle', GLYPHS[irand(0, GLYPHS.length - 1)])
        : el('heal-particle heal-dot');
      const x = rand(cw * 0.12, cw * 0.9);
      const y = rand(ch * 0.55, ch * 0.94);
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      const dx = rand(-16, 16);
      const dist = rand(42, 80);
      const rot = rand(-90, 90);
      p.animate([
        { opacity: 0, transform: 'translate(-50%,-50%) scale(.4) rotate(0deg)' },
        { opacity: 1, offset: .25 },
        { opacity: .85, offset: .6 },
        { opacity: 0, transform: `translate(calc(-50% + ${dx}px), calc(-50% - ${dist}px)) scale(1) rotate(${rot}deg)` }
      ], { duration: irand(520, 680), delay: i * 20, easing: 'cubic-bezier(.3,.7,.3,1)' });
      spawn(layer, p, 760);
    }

    // 4) 떠오르는 +숫자/라벨
    if (opts.label) {
      const f = el('heal-float', opts.label);
      f.style.left = ax + 'px';
      f.style.top = ay + 'px';
      f.animate([
        { opacity: 0, transform: 'translateX(-50%) translateY(6px) scale(.92)' },
        { opacity: 1, offset: .3, transform: 'translateX(-50%) translateY(-4px) scale(1)' },
        { opacity: 1, offset: .68 },
        { opacity: 0, transform: 'translateX(-50%) translateY(-28px) scale(1)' }
      ], { duration: 800, easing: 'cubic-bezier(.3,.7,.3,1)' });
      spawn(layer, f, 820);
    }

    // 5) 바 충전 광택
    (opts.bars || []).forEach((b) => surgeBar(b, pal));
  }

  function create({ chip }) {
    const layer = ensureLayer(chip);
    const ctx = { chip, layer, rand: irand, surgeBar };
    return {
      ctx,
      play(type, opts) {
        const pal = PALETTE[type] || PALETTE.heal;
        runSurge(chip, layer, pal, opts || {});
      }
    };
  }

  global.HealFX = { create, PALETTE, rand: irand };
})(window);
