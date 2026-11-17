/* 中药学 · 练习模块（默写 / 选择题） */
(function () {
  'use strict';
  var Z = window.ZY, UI = window.ZY_UI;
  var esc = Z.esc, icon = UI.icon;

  var MAX_DRAFTS = 5;   // 最多同时保留的未完成练习份数

  var FIELD_DEF = [
    { k: 'nature', name: '药性', short: '药性', rows: 2, ph: '默写药性（四气五味、归经）…' },
    { k: 'effects', name: '功效', short: '功效', rows: 2, ph: '默写功效，可用「，」分隔…' },
    { k: 'apps', name: '应用', short: '应用', rows: 5, ph: '默写主治证候与要点…' }
  ];

  var st = {
    mode: 'mo',
    fields: ['nature', 'effects', 'apps'],
    sel: {},
    includeAttach: true,
    order: 'random',
    setupOpen: {}
  };
  var run = null;   // 当前运行态（从草稿恢复）

  /* ---------------- 可用性判断 ---------------- */
  function fieldHas(v, f) {
    if (f === 'nature') return !!v.nature;
    if (f === 'effects') return !!(v.effects && v.effects.length);
    if (f === 'apps') return !!(v.apps && v.apps.length);
    return false;
  }
  function drugOk(d, fields) {
    var v = Z.view(d);
    if (d.kind === 'attach') return !!v.raw;      // 附药以整段原文为默写内容
    return fields.some(function (f) { return fieldHas(v, f); });
  }
  function chapterDrugList(c, includeAttach) {
    var out = [];
    (c.sections || []).forEach(function (s) {
      (s.drugs || []).forEach(function (name) {
        var d = Z.drugs.filter(function (x) { return x.kind === 'main' && x.name === name; })[0];
        if (!d) return;
        out.push(d);
        if (includeAttach) (d.children || []).forEach(function (cid) { if (Z.byId[cid]) out.push(Z.byId[cid]); });
      });
    });
    return out;
  }
  function allDrugList() {
    var out = [];
    Z.chapters.forEach(function (c) { out = out.concat(chapterDrugList(c, st.includeAttach)); });
    return out;
  }

  function selCount() { return Object.keys(st.sel).length; }
  function selectAll(on) {
    st.sel = {};
    if (on) allDrugList().forEach(function (d) { st.sel[d.id] = 1; });
  }

  /* ---------------- 练习首页 ---------------- */
  function renderHome(main) {
    UI.header({
      title: '练习',
      sub: '默写 · 选择题',
      actions: [{ icon: 'list', label: '目录', onClick: function () { UI.go('#/catalog'); } }]
    });
    var drafts = (Z.store.drafts || []).slice().sort(function (a, b) {
      return (b.createdAt || b.ts || 0) - (a.createdAt || a.ts || 0);
    });
    var h = [];
    h.push('<div class="card" style="padding:12px 14px;background:#f0f7ef;border-color:#cfe3d2">' +
      '<div class="small" style="color:#2b6b43;line-height:1.7">练习不记成绩，只帮你把药背下来。中途退出会自动保存，可同时保留多份练习记录（最多 5 份），随时接着练。</div></div>');
    h.push('<div class="grid2">' +
      tile('mo', '默写练习', '看药名，默写药性 / 功效 / 应用') +
      tile('tc', '选择题练习', '按比例生成选项，选出正确内容') +
      '</div>');
    if (drafts.length) {
      h.push('<div class="card mt10" style="padding:12px 13px 4px"><div class="sec-label">未完成的练习（' + drafts.length + '）</div>');
      drafts.forEach(function (rec) {
        var total = Z.practiceTotal(rec);
        var done = Z.practiceDone(rec);
        h.push('<div class="li" style="padding:10px 0;border-bottom:1px solid var(--line)">' +
          '<div class="li-t"><div class="t">' + (rec.mode === 'mo' ? '默写练习' : '选择题练习') + '</div>' +
          '<div class="s">已答 ' + done + ' / ' + total + ' 题 · ' + Z.nowText(rec.ts || rec.createdAt) + '</div></div>' +
          '<button class="btn xs" data-rdel="' + rec.id + '">丢弃</button>' +
          '<button class="btn xs primary" data-resume="' + rec.id + '">继续</button></div>');
      });
      h.push('</div>');
    }
    h.push('<div class="card mt10"><div class="sec-label">练习范围说明</div>' +
      '<div class="small muted">范围可以精确到每一味药，也可以整章/整节勾选；内容可选药性、功效、应用。默认<b>不预选</b>，自己勾选后开始。</div></div>');
    main.innerHTML = h.join('');
    UI.bind(main, '[data-mode]', function (el) { UI.go('#/practice/setup?mode=' + el.getAttribute('data-mode')); });
    UI.bind(main, '[data-resume]', function (el) {
      var id = el.getAttribute('data-resume');
      var rec = (Z.store.drafts || []).filter(function (x) { return x.id === id; })[0];
      if (!rec) { UI.toast('记录不存在'); return; }
      run = rec;
      UI.go('#/practice/run?id=' + id);
    });
    UI.bind(main, '[data-rdel]', function (el) {
      var id = el.getAttribute('data-rdel');
      UI.confirmDialog('丢弃练习', '将删除这份未完成的练习记录，确定吗？', '丢弃', '取消').then(function (ok) {
        if (!ok) return;
        Z.store.drafts = (Z.store.drafts || []).filter(function (x) { return x.id !== id; });
        if (run && run.id === id) run = null;
        Z.save(true);
        UI.toast('已丢弃'); renderHome(main);
      });
    });
  }
  function tile(mode, t, s) {
    return '<div class="tile" data-mode="' + mode + '"><div class="tt">' + t + '</div><div class="ts">' + s +
      '</div><div class="ti">' + (mode === 'mo' ? '✎' : '☑') + '</div></div>';
  }

  /* ---------------- 练习设置 ---------------- */
  function renderSetup(main, p, q) {
    st.mode = (q.mode === 'tc') ? 'tc' : 'mo';
    // 默认不预选：由用户自己勾选范围（「清空」也才能真正清空）
    UI.header({ title: '练习设置', sub: st.mode === 'tc' ? '选择题' : '默写', back: true });

    var h = [];
    h.push('<div class="card"><div class="sec-label">练习形式</div><div class="seg" id="seg-mode">' +
      '<button data-m="mo" class="' + (st.mode === 'mo' ? 'on' : '') + '">默写</button>' +
      '<button data-m="tc" class="' + (st.mode === 'tc' ? 'on' : '') + '">选择题</button></div></div>');

    h.push('<div class="card"><div class="sec-label">练习内容</div><div class="tag-row" id="fld-row">' +
      FIELD_DEF.map(function (f) {
        var on = st.fields.indexOf(f.k) >= 0;
        return '<button class="chip' + (on ? ' on' : '') + '" data-fld="' + f.k + '" style="height:32px;padding:0 14px;font-size:14px">' +
          (on ? '✓ ' : '') + f.name + '</button>';
      }).join('') + '</div>' +
      '<div class="tiny dim mt6">药性 / 功效 / 应用，至少选一项；附药以整段原文参与默写，选择题只出主药</div></div>');

    h.push('<div class="card"><div class="row between mb6"><div class="sec-label" style="margin:0">药物范围</div>' +
      '<div class="small dim">已选 <b id="sel-n">' + selCount() + '</b> 味</div></div>' +
      '<div class="row wrap" style="gap:8px;margin-bottom:10px">' +
      '<button class="btn xs" id="sel-all">全部主药</button>' +
      '<button class="btn xs" id="sel-all2">全部（含附药）</button>' +
      '<button class="btn xs" id="sel-none">清空</button>' +
      '<label class="ck small" style="margin-left:auto"><input type="checkbox" id="inc-attach"' + (st.includeAttach ? ' checked' : '') + '>含附药</label>' +
      '</div>');
    Z.chapters.forEach(function (c, ci) {
      var list = chapterDrugList(c, st.includeAttach);
      var n = list.filter(function (d) { return st.sel[d.id]; }).length;
      var open = !!st.setupOpen[ci];
      h.push('<div class="chap' + (open ? ' open' : '') + '" data-chap="' + ci + '">' +
        '<div class="chap-hd"><label class="ck" style="margin-left:2px"><input type="checkbox" data-chk="' + ci + '"' +
        (n === list.length && list.length ? ' checked' : '') + '></label>' +
        '<span class="cn">' + esc(c.no) + '　' + esc(c.name) + '</span>' +
        '<span class="chip gray tiny">' + n + '/' + list.length + '</span>' +
        '<span class="caret">' + icon('right') + '</span></div>' +
        '<div class="chap-bd">' + (c.sections || []).map(function (s) {
          var items = [];
          (s.drugs || []).forEach(function (name) {
            var d = Z.drugs.filter(function (x) { return x.kind === 'main' && x.name === name; })[0];
            if (!d) return;
            items.push(selRow(d));
            if (st.includeAttach) (d.children || []).forEach(function (cid) {
              if (Z.byId[cid]) items.push(selRow(Z.byId[cid]));
            });
          });
          return '<div class="sec">' + (s.name ? '<div class="sec-t">' + esc(s.name) + '</div>' : '') + items.join('') + '</div>';
        }).join('') + '</div></div>');
    });
    h.push('</div>');

    h.push('<div class="card"><div class="sec-label">出题顺序</div><div class="seg" id="seg-order">' +
      '<button data-o="random" class="' + (st.order === 'random' ? 'on' : '') + '">随机</button>' +
      '<button data-o="seq" class="' + (st.order === 'seq' ? 'on' : '') + '">按目录顺序</button></div></div>');
    main.innerHTML = h.join('');

    var oldBar = document.getElementById('fbar');
    if (oldBar) oldBar.remove();
    var startBtn = document.createElement('div');
    startBtn.className = 'fbar';
    startBtn.id = 'fbar';
    startBtn.innerHTML = '<div class="grow small dim" id="start-hint"></div>' +
      '<button class="btn primary" id="btn-start">开始练习</button>';
    document.getElementById('app').appendChild(startBtn);
    main.className = 'has-bar';

    function refreshCount() {
      document.getElementById('sel-n').textContent = selCount();
      var ids = practiceIds();
      var hint = document.getElementById('start-hint');
      var per = st.mode === 'mo' ? ids.length : ids.length * st.fields.length;
      hint.innerHTML = ids.length ? '本次共 <b>' + per + '</b> 题' : '请先选择药物范围';
      document.getElementById('btn-start').disabled = !ids.length;
    }
    function readyIds() {
      if (!st.fields.length) return [];
      return Object.keys(st.sel).map(function (id) { return Z.byId[id]; })
        .filter(function (d) { return d && drugOk(d, st.fields); });
    }
    // 选择题的选项来自「药性/功效/应用」分项：只用主药，且必须选中的内容项都有数据，
    // 否则会出现没有正确答案的题目
    function practiceIds() {
      var ids = readyIds();
      if (st.mode === 'tc') {
        ids = ids.filter(function (d) {
          if (d.kind !== 'main') return false;
          var v = Z.view(d);
          return st.fields.every(function (f) { return fieldHas(v, f); });
        });
      }
      return ids;
    }
    refreshCount();

    UI.bind(main, '#seg-mode button', function (el) {
      st.mode = el.getAttribute('data-m');
      UI.go('#/practice/setup?mode=' + st.mode);
    });
    UI.bind(main, '#seg-order button', function (el) {
      st.order = el.getAttribute('data-o');
      main.querySelectorAll('#seg-order button').forEach(function (b) { b.classList.toggle('on', b === el); });
    });
    UI.bind(main, '[data-fld]', function (el) {
      var k = el.getAttribute('data-fld');
      var i = st.fields.indexOf(k);
      if (i >= 0) { if (st.fields.length === 1) { UI.toast('至少要保留一项练习内容'); return; } st.fields.splice(i, 1); }
      else st.fields.push(k);
      st.fields.sort(function (a, b) { return ['nature', 'effects', 'apps'].indexOf(a) - ['nature', 'effects', 'apps'].indexOf(b); });
      renderSetup(main, [], { mode: st.mode });
    });
    main.querySelector('#sel-all').onclick = function () {
      st.sel = {}; Z.chapters.forEach(function (c) {
        chapterDrugList(c, false).forEach(function (d) { st.sel[d.id] = 1; });
      }); renderSetup(main, [], { mode: st.mode });
    };
    main.querySelector('#sel-all2').onclick = function () { selectAll(true); renderSetup(main, [], { mode: st.mode }); };
    main.querySelector('#sel-none').onclick = function () { selectAll(false); renderSetup(main, [], { mode: st.mode }); };
    main.querySelector('#inc-attach').onchange = function (e) {
      st.includeAttach = e.target.checked;
      if (!st.includeAttach) {
        Z.drugs.forEach(function (d) { if (d.kind === 'attach') delete st.sel[d.id]; });
      }
      renderSetup(main, [], { mode: st.mode });
    };
    main.querySelectorAll('[data-chap]').forEach(function (el) {
      var ci = el.getAttribute('data-chap');
      el.querySelector('.chap-hd').onclick = function (e) {
        if (e.target.closest && e.target.closest('.ck')) return;
        st.setupOpen[ci] = !st.setupOpen[ci];
        el.classList.toggle('open', !!st.setupOpen[ci]);
      };
    });
    main.querySelectorAll('[data-chk]').forEach(function (ck) {
      ck.onclick = function (e) {
        e.stopPropagation();
        var ci = +ck.getAttribute('data-chk');
        var list = chapterDrugList(Z.chapters[ci], st.includeAttach);
        var allOn = list.every(function (d) { return st.sel[d.id]; });
        list.forEach(function (d) { if (allOn) delete st.sel[d.id]; else st.sel[d.id] = 1; });
        renderSetup(main, [], { mode: st.mode });
      };
    });
    function setSel(id, on) {
      if (on) st.sel[id] = 1; else delete st.sel[id];
    }
    // 选中状态变化后，同步：行内复选框、已选总数、底部按钮、所属章的计数与半选态
    function syncSelUI(id) {
      var row = main.querySelector('[data-dsel="' + id + '"]');
      if (row) {
        var ck0 = row.querySelector('input[type=checkbox]');
        if (ck0) ck0.checked = !!st.sel[id];
      }
      refreshCount();
      Z.chapters.forEach(function (c, i) {
        var el = main.querySelector('[data-chap="' + i + '"]');
        if (!el) return;
        var list = chapterDrugList(c, st.includeAttach);
        var has = false;
        for (var k = 0; k < list.length; k++) { if (list[k].id === id) { has = true; break; } }
        if (!has) return;
        var n = 0;
        list.forEach(function (d) { if (st.sel[d.id]) n++; });
        var chip = el.querySelector('.chap-hd .chip');
        if (chip) chip.textContent = n + '/' + list.length;
        var hc = el.querySelector('.chap-hd input[type=checkbox]');
        if (hc) {
          hc.checked = (n === list.length && n > 0);
          hc.indeterminate = (n > 0 && n < list.length);
        }
      });
    }
    // ① 直接点复选框：走 change（浏览器已切换 checked）
    main.querySelectorAll('[data-dsel] input[type=checkbox]').forEach(function (ck) {
      ck.onchange = function () {
        var row = ck.closest('[data-dsel]');
        if (!row) return;
        var id = row.getAttribute('data-dsel');
        setSel(id, ck.checked);
        syncSelUI(id);
      };
    });
    // ② 点药名 / 整行：由这一处统一改状态（不要再让复选框事件冒泡进来重复切换）
    main.querySelectorAll('[data-dsel]').forEach(function (el) {
      el.onclick = function (e) {
        if (e.target.closest && e.target.closest('.ck')) return;  // 复选框已由 ① 处理
        var id = el.getAttribute('data-dsel');
        setSel(id, !st.sel[id]);
        syncSelUI(id);
      };
    });
    document.getElementById('btn-start').onclick = function () {
      var ids = practiceIds();
      if (!ids.length) { UI.toast('没有可练习的药物'); return; }
      startPractice(st.mode, st.fields.slice(), ids);
    };

    function selRow(d) {
      var on = !!st.sel[d.id];
      return '<div class="dr' + (d.kind === 'attach' ? ' attach' : '') + '" data-dsel="' + d.id + '">' +
        '<label class="ck"><input type="checkbox"' + (on ? ' checked' : '') + '></label>' +
        '<span class="nm">' + esc(d.name) + '</span>' +
        (d.kind === 'attach' ? '<span class="chip gray tiny" style="height:19px;padding:0 6px">附</span>' : '') +
        '</div>';
    }
  }

  /* ---------------- 开始 / 草稿 ---------------- */
  function startPractice(mode, fields, drugs) {
    if (mode === 'tc') drugs = drugs.filter(function (d) { return d.kind === 'main'; });
    var ids = drugs.map(function (d) { return d.id; });
    var orderArr = ids.slice();
    if (st.order === 'random') orderArr = Z.shuffle(orderArr);
    var rec = {
      id: 'dr_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      mode: mode, fields: fields, order: orderArr, i: 0,
      ans: {}, submitted: {}, qs: [],
      ts: Date.now(), createdAt: Date.now()
    };
    if (!Array.isArray(Z.store.drafts)) Z.store.drafts = [];
    Z.store.drafts.unshift(rec);
    if (Z.store.drafts.length > MAX_DRAFTS) Z.store.drafts.length = MAX_DRAFTS;
    Z.save(true);
    run = rec;
    UI.go('#/practice/run?id=' + rec.id);
  }

  /* ---------------- 选择题生成 ---------------- */
  function poolFor(field, excludeDrugId) {
    var out = [];
    Z.drugs.forEach(function (d) {
      if (d.id === excludeDrugId) return;
      var v = Z.view(d);
      if (field === 'nature' && v.nature) out.push({ t: v.nature, ch: d.chapter });
      else if (field === 'effects') (v.effects || []).forEach(function (e) { out.push({ t: e, ch: d.chapter }); });
      else if (field === 'apps') (v.apps || []).forEach(function (a) { out.push({ t: a.t, ch: d.chapter }); });
    });
    return out;
  }

  function buildQuestion(did, field) {
    var d = Z.byId[did], v = Z.view(d);
    var correct = [];
    if (field === 'nature') correct = [v.nature];
    else if (field === 'effects') correct = (v.effects || []).slice();
    else correct = (v.apps || []).map(function (a) { return a.t; });
    correct = Z.uniqBy(correct.filter(Boolean), function (x) { return x; });
    if (!correct.length) return null;          // 该药这项内容没有分项数据，跳过
    var nCorrect = correct.length;
    if (field === 'nature') nCorrect = 1;
    if (field !== 'nature') {
      var cap = field === 'effects' ? 6 : 5;
      if (correct.length > cap) correct = correct.slice(0, cap);
    }
    var nDecoy;
    if (field === 'nature') nDecoy = 4;
    else nDecoy = Math.min(6, Math.max(2, Math.round(correct.length * 0.7)));

    var correctSet = Object.create(null);
    correct.forEach(function (x) { correctSet[x] = 1; });
    var pool = poolFor(field, did).filter(function (x) { return !correctSet[x.t]; });
    // 同章优先，增加干扰项可信度
    var sameCh = pool.filter(function (x) { return x.ch === d.chapter; });
    var otherCh = pool.filter(function (x) { return x.ch !== d.chapter; });
    var picked = Z.uniqBy(Z.shuffle(sameCh), function (x) { return x.t; });
    if (picked.length < nDecoy) {
      picked = picked.concat(Z.uniqBy(Z.shuffle(otherCh), function (x) { return x.t; }));
    }
    picked = Z.uniqBy(picked, function (x) { return x.t; }).slice(0, nDecoy);

    var opts = correct.map(function (t) { return { t: t, ok: true }; })
      .concat(picked.map(function (x) { return { t: x.t, ok: false }; }));
    opts = Z.shuffle(opts);
    return { did: did, field: field, opts: opts, picked: [], done: false, multi: field !== 'nature' };
  }

  function ensureQuestion(idx) {
    if (!run || run.mode !== 'tc') return null;
    while (run.qs.length <= idx) {
      var k = run.qs.length;
      var did = run.order[Math.floor(k / run.fields.length)];
      var field = run.fields[k % run.fields.length];
      var q = buildQuestion(did, field);
      if (!q || !q.opts.length) {           // 极端情况：没有可用的正确答案，跳过
        run.qs.push({ did: did, field: field, opts: [], picked: [], done: true, skipped: true });
      } else run.qs.push(q);
    }
    return run.qs[idx];
  }

  /* ---------------- 运行页 ---------------- */
  var guardBusy = false;
  function renderRun(main, p, q) {
    var id = q.id || '';
    if (!run || run.id !== id) {
      var list = Z.store.drafts || [];
      var rec = id ? list.filter(function (x) { return x.id === id; })[0] : null;
      if (!rec && q.mode) {
        rec = list.filter(function (x) { return x.mode === q.mode; })
          .sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); })[0];
      }
      if (!rec) { UI.toast('没有进行中的练习'); UI.go('#/practice'); return; }
      run = rec;
    }
    var mode = run.mode;
    UI.header({
      title: mode === 'mo' ? '默写练习' : '选择题练习',
      sub: '自动保存',
      back: true,
      actions: [{ text: '结束', label: '结束练习', onClick: function () { requestExit(); } }]
    });
    // 顶部返回 = 结束流程（直接回练习入口页，不再 history.back 绕回上一题）
    var hb = document.getElementById('hd-back');
    if (hb) hb.onclick = function () { requestExit(); };
    if (mode === 'mo') renderMoRun(main); else renderTcRun(main);
    installGuard(main);
  }

  function saveRun() {
    if (!run) return;
    run.ts = Date.now();
    if (!Array.isArray(Z.store.drafts)) Z.store.drafts = [];
    var i = -1;
    Z.store.drafts.forEach(function (x, k) { if (x.id === run.id) i = k; });
    if (i >= 0) Z.store.drafts[i] = run; else Z.store.drafts.unshift(run);
    Z.save(true);
  }

  function totalCount() {
    return Z.practiceTotal(run);
  }

  function progressHTML(done, total) {
    var pct = total ? Math.round(done / total * 100) : 0;
    return '<div class="qhead"><div class="progress"><i style="width:' + pct + '%"></i></div>' +
      '<div class="pbar-txt">' + done + ' / ' + total + '</div></div>';
  }

  /* ---------- 默写 ---------- */
  function renderMoRun(main) {
    if (!run) return;
    var total = run.order.length;
    if (run.i >= total) { finishPractice(); return; }
    var did = run.order[run.i];
    var d = Z.byId[did];
    if (!d) { run.i++; saveRun(); renderMoRun(main); return; }
    var v = Z.view(d);
    var ans = run.ans[did] || (run.ans[did] = {});
    var submitted = !!run.submitted[did];

    var h = [progressHTML(Object.keys(run.submitted).length, total)];
    h.push('<div class="qname">' + esc(d.name) + '</div>');
    h.push('<div class="qmeta">第 ' + (run.i + 1) + ' / ' + total + ' 题 · ' +
      (d.kind === 'attach' ? '附药 · ' : '') + esc(d.chapterName) + '</div>');
    h.push('<div class="card">');
    if (d.kind === 'attach') {
      h.push('<div class="field"><label>附药内容（整段默写）</label>' +
        '<textarea class="input" data-ans="raw" rows="6" placeholder="默写这味附药的性味、功能、主治与用法…"' +
        (submitted ? ' readonly' : '') + '>' + esc(ans.raw || '') + '</textarea></div>');
    } else {
      run.fields.forEach(function (fk) {
        var f = FIELD_DEF.filter(function (x) { return x.k === fk; })[0];
        if (!fieldHas(v, fk)) return;
        h.push('<div class="field"><label>' + f.name + '</label>' +
          '<textarea class="input" data-ans="' + fk + '" rows="' + f.rows + '" placeholder="' + f.ph + '"' +
          (submitted ? ' readonly' : '') + '>' + esc(ans[fk] || '') + '</textarea></div>');
      });
    }
    h.push('</div>');
    if (!submitted) {
      h.push('<button class="btn primary block mt10" id="btn-submit">提交，对照答案</button>');
    } else {
      h.push('<div class="card" style="background:#f2f8f2;border-color:#bfd8c0">' +
        '<div class="sec-label" style="color:#3f7d4e">正确答案</div>');
      if (d.kind === 'attach') {
        h.push('<div style="margin-bottom:10px"><div class="b small" style="color:#3f7d4e">原文</div>' +
          '<div class="sec-body" style="line-height:1.95;text-align:justify">' + esc(v.raw) + '</div></div>');
      } else {
        run.fields.forEach(function (fk) {
          if (!fieldHas(v, fk)) return;
          h.push('<div style="margin-bottom:10px"><div class="b small" style="color:#3f7d4e">' +
            FIELD_DEF.filter(function (x) { return x.k === fk; })[0].name + '</div>' +
            answerHTML(v, fk) + '</div>');
        });
      }
      h.push('</div>');
      h.push('<div class="row mt10"><button class="btn" id="btn-prev"' + (run.i <= 0 ? ' disabled' : '') + '>' +
        icon('left') + '上一题</button>' +
        '<button class="btn primary grow" id="btn-next">' + (run.i >= total - 1 ? '完成练习' : '下一题') + '</button></div>');
    }
    main.innerHTML = h.join('');

    if (!submitted) {
      main.querySelectorAll('[data-ans]').forEach(function (ta) {
        ta.oninput = function () { ans[ta.getAttribute('data-ans')] = ta.value; saveRun(); };
      });
      main.querySelector('#btn-submit').onclick = function () {
        main.querySelectorAll('[data-ans]').forEach(function (ta) { ans[ta.getAttribute('data-ans')] = ta.value; });
        run.submitted[did] = 1;
        saveRun();
        renderMoRun(main);
        window.scrollTo(0, 0);
      };
    } else {
      main.querySelector('#btn-next').onclick = function () {
        if (run.i >= total - 1) { finishPractice(); return; }
        run.i++; saveRun(); renderMoRun(main); window.scrollTo(0, 0);
      };
      var pv = main.querySelector('#btn-prev');
      if (pv) pv.onclick = function () { if (run.i > 0) { run.i--; saveRun(); renderMoRun(main); window.scrollTo(0, 0); } };
    }
  }

  function answerHTML(v, fk) {
    if (fk === 'nature') return '<div class="sec-body">' + esc(v.nature) + '</div>';
    if (fk === 'effects') {
      return '<div class="eff-wrap">' + (v.effects || []).map(function (e) {
        return '<span class="eff">' + esc(e) + '</span>';
      }).join('') + '</div>';
    }
    var out = '';
    (v.apps || []).forEach(function (a, i) {
      out += '<div class="app-item"><div class="app-t">' + (i + 1) + '. ' + esc(a.t) + '</div>' +
        (a.d ? '<div class="app-d">' + esc(a.d).replace(/\n/g, '<br>') + '</div>' : '') + '</div>';
    });
    (v.appsTail || []).forEach(function (t) { out += '<div class="app-tail">' + esc(t) + '</div>'; });
    return out;
  }

  /* ---------- 选择题 ---------- */
  function renderTcRun(main) {
    if (!run) return;
    var total = totalCount();
    if (run.i >= total) { finishPractice(); return; }
    var q = ensureQuestion(run.i);
    // 跳过没有可用答案的题（极少数缺分项数据的药）
    while (q && q.skipped) {
      run.i++;
      if (run.i >= total) { finishPractice(); return; }
      q = ensureQuestion(run.i);
    }
    var d = Z.byId[q.did];
    if (!d) { run.i++; saveRun(); renderTcRun(main); return; }
    var fdef = FIELD_DEF.filter(function (x) { return x.k === q.field; })[0];
    var fieldName = fdef ? fdef.name : q.field;
    var letters = 'ABCDEFGH';
    var doneCount = run.qs.filter(function (x) { return x.done; }).length;

    var h = [progressHTML(doneCount, total)];
    h.push('<div class="qname">' + esc(d.name) + '</div>');
    h.push('<div class="qmeta">第 ' + (run.i + 1) + ' / ' + total + ' 题 · 请选出它的' +
      (q.multi ? '「' + fieldName + '」正确内容（可多选）' : '「' + fieldName + '」') + '</div>');
    h.push('<div id="opts">');
    q.opts.forEach(function (o, i) {
      var cls = '';
      if (q.done) {
        if (o.ok) cls = ' right';
        else if (q.picked.indexOf(i) >= 0) cls = ' wrong';
        cls += ' lock';
      } else if (q.picked.indexOf(i) >= 0) cls = ' sel';
      h.push('<div class="opt' + cls + '" data-oi="' + i + '"><span class="oi">' + letters[i] + '</span>' +
        '<span class="ot">' + esc(o.t) + '</span></div>');
    });
    h.push('</div>');

    if (q.done) {
      var right = q.opts.filter(function (o) { return o.ok; }).map(function (o) { return o.t; });
      h.push('<div class="ansbox ok"><div class="al">正确答案</div><div class="sec-body">' +
        right.map(esc).join('；') + '</div></div>');
      h.push('<div class="row mt10"><button class="btn" id="btn-prev"' + (run.i <= 0 ? ' disabled' : '') + '>' +
        icon('left') + '上一题</button>' +
        '<button class="btn primary grow" id="btn-next">' + (run.i >= total - 1 ? '完成练习' : '下一题') + '</button></div>');
    } else {
      h.push('<button class="btn primary block mt10" id="btn-submit">提交答案</button>');
    }
    main.innerHTML = h.join('');

    if (!q.done) {
      main.querySelectorAll('[data-oi]').forEach(function (el) {
        el.onclick = function () {
          var i = +el.getAttribute('data-oi');
          if (q.multi) {
            var k = q.picked.indexOf(i);
            if (k >= 0) q.picked.splice(k, 1); else q.picked.push(i);
          } else {
            q.picked = (q.picked[0] === i) ? [] : [i];
          }
          main.querySelectorAll('[data-oi]').forEach(function (e2) {
            e2.classList.toggle('sel', q.picked.indexOf(+e2.getAttribute('data-oi')) >= 0);
          });
          saveRun();
        };
      });
      main.querySelector('#btn-submit').onclick = function () {
        if (!q.picked.length) { UI.toast('先选一个选项'); return; }
        q.done = true; saveRun(); renderTcRun(main); window.scrollTo(0, 0);
      };
    } else {
      main.querySelector('#btn-next').onclick = function () {
        if (run.i >= total - 1) { finishPractice(); return; }
        run.i++; saveRun(); renderTcRun(main); window.scrollTo(0, 0);
      };
      var pv = main.querySelector('#btn-prev');
      if (pv) pv.onclick = function () { if (run.i > 0) { run.i--; saveRun(); renderTcRun(main); window.scrollTo(0, 0); } };
    }
  }

  /* ---------------- 结束 / 退出 ---------------- */
  function requestExit() {
    if (!run) { UI.go('#/practice'); return; }
    var total = totalCount();
    var done = Z.practiceDone(run);
    saveRun();
    UI.dialog({
      title: '结束练习？',
      html: '已作答 <b>' + done + '</b> / ' + total + ' 题。<br>退出后会<b>自动保存</b>你已经作答的部分（最多保存 <b>' + MAX_DRAFTS + '</b> 份）。' +
        '<br>保存的练习记录都能在「练习」页面找到，随时继续。',
      buttons: [
        { text: '继续练习', value: false },
        { text: '结束并保存', value: true, primary: true }
      ]
    }).then(function (ok) {
      if (!ok) return;
      saveRun();
      run = null;
      location.replace('#/practice');
    });
  }

  function finishPractice() {
    if (!run) { location.replace('#/practice'); return; }
    var id = run.id;
    Z.store.drafts = (Z.store.drafts || []).filter(function (x) { return x.id !== id; });
    Z.save(true);
    run = null;
    UI.dialog({
      title: '练习完成',
      text: '本次练习已全部过完。继续保持～',
      buttons: [{ text: '返回练习页', value: true, primary: true }]
    }).then(function () { location.replace('#/practice'); });
  }

  /* ---------------- 离开守卫（返回键 / 切换底栏） ---------------- */
  var guardInstalled = false;
  function installGuard(main) {
    if (guardInstalled) return;
    guardInstalled = true;
    // 拦截底栏与页面内链接，避免直接切走
    document.addEventListener('click', function (e) {
      if (!run) return;
      var a = e.target.closest && e.target.closest('a[href^="#/"]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || href.indexOf('#/practice/run') === 0) return;
      e.preventDefault();
      e.stopPropagation();
      confirmLeave(function () { location.replace(href); });
    }, true);
    window.addEventListener('beforeunload', function () { saveRun(); });
  }

  function confirmLeave(after) {
    if (!run) { after && after(); return; }
    saveRun();
    UI.dialog({
      title: '退出练习？',
      html: '退出后会<b>自动保存</b>已回答的内容（最多保存 <b>' + MAX_DRAFTS + '</b> 份）。' +
        '<br>保存的练习记录都能在「练习」页面找到，随时继续。',
      buttons: [
        { text: '继续练习', value: false },
        { text: '退出', value: true, primary: true }
      ]
    }).then(function (ok) {
      if (!ok) return;
      saveRun();
      run = null;
      after && after();
    });
  }

  /* 路由守卫：练习中要离开时统一走「结束并保存」流程，不再来回改 hash 造成循环 */
  function beforeRoute(h) {
    if (!run) return true;
    if (h === '#/practice/run?id=' + run.id) return true;
    try { history.replaceState(null, '', '#/practice/run?id=' + run.id); } catch (e) { }
    requestExit();
    return false;
  }

  window.ZY_PRACTICE = {
    inRun: function () { return !!run; },
    saveRun: saveRun,
    beforeRoute: beforeRoute,
    leave: function (cb) { confirmLeave(cb); },
    getRun: function () { return run; }
  };
  window.appBack = function () {
    if (UI.dialogOpen()) { UI.closeDialog(false); return true; }
    if (run) { requestExit(); return true; }
    var h = location.hash || '#/home';
    if (h.indexOf('#/card/') === 0) { UI.replace('#/catalog'); return true; }
    var roots = ['#/home', '#/catalog', '#/practice', '#/fav', '#/me', ''];
    if (roots.indexOf(h) >= 0) return false;
    history.back();
    return true;
  };

  UI.VIEWS.practice = function (main, p) {
    var q = UI.parseHash().q;
    if (p[0] === 'setup') {
      // 每次从其它页面进入设置页都从空白开始（页面内勾选/重渲染不会清空）
      if (st.entered !== true) { st.sel = {}; st.entered = true; }
      return renderSetup(main, p, q);
    }
    st.entered = false;
    if (p[0] === 'run') return renderRun(main, p, q);
    return renderHome(main);
  };
})();
