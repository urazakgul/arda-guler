(function () {
  var NS = "http://www.w3.org/2000/svg";
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DAY = 86400000;

  var teams = DATA.teams.map(function (team) {
    var cg = 0, ca = 0, cm = 0, cn = 0;
    var list = team.matches.map(function (m) {
      var p = m.d.split("-");
      return Object.assign({ t: Date.UTC(+p[0], +p[1] - 1, +p[2]) }, m);
    }).sort(function (a, b) { return a.t - b.t; });
    list.forEach(function (m) {
      cg += m.g; ca += m.a; cm += m.m; cn += m.p;
      m.cg = cg; m.ca = ca; m.cm = cm; m.cn = cn;
    });
    return { id: team.id, name: team.name, kind: team.kind, matches: list, totG: cg, totA: ca, totM: cm, totN: cn };
  });

  var team, matches, totG, totA, totM, totN, sel;

  function fmt(n) { return n.toLocaleString("en-US"); }
  function dateStr(t) {
    var d = new Date(t);
    return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }
  function seasonOf(t) {
    var d = new Date(t), y = d.getUTCFullYear();
    if (d.getUTCMonth() < 6) y -= 1;
    return y + "/" + String(y + 1).slice(2);
  }
  function subText() {
    var first = matches[0].t, last = matches[matches.length - 1].t;
    var cur = Date.now() - last < 120 * DAY;
    if (team.kind === "national") {
      var d = new Date(first);
      return "Official matches for " + team.name + " since " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
    }
    var a = seasonOf(first), b = seasonOf(last);
    if (cur) return "Official matches for " + team.name + " since the " + a + " season";
    return "Official matches for " + team.name + (a === b ? " in the " + a + " season" : ", " + a + " to " + b + " seasons");
  }

  var host = document.getElementById("chart");
  var btn = document.getElementById("teamBtn");
  var menu = document.getElementById("teamMenu");
  var items = teams.map(function (t) {
    var li = document.createElement("li");
    li.setAttribute("role", "option");
    li.tabIndex = -1;
    li.dataset.id = t.id;
    li.textContent = t.name;
    menu.appendChild(li);
    return li;
  });
  function openMenu() {
    menu.hidden = false; btn.setAttribute("aria-expanded", "true");
    var cur = items.filter(function (li) { return li.dataset.id === team.id; })[0];
    cur.focus();
  }
  function closeMenu(refocus) {
    if (menu.hidden) return;
    menu.hidden = true; btn.setAttribute("aria-expanded", "false");
    if (refocus) btn.focus();
  }
  function choose(li) { closeMenu(true); setTeam(li.dataset.id, true); }
  btn.addEventListener("click", function () { menu.hidden ? openMenu() : closeMenu(false); });
  btn.addEventListener("keydown", function (ev) {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { ev.preventDefault(); openMenu(); }
  });
  menu.addEventListener("click", function (ev) {
    var li = ev.target.closest("li"); if (li) choose(li);
  });
  menu.addEventListener("keydown", function (ev) {
    var i = items.indexOf(document.activeElement);
    if (ev.key === "ArrowDown") { items[Math.min(items.length - 1, i + 1)].focus(); ev.preventDefault(); }
    else if (ev.key === "ArrowUp") { items[Math.max(0, i - 1)].focus(); ev.preventDefault(); }
    else if (ev.key === "Home") { items[0].focus(); ev.preventDefault(); }
    else if (ev.key === "End") { items[items.length - 1].focus(); ev.preventDefault(); }
    else if (ev.key === "Enter" || ev.key === " ") { if (i >= 0) choose(items[i]); ev.preventDefault(); }
    else if (ev.key === "Escape") { closeMenu(true); ev.preventDefault(); }
    else if (ev.key === "Tab") closeMenu(false);
  });
  document.addEventListener("pointerdown", function (ev) {
    if (!ev.target.closest(".club")) closeMenu(false);
  });

  function setTeam(id, fromUser) {
    team = teams.filter(function (t) { return t.id === id; })[0] || teams[0];
    matches = team.matches; totG = team.totG; totA = team.totA; totM = team.totM; totN = team.totN;
    sel = matches.length - 1;
    items.forEach(function (li) { li.setAttribute("aria-selected", li.dataset.id === team.id ? "true" : "false"); });
    document.getElementById("cur").textContent = team.name;
    document.getElementById("tG").textContent = totG;
    document.getElementById("tA").textContent = totA;
    document.getElementById("tGA").textContent = totG + totA;
    document.getElementById("tM").textContent = fmt(totM);
    document.getElementById("nMatches").textContent = totN;
    document.getElementById("asOf").textContent = DATA.asOf;
    document.getElementById("src").textContent = team.name;
    document.querySelector(".sub").textContent = subText();
    document.querySelector(".totals").setAttribute("aria-label", "Totals for " + team.name);
    document.title = "Arda Güler · " + team.name;
    if (fromUser) {
      try { history.replaceState(null, "", "#" + team.id); } catch (e) {}
      draw();
    }
  }
  var tip = document.createElement("div");
  tip.className = "tip";
  host.appendChild(tip);

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

  function buildSvg(W, H, interactive) {
    var m = { t: 12, r: 44, b: 26, l: 28 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var svg = el("svg", { width: W, height: H, role: "img",
      "aria-label": "Cumulative goals, assists, goal contributions and minutes played, in match order",
      "font-family": "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }, null);

    var n = matches.length;
    var x = function (i) { return m.l + ((i + 0.5) / n) * iw; };
    var maxC = Math.ceil((totG + totA) / 10) * 10;
    var maxM = Math.ceil(totM / 1000) * 1000;
    var yC = function (v) { return m.t + ih - (v / maxC) * ih; };
    var yM = function (v) { return m.t + ih - (v / maxM) * ih; };
    var cMuted = css("--muted"), cLine = css("--line"), cG = css("--goal"), cA = css("--assist"),
        cMin = css("--minutes"), cFg = css("--fg"), cBg = css("--bg"), cGC = css("--gc");

    for (var k = 0; k <= 5; k++) {
      var v = (maxC * k) / 5;
      var y = yC(v);
      el("line", { x1: m.l, x2: W - m.r, y1: y, y2: y, stroke: cLine, "stroke-width": 1, "stroke-opacity": 0.55 }, svg);
      var l = el("text", { x: m.l - 6, y: y + 4, "text-anchor": "end", fill: cMuted, "font-size": 11 }, svg);
      l.textContent = Math.round(v);
    }
    for (var j = 0; j <= 5; j++) {
      var mv = (maxM * j) / 5;
      var r = el("text", { x: W - m.r + 6, y: yM(mv) + 4, fill: cMin, "font-size": 11 }, svg);
      r.textContent = fmt(Math.round(mv));
    }

    var maxTicks = Math.max(2, Math.floor(iw / 90));
    var step = [5, 10, 20, 25, 50, 100].filter(function (c) { return n / c <= maxTicks; })[0] || 100;
    var ticks = [0];
    for (var i = step - 1; i < n; i += step) if (i - 0 >= step / 2) ticks.push(i);
    ticks.forEach(function (i) {
      var px = x(i), d = new Date(matches[i].t);
      el("line", { x1: px, x2: px, y1: m.t, y2: m.t + ih + 4, stroke: cLine, "stroke-width": 1, "stroke-opacity": 0.55 }, svg);
      var anchor = i === 0 ? "start" : (px > W - m.r - 40 ? "end" : "middle");
      var lb = el("text", { x: px, y: H - 8, "text-anchor": anchor, fill: cMuted, "font-size": 11 }, svg);
      lb.textContent = MONTHS[d.getUTCMonth()] + " ’" + String(d.getUTCFullYear()).slice(2);
    });

    function poly(fn, color, w, op) {
      el("polyline", { points: matches.map(function (r, i) { return x(i).toFixed(1) + "," + fn(r).toFixed(1); }).join(" "),
        fill: "none", stroke: color, "stroke-width": w, "stroke-linejoin": "round", "stroke-linecap": "round",
        opacity: op }, svg);
    }
    poly(function (r) { return yM(r.cm); }, cMin, 1.6, 0.8);
    poly(function (r) { return yC(r.cg + r.ca); }, cGC, 2.4, 1);
    poly(function (r) { return yC(r.cg); }, cG, 1.8, 1);
    poly(function (r) { return yC(r.ca); }, cA, 1.8, 1);

    if (interactive) {
    var s = matches[sel];
    el("line", { x1: x(sel), x2: x(sel), y1: m.t, y2: m.t + ih, stroke: cFg, "stroke-width": 1,
      "stroke-dasharray": "3 3", opacity: 0.6 }, svg);
    [[s.cm, yM, cMin], [s.cg + s.ca, yC, cGC], [s.cg, yC, cG], [s.ca, yC, cA]].forEach(function (p) {
      el("circle", { cx: x(sel), cy: p[1](p[0]), r: 4.5, fill: cBg, stroke: p[2], "stroke-width": 2.5 }, svg);
    });

    var hit = el("rect", { x: m.l, y: 0, width: iw, height: H - m.b, fill: "transparent",
      style: "cursor:crosshair;touch-action:pan-y" }, svg);
    var nearest = function (ev) {
      var r = svg.getBoundingClientRect();
      return Math.round(((ev.clientX - r.left - m.l) / iw) * n - 0.5);
    }
    hit.addEventListener("pointermove", function (ev) { pick(nearest(ev)); });
    hit.addEventListener("pointerdown", function (ev) { pick(nearest(ev)); });
    }
    return { svg: svg, x: x, m: m, ih: ih, yM: yM };
  }

  function draw() {
    var old = host.querySelector("svg");
    if (old) old.remove();
    var W = host.clientWidth, H = host.clientHeight;
    if (W < 80 || H < 80) return;
    var g = buildSvg(W, H, true);
    host.insertBefore(g.svg, tip);
    var compact = W < 520 || H < 300;
    tip.className = "tip" + (compact ? " compact" : "");
    tip.style.width = compact ? (W - g.m.l - g.m.r - 8) + "px" : "";
    renderTip(compact);
    var tw = tip.offsetWidth, th = tip.offsetHeight, px = g.x(sel), left, top;
    if (compact) {
      left = g.m.l + 4;
      top = g.yM(matches[sel].cm) < H / 2 ? g.m.t + g.ih - th - 4 : g.m.t + 4;
    } else {
      left = px > W / 2 ? px - 14 - tw : px + 14;
      left = Math.max(g.m.l + 4, Math.min(W - g.m.r - tw - 4, left));
      top = g.m.t + 6;
    }
    top = Math.max(g.m.t + 4, Math.min(g.m.t + g.ih - th - 4, top));
    tip.style.left = left + "px";
    tip.style.top = top + "px";
  }

  function renderTip(compact) {
    var r = matches[sel];
    var score = r.v === "H" ? team.name + " " + r.f + "–" + r.x + " " + r.o
                            : r.o + " " + r.x + "–" + r.f + " " + team.name;
    var mins = !r.p ? "–" : r.m ? r.m + "'" : "n/a";
    var note = !r.p ? "did not play" : r.e;
    if (compact) {
      var cols = [["n", "Matches", r.p, r.cn], ["all", "G+A", r.g + r.a, r.cg + r.ca], ["g", "Goals", r.g, r.cg],
        ["a", "Assists", r.a, r.ca], ["min", "Min", mins, fmt(r.cm) + "'"]];
      function cells(i, lead) {
        return "<span>" + lead + "</span>" + cols.map(function (c) {
          return '<b class="' + c[0] + '">' + (i === 0 ? c[1] : c[i + 1]) + "</b>";
        }).join("");
      }
      tip.innerHTML =
        '<div class="t1">' + dateStr(r.t) + " · " + r.c + "</div>" +
        '<div class="t2">' + score + (note ? " <em>(" + note + ")</em>" : "") + "</div>" +
        '<div class="cg hd">' + cells(0, "") + "</div>" +
        '<div class="cg">' + cells(1, "Match") + "</div>" +
        '<div class="cg">' + cells(2, "Total") + "</div>";
      return;
    }
    function row(cls, label, one, total) {
      return '<div class="row ' + cls + '"><span>' + label + "</span><b>" + one + "</b><b>" + total + "</b></div>";
    }
    tip.innerHTML =
      '<div class="t1">' + dateStr(r.t) + " · " + r.c + "</div>" +
      '<div class="t2">' + score + (note ? " <em>(" + note + ")</em>" : "") + "</div>" +
      '<div class="row head"><span></span><b>Match</b><b>Cumulative</b></div>' +
      row("n", "Matches", r.p, r.cn) +
      row("all", "Goal contributions", r.g + r.a, r.cg + r.ca) +
      row("g", "Goals", r.g, r.cg) +
      row("a", "Assists", r.a, r.ca) +
      row("min", "Minutes", mins, fmt(r.cm) + "'");
  }

  function pick(i) {
    i = Math.max(0, Math.min(matches.length - 1, i));
    if (i === sel) return;
    sel = i; draw();
  }

  function exportPng() {
    var VW = 1600, VH = 1000, PAD = 48, SC = 2;
    var cv = document.createElement("canvas");
    cv.width = VW * SC; cv.height = VH * SC;
    var ctx = cv.getContext("2d");
    ctx.scale(SC, SC);
    var FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
    var cBg = css("--bg"), cFg = css("--fg"), cMuted = css("--muted"), cCard = css("--card"), cLine = css("--line");
    function rr(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    ctx.fillStyle = cBg; ctx.fillRect(0, 0, VW, VH);
    ctx.textBaseline = "alphabetic";

    ctx.font = "700 44px " + FONT; ctx.fillStyle = cFg;
    var name = "Arda G\u00fcler";
    ctx.fillText(name, PAD, PAD + 40);
    var nw = ctx.measureText(name + " ").width;
    ctx.font = "500 44px " + FONT; ctx.fillStyle = cMuted;
    ctx.fillText("\u00b7 " + team.name, PAD + nw, PAD + 40);
    ctx.font = "400 18px " + FONT;
    ctx.fillText(document.querySelector(".sub").textContent, PAD, PAD + 72);

    var boxes = document.querySelectorAll(".tot");
    var gap = 16, bw = (VW - PAD * 2 - gap * (boxes.length - 1)) / boxes.length, by = PAD + 96, bh = 96;
    Array.prototype.forEach.call(boxes, function (b, i) {
      var bx = PAD + i * (bw + gap);
      rr(bx, by, bw, bh, 14); ctx.fillStyle = cCard; ctx.fill(); ctx.strokeStyle = cLine; ctx.lineWidth = 1; ctx.stroke();
      ctx.font = "700 44px " + FONT; ctx.fillStyle = getComputedStyle(b.querySelector(".num")).color;
      ctx.fillText(b.querySelector(".num").textContent, bx + 20, by + 52);
      ctx.font = "400 16px " + FONT; ctx.fillStyle = cMuted;
      ctx.fillText(b.querySelector(".lbl").textContent, bx + 20, by + 78);
    });

    var legend = [["Goal contributions (left axis)", "--gc"], ["Goals", "--goal"], ["Assists", "--assist"],
      ["Minutes (right axis)", "--minutes"]];
    ctx.font = "400 16px " + FONT;
    var sw = 26, sp = 10, between = 28;
    var total = legend.reduce(function (n, it) { return n + sw + sp + ctx.measureText(it[0]).width; }, 0) +
      between * (legend.length - 1);
    var lx = (VW - total) / 2, ly = by + bh + 36;
    legend.forEach(function (it) {
      ctx.fillStyle = css(it[1]); rr(lx, ly - 9, sw, 4, 2); ctx.fill();
      ctx.fillStyle = cMuted; ctx.fillText(it[0], lx + sw + sp, ly);
      lx += sw + sp + ctx.measureText(it[0]).width + between;
    });

    var cx = PAD, cy = ly + 18, cw = VW - PAD * 2, ch = VH - cy - 56;
    var lw = 1180, lh = Math.round(ch * lw / cw);
    var svg = buildSvg(lw, lh, false).svg;
    svg.setAttribute("viewBox", "0 0 " + lw + " " + lh);
    svg.setAttribute("width", cw * SC); svg.setAttribute("height", ch * SC);
    var xml = new XMLSerializer().serializeToString(svg);
    var img = new Image();
    img.onload = function () {
      ctx.drawImage(img, cx, cy, cw, ch);
      ctx.font = "400 14px " + FONT; ctx.fillStyle = cMuted;
      ctx.fillText("Data as of " + DATA.asOf + ". Source: Sofascore, " + team.name + " matches only. " +
        "Matches are shown in order; off-season gaps are skipped.", PAD, VH - 24);
      ctx.font = "700 20px " + FONT; ctx.fillStyle = cFg;
      ctx.textAlign = "right"; ctx.fillText("@urazdev", VW - PAD, VH - 24); ctx.textAlign = "left";
      cv.toBlob(function (blob) {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "arda-guler-" + team.id + ".png";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      }, "image/png");
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  }
  document.getElementById("dl").addEventListener("click", exportPng);

  host.setAttribute("tabindex", "0");
  host.addEventListener("keydown", function (ev) {
    if (ev.key === "ArrowLeft") { pick(sel - 1); ev.preventDefault(); }
    if (ev.key === "ArrowRight") { pick(sel + 1); ev.preventDefault(); }
    if (ev.key === "Home") { pick(0); ev.preventDefault(); }
    if (ev.key === "End") { pick(matches.length - 1); ev.preventDefault(); }
  });

  window.addEventListener("hashchange", function () { setTeam(location.hash.slice(1), true); });

  setTeam(location.hash.slice(1), false);
  draw();
  if (window.ResizeObserver) new ResizeObserver(draw).observe(host);
  else window.addEventListener("resize", draw);
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", draw);
  }
})();
