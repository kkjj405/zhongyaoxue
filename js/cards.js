/* 中药学 · 卡片模块（目录 / 卡片阅读 / 笔记 / 收藏 / 编辑 / 隐藏） */
(function () {
  'use strict';
  var Z = window.ZY, UI = window.ZY_UI;
  var esc = Z.esc, icon = UI.icon;

  /* =================================================================
   *  目录
   * ================================================================= */
  var catState = {
    manage: false,
    sel: {},
    open: {},
    kw: ''
  };
  // 默认展开前两章
  (Z.chapters || []).slice(0, 2).forEach(function (c, i) { catState.open[i] = true; });

  function selCount() { return Object.keys(catState.sel).length; }
  function clearSel() { catState.sel = {}; }

  function drugRow(d, manage) {
    var hid = Z.isHidden(d.id);
    var flags = [];
    if (hid) flags.push('<span class="flag" title="已隐藏">⊘</span>');
    if (Z.isFav(d.id)) flags.push('<span class="flag" style="color:#b8892f">★</span>');
    if (Z.note(d.id)) flags.push('<span class="flag" style="color:#3b6ea5">✎</span>');
    if (Z.hasEdit(d.id)) flags.push('<span class="flag" title="已修改">✐</span>');
    return '<div class="dr' + (d.kind === 'attach' ? ' attach' : '') + (hid ? ' hid' : '') +
      (catState.sel[d.id] ? ' sel' : '') + '" data-dr="' + d.id + '">' +
      (manage ? '<label class="ck"><input type="checkbox" data-ck="' + d.id + '"' + (catState.sel[d.id] ? ' checked' : '') + '></label>' : '') +
      '<span class="nm">' + esc(d.name) + '</span>' +
      (d.kind === 'attach' ? '<span class="chip gray tiny" style="height:19px;padding:0 6px">附</span>' : '') +
      '<span class="flags">' + flags.join('') + '</span></div>';
  }

  function chapterHTML(c, ci) {
    var rows = [];
    (c.sections || []).forEach(function (sec, si) {
      var items = [];
      (sec.drugs || []).forEach(function (name) {
        var d = Z.drugs.filter(function (x) { return x.kind === 'main' && x.name === name; })[0];
        if (!d) return;
        if (catState.kw && d.name.indexOf(catState.kw) < 0) {
          // 关键词不命中主药时，仍检查其附药
          var hitChild = (d.children || []).some(function (cid) {
            return Z.byId[cid] && Z.byId[cid].name.indexOf(catState.kw) >= 0;
          });
          if (!hitChild) return;
        }
        items.push(drugRow(d, catState.manage));
        (d.children || []).forEach(function (cid) {
          var cd = Z.byId[cid];
          if (!cd) return;
          if (catState.kw && cd.name.indexOf(catState.kw) < 0 && d.name.indexOf(catState.kw) < 0) return;
          items.push(drugRow(cd, catState.manage));
        });
      });
      if (items.length) {
        rows.push('<div class="sec">' + (sec.name ? '<div class="sec-t">' + esc(sec.name) + '</div>' : '') +
          items.join('') + '</div>');
      }
    });
    if (!rows.length) return '';
    var count = 0;
    (c.sections || []).forEach(function (s) { count += (s.drugs || []).length; });
    var hidCount = 0;
    (c.sections || []).forEach(function (s) {
      (s.drugs || []).forEach(function (n) {
        var d = Z.drugs.filter(function (x) { return x.kind === 'main' && x.name === n; })[0];
        if (d) {
          if (Z.isHidden(d.id)) hidCount++;
          (d.children || []).forEach(function (cid) { if (Z.isHidden(cid)) hidCount++; });
        }
      });
    });
    var open = catState.kw ? true : !!catState.open[ci];
    return '<div class="chap' + (open ? ' open' : '') + '" data-chap="' + ci + '">' +
      '<div class="chap-hd"><span class="caret">' + icon('right') + '</span>' +
      '<span class="cn">' + esc(c.no) + '　' + esc(c.name) + '</span>' +
      '<span class="chip gray tiny">' + count + ' 味' + (hidCount ? ' · 隐藏 ' + hidCount : '') + '</span></div>' +
      '<div class="chap-bd">' + rows.join('') + '</div></div>';
  }

  function renderCatalog(main) {
    var mg = catState.manage;
    UI.header({
      title: '药物目录',
      sub: Z.drugs.length + ' 味',
      actions: [
        { icon: 'search', label: '搜索', onClick: function () { UI.go('#/search'); } },
        { text: mg ? '完成' : '管理', label: '批量管理', onClick: function () {
          catState.manage = !catState.manage; clearSel(); renderCatalog(main); paintManageBar();
        } }
      ]
    });

    var html = [];
    // 隐藏药物提示
    var hc = Z.hiddenCount();
    if (hc && !mg) {
      html.push('<div class="card" style="padding:10px 12px"><div class="row between"><div class="small muted">已隐藏 ' +
        hc + ' 味药（目录中带删除线，卡片切换时跳过）</div>' +
        '<button class="btn xs" id="show-hidden">去取消隐藏</button></div></div>');
    }
    html.push('<div class="searchbox mb10" style="margin-bottom:10px"><svg class="s-ico" viewBox="0 0 24 24">' +
      '<circle cx="11" cy="11" r="6.5" fill="none" stroke-width="1.9"/><path d="m16 16 4.5 4.5" stroke-width="1.9" stroke-linecap="round" fill="none"/></svg>' +
      '<input class="input" id="cat-kw" placeholder="在本目录中查找药名（如 麻黄）" value="' + esc(catState.kw) + '"></div>');
    if (mg) {
      html.push('<div class="card flat" style="padding:9px 11px"><div class="row between"><span class="small muted">勾选要隐藏（或取消隐藏）的药物</span>' +
        '<span class="chip solid tiny" id="sel-count">已选 ' + selCount() + '</span></div></div>');
    }
    Z.chapters.forEach(function (c, ci) { html.push(chapterHTML(c, ci)); });
    html.push('<div class="small dim center" style="margin:16px 0 6px">— 共 ' + Z.chapters.length + ' 章 · ' +
      Z.drugs.length + ' 味药（含附药）—</div>');
    main.innerHTML = html.join('');
    main.className = mg ? 'has-bar' : '';

    // 交互
    main.querySelectorAll('[data-chap]').forEach(function (el) {
      var hd = el.querySelector('.chap-hd');
      hd.onclick = function () {
        var ci = el.getAttribute('data-chap');
        catState.open[ci] = !catState.open[ci];
        el.classList.toggle('open', !!catState.open[ci]);
      };
    });
    main.querySelectorAll('[data-dr]').forEach(function (el) {
      el.onclick = function (e) {
        var id = el.getAttribute('data-dr');
        if (mg) {
          if (e.target.closest && e.target.closest('.ck')) return;
          toggleSel(id);
          el.classList.toggle('sel', !!catState.sel[id]);
          var ck = el.querySelector('input');
          if (ck) ck.checked = !!catState.sel[id];
          paintManageBar();
          return;
        }
        UI.go('#/card/' + id);
      };
    });
    main.querySelectorAll('[data-ck]').forEach(function (ck) {
      ck.onclick = function (e) {
        e.stopPropagation();
        var id = ck.getAttribute('data-ck');
        toggleSel(id);
        ck.closest('.dr').classList.toggle('sel', !!catState.sel[id]);
        paintManageBar();
      };
    });
    var kw = main.querySelector('#cat-kw');
    if (kw) {
      var t = null;
      kw.oninput = function () {
        clearTimeout(t);
        t = setTimeout(function () {
          catState.kw = kw.value.trim();
          var pos = kw.selectionStart;
          renderCatalog(main);
          var n = main.querySelector('#cat-kw');
          if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { } }
        }, 220);
      };
    }
    var sh = main.querySelector('#show-hidden');
    if (sh) sh.onclick = function () {
      catState.manage = true; catState.sel = {};
      renderCatalog(main); paintManageBar();
      UI.toast('已进入管理，勾选被隐藏的药再点「取消隐藏」');
    };
    if (mg) paintManageBar(main);
    else removeManageBar();
  }

  function toggleSel(id) {
    if (catState.sel[id]) delete catState.sel[id]; else catState.sel[id] = 1;
  }

  function removeManageBar() {
    var b = document.getElementById('fbar');
    if (b) b.remove();
  }

  function paintManageBar(main) {
    if (!catState.manage) { removeManageBar(); return; }
    var bar = document.getElementById('fbar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'fbar';
      bar.id = 'fbar';
      document.getElementById('app').appendChild(bar);
    }
    bar.innerHTML =
      '<button class="btn sm" id="mb-all">全选</button>' +
      '<button class="btn sm" id="mb-none">清空</button>' +
      '<button class="btn sm danger" id="mb-hide" disabled>隐藏</button>' +
      '<button class="btn sm" id="mb-unhide" disabled>取消隐藏</button>' +
      '<span class="grow"></span>' +
      '<button class="btn sm primary" id="mb-done">完成</button>';
    var n = selCount();
    var sc = document.getElementById('sel-count');
    if (sc) sc.textContent = '已选 ' + n;
    bar.querySelector('#mb-hide').disabled = !n;
    bar.querySelector('#mb-unhide').disabled = !n;
    bar.querySelector('#mb-all').onclick = function () {
      var cur = document.getElementById('main');
      cur.querySelectorAll('[data-dr]').forEach(function (el) {
        var id = el.getAttribute('data-dr');
        catState.sel[id] = 1;
        el.classList.add('sel');
        var ck = el.querySelector('input'); if (ck) ck.checked = true;
      });
      paintManageBar();
    };
    bar.querySelector('#mb-none').onclick = function () { clearSel(); renderCatalog(document.getElementById('main')); };
    bar.querySelector('#mb-hide').onclick = function () {
      var ids = Object.keys(catState.sel);
      ids.forEach(function (id) { Z.setHidden(id, true); });
      UI.toast('已隐藏 ' + ids.length + ' 味药');
      clearSel(); renderCatalog(document.getElementById('main'));
    };
    bar.querySelector('#mb-unhide').onclick = function () {
      var ids = Object.keys(catState.sel);
      ids.forEach(function (id) { Z.setHidden(id, false); });
      UI.toast('已取消隐藏 ' + ids.length + ' 味药');
      clearSel(); renderCatalog(document.getElementById('main'));
    };
    bar.querySelector('#mb-done').onclick = function () {
      catState.manage = false; clearSel(); removeManageBar();
      renderCatalog(document.getElementById('main'));
    };
  }

  /* =================================================================
   *  卡片
   * ================================================================= */
  var cardState = { panel: null, panelDrug: null, favGroup: null, drug: '', page: 0, continuous: null };

  function visibleOrder() {
    return Z.order.filter(function (id) { return !Z.isHidden(id) && Z.byId[id]; });
  }

  function cardHTML(v) {
    var h = [];
    var chips = [];
    if (v.kind === 'attach') chips.push('<span class="chip gray">附药</span>');
    if (v.edited) chips.push('<span class="chip gray">已修改</span>');
    if (Z.isFav(v.id)) chips.push('<span class="chip solid">★ 已收藏</span>');
    if (Z.isHidden(v.id)) chips.push('<span class="chip gray">⊘ 已隐藏</span>');
    if (Z.note(v.id)) chips.push('<span class="chip gray">有笔记</span>');

    h.push('<div class="drug-title"><span class="n">' + esc(v.name) + '</span>' +
      '<span class="p">' + esc(v.chapterNo + ' ' + v.chapterName + (v.sectionName ? ' · ' + v.sectionName : '')) + '</span></div>');
    if (chips.length) h.push('<div class="tag-row mt6">' + chips.join('') + '</div>');

    var note = Z.note(v.id);
    if (note) h.push('<div class="note-inline mt10" id="card-note-view"><div class="tiny" style="opacity:.7;margin-bottom:2px">我的笔记</div>' +
      esc(note).replace(/\n/g, '<br>') + '</div>');

    var content = buildContent(v);
    if (content.paged && !cardState.continuous) {
      var pg = content.pages[Math.min(cardState.page, content.pages.length - 1)];
      h.push(cpagerHTML(cardState.page, content.pages.length, pg.label));
      h.push('<div class="card mt10">' + pg.html + '</div>');
    } else {
      h.push('<div class="card mt14">' + content.html + '</div>');
      if (content.paged) {
        h.push('<div class="center mt6">' + (cardState.continuous
          ? '<button class="btn ghost xs" id="cp-off">切回分页阅读</button>'
          : '<button class="btn ghost xs" id="cp-on">分页阅读（每页少一点）</button>') + '</div>');
      }
    }

    // 附药 / 母药
    if (v.children && v.children.length) {
      h.push('<div class="card"><div class="sec-label">附药</div><div class="tag-row">' +
        v.children.map(function (c) {
          return '<a class="chip" href="#/card/' + c.id + '">' + esc(c.name) + '</a>';
        }).join('') + '</div></div>');
    }
    if (v.parent && Z.byId[v.parent]) {
      h.push('<div class="card"><div class="sec-label">母药</div><a class="chip" href="#/card/' + v.parent + '">' +
        esc(Z.byId[v.parent].name) + '</a></div>');
    }
    // 鉴别用药
    if (v.diffs && v.diffs.length) {
      h.push('<div class="card"><div class="sec-label">鉴别用药</div>' + v.diffs.map(function (x) {
        return '<div class="app-item"><div class="app-t">' + esc(x.title) + '</div><div class="app-d">' +
          esc(x.body).replace(/\n/g, '<br>') + '</div></div>';
      }).join('') + '</div>');
    }
    return h.join('');
  }

  function sec(label, body) {
    return '<div class="sec-block"><div class="sec-label">' + label + '</div>' + body + '</div>';
  }

  function appItem(a, i) {
    return '<div class="app-item"><div class="app-t">' + (i + 1) + '. ' + esc(a.t) + '</div>' +
      (a.d ? '<div class="app-d">' + esc(a.d).replace(/\n/g, '<br>') + '</div>' : '') + '</div>';
  }

  /* 长卡片分页：药性/功效 → 应用（每页 3 条）→ 用法/注意 */
  function buildContent(v) {
    var basic = '';
    if (v.nature) basic += sec('药性', '<div class="sec-body">' + esc(v.nature) + '</div>');
    if (v.effects && v.effects.length) {
      basic += sec('功效', '<div class="eff-wrap">' + v.effects.map(function (e) {
        return '<span class="eff">' + esc(e) + '</span>';
      }).join('') + '</div>');
    }
    var usage = v.usage ? sec('用法用量', '<div class="sec-body">' + esc(v.usage) + '</div>') : '';
    var caution = v.caution ? sec('使用注意', '<div class="sec-body" style="color:#8a3b3b">' + esc(v.caution) + '</div>') : '';
    if (v.kind === 'attach' && v.raw) {
      var rawOnly = sec('附药原文', '<div class="sec-body" style="font-size:15px;line-height:1.95;text-align:justify">' + esc(v.raw) + '</div>');
      var cl = (v.raw || '').length;
      if (cl > 700) {
        // 极长附药也可以分两页，暂无必要，保持整段
      }
      return { paged: false, html: rawOnly };
    }
    var apps = v.apps || [];
    var tail = (v.appsTail || []).map(function (t) {
      return '<div class="app-tail">' + esc(t).replace(/\n/g, '<br>') + '</div>';
    }).join('');
    var appsBlock = '';
    if (apps.length || tail) {
      appsBlock = sec('应用', apps.map(appItem).join('') + tail);
    }
    // 连续阅读的整体 HTML
    var full = basic + appsBlock + usage + caution;

    // 是否分页：应用条目多，或正文很长
    var len = (v.nature || '').length + (v.effectsRaw || '').length + (v.usage || '').length + (v.caution || '').length;
    apps.forEach(function (a) { len += (a.t || '').length + (a.d || '').length; });
    var needPage = apps.length >= 4 || len > 700;
    if (!needPage) return { paged: false, html: full };

    var pages = [];
    pages.push({ label: '药性 · 功效', html: basic || '<div class="empty">（原文无分项）</div>' });
    var size = 3;
    for (var i = 0; i < apps.length; i += size) {
      var part = apps.slice(i, i + size).map(function (a, k) { return appItem(a, i + k); });
      var isLast = (i + size >= apps.length);
      if (isLast) part.push(tail);
      pages.push({
        label: '应用 ' + (i + 1) + '–' + Math.min(i + size, apps.length) + ' / ' + apps.length,
        html: sec('应用', part.join(''))
      });
    }
    if (!apps.length && tail) pages.push({ label: '应用', html: sec('应用', tail) });
    if (usage || caution) pages.push({ label: '用法 · 注意', html: usage + caution });
    return { paged: pages.length > 1, pages: pages, html: full };
  }

  function cpagerHTML(page, total, label) {
    return '<div class="cpager">' +
      '<button class="btn xs" id="cp-prev"' + (page <= 0 ? ' disabled' : '') + '>' + icon('left') + ' 上一页</button>' +
      '<span class="cpt">第 ' + (page + 1) + ' / ' + total + ' 页 · ' + esc(label || '') + '</span>' +
      '<button class="btn xs" id="cp-next"' + (page >= total - 1 ? ' disabled' : '') + '>下一页 ' + icon('right') + '</button>' +
      '</div>';
  }

  function renderCard(main, p) {
    var id = p[0];
    var d = Z.byId[id];
    if (!d) {
      UI.header({ title: '卡片', back: true });
      main.innerHTML = UI.emptyBox('没有找到这味药');
      return;
    }
    Z.store.pos.lastDrug = id;
    Z.save();
    var v = Z.view(d);
    if (cardState.drug !== id) { cardState.drug = id; cardState.page = 0; cardState.continuous = null; }
    var list = visibleOrder();
    var idx = list.indexOf(id);
    var prevId = null, nextId = null;
    if (idx >= 0) {
      if (idx > 0) prevId = list[idx - 1];
      if (idx < list.length - 1) nextId = list[idx + 1];
    } else {
      // 当前这味药被隐藏：按目录顺序找它两侧最近的可见药，照样能翻页
      var ai = Z.order.indexOf(id);
      for (var k = ai - 1; k >= 0; k--) { if (list.indexOf(Z.order[k]) >= 0) { prevId = Z.order[k]; break; } }
      for (var k2 = ai + 1; k2 < Z.order.length; k2++) { if (list.indexOf(Z.order[k2]) >= 0) { nextId = Z.order[k2]; break; } }
    }

    UI.header({
      title: d.kind === 'attach' ? '附药 · ' + d.name : d.name,
      sub: d.chapterNo,
      back: true,
      actions: [
        { icon: 'search', label: '搜索', onClick: function () { UI.go('#/search'); } },
        { icon: 'list', label: '目录', onClick: function () { UI.go('#/catalog'); } }
      ]
    });

    main.innerHTML = cardHTML(v) +
      '<div class="act-row" id="card-acts">' +
      act('note', '笔记', Z.note(id) ? 'on' : '') +
      act('fav', '收藏', Z.isFav(id) ? 'on' : '') +
      act('edit', '编辑', Z.hasEdit(id) ? 'on' : '') +
      act(Z.isHidden(id) ? 'unhide' : 'hide', Z.isHidden(id) ? '取消隐藏' : '隐藏', '') +
      act('diff', '鉴别', (v.diffs && v.diffs.length) ? '' : '') +
      '</div>' +
      '<div id="card-panel"></div>' +
      '<div class="pager">' +
      '<button class="btn" id="p-prev"' + (prevId ? '' : ' disabled') + '>' + icon('left') + ' 上一个</button>' +
      '<div class="pc">' + (idx >= 0 ? (idx + 1) + ' / ' + list.length : '已隐藏') + '</div>' +
      '<button class="btn" id="p-next"' + (nextId ? '' : ' disabled') + '>下一个 ' + icon('right') + '</button>' +
      '</div>' +
      '<div class="small dim center" style="margin-top:14px">目录顺序 · 已隐藏的药会被跳过</div>';

    function act(k, label, cls) {
      var ic = { note: 'note', fav: 'star', edit: 'edit', hide: 'hide', unhide: 'eyeoff', diff: 'diff' }[k];
      return '<button class="act ' + cls + (k === 'hide' ? ' red' : '') + '" data-act="' + k + '">' +
        icon(ic) + '<span>' + label + '</span></button>';
    }

    // 上一个 / 下一个
    var prev = main.querySelector('#p-prev'), next = main.querySelector('#p-next');
    if (prev) prev.onclick = function () { if (prevId) UI.go('#/card/' + prevId); };
    if (next) next.onclick = function () { if (nextId) UI.go('#/card/' + nextId); };

    // 分页阅读
    var cpPrev = main.querySelector('#cp-prev');
    if (cpPrev) cpPrev.onclick = function () {
      if (cardState.page > 0) { cardState.page--; renderCard(main, [id]); window.scrollTo(0, 0); }
    };
    var cpNext = main.querySelector('#cp-next');
    if (cpNext) cpNext.onclick = function () {
      cardState.page++; renderCard(main, [id]); window.scrollTo(0, 0);
    };
    var cpOn = main.querySelector('#cp-on');
    if (cpOn) cpOn.onclick = function () { cardState.continuous = true; renderCard(main, [id]); };
    var cpOff = main.querySelector('#cp-off');
    if (cpOff) cpOff.onclick = function () { cardState.continuous = false; cardState.page = 0; renderCard(main, [id]); window.scrollTo(0, 0); };

    // 操作
    UI.bind(main, '#card-acts [data-act]', function (el) {
      var k = el.getAttribute('data-act');
      if (k === 'note') togglePanel(main, id, 'note');
      else if (k === 'fav') togglePanel(main, id, 'fav');
      else if (k === 'edit') togglePanel(main, id, 'edit');
      else if (k === 'hide') { Z.setHidden(id, true); UI.toast('已隐藏，卡片切换将跳过'); renderCard(main, [id]); }
      else if (k === 'unhide') { Z.setHidden(id, false); UI.toast('已取消隐藏'); renderCard(main, [id]); }
      else if (k === 'diff') {
        if (v.diffs && v.diffs.length) UI.go('#/diff?ref=' + encodeURIComponent(d.name));
        else UI.toast('这味药在原文中没有鉴别条目');
      }
    });

    // 笔记点击编辑
    var nv = main.querySelector('#card-note-view');
    if (nv) nv.onclick = function () { togglePanel(main, id, 'note'); };

    // 键盘左右
    document.onkeydown = function (e) {
      if (e.key === 'ArrowLeft' && prevId) UI.go('#/card/' + prevId);
      if (e.key === 'ArrowRight' && nextId) UI.go('#/card/' + nextId);
    };
  }

  /* ---------- 卡片内嵌面板：笔记 / 收藏 / 编辑 ---------- */
  function togglePanel(main, id, kind) {
    var box = main.querySelector('#card-panel');
    if (!box) return;
    if (cardState.panel === kind && cardState.panelDrug === id) {
      cardState.panel = null; box.innerHTML = ''; return;
    }
    cardState.panel = kind; cardState.panelDrug = id;
    if (kind === 'note') box.innerHTML = notePanelHTML(id);
    else if (kind === 'fav') box.innerHTML = favPanelHTML(id);
    else box.innerHTML = editPanelHTML(id);
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    if (kind === 'note') {
      var ta = box.querySelector('#note-ta');
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
      box.querySelector('#note-save').onclick = function () {
        Z.setNote(id, ta.value);
        UI.toast(ta.value.trim() ? '笔记已保存' : '笔记已清空');
        cardState.panel = null; renderCard(main, [id]);
      };
      box.querySelector('#note-cancel').onclick = function () { cardState.panel = null; box.innerHTML = ''; };
    } else if (kind === 'fav') {
      UI.bind(box, '[data-g]', function (el) {
        var g = el.getAttribute('data-g');
        if (g === '__off') { if (Z.isFav(id)) Z.toggleFav(id); UI.toast('已取消收藏'); }
        else { if (Z.isFav(id) && Z.favGroup(id) !== g) { delete Z.store.fav.items[id]; Z.save(true); } Z.toggleFav(id, g); UI.toast('已收藏到「' + (Z.store.fav.groups.filter(function (x) { return x.id === g; })[0] || {}).name + '」'); }
        cardState.panel = null; renderCard(main, [id]);
      });
      box.querySelector('#fav-manage').onclick = function () { UI.go('#/fav'); };
    } else if (kind === 'edit') {
      var d = Z.byId[id];
      var e = Z.store.edits[id] || {};
      var v = Z.view(d);
      var vals = {
        nature: e.nature != null ? e.nature : (d.nature || ''),
        effects: e.effects != null ? e.effects : (d.effectsRaw || ''),
        apps: e.apps != null ? e.apps : Z.appsToText(d.apps, d.appsTail),
        usage: e.usage != null ? e.usage : (d.usage || ''),
        caution: e.caution != null ? e.caution : (d.caution || ''),
        raw: e.raw != null ? e.raw : (d.raw || '')
      };
      box.querySelector('#ed-save').onclick = function () {
        var obj = {};
        if (d.kind === 'attach') {
          obj = { raw: box.querySelector('[data-f="raw"]').value };
        } else {
          ['nature', 'effects', 'apps', 'usage', 'caution'].forEach(function (f) {
            var el = box.querySelector('[data-f="' + f + '"]');
            if (el) obj[f] = el.value;
          });
        }
        Z.store.edits[id] = obj;
        Z.save(true);
        UI.toast('已保存修改（本机生效）');
        cardState.panel = null; renderCard(main, [id]);
      };
      box.querySelector('#ed-reset').onclick = function () {
        UI.confirmDialog('恢复原文', '将丢弃你对这味药的所有修改，恢复为教材原文。', '恢复', '取消').then(function (ok) {
          if (!ok) return;
          delete Z.store.edits[id]; Z.save(true);
          UI.toast('已恢复原文');
          cardState.panel = null; renderCard(main, [id]);
        });
      };
      box.querySelector('#ed-cancel').onclick = function () { cardState.panel = null; box.innerHTML = ''; };
    }
  }

  function notePanelHTML(id) {
    var v = Z.note(id);
    return '<div class="card mt14" style="background:#fffdf3;border-color:#ecdcaf">' +
      '<div class="sec-label">我的笔记（只存本机）</div>' +
      '<textarea class="input" id="note-ta" placeholder="记下这味药的记忆点、易错点、老师强调的地方…" style="min-height:110px">' + esc(v) + '</textarea>' +
      '<div class="row mt10"><button class="btn sm primary" id="note-save">保存笔记</button>' +
      '<button class="btn sm" id="note-cancel">收起</button></div></div>';
  }

  function favPanelHTML(id) {
    var groups = Z.store.fav.groups;
    var cur = Z.favGroup(id);
    var h = ['<div class="card mt14"><div class="sec-label">选择收藏分组</div><div class="tag-row">'];
    groups.forEach(function (g) {
      h.push('<button class="chip' + (cur === g.id ? ' on' : '') + '" data-g="' + g.id + '">' +
        esc(g.name) + '</button>');
    });
    if (cur) h.push('<button class="chip gray" data-g="__off">取消收藏</button>');
    h.push('</div><div class="row mt10"><button class="btn sm" id="fav-manage">管理分组</button></div></div>');
    return h.join('');
  }

  function editPanelHTML(id) {
    var d = Z.byId[id];
    var e = Z.store.edits[id] || {};
    var h = ['<div class="card mt14" style="background:#fbf8f0"><div class="sec-label">编辑内容（只改本机，可随时恢复原文）</div>'];
    if (d.kind === 'attach') {
      h.push('<div class="field"><label>原文段落</label><textarea class="input" data-f="raw" style="min-height:150px">' +
        esc(e.raw != null ? e.raw : (d.raw || '')) + '</textarea></div>');
    } else {
      h.push('<div class="field"><label>药性</label><input class="input" data-f="nature" value="' +
        esc(e.nature != null ? e.nature : (d.nature || '')) + '"></div>');
      h.push('<div class="field"><label>功效（用「，」分隔）</label><input class="input" data-f="effects" value="' +
        esc(e.effects != null ? e.effects : (d.effectsRaw || '')) + '"></div>');
      h.push('<div class="field"><label>应用（每行一条，格式：证候｜说明）</label><textarea class="input" data-f="apps" style="min-height:160px">' +
        esc(e.apps != null ? e.apps : Z.appsToText(d.apps, d.appsTail)) + '</textarea></div>');
      h.push('<div class="field"><label>用法用量</label><textarea class="input" data-f="usage" style="min-height:64px">' +
        esc(e.usage != null ? e.usage : (d.usage || '')) + '</textarea></div>');
      h.push('<div class="field"><label>使用注意</label><textarea class="input" data-f="caution" style="min-height:64px">' +
        esc(e.caution != null ? e.caution : (d.caution || '')) + '</textarea></div>');
    }
    h.push('<div class="row"><button class="btn sm primary" id="ed-save">保存</button>' +
      '<button class="btn sm" id="ed-cancel">取消</button>' +
      '<span class="grow"></span><button class="btn sm danger" id="ed-reset">恢复原文</button></div></div>');
    return h.join('');
  }

  UI.VIEWS.catalog = renderCatalog;
  UI.VIEWS.card = renderCard;
  window.ZY_CARDS = { catState: catState, visibleOrder: visibleOrder, removeManageBar: removeManageBar };
})();
