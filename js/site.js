(function () {
  'use strict';

  // ---------- WhatsApp e formulário ----------
  var NUM = '5516994275750';
  var HELLO = 'Olá, Prime Soldagem! Vim pelo site e quero um orçamento.';
  document.querySelectorAll('.js-wa').forEach(function (a) {
    a.href = 'https://wa.me/' + NUM + '?text=' + encodeURIComponent(HELLO);
  });

  var form = document.getElementById('quote-form');
  var send = document.getElementById('f-send');
  var consent = document.getElementById('f-lgpd');
  var err = document.getElementById('f-err');

  function val(id) {
    // limita o tamanho de cada campo; o texto só vira parte de um link, nunca é executado
    return document.getElementById(id).value.replace(/\s+/g, ' ').trim().slice(0, 600);
  }
  function missing() {
    if (!val('f-nome')) return ['f-nome', 'Preencha o seu nome.'];
    if (!val('f-cidade')) return ['f-cidade', 'Preencha a cidade do serviço.'];
    if (!val('f-servico')) return ['f-servico', 'Escolha o tipo de serviço.'];
    if (!val('f-desc')) return ['f-desc', 'Descreva o que você precisa.'];
    if (!consent.checked) return ['f-lgpd', 'Marque que concorda com a Política de Privacidade.'];
    return null;
  }
  function build() {
    var lines = ['Olá, Prime Soldagem! Quero um orçamento.'];
    lines.push('Nome: ' + val('f-nome'));
    lines.push('Cidade: ' + val('f-cidade'));
    lines.push('Serviço: ' + val('f-servico'));
    lines.push('Detalhes: ' + val('f-desc'));
    send.href = 'https://wa.me/' + NUM + '?text=' + encodeURIComponent(lines.join('\n'));
    if (!err.hidden && !missing()) err.hidden = true;
  }
  if (form) {
    form.addEventListener('input', build);
    form.addEventListener('change', build);
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    send.addEventListener('click', function (e) {
      var m = missing();
      if (m) {
        e.preventDefault();
        err.textContent = m[1];
        err.hidden = false;
        document.getElementById(m[0]).focus();
      }
    });
    build();
  }

  // ---------- Menu: marca a seção visível ----------
  var links = Array.prototype.slice.call(document.querySelectorAll('.top nav a'));
  if ('IntersectionObserver' in window && links.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + en.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (a) { var s = document.querySelector(a.getAttribute('href')); if (s) io.observe(s); });
  }

  // ---------- Animação de solda ----------
  // 1) Um cordão de solda avança na borda do menu conforme a rolagem; a ponta acende em arco azul e solta faíscas.
  // 2) A tocha da logo no topo solta faíscas de tempos em tempos.
  // 3) Os botões de orçamento soltam faíscas ao passar o mouse ou tocar.
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvas = document.getElementById('weld');
  if (!canvas || !canvas.getContext || reduce) return;
  var ctx = canvas.getContext('2d');
  var header = document.querySelector('.top');
  var logo = document.getElementById('hero-logo');
  var W = 0, H = 0, sparks = [], running = false, lastY = window.scrollY, heat = 0;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    kick();
  }
  function progress() {
    var max = document.documentElement.scrollHeight - H;
    return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  }
  function beadY() { return header ? header.getBoundingClientRect().bottom - 1 : 0; }

  function spawn(x, y, n, power, dir) {
    for (var i = 0; i < n; i++) {
      var a = (dir === undefined ? -Math.PI / 2 : dir) + (Math.random() - 0.5) * Math.PI * 1.2;
      var v = (1.5 + Math.random() * 4.5) * power;
      sparks.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, decay: 0.014 + Math.random() * 0.026, size: 0.7 + Math.random() * 1.5 });
    }
    if (sparks.length > 450) sparks.splice(0, sparks.length - 450);
    kick();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var y = beadY(), tip = progress() * W;

    if (tip > 1) {
      var g = ctx.createLinearGradient(0, 0, tip, 0);
      var cool = Math.max(0, 1 - 180 / tip), warm = Math.max(0, 1 - 50 / tip);
      g.addColorStop(0, 'rgba(160,172,188,.85)');
      g.addColorStop(cool, 'rgba(160,172,188,.85)');
      g.addColorStop(warm, 'rgba(70,160,255,1)');
      g.addColorStop(1, 'rgba(235,248,255,1)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 1.5, tip, 3);
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      for (var sx = 4; sx < tip - 6; sx += 7) ctx.fillRect(sx, y - 1.5, 1, 3);
    }

    if (heat > 0.02 && tip > 1) {
      var r = (16 * heat) * (0.6 + Math.random() * 0.4) + 4;
      var glow = ctx.createRadialGradient(tip, y, 0, tip, y, r);
      glow.addColorStop(0, 'rgba(255,255,255,' + (0.95 * heat) + ')');
      glow.addColorStop(0.35, 'rgba(110,190,255,' + (0.6 * heat) + ')');
      glow.addColorStop(1, 'rgba(31,139,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(tip, y, r, 0, Math.PI * 2); ctx.fill();
    }

    ctx.globalCompositeOperation = 'lighter';
    for (var i = sparks.length - 1; i >= 0; i--) {
      var p = sparks[i], px = p.x, py = p.y;
      p.vy += 0.15; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.life -= p.decay;
      if (p.life <= 0 || p.y > H + 20) { sparks.splice(i, 1); continue; }
      ctx.strokeStyle = p.life > 0.55 ? 'rgba(225,245,255,' + p.life + ')' : 'rgba(60,150,255,' + p.life + ')';
      ctx.lineWidth = p.size;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    heat *= 0.9;
    if (sparks.length || heat > 0.02) requestAnimationFrame(draw);
    else running = false;
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(draw); } }

  window.addEventListener('scroll', function () {
    var dy = Math.abs(window.scrollY - lastY); lastY = window.scrollY;
    heat = Math.min(1, heat + dy / 60);
    if (dy > 0) spawn(progress() * W, beadY(), Math.min(10, 1 + Math.floor(dy / 8)), 1);
    kick();
  }, { passive: true });
  window.addEventListener('resize', resize);

  // ponta da tocha na logo: ~80% da largura e ~32% da altura da imagem
  function torch() {
    if (!logo || document.hidden) return;
    var r = logo.getBoundingClientRect();
    if (r.bottom < 0 || r.top > H || r.width === 0) return;
    spawn(r.left + r.width * 0.795, r.top + r.height * 0.325, 6 + Math.floor(Math.random() * 10), 0.9, -Math.PI / 4);
  }
  setInterval(function () { if (Math.random() < 0.7) torch(); }, 450);

  document.querySelectorAll('.btn-solid, .btn-wa, .wa-float').forEach(function (b) {
    function burst(e) {
      var r = b.getBoundingClientRect();
      var x = e && e.clientX ? e.clientX : r.left + r.width / 2;
      spawn(x, r.top + 2, 16, 0.9);
    }
    b.addEventListener('pointerenter', burst);
    b.addEventListener('pointerdown', burst);
  });

  resize();
})();
