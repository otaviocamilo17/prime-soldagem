(function () {
  'use strict';
  var SERVICOS = ['Soldagem (MIG, TIG ou eletrodo)', 'Caldeiraria', 'Estrutura metálica', 'Guarda-corpo / serralheria', 'Portão ou escada', 'Corte, dobra e montagem', 'Manutenção industrial', 'Outro'];
  var ORC_LABEL = { novo: 'Novo', enviado: 'Enviado', aprovado: 'Aprovado', recusado: 'Recusado' };
  var PED_LABEL = { producao: 'Em produção', pronto: 'Pronto', entregue: 'Entregue' };
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  var P = window.Prime || {};
  var db = P.db;
  var state = { orcs: [], peds: [], clis: [], fotos: [], cfg: {}, fOrc: '', qOrc: '', qCli: '' };
  var $ = function (id) { return document.getElementById(id); };
  var money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  var money2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function parseMoney(s) { if (!s) return null; var n = parseFloat(String(s).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; }
  function fmtInput(n) { return n ? String(n).replace('.', ',') : ''; }
  function num(v) { return v == null ? 0 : Number(v) || 0; }
  function todayISO() { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function fmtDate(iso) { if (!iso) return '–'; var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function monthKey(iso) { return iso ? String(iso).slice(0, 7) : ''; }
  var toastT;
  function toast(msg, bad) { var t = $('toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' err' : ''); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 2800); }
  function fail(r) { if (r && r.error) { toast('Não foi possível salvar: ' + (r.error.message || 'erro desconhecido'), true); return true; } return false; }

  if (!db) { $('noconfig').hidden = false; return; }

  // ---------- login ----------
  function showLogin(text) { $('app').hidden = true; $('login').hidden = false; $('l-msg').textContent = text || ''; }
  $('f-login').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('l-email').value.trim(), pass = $('l-pass').value;
    if (!email || !pass) { $('l-msg').textContent = 'Preencha e-mail e senha.'; return; }
    $('l-msg').textContent = 'Entrando…';
    db.auth.signInWithPassword({ email: email, password: pass }).then(function (r) {
      if (r.error) { $('l-msg').textContent = /Invalid login/i.test(r.error.message) ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar agora.'; return; }
      enter(r.data.session);
    });
  });
  $('logout').addEventListener('click', function () { db.auth.signOut().then(function () { showLogin(''); }); });

  function enter(session) {
    if (!session) return showLogin('');
    db.rpc('is_admin').then(function (r) {
      if (r.error || r.data !== true) { db.auth.signOut(); showLogin('Esta conta não tem acesso ao painel.'); return; }
      $('login').hidden = true; $('app').hidden = false;
      $('who').textContent = session.user.email;
      load();
    });
  }

  // ---------- navegação ----------
  var VIEWS = ['visao', 'orcamentos', 'pedidos', 'clientes', 'galeria', 'site'];
  function show(v) {
    if (VIEWS.indexOf(v) < 0) v = 'visao';
    document.querySelectorAll('section.view').forEach(function (s) { s.hidden = s.dataset.view !== v; });
    document.querySelectorAll('.tab').forEach(function (b) { if (b.dataset.view === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    try { history.replaceState(null, '', '#' + v); } catch (e) {}
  }
  document.querySelectorAll('.tab').forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.view); }); });
  show((location.hash || '').slice(1));
  $('today').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  ['o-servico', 'p-servico'].forEach(function (id) { $(id).innerHTML = SERVICOS.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join(''); });

  // ---------- dados ----------
  var loading = false;
  function load() {
    if (loading) return; loading = true;
    Promise.all([
      db.from('orcamentos').select('*').order('data', { ascending: false }).order('criado_em', { ascending: false }).limit(1000),
      db.from('pedidos').select('*').order('criado_em', { ascending: false }).limit(1000),
      db.from('clientes').select('*').order('criado_em', { ascending: false }).limit(1000),
      db.from('fotos').select('*').order('ordem').order('criado_em', { ascending: false }),
      db.from('config').select('*').eq('id', 1).maybeSingle()
    ]).then(function (rs) {
      loading = false;
      var bad = rs.filter(function (r) { return r.error; });
      if (bad.length) { toast('Erro ao carregar dados: ' + bad[0].error.message, true); }
      state.orcs = rs[0].data || []; state.peds = rs[1].data || []; state.clis = rs[2].data || [];
      state.fotos = rs[3].data || []; state.cfg = rs[4].data || {};
      renderAll(); fillCfg();
    }, function () { loading = false; toast('Sem conexão com o banco de dados.', true); });
  }
  setInterval(function () { if (!document.hidden && !$('app').hidden && !document.querySelector('dialog[open]')) load(); }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !$('app').hidden) load(); });

  // ---------- gráficos ----------
  function lastMonths(n) { var out = [], d = new Date(); for (var i = n - 1; i >= 0; i--) { var x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push({ key: x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'), label: MESES[x.getMonth()] }); } return out; }
  function niceMax(v) { if (v <= 0) return 1; var p = Math.pow(10, Math.floor(Math.log10(v))); var m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
  function barChart(el, months, series, fmt, isInt) {
    var W = 560, H = 220, L = 66, R = 8, T = 14, B = 26;
    var top = Math.max.apply(null, series.reduce(function (a, s) { return a.concat(s.values); }, [0]));
    var max = isInt ? Math.max(4, Math.ceil(top / 4) * 4) : niceMax(top);
    var iw = W - L - R, ih = H - T - B, gw = iw / months.length, n = series.length, bw = Math.min(26, (gw - 14) / n);
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">';
    for (var g = 0; g <= 4; g++) { var v = max * g / 4, y = T + ih - ih * g / 4; svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="rgba(77,150,255,' + (g ? .1 : .3) + ')"/><text x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + esc(fmt(v)) + '</text>'; }
    months.forEach(function (m, i) {
      var cx = L + gw * i + gw / 2, x0 = cx - (bw * n + 4 * (n - 1)) / 2;
      series.forEach(function (s, k) {
        var val = s.values[i], h = ih * val / max, x = x0 + k * (bw + 4), y = T + ih - h;
        svg += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) + '" rx="2" fill="' + s.color + '"><title>' + esc(m.label + ': ' + fmt(val)) + '</title></rect>';
        if (val > 0 && n === 1) svg += '<text class="val" x="' + (x + bw / 2) + '" y="' + (y - 5) + '" text-anchor="middle">' + esc(fmt(val)) + '</text>';
      });
      svg += '<text x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + m.label + '</text>';
    });
    el.innerHTML = svg + '</svg>';
  }
  function shortMoney(v) { return v >= 1000 ? 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k' : 'R$ ' + Math.round(v); }

  // ---------- render ----------
  function renderAll() { renderOverview(); renderOrcs(); renderPeds(); renderClis(); renderFotos(); renderCounts(); fillContas(); }

  function renderCounts() {
    var novos = state.orcs.filter(function (o) { return o.status === 'novo'; }).length;
    var prod = state.peds.filter(function (p) { return p.status !== 'entregue'; }).length;
    $('c-novos').textContent = novos; $('c-novos').hidden = !novos;
    $('c-prod').textContent = prod; $('c-prod').hidden = !prod;
  }

  function renderOverview() {
    var mk = monthKey(todayISO()), months = lastMonths(6);
    var orcMes = state.orcs.filter(function (o) { return monthKey(o.data) === mk; });
    $('k-orc').textContent = orcMes.length;
    $('k-orc-n').textContent = state.orcs.filter(function (o) { return o.status === 'novo'; }).length + ' aguardando resposta';
    var dec = state.orcs.filter(function (o) { return o.status === 'aprovado' || o.status === 'recusado'; });
    var apr = dec.filter(function (o) { return o.status === 'aprovado'; }).length;
    $('k-taxa').textContent = dec.length ? Math.round(apr / dec.length * 100) + '%' : '–';
    $('k-taxa-n').textContent = dec.length ? apr + ' de ' + dec.length + ' decididos' : 'sem orçamentos decididos';
    var abertos = state.peds.filter(function (p) { return p.status !== 'entregue'; });
    $('k-prod').textContent = money.format(abertos.reduce(function (s, p) { return s + num(p.valor); }, 0));
    $('k-prod-n').textContent = abertos.length + (abertos.length === 1 ? ' pedido aberto' : ' pedidos abertos');
    var entMes = state.peds.filter(function (p) { return p.status === 'entregue' && monthKey(p.entregue_em) === mk; });
    $('k-fat').textContent = money.format(entMes.reduce(function (s, p) { return s + num(p.valor); }, 0));
    $('k-fat-n').textContent = entMes.length + (entMes.length === 1 ? ' entrega no mês' : ' entregas no mês');

    barChart($('ch-orc'), months, [
      { color: '#3a4d66', values: months.map(function (m) { return state.orcs.filter(function (o) { return monthKey(o.data) === m.key; }).length; }) },
      { color: '#1f8bff', values: months.map(function (m) { return state.orcs.filter(function (o) { return monthKey(o.data) === m.key && o.status === 'aprovado'; }).length; }) }
    ], function (v) { return String(Math.round(v)); }, true);
    barChart($('ch-fat'), months, [
      { color: '#1f8bff', values: months.map(function (m) { return state.peds.filter(function (p) { return p.status === 'entregue' && monthKey(p.entregue_em) === m.key; }).reduce(function (s, p) { return s + num(p.valor); }, 0); }) }
    ], shortMoney);

    var cnt = {}; state.orcs.forEach(function (o) { cnt[o.servico] = (cnt[o.servico] || 0) + 1; });
    var rows = Object.keys(cnt).map(function (k) { return [k, cnt[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6);
    var topv = rows.length ? rows[0][1] : 1;
    var box = $('ch-svc');
    box.innerHTML = rows.length ? rows.map(function (r) { return '<div class="hbar"><span title="' + esc(r[0]) + '">' + esc(r[0]) + '</span><div class="track"><div class="fill"></div></div><span class="num">' + r[1] + '</span></div>'; }).join('') : '<div class="empty">Nenhum orçamento ainda.</div>';
    box.querySelectorAll('.fill').forEach(function (f, i) { f.style.width = (rows[i][1] / topv * 100) + '%'; });

    var prox = abertos.slice().sort(function (a, b) { return (a.prazo || '9999') < (b.prazo || '9999') ? -1 : 1; }).slice(0, 5);
    $('next').innerHTML = prox.length ? '<div class="view">' + prox.map(jobCard).join('') + '</div>' : '<div class="empty">Nenhum pedido em aberto.</div>';
    bindJobs($('next'));
  }

  function renderOrcs() {
    var q = state.qOrc.toLowerCase();
    var list = state.orcs.filter(function (o) {
      if (state.fOrc && o.status !== state.fOrc) return false;
      if (!q) return true;
      return [o.cliente, o.cidade, o.servico, o.descricao, o.telefone].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    $('t-orc').innerHTML = list.length ? list.map(function (o) {
      return '<tr data-id="' + esc(o.id) + '"><td><div class="who"><span>' + esc(o.cliente) + (o.origem === 'site' ? '<span class="origin">site</span>' : '') + '</span><small>' + esc(o.telefone || '') + '</small></div></td><td>' + esc(o.servico) + '</td><td>' + esc(o.cidade || '–') + '</td><td class="num">' + fmtDate(o.data) + '</td><td><span class="pill s-' + esc(o.status) + '">' + esc(ORC_LABEL[o.status] || o.status) + '</span></td><td class="r num">' + (o.valor ? money2.format(o.valor) : '–') + '</td></tr>';
    }).join('') : '<tr><td colspan="6"><div class="empty">' + (state.orcs.length ? 'Nenhum orçamento com esse filtro.' : 'Nenhum orçamento ainda. Os pedidos feitos no site aparecem aqui.') + '</div></td></tr>';
    $('t-orc').querySelectorAll('tr[data-id]').forEach(function (tr) { tr.addEventListener('click', function () { openOrc(tr.dataset.id); }); });
  }

  function jobCard(p) {
    var late = p.status !== 'entregue' && p.prazo && p.prazo < todayISO();
    var next = p.status === 'producao' ? ['pronto', 'Marcar pronto'] : p.status === 'pronto' ? ['entregue', 'Marcar entregue'] : null;
    return '<div class="job" data-id="' + esc(p.id) + '"><div class="row"><strong>' + esc(p.cliente) + '</strong><span class="num">' + (p.valor ? money.format(p.valor) : '') + '</span></div>' +
      '<div class="row"><span class="muted">' + esc(p.servico) + '</span><span class="due' + (late ? ' late' : '') + '">' + (p.status === 'entregue' ? 'entregue ' + fmtDate(p.entregue_em) : (p.prazo ? (late ? 'atrasado · ' : 'prazo ') + fmtDate(p.prazo) : 'sem prazo')) + '</span></div>' +
      (next ? '<div class="actions"><button class="btn sm" data-move="' + next[0] + '">' + next[1] + '</button></div>' : '') + '</div>';
  }
  function bindJobs(root) {
    root.querySelectorAll('.job').forEach(function (el) {
      el.addEventListener('click', function (e) {
        var mv = e.target.closest('[data-move]');
        if (mv) { e.stopPropagation(); movePed(el.dataset.id, mv.dataset.move); return; }
        openPed(el.dataset.id);
      });
    });
  }
  function renderPeds() {
    ['producao', 'pronto', 'entregue'].forEach(function (st) {
      var list = state.peds.filter(function (p) { return p.status === st; });
      if (st === 'entregue') list = list.slice().sort(function (a, b) { return (b.entregue_em || '') < (a.entregue_em || '') ? -1 : 1; }).slice(0, 12);
      else list = list.slice().sort(function (a, b) { return (a.prazo || '9999') < (b.prazo || '9999') ? -1 : 1; });
      $('col-' + st).innerHTML = list.length ? list.map(jobCard).join('') : '<div class="empty">Nada aqui.</div>';
      var total = state.peds.filter(function (p) { return p.status === st; }).reduce(function (s, p) { return s + num(p.valor); }, 0);
      $('sum-' + st).textContent = total ? money.format(total) : '';
      bindJobs($('col-' + st));
    });
  }

  function renderClis() {
    var q = state.qCli.toLowerCase();
    var list = state.clis.filter(function (c) { return !q || [c.nome, c.cidade, c.email, c.telefone].join(' ').toLowerCase().indexOf(q) >= 0; });
    $('t-cli').innerHTML = list.length ? list.map(function (c) {
      var no = state.orcs.filter(function (o) { return o.cliente_id === c.id; }).length;
      var np = state.peds.filter(function (p) { return p.cliente_id === c.id; }).length;
      return '<tr data-id="' + esc(c.id) + '"><td><div class="who"><span>' + esc(c.nome) + '</span><small>' + esc(c.telefone || '') + '</small></div></td><td>' + esc(c.cidade || '–') + '</td><td>' + esc(c.email || '') + '</td><td class="num">' + fmtDate(c.criado_em) + '</td><td class="r num">' + no + '</td><td class="r num">' + np + '</td></tr>';
    }).join('') : '<tr><td colspan="6"><div class="empty">' + (state.clis.length ? 'Nenhum cliente com essa busca.' : 'Nenhum cliente cadastrado ainda. O cadastro fica em "Entrar" no topo do site.') + '</div></td></tr>';
    $('t-cli').querySelectorAll('tr[data-id]').forEach(function (tr) { tr.addEventListener('click', function () { openCli(tr.dataset.id); }); });
  }
  function fillContas() {
    var opts = '<option value="">Sem conta no site</option>' + state.clis.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.nome + (c.cidade ? ' · ' + c.cidade : '')) + '</option>'; }).join('');
    ['o-conta', 'p-conta'].forEach(function (id) { var v = $(id).value; $(id).innerHTML = opts; $(id).value = v; });
  }

  function renderFotos() {
    var el = $('photos');
    if (!state.fotos.length) { el.innerHTML = '<div class="empty">Nenhuma foto ainda. Envie as fotos dos trabalhos acima.</div>'; return; }
    el.innerHTML = state.fotos.map(function (f) {
      return '<div class="photo" data-id="' + esc(f.id) + '"><img src="' + esc(P.fotoUrl(f.caminho)) + '" alt="' + esc(f.titulo || 'Foto de trabalho') + '" loading="lazy"><div class="meta">' +
        '<input value="' + esc(f.titulo || '') + '" maxlength="60" placeholder="Título da foto" aria-label="Título da foto" data-k="titulo">' +
        '<div class="row"><label class="switch"><input type="checkbox" data-k="no_site"' + (f.no_site ? ' checked' : '') + '>Mostrar no site</label>' +
        '<button class="btn danger sm" data-del>Excluir</button></div></div></div>';
    }).join('');
    el.querySelectorAll('.photo').forEach(function (card) {
      var id = card.dataset.id;
      card.querySelector('[data-k=titulo]').addEventListener('change', function () { upd('fotos', id, { titulo: this.value.trim().slice(0, 60) }, 'Título salvo'); });
      card.querySelector('[data-k=no_site]').addEventListener('change', function () { upd('fotos', id, { no_site: this.checked }, this.checked ? 'Foto vai aparecer no site' : 'Foto escondida do site'); });
      armDelete(card.querySelector('[data-del]'), function () { deleteFoto(id); });
    });
  }

  // exclusão em dois cliques
  function armDelete(btn, fn) {
    var t, old = btn.textContent;
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (btn.classList.contains('armed')) { clearTimeout(t); btn.classList.remove('armed'); btn.textContent = old; fn(); return; }
      btn.classList.add('armed'); btn.textContent = 'Confirmar exclusão';
      t = setTimeout(function () { btn.classList.remove('armed'); btn.textContent = old; }, 3500);
    });
  }

  // ---------- escrita ----------
  function upd(table, id, data, msg) {
    return db.from(table).update(data).eq('id', id).then(function (r) { if (!fail(r)) { if (msg) toast(msg); load(); } });
  }

  var editingOrc = null, editingPed = null;
  function openOrc(id, preset) {
    var o = id ? state.orcs.find(function (x) { return x.id === id; }) : null;
    var c = preset || {};
    editingOrc = o ? o.id : null;
    $('orc-title').textContent = o ? 'Orçamento · ' + o.cliente : 'Novo orçamento';
    $('o-cliente').value = o ? o.cliente : (c.nome || ''); $('o-tel').value = o ? o.telefone || '' : (c.telefone || ''); $('o-cidade').value = o ? o.cidade || '' : (c.cidade || '');
    $('o-conta').value = o ? o.cliente_id || '' : (c.id || '');
    $('o-servico').value = o && SERVICOS.indexOf(o.servico) >= 0 ? o.servico : (o ? 'Outro' : SERVICOS[0]);
    $('o-material').value = o ? o.material || '' : 'Aço carbono';
    $('o-valor').value = o ? fmtInput(o.valor) : ''; $('o-status').value = o ? o.status : 'novo';
    $('o-data').value = o ? (o.data || todayISO()) : todayISO(); $('o-desc').value = o ? o.descricao || '' : '';
    if (o && SERVICOS.indexOf(o.servico) < 0 && o.servico) $('o-desc').value = '[' + o.servico + '] ' + $('o-desc').value;
    $('orc-del').hidden = !o; $('orc-ped').hidden = !o || !!o.pedido_id;
    var tel = o && P.waDigits(o.telefone);
    $('orc-wa').hidden = !tel; if (tel) $('orc-wa').href = 'https://wa.me/' + tel;
    $('orc-err').textContent = '';
    $('dlg-orc').showModal();
  }
  function readOrc() {
    return { cliente: $('o-cliente').value.trim().slice(0, 80), telefone: $('o-tel').value.trim().slice(0, 20), cidade: $('o-cidade').value.trim().slice(0, 60),
      cliente_id: $('o-conta').value || null, servico: $('o-servico').value, material: $('o-material').value || null,
      valor: parseMoney($('o-valor').value), status: $('o-status').value, data: $('o-data').value || todayISO(), descricao: $('o-desc').value.trim().slice(0, 1200) };
  }
  $('form-orc').addEventListener('submit', function (e) {
    e.preventDefault();
    var d = readOrc();
    if (d.cliente.length < 2) { $('orc-err').textContent = 'Preencha o nome do cliente.'; $('o-cliente').focus(); return; }
    var q = editingOrc ? db.from('orcamentos').update(d).eq('id', editingOrc) : db.from('orcamentos').insert(Object.assign(d, { origem: 'painel' }));
    q.then(function (r) { if (!fail(r)) { $('dlg-orc').close(); toast('Orçamento salvo'); load(); } });
  });
  armDelete($('orc-del'), function () { db.from('orcamentos').delete().eq('id', editingOrc).then(function (r) { if (!fail(r)) { $('dlg-orc').close(); toast('Orçamento excluído'); load(); } }); });
  $('orc-ped').addEventListener('click', function () {
    var d = readOrc(), id = editingOrc;
    if (d.cliente.length < 2) { $('orc-err').textContent = 'Preencha o nome do cliente.'; return; }
    db.from('pedidos').insert({ cliente: d.cliente, telefone: d.telefone, cliente_id: d.cliente_id, servico: d.servico, valor: d.valor, status: 'producao', descricao: d.descricao, orcamento_id: id }).select('id').single()
      .then(function (r) {
        if (fail(r)) return;
        return db.from('orcamentos').update(Object.assign(d, { status: 'aprovado', pedido_id: r.data.id })).eq('id', id).then(function (r2) {
          if (fail(r2)) return;
          $('dlg-orc').close(); toast('Pedido criado em "Em produção"'); show('pedidos'); load();
        });
      });
  });

  function openPed(id) {
    var p = id ? state.peds.find(function (x) { return x.id === id; }) : null;
    editingPed = p ? p.id : null;
    $('ped-title').textContent = p ? 'Pedido · ' + p.cliente : 'Novo pedido';
    $('p-cliente').value = p ? p.cliente : ''; $('p-tel').value = p ? p.telefone || '' : ''; $('p-conta').value = p ? p.cliente_id || '' : '';
    $('p-servico').value = p && SERVICOS.indexOf(p.servico) >= 0 ? p.servico : (p ? 'Outro' : SERVICOS[0]);
    $('p-valor').value = p ? fmtInput(p.valor) : ''; $('p-prazo').value = p ? p.prazo || '' : ''; $('p-status').value = p ? p.status : 'producao';
    $('p-desc').value = p ? p.descricao || '' : '';
    $('ped-del').hidden = !p; $('ped-err').textContent = '';
    $('dlg-ped').showModal();
  }
  $('form-ped').addEventListener('submit', function (e) {
    e.preventDefault();
    var d = { cliente: $('p-cliente').value.trim().slice(0, 80), telefone: $('p-tel').value.trim().slice(0, 20), cliente_id: $('p-conta').value || null, servico: $('p-servico').value,
      valor: parseMoney($('p-valor').value), prazo: $('p-prazo').value || null, status: $('p-status').value, descricao: $('p-desc').value.trim().slice(0, 1200) };
    if (d.cliente.length < 2) { $('ped-err').textContent = 'Preencha o nome do cliente.'; $('p-cliente').focus(); return; }
    var old = editingPed && state.peds.find(function (x) { return x.id === editingPed; });
    if (d.status === 'entregue' && (!old || old.status !== 'entregue')) d.entregue_em = todayISO();
    if (d.status !== 'entregue') d.entregue_em = null;
    var q = editingPed ? db.from('pedidos').update(d).eq('id', editingPed) : db.from('pedidos').insert(d);
    q.then(function (r) { if (!fail(r)) { $('dlg-ped').close(); toast('Pedido salvo'); load(); } });
  });
  armDelete($('ped-del'), function () { db.from('pedidos').delete().eq('id', editingPed).then(function (r) { if (!fail(r)) { $('dlg-ped').close(); toast('Pedido excluído'); load(); } }); });
  function movePed(id, st) {
    var d = { status: st }; if (st === 'entregue') d.entregue_em = todayISO();
    upd('pedidos', id, d, st === 'entregue' ? 'Pedido entregue' : 'Pedido pronto para entrega');
  }

  var viewingCli = null;
  function openCli(id) {
    var c = state.clis.find(function (x) { return x.id === id; }); if (!c) return;
    viewingCli = c;
    $('cli-title').textContent = c.nome;
    var kv = [['WhatsApp', c.telefone], ['Cidade', c.cidade], ['E-mail', c.email], ['Cadastro', fmtDate(c.criado_em)], ['Aceite LGPD', fmtDate(c.aceite_lgpd_em)]];
    $('cli-kv').innerHTML = kv.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1] || '–') + '</dd>'; }).join('');
    var items = state.orcs.filter(function (o) { return o.cliente_id === id; }).map(function (o) { return { d: o.data, t: 'Orçamento · ' + o.servico, s: ORC_LABEL[o.status], c: 's-' + o.status }; })
      .concat(state.peds.filter(function (p) { return p.cliente_id === id; }).map(function (p) { return { d: (p.criado_em || '').slice(0, 10), t: 'Pedido · ' + p.servico, s: PED_LABEL[p.status], c: 's-' + p.status }; }))
      .sort(function (a, b) { return a.d < b.d ? 1 : -1; });
    $('cli-hist').innerHTML = items.length ? items.map(function (i) { return '<div><span>' + fmtDate(i.d) + ' · ' + esc(i.t) + '</span><span class="pill ' + esc(i.c) + '">' + esc(i.s) + '</span></div>'; }).join('') : '<p class="muted">Sem orçamentos ou pedidos ligados a esta conta.</p>';
    var tel = P.waDigits(c.telefone);
    $('cli-wa').hidden = !tel; if (tel) $('cli-wa').href = 'https://wa.me/' + tel;
    $('dlg-cli').showModal();
  }
  $('cli-orc').addEventListener('click', function () { $('dlg-cli').close(); openOrc(null, viewingCli); });

  document.querySelectorAll('[data-new]').forEach(function (b) { b.addEventListener('click', function () { b.dataset.new === 'orc' ? openOrc(null) : openPed(null); }); });
  document.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { b.closest('dialog').close(); }); });
  $('q-orc').addEventListener('input', function () { state.qOrc = this.value; renderOrcs(); });
  $('q-cli').addEventListener('input', function () { state.qCli = this.value; renderClis(); });
  $('f-orc').addEventListener('click', function (e) {
    var c = e.target.closest('.chip'); if (!c) return;
    state.fOrc = c.dataset.f; this.querySelectorAll('.chip').forEach(function (x) { x.setAttribute('aria-pressed', String(x === c)); }); renderOrcs();
  });

  // ---------- galeria ----------
  function uploadFiles(files) {
    var list = Array.prototype.filter.call(files, function (f) { return /^image\/(png|jpeg|webp)$/.test(f.type); });
    if (!list.length) { toast('Escolha fotos JPG, PNG ou WEBP.', true); return; }
    var done = 0; $('up-status').textContent = 'Enviando 0 de ' + list.length + '…';
    list.reduce(function (pr, f) {
      return pr.then(function () {
        if (f.size > 10 * 1024 * 1024) { toast(f.name + ': maior que 10 MB.', true); return; }
        var ext = f.type === 'image/png' ? 'png' : f.type === 'image/webp' ? 'webp' : 'jpg';
        var path = new Date().toISOString().slice(0, 10) + '/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)) + '.' + ext;
        return db.storage.from('fotos').upload(path, f, { contentType: f.type, upsert: false }).then(function (r) {
          if (r.error) { toast('Não foi possível enviar ' + f.name + '.', true); return; }
          return db.from('fotos').insert({ caminho: path, titulo: f.name.replace(/\.[^.]+$/, '').slice(0, 60), no_site: true, ordem: 0 }).then(function (r2) {
            if (!fail(r2)) { done++; $('up-status').textContent = 'Enviando ' + done + ' de ' + list.length + '…'; }
          });
        });
      });
    }, Promise.resolve()).then(function () { $('up-status').textContent = done + ' foto(s) enviada(s).'; load(); });
  }
  function deleteFoto(id) {
    var f = state.fotos.find(function (x) { return x.id === id; }); if (!f) return;
    db.from('fotos').delete().eq('id', id).then(function (r) {
      if (fail(r)) return;
      if (f.caminho && !/^img\//.test(f.caminho)) db.storage.from('fotos').remove([f.caminho]);
      toast('Foto excluída'); load();
    });
  }
  $('pick').addEventListener('change', function () { uploadFiles(this.files); this.value = ''; });
  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { if (e.dataTransfer) uploadFiles(e.dataTransfer.files); });

  // ---------- informações do site ----------
  var CFG = { 'c-wa': 'whatsapp', 'c-cidade': 'cidade', 'c-ig': 'instagram', 'c-hor': 'horario', 'c-tit': 'hero_titulo', 'c-sub': 'hero_sub', 'c-sobre': 'sobre' };
  var cfgDirty = false;
  $('cfg').addEventListener('input', function () { cfgDirty = true; $('cfg-status').textContent = 'Alterações não salvas'; });
  function fillCfg() { if (cfgDirty) return; Object.keys(CFG).forEach(function (id) { $(id).value = state.cfg[CFG[id]] || ''; }); }
  $('cfg').addEventListener('submit', function (e) {
    e.preventDefault();
    var d = { id: 1, atualizado_em: new Date().toISOString() };
    Object.keys(CFG).forEach(function (id) { d[CFG[id]] = $(id).value.trim(); });
    db.from('config').upsert(d).then(function (r) {
      if (fail(r)) return;
      cfgDirty = false; $('cfg-status').textContent = 'Salvo às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); toast('Informações salvas');
    });
  });

  // ---------- início ----------
  db.auth.getSession().then(function (r) { enter(r.data && r.data.session); });
})();
