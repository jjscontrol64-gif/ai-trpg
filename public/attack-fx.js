/* ============================================================
   attack-fx.js — 전투 공격 이펙트 엔진 (의존성 없음)
   ------------------------------------------------------------
   사용법:
     const fx = AttackFX.create({ arena, target, fxLayer });
     fx.play('slash', { damage: 8, crit: true, color:'#ffe9bd',
                        onImpact: (o)=> applyDamage(o.damage) });

   새 이펙트 추가 (확장):
     AttackFX.register('myskill', (ctx, opts) => {
        // ...연출 DOM 생성...
        ctx.impact(opts, 200);   // 200ms 뒤 타격 처리(데미지/플래시/숫자)
     });

   ctx 헬퍼:
     ctx.fxLayer / ctx.target / ctx.arena
     ctx.el(className, html?)        → 요소 생성
     ctx.spawn(el, ms)              → fxLayer에 추가 후 ms 뒤 제거
     ctx.run(el)                    → 다음 프레임에 .go 클래스 부여(애니 트리거)
     ctx.flash(dark?) / ctx.shake(hard?)
     ctx.hitTarget(crit)
     ctx.damageNumber(amount, crit, color)
     ctx.statusText(text, color)    → 상태 텍스트 플로팅(속박 등)
     ctx.bound(on)                  → 타겟 지속 상태 토글
     ctx.impact(opts, delay)        → delay 후 hitTarget+damageNumber+onImpact
     ctx.rand(a,b)
   ============================================================ */
(function (global) {
  'use strict';

  const registry = {};

  function register(name, fn) { registry[name] = fn; }

  function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

  function create({ arena, target, fxLayer }) {
    const ctx = {
      arena, target, fxLayer, rand,

      el(className, html) {
        const d = document.createElement('div');
        if (className) d.className = className;
        if (html != null) d.innerHTML = html;
        return d;
      },

      spawn(el, ms) {
        fxLayer.appendChild(el);
        if (ms) setTimeout(() => el.remove(), ms);
        return el;
      },

      run(el) { void el.offsetWidth; el.classList.add('go'); return el; },

      flash(dark) {
        const cls = dark ? 'fx-flash-dark' : 'fx-flash';
        arena.classList.remove(cls); void arena.offsetWidth; arena.classList.add(cls);
        setTimeout(() => arena.classList.remove(cls), 320);
      },

      shake(hard) {
        const cls = hard ? 'fx-shake-hard' : 'fx-shake';
        arena.classList.remove(cls); void arena.offsetWidth; arena.classList.add(cls);
        setTimeout(() => arena.classList.remove(cls), 520);
      },

      hitTarget(crit) {
        target.classList.remove('fx-hit'); void target.offsetWidth; target.classList.add('fx-hit');
        this.flash(crit && false);
        setTimeout(() => target.classList.remove('fx-hit'), 430);
      },

      damageNumber(amount, crit, color) {
        const d = this.el('fx-dmg', (crit ? '치명! ' : '') + amount);
        d.style.color = crit ? '#ffd98a' : (color || '#fff');
        d.style.fontSize = crit ? '2.1rem' : '1.5rem';
        d.style.left = (48 + rand(-6, 6)) + '%';
        d.style.top = '34%';
        this.spawn(d, 1000);
      },

      statusText(text, color) {
        const d = this.el('fx-status', text);
        if (color) d.style.color = color;
        d.style.left = '48%';
        d.style.top = '26%';
        this.spawn(d, 1300);
      },

      bound(on) { target.classList.toggle('fx-bound', !!on); },

      impact(opts, delay) {
        setTimeout(() => {
          this.hitTarget(opts.crit);
          if (typeof opts.damage === 'number') this.damageNumber(opts.damage, opts.crit, opts.color);
          if (typeof opts.onImpact === 'function') opts.onImpact(opts);
        }, delay || 0);
      }
    };

    return {
      ctx,
      play(name, opts) {
        const fn = registry[name];
        if (!fn) { console.warn('[AttackFX] 등록되지 않은 이펙트:', name); return; }
        return fn(ctx, opts || {});
      },
      has(name) { return !!registry[name]; },
      list() { return Object.keys(registry); }
    };
  }

  /* ===== 기본 이펙트 (직업 기본 공격) ============================ */

  register('slash', (ctx, opts) => {        // 전사 기본 · 베기
    const s = ctx.el('fx-slash', '<i></i><i></i>');
    ctx.spawn(s, 500); ctx.run(s);
    ctx.impact(opts, 200);
  });

  register('stab', (ctx, opts) => {         // 도적 기본 · 찌르기
    const s = ctx.el('fx-stab', '<i></i><i></i><i></i>');
    const sp = ctx.el('fx-stab-spark');
    ctx.spawn(s, 700); ctx.spawn(sp, 700);
    ctx.run(s); ctx.run(sp);
    ctx.impact(opts, 220);
  });

  register('magic', (ctx, opts) => {        // 마법사 기본 · 비전 폭발
    const ring = ctx.el('fx-ring'), burst = ctx.el('fx-burst');
    ctx.spawn(ring, 900); ctx.spawn(burst, 900);
    ctx.run(ring); ctx.run(burst);
    const RUNES = ['✦', '✧', '❖', '◆', '✶', '⟡'];
    for (let k = 0; k < 7; k++) {
      const r = ctx.el('fx-rune', RUNES[rand(0, RUNES.length - 1)]);
      const ang = Math.random() * Math.PI * 2, dist = rand(60, 120);
      const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
      r.animate([
        { opacity: 0, transform: 'translate(-50%,-50%) scale(.3)' },
        { opacity: 1, offset: .3 },
        { opacity: 0, transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(1.1) rotate(${rand(-120, 120)}deg)` }
      ], { duration: 700, delay: 200 + k * 20, easing: 'ease-out' });
      ctx.spawn(r, 1000);
    }
    ctx.impact(opts, 320);
  });

  /* ===== 스킬 이펙트 ============================================ */

  register('smash', (ctx, opts) => {        // 전사 스킬 · 강타 (내려찍기 + 충격파)
    const streak = ctx.el('fx-smash-streak');
    ctx.spawn(streak, 400); ctx.run(streak);
    setTimeout(() => {
      const shock = ctx.el('fx-smash-shock');
      ctx.spawn(shock, 600); ctx.run(shock);
      for (let i = 0; i < 6; i++) {
        const c = ctx.el('fx-smash-crack');
        c.style.setProperty('--a', (i * 60 + rand(-12, 12)) + 'deg');
        ctx.spawn(c, 600); ctx.run(c);
      }
    }, 150);
    ctx.shake(true);                         // 강타는 강한 흔들림
    ctx.impact(opts, 200);
  });

  register('ambush', (ctx, opts) => {       // 도적 스킬 · 암습 (암전 + 교차 베기)
    const veil = ctx.el('fx-ambush-veil');
    ctx.spawn(veil, 800); ctx.run(veil);
    const angles = [-30, 25, -65, 60];
    angles.forEach((a, i) => {
      setTimeout(() => {
        const cut = ctx.el('fx-ambush-cut');
        cut.style.setProperty('--a', a + 'deg');
        ctx.spawn(cut, 350); ctx.run(cut);
      }, 180 + i * 70);
    });
    setTimeout(() => {
      const burst = ctx.el('fx-ambush-burst');
      ctx.spawn(burst, 500); ctx.run(burst);
      const mark = ctx.el('fx-ambush-mark', '✦ 약점 적중');
      ctx.spawn(mark, 1000); ctx.run(mark);
    }, 460);
    ctx.flash(true);                          // 어두운 보랏빛 플래시
    // 암습은 치명타 연출이 핵심 → 강제 crit 표기 가능
    ctx.impact(opts, 520);
  });

  register('bind', (ctx, opts) => {         // 마법사 스킬 · 속박 (사슬 + 마법진 조임)
    const r1 = ctx.el('fx-bind-ring'), r2 = ctx.el('fx-bind-ring');
    ctx.spawn(r1, 1100); ctx.spawn(r2, 1200);
    ctx.run(r1); ctx.run(r2);
    for (let i = 0; i < 8; i++) {
      const ch = ctx.el('fx-bind-chain', '⛓');
      ch.style.setProperty('--a', (i * 45) + 'deg');
      ctx.spawn(ch, 900);
      setTimeout(() => ctx.run(ch), 120 + i * 20);
    }
    const lock = ctx.el('fx-bind-lock', '🔒');
    ctx.spawn(lock, 1100); ctx.run(lock);
    // 속박은 지속 상태 부여 (데미지는 적거나 0일 수 있음)
    setTimeout(() => {
      ctx.bound(true);
      ctx.statusText('🔗 속박 ' + (opts.turns || 2) + '턴', '#bcd6ff');
      if (typeof opts.onApply === 'function') opts.onApply(opts);
    }, 520);
    ctx.impact(opts, 480);
  });

  global.AttackFX = { create, register, rand };
})(window);
