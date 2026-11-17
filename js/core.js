/* 中药学 · 数据层 / 本地存储 / 工具函数 */
(function () {
  'use strict';

  var D = window.ZYX_DATA;
  if (!D) { document.body.innerHTML = '<div class="empty">数据文件加载失败，请重新打开应用</div>'; return; }

  var drugs = D.drugs || [];
  var byId = Object.create(null);
  drugs.forEach(function (d) { byId[d.id] = d; });

  /* ---------- 章节目录索引（含附药归属） ---------- */
  var chapters = D.chapters || [];
  var diffByRef = Object.create(null);   // 药名 -> [鉴别条目]
  var diffByName = Object.create(null);
  (D.differentials || []).forEach(function (x) {
    if (x.ref) {
      (diffByRef[x.ref] || (diffByRef[x.ref] = [])).push(x);
    }
    (diffByName[x.title] || (diffByName[x.title] = [])).push(x);
  });

  /* ---------- 本地存储 ---------- */
  var KEY = 'zyx.data.v1';
  var DEFAULT = {
    notes: {},          // drugId -> {t, ts}
    hidden: {},         // drugId -> 1
    edits: {},          // drugId -> {nature, effects, apps, appsTail, usage, caution, raw}
    fav: { groups: [{ id: 'g0', name: '默认分组' }], items: {} },  // items: drugId -> groupId
    pos: { lastDrug: '' },
    drafts: [],            // 可同时保留多份未完成练习（旧版单条 draft 会自动迁移）
    settings: { order: 'random', includeAttach: true },
    meta: { firstOpen: 0, lastVersion: '' }
  };

  var store = load();
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT));
      var o = JSON.parse(raw);
      // 补全缺省字段
      for (var k in DEFAULT) {
        if (o[k] === undefined || o[k] === null) o[k] = JSON.parse(JSON.stringify(DEFAULT[k]));
      }
      if (!o.fav || !Array.isArray(o.fav.groups) || !o.fav.groups.length) {
        o.fav = { groups: [{ id: 'g0', name: '默认分组' }], items: {} };
      }
      if (!o.fav.items) o.fav.items = {};
      // 旧版只有一条 draft:{mo,tc}，迁移成数组
      if (!Array.isArray(o.drafts)) o.drafts = [];
      if (o.draft) {
        ['mo', 'tc'].forEach(function (k) {
          var d = o.draft[k];
          if (!d) return;
          if (!d.id) d.id = 'dr_' + (d.ts || Date.now()) + '_' + k;
          if (!d.createdAt) d.createdAt = d.ts || Date.now();
          o.drafts.push(d);
        });
        delete o.draft;
      }
      return o;
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULT));
    }
  }
  var saveTimer = null;
  function save(now) {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (now) { persist(); return; }
    saveTimer = setTimeout(persist, 120);
  }
  function persist() {
    saveTimer = null;
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* 容量不足时静默 */ }
  }
  window.addEventListener('pagehide', persist);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') persist();
  });

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function splitList(s) {
    return String(s || '').replace(/[。；;]+$/, '')
      .split(/[，,]/).map(function (x) { return x.trim(); })
      .filter(Boolean);
  }
  // 应用文本 <-> 条目：每行「证候｜说明」；不带 ｜ 的行并入上一条说明，空行忽略
  function parseApps(text) {
    var out = [], tail = [];
    String(text || '').split('\n').forEach(function (line) {
      var s = line.replace(/^\s+|\s+$/g, '');
      if (!s) return;
      s = s.replace(/^\d+[.、)]\s*/, '');
      var m = s.split(/[｜|]/);
      if (m.length >= 2) {
        out.push({ t: m[0].trim(), d: m.slice(1).join('｜').trim() });
      } else if (/^此外/.test(s) || !out.length) {
        tail.push(s);
      } else {
        out[out.length - 1].d = (out[out.length - 1].d ? out[out.length - 1].d + '\n' : '') + s;
      }
    });
    return { apps: out, tail: tail };
  }
  function appsToText(apps, tail) {
    var lines = (apps || []).map(function (a) { return a.t + '｜' + (a.d || ''); });
    (tail || []).forEach(function (t) { lines.push(t); });
    return lines.join('\n');
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function sample(arr, n, excludeFn) {
    var pool = arr.filter(function (x) { return !excludeFn || !excludeFn(x); });
    return shuffle(pool).slice(0, n);
  }
  function uniqBy(arr, fn) {
    var seen = Object.create(null), out = [];
    arr.forEach(function (x) { var k = fn(x); if (!seen[k]) { seen[k] = 1; out.push(x); } });
    return out;
  }
  function practiceTotal(rec) {
    if (!rec) return 0;
    if (rec.mode === 'mo') return rec.order.length;
    return rec.order.length * rec.fields.length;
  }
  function practiceDone(rec) {
    if (!rec) return 0;
    if (rec.mode === 'mo') return Object.keys(rec.submitted || {}).length;
    return (rec.qs || []).filter(function (q) { return q.done; }).length;
  }
  function nowText(ts) {
    var d = new Date(ts || Date.now());
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ---------- 合并用户编辑后的药物视图 ---------- */
  function view(d) {
    var e = store.edits[d.id] || {};
    var v = {
      id: d.id, name: d.name, kind: d.kind, parent: d.parent,
      chapterNo: d.chapterNo, chapterName: d.chapterName, sectionName: d.sectionName,
      children: (d.children || []).map(function (id) { return byId[id]; }).filter(Boolean),
      diffs: diffByRef[d.name] || [],
      edited: Object.keys(e).length > 0,
      raw: d.raw || ''
    };
    if (d.kind === 'attach') {
      v.raw = e.raw != null ? e.raw : (d.raw || '');
      v.nature = e.nature != null ? e.nature : (d.nature || '');
      v.effectsRaw = e.effects != null ? e.effects : (d.effectsRaw || '');
      v.effects = splitList(v.effectsRaw);
      v.apps = e.apps != null ? parseApps(e.apps).apps : (d.apps || []);
      v.appsTail = e.apps != null ? parseApps(e.apps).tail : [];
      v.usage = e.usage != null ? e.usage : (d.usage || '');
      v.caution = e.caution != null ? e.caution : (d.caution || '');
      return v;
    }
    v.nature = e.nature != null ? e.nature : (d.nature || '');
    v.effectsRaw = e.effects != null ? e.effects : (d.effectsRaw || '');
    v.effects = splitList(v.effectsRaw);
    v.apps = e.apps != null ? parseApps(e.apps).apps : (d.apps || []);
    v.appsTail = e.apps != null ? parseApps(e.apps).tail : (e.appsTail != null ? [e.appsTail] : (d.appsTail || []));
    v.usage = e.usage != null ? e.usage : (d.usage || '');
    v.caution = e.caution != null ? e.caution : (d.caution || '');
    return v;
  }
  function hasEdit(drugId) { return !!store.edits[drugId] && Object.keys(store.edits[drugId]).length > 0; }

  /* ---------- 顺序：目录顺序（章→节→主药→其附药） ---------- */
  var order = [];        // 全部药物 id，目录顺序
  var orderIndex = Object.create(null);
  chapters.forEach(function (c) {
    (c.sections || []).forEach(function (s) {
      (s.drugs || []).forEach(function (name) {
        var main = drugs.filter(function (d) { return d.kind === 'main' && d.name === name; })[0];
        if (main && orderIndex[main.id] === undefined) { order.push(main.id); orderIndex[main.id] = order.length - 1; }
      });
    });
  });
  // 兜底：未进入目录的主药
  drugs.forEach(function (d) {
    if (d.kind === 'main' && orderIndex[d.id] === undefined) {
      order.push(d.id); orderIndex[d.id] = order.length - 1;
    }
  });
  // 附药紧跟母药
  var withAttach = [];
  order.forEach(function (id) {
    withAttach.push(id);
    (byId[id].children || []).forEach(function (cid) {
      withAttach.push(cid); orderIndex[cid] = withAttach.length - 1;
    });
  });
  order = withAttach;

  /* ---------- 收藏 ---------- */
  function isFav(id) { return !!store.fav.items[id]; }
  function favGroup(id) { return store.fav.items[id] || null; }
  function toggleFav(id, groupId) {
    if (store.fav.items[id]) { delete store.fav.items[id]; }
    else { store.fav.items[id] = groupId || (store.fav.groups[0] && store.fav.groups[0].id) || 'g0'; }
    save(true);
  }
  function favList(groupId) {
    return Object.keys(store.fav.items)
      .filter(function (id) { return byId[id] && (!groupId || store.fav.items[id] === groupId); })
      .sort(function (a, b) { return (orderIndex[a] || 0) - (orderIndex[b] || 0); });
  }

  /* ---------- 隐藏 ---------- */
  function isHidden(id) { return !!store.hidden[id]; }
  function setHidden(id, v) { if (v) store.hidden[id] = 1; else delete store.hidden[id]; save(true); }
  function hiddenCount() { return Object.keys(store.hidden).length; }

  /* ---------- 笔记 ---------- */
  function note(id) { var n = store.notes[id]; return n ? n.t : ''; }
  function setNote(id, text) {
    if (text && text.trim()) store.notes[id] = { t: text, ts: Date.now() };
    else delete store.notes[id];
    save(true);
  }
  function noteCount() { return Object.keys(store.notes).length; }

  /* ---------- 药物检索 ---------- */
  function searchDrugs(kw) {
    kw = String(kw || '').trim().toLowerCase();
    if (!kw) return [];
    var res = [];
    drugs.forEach(function (d) {
      var n = d.name.toLowerCase();
      var score = -1;
      if (n === kw) score = 0;
      else if (n.indexOf(kw) === 0) score = 1;
      else if (n.indexOf(kw) >= 0) score = 2;
      if (score >= 0) res.push({ d: d, score: score, idx: orderIndex[d.id] || 0 });
    });
    res.sort(function (a, b) { return a.score - b.score || a.idx - b.idx; });
    return res.map(function (x) { return x.d; });
  }

  window.ZY = {
    D: D, drugs: drugs, byId: byId, chapters: chapters, order: order, orderIndex: orderIndex,
    diffByRef: diffByRef, diffByName: diffByName,
    store: store, save: save, persist: persist,
    esc: esc, splitList: splitList, parseApps: parseApps, appsToText: appsToText,
    shuffle: shuffle, sample: sample, uniqBy: uniqBy, nowText: nowText,
    practiceTotal: practiceTotal, practiceDone: practiceDone,
    view: view, hasEdit: hasEdit,
    isFav: isFav, favGroup: favGroup, toggleFav: toggleFav, favList: favList,
    isHidden: isHidden, setHidden: setHidden, hiddenCount: hiddenCount,
    note: note, setNote: setNote, noteCount: noteCount,
    searchDrugs: searchDrugs
  };
})();
