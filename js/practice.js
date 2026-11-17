/* 中药学 · 练习模块（默写 / 选择题） */
(function () {
  'use strict';
  var Z = window.ZY, UI = window.ZY_UI;
  var esc = Z.esc, icon = UI.icon;

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
    var drafts = Z.store.draft || {};
    var h = [];
    h.push('<div class="card" style="padding:12px 14px;background:#fbf4e2;border-color:#ecd9ae">' +
      '<div class="small" style="color:#7a5c15;line-height:1.7">练习不记成绩，只帮你把药背下来。中途退出会自动保存已作答的内容，下次接着练。</div></div>');
    h.push('<div class="grid2">' +
      tile('mo', '默写练习', '看药名，默写药性 / 功效 / 应用') +
      tile('tc', '选择题练习', '按比例生成选项，选出正确内容') +
      '</div>');
    ['mo', 'tc'].forEach(function (m) {
      var d = drafts[m];
      if (!d) return;
      var total = m === 'mo' ? d.order.length : d.order.length * d.fields.length;
      var done = m === 'mo' ? Object.keys(d.submitted || {}).length : (d.i || 0);
      h.push('<div class="card mt10" style="padding:11px 13px;border-color:#d8c8a8">' +
        '<div class="row between"><div><div class="b small">' + (m === 'mo' ? '默写' : '选择题') + '练习未完成</div>' +
        '<div class="tiny dim mt6">已答 ' + done + ' / ' + total + ' 题 · ' + Z.nowText(d.ts) + '</div></div>' +
        '<div class="row"><button class="btn xs" data-rdel="' + m + '">丢弃</button>' +
        '<button class="btn xs primary" data-resume="' + m + '">继续</button></div></div></div>');
    });
    h.push('<div class="card mt10"><div class="sec-label">练习范围说明</div>' +
      '<div class="small muted">范围可以精确到每一味药，也可以整章/整节勾选；内容可选药性、功效、应用。</div></div>');
    main.innerHTML = h.join('');
    UI.bind(main, '[data-mode]', function (el) { UI.go('#/practice/setup?mode=' + el.getAttribute('data-mode')); });
    UI.bind(main, '[data-resume]', function (el) {
      var m = el.getAttribute('data-resume');
      run = Z.store.draft[m];
      if (!run) { UI.toast('草稿不存在'); return; }
      UI.go('#/practice/run?mode=' + m);
    });
    UI.bind(main, '[data-rdel]', function (el) {
      var m = el.getAttribute('data-rdel');
      UI.confirmDialog('丢弃进度', '将清空这次未完成的练习记录，确定吗？', '丢弃', '取消').then(function (ok) {
        if (!ok) return;
        Z.store.draft[m] = null; Z.save(true);
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
    if (!Object.keys(st.sel).length) selectAll(true);
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
    main.querySelectorAll('[data-dsel]').forEach(function (el) {
      el.onclick = function (e) {
        if (e.target.closest && e.target.closest('.ck')) return;
        var id = el.getAttribute('data-dsel');
        if (st.sel[id]) delete st.sel[id]; else st.sel[id] = 1;
        var ck = el.querySelector('input'); if (ck) ck.checked = !!st.sel[id];
        refreshCount();
        var ci = el.closest('[data-chap]');
        if (ci) {
          var list = chapterDrugList(Z.chapters[+ci.getAttribute('data-chap')], st.includeAttach);
          var n = list.filter(function (d) { return st.sel[d.id]; }).length;
          var chip = ci.querySelector('.chap-hd .chip');
          if (chip) chip.textContent = n + '/' + list.length;
          var hc = ci.querySelector('.chap-hd input[type=checkbox]');
          if (hc) { hc.checked = n === list.length && n > 0; hc.indeterminate = n > 0 && n < list.length; }
        }
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
    if (mode === 'mo') {
      run = { mode: 'mo', fields: fields, order: orderArr, i: 0, ans: {}, submitted: {}, ts: Date.now() };
    } else {
      run = { mode: 'tc', fields: fields, order: orderArr, i: 0, qs: [], ts: Date.now() };
    }
    Z.store.draft[mode] = run;
    Z.save(true);
    UI.go('#/practice/run?mode=' + mode);
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
    var mode = (q.mode === 'tc') ? 'tc' : 'mo';
    if (!run || run.mode !== mode) {
      run = Z.store.draft[mode];
      if (!run) { UI.toast('没有进行中的练习'); UI.go('#/practice'); return; }
    }
    UI.header({
      title: mode === 'mo' ? '默写练习' : '选择题练习',
      sub: '自动保存',
      back: true,
      actions: [{ text: '结束', label: '结束练习', onClick: function () { requestExit(); } }]
    });
    if (mode === 'mo') renderMoRun(main); else renderTcRun(main);
    installGuard(main);
  }

  function saveRun() {
    if (!run) return;
    run.ts = Date.now();
    Z.store.draft[run.mode] = run;
    Z.save(true);
  }

  function totalCount() {
    if (!run) return 0;
    return run.mode === 'mo' ? run.order.length : run.order.length * run.fields.length;
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
    var done = run.mode === 'mo' ? Object.keys(run.submitted).length : run.i;
    saveRun();
    UI.dialog({
      title: '结束练习？',
      html: '已作答 <b>' + done + '</b> / ' + total + ' 题。<br>退出后会<b>自动保存</b>你已经作答的部分，下次从练习页可以继续。',
      buttons: [
        { text: '继续练习', value: false },
        { text: '结束并保存', value: true, primary: true }
      ]
    }).then(function (ok) {
      if (!ok) return;
      saveRun();
      run = null;
      UI.go('#/practice');
    });
  }

  function finishPractice() {
    var m = run ? run.mode : 'mo';
    Z.store.draft[m] = null;
    Z.save(true);
    Z.store.draft[m] = null;
    run = null;
    UI.dialog({
      title: '练习完成',
      text: '本次练习已全部过完。继续保持～',
      buttons: [{ text: '返回练习页', value: true, primary: true }]
    }).then(function () { UI.go('#/practice'); });
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
      confirmLeave(function () { location.hash = href; });
    }, true);
    window.addEventListener('beforeunload', function () { saveRun(); });
  }

  function confirmLeave(after) {
    if (!run) { after && after(); return; }
    saveRun();
    UI.dialog({
      title: '退出练习？',
      html: '退出后会<b>自动保存</b>已回答的内容，之后可以继续练习。',
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

  /* 路由守卫：返回键 / 直接改 hash 时先问一句 */
  function beforeRoute(h) {
    if (!run) return true;
    if ((h || '').indexOf('#/practice/run') === 0) return true;
    try { history.replaceState(null, '', '#/practice/run?mode=' + run.mode); } catch (e) { }
    confirmLeave(function () { location.hash = h; });
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
    if (run) { confirmLeave(function () { UI.go('#/practice'); }); return true; }
    var h = location.hash || '#/home';
    var roots = ['#/home', '#/catalog', '#/practice', '#/fav', '#/me', ''];
    if (roots.indexOf(h) >= 0) return false;
    history.back();
    return true;
  };

  UI.VIEWS.practice = function (main, p) {
    if (p[0] === 'setup') return renderSetup(main, p, UI.parseHash().q);
    if (p[0] === 'run') return renderRun(main, p, UI.parseHash().q);
    return renderHome(main);
  };
})();
