(function () {
  'use strict';
  var P = window.Prime || {};
  var db = P.db;
  var $ = function (id) { return document.getElementById(id); };
  var ORC = { novo: 'Recebido', enviado: 'Orçamento enviado', aprovado: 'Aprovado', recusado: 'Não aprovado' };
  var PED = { producao: 'Em produção', pronto: 'Pronto para entrega', entregue: 'Entregue' };
  var money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  if (!db) { $('off').hidden = false; return; }

  function msg(t, bad) { var m = $('msg'); m.textContent = t; m.className = 'acc-msg' + (bad ? ' bad' : ''); }
  function fmtDate(iso) { if (!iso) return ''; var p = iso.slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function authError(e) {
    var m = (e && e.message) || '';
    if (/Invalid login/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
    if (/already registered/i.test(m)) return 'Este e-mail já tem conta. Use "Entrar".';
    if (/Password should be/i.test(m)) return 'A senha precisa ter pelo menos 8 caracteres.';
    if (/rate limit/i.test(m)) return 'Muitas tentativas. Aguarde alguns minutos.';
    return 'Não foi possível concluir agora. Tente de novo.';
  }
  function busy(form, on) { form.querySelectorAll('button').forEach(function (b) { b.disabled = on; }); }
  var here = location.origin + location.pathname;

  // ---------- abas ----------
  function tab(which) {
    $('t-login').setAttribute('aria-selected', String(which === 'login'));
    $('t-signup').setAttribute('aria-selected', String(which === 'signup'));
    $('f-login').hidden = which !== 'login';
    $('f-signup').hidden = which !== 'signup';
    $('f-reset').hidden = which !== 'reset';
    msg('');
  }
  $('t-login').addEventListener('click', function () { tab('login'); });
  $('t-signup').addEventListener('click', function () { tab('signup'); });

  // ---------- entrar ----------
  $('f-login').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('l-email').value.trim(), pass = $('l-pass').value;
    if (!email || !pass) return msg('Preencha e-mail e senha.', true);
    busy(this, true); var f = this;
    db.auth.signInWithPassword({ email: email, password: pass }).then(function (r) {
      busy(f, false);
      if (r.error) return msg(authError(r.error), true);
      start(r.data.session);
    });
  });
  $('forgot').addEventListener('click', function () {
    var email = $('l-email').value.trim();
    if (!email) { msg('Digite seu e-mail acima e clique de novo em "Esqueci minha senha".', true); $('l-email').focus(); return; }
    db.auth.resetPasswordForEmail(email, { redirectTo: here }).then(function (r) {
      msg(r.error ? authError(r.error) : 'Se houver conta com esse e-mail, enviamos um link para criar uma nova senha.', !!r.error);
    });
  });

  // ---------- criar conta ----------
  $('f-signup').addEventListener('submit', function (e) {
    e.preventDefault();
    var d = { nome: $('s-nome').value.trim(), telefone: $('s-tel').value.trim(), cidade: $('s-cidade').value.trim() };
    var email = $('s-email').value.trim(), pass = $('s-pass').value;
    if (d.nome.length < 2) return msg('Preencha seu nome.', true);
    if (d.telefone.replace(/\D/g, '').length < 10) return msg('Preencha seu WhatsApp com DDD.', true);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return msg('Digite um e-mail válido.', true);
    if (pass.length < 8) return msg('A senha precisa ter pelo menos 8 caracteres.', true);
    if (!$('s-lgpd').checked) return msg('Marque que concorda com a Política de Privacidade.', true);
    busy(this, true); var f = this;
    db.auth.signUp({ email: email, password: pass, options: { data: d, emailRedirectTo: here } }).then(function (r) {
      busy(f, false);
      if (r.error) return msg(authError(r.error), true);
      if (r.data.session) return start(r.data.session);
      tab('login'); $('l-email').value = email;
      msg('Conta criada! Enviamos um link para ' + email + '. Clique nele para confirmar e depois entre aqui.');
    });
  });

  // ---------- nova senha (link do e-mail) ----------
  $('f-reset').addEventListener('submit', function (e) {
    e.preventDefault();
    var pass = $('r-pass').value;
    if (pass.length < 8) return msg('A senha precisa ter pelo menos 8 caracteres.', true);
    db.auth.updateUser({ password: pass }).then(function (r) {
      if (r.error) return msg(authError(r.error), true);
      db.auth.getSession().then(function (s) { start(s.data.session); });
    });
  });

  // ---------- área do cliente ----------
  function li(title, sub, status, cls) {
    var el = document.createElement('li');
    var a = document.createElement('div'); var t = document.createElement('strong'); t.textContent = title; var s = document.createElement('small'); s.textContent = sub;
    a.appendChild(t); a.appendChild(s);
    var p = document.createElement('span'); p.className = 'pill p-' + cls; p.textContent = status;
    el.appendChild(a); el.appendChild(p); return el;
  }
  function empty(ul, t) { ul.textContent = ''; var el = document.createElement('li'); el.className = 'acc-empty'; el.textContent = t; ul.appendChild(el); }

  function start(session) {
    if (!session) { $('auth').hidden = false; $('area').hidden = true; return; }
    $('auth').hidden = true; $('area').hidden = false;
    var uid = session.user.id;
    db.from('clientes').select('nome,telefone,cidade').eq('id', uid).maybeSingle().then(function (r) {
      var c = r.data || {};
      $('hello').textContent = 'Olá, ' + ((c.nome || '').split(' ')[0] || 'cliente');
      $('p-nome').value = c.nome || ''; $('p-tel').value = c.telefone || ''; $('p-cidade').value = c.cidade || '';
    });
    db.from('orcamentos').select('servico,data,status,valor').eq('cliente_id', uid).order('data', { ascending: false }).then(function (r) {
      var ul = $('my-orc');
      if (!r.data || !r.data.length) return empty(ul, 'Você ainda não pediu orçamento com esta conta.');
      ul.textContent = '';
      r.data.forEach(function (o) { ul.appendChild(li(o.servico, fmtDate(o.data) + (o.valor ? ' · ' + money.format(o.valor) : ''), ORC[o.status] || o.status, o.status)); });
    });
    db.from('pedidos').select('servico,prazo,status,entregue_em').eq('cliente_id', uid).order('criado_em', { ascending: false }).then(function (r) {
      var ul = $('my-ped');
      if (!r.data || !r.data.length) return empty(ul, 'Nenhum pedido ainda.');
      ul.textContent = '';
      r.data.forEach(function (p) { ul.appendChild(li(p.servico, p.status === 'entregue' ? 'Entregue em ' + fmtDate(p.entregue_em) : (p.prazo ? 'Previsão: ' + fmtDate(p.prazo) : 'Previsão a combinar'), PED[p.status] || p.status, p.status)); });
    });
  }
  $('f-perfil').addEventListener('submit', function (e) {
    e.preventDefault();
    db.auth.getSession().then(function (s) {
      if (!s.data.session) return;
      var d = { nome: $('p-nome').value.trim().slice(0, 80), telefone: $('p-tel').value.trim().slice(0, 20), cidade: $('p-cidade').value.trim().slice(0, 60) };
      if (d.nome.length < 2) { $('p-msg').textContent = 'Preencha seu nome.'; return; }
      db.from('clientes').update(d).eq('id', s.data.session.user.id).then(function (r) {
        $('p-msg').textContent = r.error ? 'Não foi possível salvar agora.' : 'Dados salvos.';
        if (!r.error) $('hello').textContent = 'Olá, ' + d.nome.split(' ')[0];
      });
    });
  });
  $('logout').addEventListener('click', function () { db.auth.signOut().then(function () { start(null); tab('login'); }); });

  db.auth.onAuthStateChange(function (ev) {
    if (ev === 'PASSWORD_RECOVERY') { $('auth').hidden = false; $('area').hidden = true; tab('reset'); }
  });
  db.auth.getSession().then(function (r) {
    if (!$('f-reset').hidden) return;
    start(r.data && r.data.session);
    if (!(r.data && r.data.session)) tab(location.hash === '#cadastro' ? 'signup' : 'login');
  });
})();
