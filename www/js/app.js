/* WrtWeb SPA
 * A full GL.iNet-style admin panel implemented as a single-page app.
 * Routes are hash-based (e.g. #/internet, #/clients) and every view talks
 * to the WrtWeb JSON backend at /cgi-bin/wrtweb-api.
 */
(function () {
  "use strict";

  const API_BASE = new URL("../cgi-bin/wrtweb-api", location.href).href;

  /* ---------------- i18n ---------------- */
  let LANG = (function () {
    const qp = new URLSearchParams(location.search).get("lang");
    if (qp === "zh" || qp === "en") { try { localStorage.setItem("wrtweb.lang", qp); } catch (e) {} return qp; }
    return localStorage.getItem("wrtweb.lang") || "en";
  })();
  const I18 = () => (window.I18N[LANG] || window.I18N.en);
  function t(k, scope) {
    const L = I18();
    const s = scope || "common";
    return (L[s] && L[s][k]) || (window.I18N.en[s] && window.I18N.en[s][k]) || k;
  }
  function setLang(l) {
    LANG = l;
    localStorage.setItem("wrtweb.lang", l);
    // persist to router too (best-effort)
    apiPost("system_set", { lang: l === "zh" ? "zh_cn" : "en" }).catch(() => {});
    renderNav();
    render();
  }

  /* ---------------- theme ---------------- */
  function applyTheme(mode) {
    const m = mode || localStorage.getItem("wrtweb.theme") || "auto";
    const sysDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = m === "dark" || (m === "auto" && sysDark);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    const btn = document.getElementById("theme-toggle");
    if (btn) btn.textContent = m === "auto" ? "🌓" : (m === "dark" ? "🌙" : "☀️");
  }
  function cycleTheme() {
    const order = ["auto", "dark", "light"];
    const cur = localStorage.getItem("wrtweb.theme") || "auto";
    const next = order[(order.indexOf(cur) + 1) % order.length];
    localStorage.setItem("wrtweb.theme", next);
    applyTheme(next);
  }

  /* ---------------- api ---------------- */
  async function apiGet(c, params) {
    const u = new URL(API_BASE);
    u.searchParams.set("c", c);
    if (params) for (const k in params) u.searchParams.set(k, params[k]);
    const r = await fetch(u.href, { headers: { Accept: "application/json" } });
    return r.json();
  }
  async function apiPost(c, params) {
    const u = new URL(API_BASE);
    u.searchParams.set("c", c);
    const body = new URLSearchParams(params || {});
    const r = await fetch(u.href, { method: "POST", body });
    return r.json();
  }

  /* ---------------- dom helpers ---------------- */
  const $ = (s, el) => (el || document).querySelector(s);
  // Normalize a possibly-empty Lua table ({} for empty array) to a JS array.
  const arr = (x) => (Array.isArray(x) ? x : []);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function toast(msg, kind) {
    let el = document.createElement("div");
    el.className = "toast " + (kind || "ok");
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 300); }, 2200);
  }

  function cfgBtn(href) {
    return `<a class="ghost" style="padding:9px 16px;border-radius:9px" href="${href}" target="_blank">${esc(t("configure"))}</a>`;
  }

  function stat(k, v, small, href) {
    const inner = `<div class="k">${esc(k)}</div><div class="v ${small ? "sm" : ""}">${esc(v || "-")}</div>`;
    return href
      ? `<a class="stat stat-link" href="#/${href}">${inner}<span class="go">›</span></a>`
      : `<div class="stat">${inner}</div>`;
  }

  /* ---------------- nav ---------------- */
  const NAV = [
    { group: "internet", items: [
      { key: "overview", ic: "◎" },
      { key: "internet", ic: "🌐" },
      { key: "hotspot", ic: "📡" },
      { key: "wan", ic: "⇄" },
      { key: "multiwan", ic: "⇉" },
    ]},
    { group: "clients", items: [
      { key: "clients", ic: "👥" },
    ]},
    { group: "apps", items: [
      { key: "plugins", ic: "🧩" },
      { key: "adguard", ic: "🛡" },
      { key: "nas", ic: "💾" },
      { key: "ddns", ic: "🌍" },
      { key: "parental", ic: "👨‍👩‍👧" },
      { key: "tailscale", ic: "⇋" },
      { key: "zerotier", ic: "⓿" },
      { key: "astrowarp", ic: "✦" },
      { key: "edgerouter", ic: "◈" },
    ]},
    { group: "network", items: [
      { key: "wireless", ic: "📶" },
      { key: "lan", ic: "🏠" },
      { key: "guest", ic: "🧑" },
      { key: "dns", ic: "🔤" },
      { key: "ipv6", ic: "6" },
      { key: "firewall", ic: "🧱" },
      { key: "ports", ic: "↦" },
      { key: "vlan", ic: "▤" },
    ]},
    { group: "system", items: [
      { key: "sysinfo", ic: "ℹ" },
      { key: "timezone", ic: "🕒" },
      { key: "logs", ic: "📜" },
      { key: "mirror", ic: "⇅" },
      { key: "remote", ic: "🛰" },
      { key: "storage", ic: "🖴" },
      { key: "upgrade", ic: "⤒" },
      { key: "advanced", ic: "⚙" },
      { key: "security", ic: "🔑" },
      { key: "backup", ic: "🗄" },
      { key: "reboot", ic: "⏻" },
    ]},
    { group: "vpn", collapsed: true, items: [
      { key: "vpn", ic: "🔒" },
      { key: "clash", ic: "◈" },
      { key: "wgclient", ic: "W" },
      { key: "wgserver", ic: "W" },
      { key: "ovpnclient", ic: "O" },
      { key: "ovpnserver", ic: "O" },
      { key: "tor", ic: "T" },
    ]},
  ];

  function navCollapsedState() {
    try { return JSON.parse(localStorage.getItem("wrtweb.collapsed") || "{}"); }
    catch (e) { return {}; }
  }
  function setNavCollapsed(group, val) {
    const s = navCollapsedState(); s[group] = val;
    localStorage.setItem("wrtweb.collapsed", JSON.stringify(s));
  }

  function renderNav() {
    const nav = $("#nav");
    const collapsed = navCollapsedState();
    let html = "";
    for (const g of NAV) {
      if (g.collapsed) {
        const isCol = collapsed[g.group] !== false; // default collapsed
        html += `<details class="nav-group nav-details" data-group="${esc(g.group)}"${isCol ? "" : " open"}>`;
        html += `<summary>${esc(t(g.group, "groups"))}</summary>`;
        for (const it of g.items) {
          html += `<a class="nav-item" data-route="${it.key}" href="#/${it.key}">
            <span class="ic">${it.ic}</span><span>${esc(t(it.key, "nav"))}</span></a>`;
        }
        html += `</details>`;
      } else {
        html += `<div class="nav-group">${esc(t(g.group, "groups"))}</div>`;
        for (const it of g.items) {
          html += `<a class="nav-item" data-route="${it.key}" href="#/${it.key}">
            <span class="ic">${it.ic}</span><span>${esc(t(it.key, "nav"))}</span></a>`;
        }
      }
    }
    nav.innerHTML = html;
    // persist collapsible open/closed state
    nav.querySelectorAll(".nav-details").forEach(d => {
      d.addEventListener("toggle", () =>
        setNavCollapsed(d.getAttribute("data-group"), !d.open));
    });
    const sw = $("#lang-switch");
    if (sw) sw.value = LANG;
  }

  /* ---------------- views ---------------- */
  const VIEWS = {};

  function human(bytes) {
    bytes = Math.max(0, Number(bytes) || 0);
    const u = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
    let i = 0, v = bytes;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return (v >= 100 ? Math.round(v) : v.toFixed(1)) + " " + u[i];
  }
  const kib = (kb) => human((Number(kb) || 0) * 1024);

  VIEWS.overview = async function () {
    const d = await apiGet("overview");
    const up = d.uptime || 0;
    const uh = Math.floor(up / 3600), um = Math.floor((up % 3600) / 60);
    const diskRows = arr(d.storage).map(s => `<tr>
      <td>${esc(s.target)}</td><td>${esc(s.fs)}</td>
      <td>${kib(s.total)}</td><td>${kib(s.used)}</td><td>${kib(s.avail)}</td>
      <td>${esc(s.pct)}%</td></tr>`).join("");
    const leaseRows = arr(d.leases).map(l => `<tr>
      <td>${esc(l.host || "-")}</td><td>${esc(l.ip)}</td><td class="small">${esc(l.mac)}</td></tr>`).join("");
    const aps = arr(d.wireless).map(w => `<span class="tag">${esc(w.ssid || "-")} · ${esc(w.radio || "")}</span>`).join(" ");
    return wrap(`
      <div class="card"><h2>${esc(t("sysinfo", "nav"))}</h2>
        <div class="grid">
          ${stat(t("model"), d.model, false, "sysinfo")}
          ${stat(t("hostname"), d.hostname, false, "timezone")}
          ${stat(t("firmware"), d.firmware, true, "upgrade")}
          ${stat(t("kernel", "v"), d.kernel, true)}
          ${stat(t("localtime", "v"), d.localtime, true)}
          ${stat(t("uptime"), uh + "h " + um + "m", false, "sysinfo")}
          ${stat(t("load"), d.load, false, "sysinfo")}
        </div>
      </div>

      <div class="card"><h2>${esc(t("memory"))}</h2>
        <div class="grid">
          ${stat(t("used", "v"), kib(d.mem_used) + " / " + kib(d.mem_total) + " (" + (d.mem_pct || 0) + "%)")}
          ${stat(t("available", "v"), kib(d.mem_avail))}
          ${stat(t("free", "v"), kib(d.mem_free))}
          ${stat(t("buffers", "v"), kib(d.mem_buffers))}
          ${stat(t("cached", "v"), kib(d.mem_cached))}
        </div>
      </div>

      <div class="card"><h2>${esc(t("storage_usage", "v"))}</h2>
        <table><thead><tr><th>${esc(t("target", "v"))}</th><th>${esc(t("filesystem", "v"))}</th>
        <th>${esc(t("total", "v"))}</th><th>${esc(t("used", "v"))}</th><th>${esc(t("available", "v"))}</th><th>%</th></tr></thead>
        <tbody>${diskRows || `<tr><td colspan="6" class="muted">${esc(t("none"))}</td></tr>`}</tbody></table>
        <div class="btn-row"><a class="ghost" style="padding:9px 16px;border-radius:9px" href="#/storage">${esc(t("storage", "nav"))} ›</a></div>
      </div>

      <div class="card"><h2>${esc(t("network_wan", "v"))}</h2>
        <div class="grid">
          ${stat(t("wan_ip"), d.wan_ip || "-", false, "wan")}
          ${stat("IPv6", d.wan_ip6 || "-", true, "wan")}
          ${stat(t("protocol", "v"), d.wan_proto || "-")}
          ${stat(t("mac", "v"), d.wan_mac || "-", true)}
          ${stat(t("uptime"), Math.floor((d.wan_uptime || 0) / 60) + "m")}
          ${stat("RX", human(d.wan_rx))}
          ${stat("TX", human(d.wan_tx))}
          ${stat("DNS", d.wan_dns || "-", true)}
          ${stat(t("clients", "nav"), d.clients, false, "clients")}
        </div>
        <div class="btn-row"><a class="ghost" style="padding:9px 16px;border-radius:9px" href="#/wan">${esc(t("wan", "nav"))} ›</a></div>
      </div>

      <div class="card"><h2>${esc(t("dhcp_leases", "v"))} (${arr(d.leases).length})</h2>
        <table><thead><tr><th>${esc(t("hostname"))}</th><th>IP</th><th>${esc(t("mac", "v"))}</th></tr></thead>
        <tbody>${leaseRows || `<tr><td colspan="3" class="muted">${esc(t("none"))}</td></tr>`}</tbody></table>
        <div class="btn-row"><a class="ghost" style="padding:9px 16px;border-radius:9px" href="#/clients">${esc(t("clients", "nav"))} ›</a></div>
      </div>

      <div class="card"><h2>${esc(t("wireless_aps", "v"))} · ${esc(t("stations", "v"))}: ${d.stations || 0}</h2>
        <p>${aps || `<span class="muted">${esc(t("none"))}</span>`}</p>
        <div class="btn-row"><a class="ghost" style="padding:9px 16px;border-radius:9px" href="#/wireless">${esc(t("wireless", "nav"))} ›</a></div>
      </div>

      <div class="card"><h2>${esc(t("system_log", "v"))}</h2>
        <pre class="log">${esc(d.log || "")}</pre>
        <div class="btn-row"><a class="ghost" style="padding:9px 16px;border-radius:9px" href="#/logs">${esc(t("logs", "nav"))} ›</a></div>
      </div>`);
  };

  VIEWS.internet = async function () {
    const [ov, nets] = await Promise.all([apiGet("overview"), apiGet("repeater_scan")]);
    const list = arr(nets.networks);
    let rows = list.length
      ? list.map(n => `<div class="list-item">
          <div class="grow"><strong>${esc(n.ssid || "(hidden)")}</strong>
            <div class="small muted">${esc(n.bssid || "")} · ${esc(n.encryption || "")} · ${esc(n.signal || "")} dBm</div></div>
          <button class="ghost" data-join="${esc(n.ssid)}" data-bssid="${esc(n.bssid || "")}">${esc(t("connect"))}</button>
        </div>`).join("")
      : `<div class="muted">${esc(t("none"))}</div>`;

    const html = wrap(`
      <div class="card"><h2>${esc(t("internet", "nav"))} · ${esc(t("status"))}</h2>
        <div class="grid">
          ${stat(t("wan_ip"), ov.wan_ip || "-")}
          ${stat(t("wan_proto", "v"), ov.wan_proto || "-")}
        </div>
      </div>
      <div class="card"><h2>${esc(t("repeater_title", "v"))}</h2>
        <p class="muted small">${esc(t("repeater_note", "v"))}</p>
        <div class="btn-row"><button id="do-scan">${esc(t("scan"))}</button>${cfgBtn("/cgi-bin/luci/admin/network/wireless")}</div>
        <div id="net-list" style="margin-top:12px">${rows}</div>
      </div>
      <div class="card"><h2>${esc(t("join_manually", "v"))}</h2>
        <div class="row">
          <div><label>${esc(t("ssid"))}</label><input id="j-ssid"></div>
          <div><label>${esc(t("password"))}</label><input id="j-key" type="password"></div>
          <div><label>${esc(t("encryption", "v"))}</label><select id="j-enc">
            <option value="psk2">${esc(t("open_wpa2", "v"))}</option><option value="sae">${esc(t("open_wpa3", "v"))}</option>
            <option value="psk-mixed">${esc(t("open_wpa_mixed", "v"))}</option><option value="none">${esc(t("open", "v"))}</option>
          </select></div>
        </div>
        <div class="btn-row"><button id="do-join">${esc(t("connect"))}</button></div>
      </div>`);
    return html;
  };
  VIEWS.internet.mount = function () {
    const scan = $("#do-scan");
    if (scan) scan.onclick = async () => { await render(); toast(t("scanning", "v")); };
    document.querySelectorAll("[data-join]").forEach(b => {
      b.onclick = async () => {
        const ssid = b.getAttribute("data-join");
        const key = prompt("Password for " + ssid + " (blank if open)") || "";
        const enc = key ? "psk2" : "none";
        const r = await apiPost("repeater_join", { ssid, key, encryption: enc, bssid: b.getAttribute("data-bssid") });
        toast(r.ok ? t("connected_to", "v") + " " + ssid : t("failed", "v"), r.ok ? "ok" : "err");
      };
    });
    const j = $("#do-join");
    if (j) j.onclick = async () => {
      const ssid = $("#j-ssid").value, key = $("#j-key").value, encryption = $("#j-enc").value;
      if (!ssid) return toast(t("ssid_required", "v"), "err");
      const r = await apiPost("repeater_join", { ssid, key, encryption });
      toast(r.ok ? t("saved") : t("failed", "v"), r.ok ? "ok" : "err");
    };
  };

  VIEWS.hotspot = async function () {
    const [mod, wl] = await Promise.all([apiGet("modem"), apiGet("wireless")]);
    const aps = arr(wl.ifaces);
    const protos = ["dhcp", "qmi", "mbim", "ppp"];
    const apCards = aps.map(i => `<div class="card">
      <h2>${esc(i.ssid || i.name)} <span class="tag">${esc(i.device || "")}</span></h2>
      <div class="row">
        <div><label>${esc(t("ssid"))}</label><input data-hf="ssid" data-hsec="${esc(i.name)}" value="${esc(i.ssid || "")}"></div>
        <div><label>${esc(t("password"))}</label><input data-hf="key" data-hsec="${esc(i.name)}" type="password" value="${esc(i.key || "")}"></div>
      </div>
      <div class="btn-row"><button data-hsave="${esc(i.name)}">${esc(t("save"))}</button></div>
    </div>`).join("");
    return wrap(`
      <div class="card"><h2>${esc(t("modem_title", "v"))}</h2>
        <div class="grid">
          ${stat(t("detected", "v"), mod.detected || t("none"))}
          ${stat(t("status"), mod.enabled === "1" ? t("enabled") : t("disabled"))}
        </div>
        <div class="row">
          <div><label>${esc(t("protocol", "v"))}</label><select id="hf-proto">
            ${protos.map(p => `<option ${mod.proto === p ? "selected" : ""} value="${p}">${p.toUpperCase()}</option>`).join("")}
          </select></div>
          <div><label>${esc(t("apn", "v"))}</label><input id="hf-apn" value="${esc(mod.apn || "")}"></div>
        </div>
        <div class="btn-row">
          <button id="hf-on">${esc(t("enable_share", "v"))}</button>
          <button class="ghost" id="hf-off">${esc(t("disabled"))}</button>
          ${cfgBtn("/cgi-bin/luci/admin/network/wireless")}
        </div>
        <p class="muted small">${esc(t("modem_note", "v"))}</p>
      </div>
      <div class="card"><h2>${esc(t("wifi_hotspot", "v"))}</h2>
        <p class="muted small">${esc(t("tethering", "v"))} — LAN devices join this Wi-Fi and share the uplink.</p>
      </div>
      ${apCards || `<div class="card muted">${esc(t("no_wireless", "v"))}</div>`}
    `);
  };
  VIEWS.hotspot.mount = function () {
    const on = $("#hf-on"), off = $("#hf-off");
    if (on) on.onclick = async () => {
      const r = await apiPost("modem_set", { enabled: "1", proto: $("#hf-proto").value, apn: $("#hf-apn").value });
      toast(r.ok ? t("saved") : t("failed", "v"), r.ok ? "ok" : "err");
    };
    if (off) off.onclick = async () => {
      const r = await apiPost("modem_set", { enabled: "0" });
      toast(r.ok ? t("saved") : t("failed", "v"), r.ok ? "ok" : "err");
    };
    document.querySelectorAll("[data-hsave]").forEach(b => {
      b.onclick = async () => {
        const sec = b.getAttribute("data-hsave");
        const p = { iface: sec };
        document.querySelectorAll(`[data-hsec="${sec}"]`).forEach(inp => p[inp.getAttribute("data-hf")] = inp.value);
        const r = await apiPost("wireless_set", p);
        toast(r.ok ? t("saved") : t("failed", "v"), r.ok ? "ok" : "err");
      };
    });
  };

  VIEWS.wan = async function () {
    const d = await apiGet("wan");
    return wrap(`
      <div class="card"><h2>${esc(t("wan", "v"))}</h2>
        <div class="row">
          <div><label>${esc(t("protocol", "v"))}</label><select id="w-proto">
            ${["dhcp","static","pppoe"].map(p => `<option ${d.proto===p?"selected":""} value="${p}">${p.toUpperCase()}</option>`).join("")}
          </select></div>
        </div>
        <div class="row">
          <div><label>${esc(t("pppoe_user_static", "v"))}</label><input id="w-user" value="${esc(d.username||d.ipaddr||"")}"></div>
          <div><label>${esc(t("password_netmask", "v"))}</label><input id="w-pass" value="${esc(d.netmask||"")}"></div>
          <div><label>${esc(t("gateway", "v"))}</label><input id="w-gw" value="${esc(d.gateway||"")}"></div>
        </div>
        <div class="btn-row"><button id="w-save">${esc(t("save"))}</button>${cfgBtn("/cgi-bin/luci/admin/network/network")}</div>
        <p class="muted small">${esc(t("current_wan_ip", "v"))}: ${esc(d.ip||"-")}</p>
      </div>`);
  };
  VIEWS.wan.mount = function () {
    $("#w-save").onclick = async () => {
      const proto = $("#w-proto").value;
      const p = { proto };
      if (proto === "pppoe") { p.username = $("#w-user").value; p.password = $("#w-pass").value; }
      if (proto === "static") { p.ipaddr = $("#w-user").value; p.netmask = $("#w-pass").value; p.gateway = $("#w-gw").value; }
      const r = await apiPost("wan_set", p);
      toast(r.ok ? t("saved") : t("failed", "v"), r.ok ? "ok" : "err");
    };
  };

  VIEWS.clients = async function () {
    const d = await apiGet("clients");
    const sigTag = (s) => {
      if (s == null) return "-";
      const cls = s >= -60 ? "on" : (s >= -75 ? "" : "off");
      return `<span class="tag ${cls}">${s} dBm</span>`;
    };
    const rows = arr(d.clients).map(c => {
      let conn;
      if (c.method === "wifi") {
        const band = c.band === "5g" ? t("band_5g", "v") : (c.band === "2.4g" ? t("band_2g", "v") : "");
        conn = `<span class="tag">${esc(t("wifi", "v"))}${band ? " " + esc(band) : ""}</span>`;
      } else {
        conn = `<span class="tag">${esc(t("wired", "v"))}</span>`;
      }
      const rate = (c.tx != null || c.rx != null)
        ? `${c.tx != null ? c.tx : "-"} / ${c.rx != null ? c.rx : "-"} Mbit/s` : "-";
      return `<tr>
        <td>${esc(c.name || "-")}</td>
        <td>${esc(c.ip || "-")}</td>
        <td class="small">${esc(c.mac || "")}</td>
        <td>${conn}</td>
        <td>${c.method === "wifi" ? sigTag(c.signal) : "-"}</td>
        <td class="small">${esc(rate)}</td>
        <td>${c.online ? `<span class="tag on">${esc(t("online", "v"))}</span>` : `<span class="tag off">${esc(t("offline", "v"))}</span>`}</td>
      </tr>`;
    }).join("");
    return wrap(`<div class="card"><h2>${esc(t("clients", "nav"))}</h2>
      <table><thead><tr><th>${esc(t("name"))}</th><th>IP</th><th>${esc(t("mac", "v"))}</th>
      <th>${esc(t("method", "v"))}</th><th>${esc(t("signal", "v"))}</th><th>${esc(t("rate", "v"))}</th><th>${esc(t("status"))}</th></tr></thead><tbody>
      ${rows || `<tr><td colspan="7" class="muted">${esc(t("none"))}</td></tr>`}</tbody></table>
      <div class="btn-row">${cfgBtn("/cgi-bin/luci/admin/network/network")}</div></div>`);
  };

  VIEWS.wireless = async function () {
    const d = await apiGet("wireless");
    const ifaces = arr(d.ifaces).map(i => `<div class="card">
      <h2>${esc(i.ssid || i.name)} <span class="tag">${esc(i.device || "")}</span></h2>
      <div class="row">
        <div><label>${esc(t("ssid"))}</label><input data-f="ssid" data-sec="${esc(i.name)}" value="${esc(i.ssid||"")}"></div>
        <div><label>${esc(t("password"))}</label><input data-f="key" data-sec="${esc(i.name)}" type="password" value="${esc(i.key||"")}"></div>
        <div><label>${esc(t("encryption", "v"))}</label><select data-f="encryption" data-sec="${esc(i.name)}">
          ${["psk2","sae","sae-mixed","psk-mixed","none"].map(e=>`<option ${i.encryption===e?"selected":""} value="${e}">${e}</option>`).join("")}
        </select></div>
      </div>
      <div class="btn-row"><button data-save-sec="${esc(i.name)}">${esc(t("save"))}</button></div>
    </div>`).join("");
    return wrap((ifaces || `<div class="muted">${esc(t("no_wireless", "v"))}</div>`) + `<div class="btn-row">${cfgBtn("/cgi-bin/luci/admin/network/wireless")}</div>`);
  };
  VIEWS.wireless.mount = function () {
    document.querySelectorAll("[data-save-sec]").forEach(btn => {
      btn.onclick = async () => {
        const sec = btn.getAttribute("data-save-sec");
        const p = { iface: sec };
        document.querySelectorAll(`[data-sec="${sec}"]`).forEach(inp => p[inp.getAttribute("data-f")] = inp.value);
        const r = await apiPost("wireless_set", p);
        toast(r.ok ? t("saved") : t("failed", "v"), r.ok ? "ok" : "err");
      };
    });
  };

  VIEWS.lan = async function () {
    const d = await apiGet("lan");
    return wrap(`<div class="card"><h2>${esc(t("lan", "nav"))}</h2>
      <div class="row">
        <div><label>IP</label><input id="l-ip" value="${esc(d.ipaddr||"")}"></div>
        <div><label>${esc(t("netmask", "v"))}</label><input id="l-mask" value="${esc(d.netmask||"")}"></div>
        <div><label>${esc(t("dhcp_start", "v"))}</label><input id="l-s" value="${esc(d.dhcp_start||"")}"></div>
        <div><label>${esc(t("dhcp_limit", "v"))}</label><input id="l-l" value="${esc(d.dhcp_limit||"")}"></div>
      </div>
      <div class="btn-row"><button id="l-save">${esc(t("save"))}</button>${cfgBtn("/cgi-bin/luci/admin/network/network")}</div>
      <p class="muted small">${esc(t("lan_note", "v"))}</p></div>`);
  };
  VIEWS.lan.mount = function () {
    $("#l-save").onclick = async () => {
      const r = await apiPost("lan_set", { ipaddr:$("#l-ip").value, netmask:$("#l-mask").value,
        dhcp_start:$("#l-s").value, dhcp_limit:$("#l-l").value });
      toast(r.ok ? t("saved") : t("failed", "v"), r.ok ? "ok" : "err");
    };
  };

  VIEWS.guest = async function () {
    const d = await apiGet("wireless");
    const guest = arr(d.ifaces).find(i => i.network === "guest");
    return wrap(`<div class="card"><h2>${esc(t("guest", "nav"))}</h2>
      <p class="muted small">${esc(t("guest_note", "v"))}</p>
      <div class="row">
        <div><label>${esc(t("ssid"))}</label><input id="g-ssid" value="${esc(guest?guest.ssid:"guest")}"></div>
        <div><label>${esc(t("password"))}</label><input id="g-key" type="password" value="${esc(guest?guest.key:"")}"></div>
      </div>
      <div class="btn-row"><button id="g-save">${esc(t("save"))}</button>${cfgBtn("/cgi-bin/luci/admin/network/wireless")}</div>
      <p class="muted small">${esc(t("guest_apply_note", "v"))}</p>
    </div>`);
  };
  VIEWS.guest.mount = function () {
    $("#g-save").onclick = async () => {
      const r = await apiPost("guest_apply", { ssid:$("#g-ssid").value, key:$("#g-key").value, encryption:"psk2", isolate:"1" });
      toast(r.ok ? t("saved") : t("failed", "v"), r.ok ? "ok" : "err");
    };
  };

  VIEWS.ports = async function () {
    const d = await apiGet("portforward");
    const rows = arr(d.rules).map(r => `<tr>
      <td>${esc(r.name)}</td><td>${esc(r.proto)}</td><td>${esc(r.src_dport)}</td>
      <td>${esc(r.dest_ip)}:${esc(r.dest_port)}</td>
      <td><button class="ghost" data-del="${r.idx}">${esc(t("remove"))}</button></td></tr>`).join("");
    return wrap(`<div class="card"><h2>${esc(t("ports", "nav"))}</h2>
      <table><thead><tr><th>${esc(t("name"))}</th><th>${esc(t("proto", "v"))}</th><th>${esc(t("ext_port", "v"))}</th><th>${esc(t("internal", "v"))}</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" class="muted">${esc(t("none"))}</td></tr>`}</tbody></table></div>
      <div class="card"><h2>${esc(t("add"))}</h2>
        <div class="row">
          <div><label>${esc(t("name"))}</label><input id="p-name"></div>
          <div><label>${esc(t("proto", "v"))}</label><select id="p-proto"><option>tcp</option><option>udp</option><option>tcp udp</option></select></div>
          <div><label>${esc(t("ext_port", "v"))}</label><input id="p-sport"></div>
          <div><label>${esc(t("internal_ip", "v"))}</label><input id="p-ip"></div>
          <div><label>${esc(t("internal_port", "v"))}</label><input id="p-dport"></div>
        </div>
        <div class="btn-row"><button id="p-add">${esc(t("add"))}</button>${cfgBtn("/cgi-bin/luci/admin/network/firewall")}</div></div>`);
  };
  VIEWS.ports.mount = function () {
    $("#p-add").onclick = async () => {
      const r = await apiPost("portforward_add", { name:$("#p-name").value, proto:$("#p-proto").value,
        src_dport:$("#p-sport").value, dest_ip:$("#p-ip").value, dest_port:$("#p-dport").value });
      if (r.ok) { toast(t("saved")); render(); } else toast(t("failed", "v"), "err");
    };
    document.querySelectorAll("[data-del]").forEach(b => {
      b.onclick = async () => {
        const r = await apiPost("portforward_del", { idx: b.getAttribute("data-del") });
        if (r.ok) { toast(t("saved")); render(); } else toast(t("failed", "v"), "err");
      };
    });
  };

  VIEWS.adguard = async function () {
    const d = await apiGet("adguard");
    return wrap(`<div class="card"><h2>${esc(t("adguard", "nav"))}</h2>
      <div class="grid">
        ${stat(t("installed"), d.installed ? t("installed") : t("not_installed"))}
        ${stat(t("status"), d.running ? t("running") : t("stopped"))}
      </div>
      <div class="btn-row">
        <button id="ag-start">${esc(t("start", "v"))}</button>
        <button class="ghost" id="ag-stop">${esc(t("stop", "v"))}</button>
        <a class="ghost" style="padding:9px 16px;border-radius:9px" href="http://${esc(location.hostname)}:3000" target="_blank">${esc(t("open_ui", "v"))}</a>
        ${cfgBtn("/cgi-bin/luci/admin/services/adguardhome")}
      </div>
      <p class="muted small">${esc(t("ag_note", "v"))}</p>
    </div>`);
  };
  VIEWS.adguard.mount = function () {
    $("#ag-start").onclick = async () => { const r = await apiPost("adguard_set",{action:"start"}); toast(r.ok?t("started","v"):t("failed","v"),r.ok?"ok":"err"); };
    $("#ag-stop").onclick = async () => { const r = await apiPost("adguard_set",{action:"stop"}); toast(r.ok?t("stopped","v"):t("failed","v"),r.ok?"ok":"err"); };
  };

  VIEWS.nas = async function () {
    const [d, su] = await Promise.all([apiGet("nas"), apiGet("samba_users")]);
    const users = arr(su.users);
    const userRows = users.map(x => `<div style="border-bottom:1px solid var(--line);padding:10px 0">
      <div class="row">
        <div><label>${esc(t("username", "v"))}</label><input value="${esc(x.name)}" readonly></div>
        <div><label>${esc(t("storage_path", "v"))}</label><input data-su-path="${esc(x.name)}" value="${esc(x.path || ("/mnt/nvme/" + x.name))}"></div>
      </div>
      <div class="btn-row">
        <button data-su-assign="${esc(x.name)}">${esc(t("assign", "v"))}</button>
        <button class="ghost" data-su-del="${esc(x.name)}">${esc(t("remove"))}</button>
      </div></div>`).join("");
    return wrap(`
      <div class="card"><h2>${esc(t("nas", "nav"))}</h2>
        <div class="grid">${stat(t("samba", "v"), d.samba_enabled === "1" ? t("enabled") : t("disabled"))}</div>
        <p class="small muted">${esc(t("mounts", "v"))}: ${esc(d.mounts || "-")}</p>
        <div class="btn-row">
          <button id="nas-on">${esc(t("enabled"))}</button>
          <button class="ghost" id="nas-off">${esc(t("disabled"))}</button>
          ${cfgBtn("/cgi-bin/luci/admin/services/samba4")}
        </div>
        <p class="muted small">${esc(t("nas_note", "v"))}</p>
      </div>
      <div class="card"><h2>${esc(t("samba_users", "v"))}</h2>
        <div>${userRows || `<div class="muted">${esc(t("none"))}</div>`}</div>
        <div class="row">
          <div><label>${esc(t("username", "v"))}</label><input id="su-user" autocomplete="off"></div>
          <div><label>${esc(t("password"))}</label><input id="su-pass" type="password" autocomplete="new-password"></div>
          <div><label>${esc(t("storage_path", "v"))}</label><input id="su-path" placeholder="/mnt/nvme/user"></div>
        </div>
        <div class="btn-row"><button id="su-add">${esc(t("add_user", "v"))}</button></div>
        <p class="muted small">${esc(t("samba_users_note", "v"))}</p>
      </div>`);
  };
  VIEWS.nas.mount = function () {
    const on = $("#nas-on"), off = $("#nas-off");
    if (on) on.onclick = async () => { const r = await apiPost("nas_set", { enabled: "1" }); toast(r.ok ? t("saved") : t("failed", "v"), r.ok ? "ok" : "err"); render(); };
    if (off) off.onclick = async () => { const r = await apiPost("nas_set", { enabled: "0" }); toast(r.ok ? t("saved") : t("failed", "v"), r.ok ? "ok" : "err"); render(); };
    const add = $("#su-add");
    if (add) add.onclick = async () => {
      const user = $("#su-user").value.trim(), pass = $("#su-pass").value;
      const path = $("#su-path") ? $("#su-path").value.trim() : "";
      if (!user) return toast(t("username", "v"), "err");
      if (pass.length < 5) return toast(t("pw_min", "v"), "err");
      const r = await apiPost("samba_user_add", { user, pass, path });
      toast(r.ok ? t("saved") : (r.error || t("failed", "v")), r.ok ? "ok" : "err");
      if (r.ok) render();
    };
    document.querySelectorAll("[data-su-assign]").forEach(b => {
      b.onclick = async () => {
        const u = b.getAttribute("data-su-assign");
        const inp = document.querySelector(`[data-su-path="${u}"]`);
        const r = await apiPost("samba_assign", { user: u, path: inp ? inp.value.trim() : "" });
        toast(r.ok ? t("saved") : (r.error || t("failed", "v")), r.ok ? "ok" : "err");
        if (r.ok) render();
      };
    });
    document.querySelectorAll("[data-su-del]").forEach(b => {
      b.onclick = async () => {
        const r = await apiPost("samba_user_del", { user: b.getAttribute("data-su-del") });
        toast(r.ok ? t("saved") : t("failed", "v"), r.ok ? "ok" : "err");
        if (r.ok) render();
      };
    });
  };

  VIEWS.ddns = async function () {
    const d = await apiGet("ddns");
    const rows = arr(d.services).map(s=>`<tr><td>${esc(s.service)}</td><td>${esc(s.domain)}</td><td>${esc(s.enabled)}</td></tr>`).join("");
    return wrap(`<div class="card"><h2>${esc(t("ddns", "nav"))}</h2>
      <table><thead><tr><th>${esc(t("service", "v"))}</th><th>${esc(t("domain", "v"))}</th><th>${esc(t("enabled"))}</th></tr></thead>
      <tbody>${rows||`<tr><td colspan="3" class="muted">${esc(t("none"))}</td></tr>`}</tbody></table>
      <p class="muted small">${esc(t("ddns_note", "v"))}</p>
      <div class="btn-row">${cfgBtn("/cgi-bin/luci/admin/services/ddns")}</div></div>`);
  };

  VIEWS.vpn = async function () {
    const d = await apiGet("vpn");
    const wg = arr(d.wireguard).map(w=>`<tr><td>${esc(w.iface)}</td><td>${esc(w.peers)}</td></tr>`).join("");
    return wrap(`<div class="card"><h2>${esc(t("vpn", "nav"))}</h2>
      <div class="grid">
        ${stat("WireGuard", d.wg_installed ? t("installed") : t("not_installed"))}
        ${stat("OpenVPN", d.ovpn_installed ? t("installed") : t("not_installed"))}
        ${stat(t("ovpn_profiles", "v"), d.ovpn_count)}
      </div>
      <table style="margin-top:12px"><thead><tr><th>${esc(t("wg_iface", "v"))}</th><th>${esc(t("peers", "v"))}</th></tr></thead>
      <tbody>${wg||`<tr><td colspan="2" class="muted">${esc(t("none"))}</td></tr>`}</tbody></table>
      <div class="btn-row">${cfgBtn("/cgi-bin/luci/admin/network/network")}</div></div>`);
  };

  VIEWS.clash = async function () {
    const d = await apiGet("clash");
    return wrap(`<div class="card"><h2>${esc(t("clash", "nav"))}</h2>
      <div class="grid">
        ${stat(t("installed"), d.installed ? t("installed") : t("not_installed"))}
        ${stat(t("status"), d.running ? t("running") : t("stopped"))}
      </div>
      ${serviceBtns("mihomo", "http://" + location.hostname + ":9090/ui/")}
      <p class="muted small">${esc(t("clash_note", "v"))}</p>
    </div>`);
  };
  VIEWS.clash.mount = bindSvc;

  VIEWS.remote = async function () {
    const [d, s] = await Promise.all([apiGet("remote_access"), apiGet("remote_ssh")]);
    const url = "https://" + (d.wan_ip || location.hostname) + "/wrtweb/";
    const sshcmd = "ssh root@" + (s.wan_ip || location.hostname);
    return wrap(`
      <div class="card"><h2>${esc(t("remote", "nav"))}</h2>
        <p class="muted small">${esc(t("remote_note", "v"))}</p>
        <div class="grid">
          ${stat(t("status"), d.enabled ? t("enabled") : t("disabled"))}
          ${stat("WAN", d.wan_ip || "-")}
        </div>
        <div class="row"><div><label>${esc(t("remote_url", "v"))}</label><input readonly value="${esc(url)}"></div></div>
        <div class="btn-row">
          <button id="ra-on">${esc(t("enabled"))}</button>
          <button class="ghost" id="ra-off">${esc(t("disabled"))}</button>
          ${cfgBtn("/cgi-bin/luci/admin/network/firewall")}
        </div>
      </div>
      <div class="card"><h2>${esc(t("ssh_wan", "v"))}</h2>
        <p class="muted small">${esc(t("ssh_note", "v"))}</p>
        <div class="grid">${stat(t("status"), s.enabled ? t("enabled") : t("disabled"))}</div>
        <div class="row"><div><label>${esc(t("remote_url", "v"))}</label><input readonly value="${esc(sshcmd)}"></div></div>
        <div class="btn-row">
          <button id="ssh-on">${esc(t("enabled"))}</button>
          <button class="ghost" id="ssh-off">${esc(t("disabled"))}</button>
        </div>
      </div>`);
  };
  VIEWS.remote.mount = function () {
    $("#ra-on").onclick = async () => { const r = await apiPost("remote_access_set", { enabled: "1" }); toast(r.ok ? t("saved") : t("failed", "v"), r.ok ? "ok" : "err"); render(); };
    $("#ra-off").onclick = async () => { const r = await apiPost("remote_access_set", { enabled: "0" }); toast(r.ok ? t("saved") : t("failed", "v"), r.ok ? "ok" : "err"); render(); };
    const so = $("#ssh-on"), sf = $("#ssh-off");
    if (so) so.onclick = async () => { const r = await apiPost("remote_ssh_set", { enabled: "1" }); toast(r.ok ? t("saved") : t("failed", "v"), r.ok ? "ok" : "err"); render(); };
    if (sf) sf.onclick = async () => { const r = await apiPost("remote_ssh_set", { enabled: "0" }); toast(r.ok ? t("saved") : t("failed", "v"), r.ok ? "ok" : "err"); render(); };
  };

  VIEWS.storage = async function () {
    const d = await apiGet("storage");
    return wrap(`
      <div class="card"><h2>${esc(t("storage", "nav"))}</h2>
        <p class="muted small">${esc(t("storage_note", "v"))}</p>
        <div class="grid">
          ${stat(t("overlay_now", "v"), d.overlay || "-", true)}
          ${stat(t("nvme_part", "v"), (d.fstype || "?") + " " + (d.uuid || ""), true)}
          ${stat(t("status"), d.extroot ? t("extroot_on", "v") : t("extroot_off", "v"))}
        </div>
        <div class="btn-row">
          ${d.extroot
            ? `<button class="danger" id="st-rollback">${esc(t("rollback_btn", "v"))}</button>`
            : `<button id="st-migrate">${esc(t("migrate_btn", "v"))}</button>`}
        </div>
        <p class="muted small">${esc(t("storage_warn", "v"))}</p>
      </div>`);
  };
  VIEWS.storage.mount = function () {
    const m = $("#st-migrate");
    if (m) m.onclick = async () => {
      if (!confirm(t("migrate_confirm", "v"))) return;
      const r = await apiPost("storage_migrate", { confirm: "1" });
      if (r.ok) toast(t("reboot_now", "v")); else toast(r.error || t("failed", "v"), "err");
    };
    const rb = $("#st-rollback");
    if (rb) rb.onclick = async () => {
      if (!confirm(t("migrate_confirm", "v"))) return;
      const r = await apiPost("storage_rollback", {});
      if (r.ok) toast(t("reboot_now", "v")); else toast(r.error || t("failed", "v"), "err");
    };
  };

  VIEWS.mirror = async function () {
    const d = await apiGet("mirror");
    return wrap(`<div class="card"><h2>${esc(t("mirror", "nav"))}</h2>
      <p class="muted small">${esc(t("mirror_note", "v"))}</p>
      <div class="grid">${stat(t("current_source", "v"), d.host || "-", true)}</div>
      <div class="row">
        <div><label>${esc(t("select_source", "v"))}</label>
          <select id="mir-mode">
            <option value="auto">${esc(t("auto", "v"))}</option>
            <option value="tuna">TUNA (Tsinghua)</option>
            <option value="ustc">USTC</option>
            <option value="official">${esc(t("official", "v"))}</option>
          </select></div>
      </div>
      <div class="btn-row"><button id="mir-apply">${esc(t("apply"))}</button></div>
      <pre class="log" id="mir-out"></pre>
    </div>`);
  };
  VIEWS.mirror.mount = function () {
    $("#mir-apply").onclick = async () => {
      const mode = $("#mir-mode").value;
      const r = await apiPost("mirror_set", { mode });
      toast(r.ok ? t("saved") : t("failed", "v"), r.ok ? "ok" : "err");
      if (r.output) $("#mir-out").textContent = r.output;
    };
  };

  VIEWS.plugins = async function () {
    const d = await apiGet("plugins");
    const pkgs = arr(d.packages);
    const rows = pkgs.slice(0, 500).map(p=>`<tr><td class="small">${esc(p)}</td></tr>`).join("");
    return wrap(`<div class="card"><h2>${esc(t("plugins", "nav"))} (${d.count||0})</h2>
      <pre class="log">${esc(pkgs.join("\n"))}</pre>
      <div class="btn-row">${cfgBtn("/cgi-bin/luci/admin/system/package-manager")}</div></div>`);
  };

  VIEWS.sysinfo = async function () {
    return VIEWS.overview();
  };

  VIEWS.logs = async function () {
    const d = await apiGet("logs");
    return wrap(`<div class="card"><h2>${esc(t("logs", "nav"))}</h2>
      <div class="btn-row"><button id="log-refresh">${esc(t("refresh"))}</button>${cfgBtn("/cgi-bin/luci/admin/status/logs")}</div>
      <pre class="log" id="logbox">${esc(d.syslog||"")}</pre></div>`);
  };
  VIEWS.logs.mount = function () { const b=$("#log-refresh"); if(b) b.onclick = () => render(); };

  VIEWS.timezone = async function () {
    const d = await apiGet("system");
    const zones = ["UTC","Asia/Shanghai","Asia/Hong_Kong","Asia/Taipei","Asia/Tokyo","America/New_York","Europe/London","Europe/Berlin"];
    return wrap(`<div class="card"><h2>${esc(t("timezone", "nav"))} / ${esc(t("hostname"))}</h2>
      <div class="row">
        <div><label>${esc(t("hostname"))}</label><input id="tz-host" value="${esc(d.hostname||"")}"></div>
        <div><label>${esc(t("time_zone", "v"))}</label><select id="tz-zone">
          ${zones.map(z=>`<option ${d.timezone===z?"selected":""} value="${z}">${z}</option>`).join("")}
        </select></div>
      </div>
      <div class="btn-row"><button id="tz-save">${esc(t("save"))}</button>${cfgBtn("/cgi-bin/luci/admin/system/system")}</div></div>`);
  };
  VIEWS.timezone.mount = function () {
    $("#tz-save").onclick = async () => {
      const r = await apiPost("system_set", { hostname:$("#tz-host").value, timezone:$("#tz-zone").value });
      toast(r.ok?t("saved"):t("failed", "v"), r.ok?"ok":"err");
    };
  };

  VIEWS.reboot = async function () {
    return wrap(`<div class="card"><h2>${esc(t("reboot", "nav"))}</h2>
      <p class="muted">${esc(t("reboot_device", "v"))}</p>
      <div class="btn-row"><button class="danger" id="rb">${esc(t("reboot", "nav"))}</button></div></div>`);
  };
  VIEWS.reboot.mount = function () {
    $("#rb").onclick = async () => {
      if (!confirm(t("reboot_confirm"))) return;
      await apiPost("reboot", { confirm:"1" });
      toast(t("reboot_now", "v"));
    };
  };

  /* ---------- real feature pages (status + control) ---------- */
  function serviceBtns(svc, cfg) {
    return `<div class="btn-row">
      <button data-svc="${svc}" data-act="start">${esc(t("start", "v"))}</button>
      <button class="ghost" data-svc="${svc}" data-act="stop">${esc(t("stop", "v"))}</button>
      <button class="ghost" data-svc="${svc}" data-act="restart">${esc(t("restart"))}</button>
      ${cfg ? cfgBtn(cfg) : ""}
    </div>`;
  }
  function bindSvc() {
    document.querySelectorAll("[data-svc]").forEach(b => {
      b.onclick = async () => {
        const r = await apiPost("service_set", { s: b.getAttribute("data-svc"), action: b.getAttribute("data-act") });
        toast(r.ok ? t("saved") : t("failed", "v"), r.ok ? "ok" : "err");
        render();
      };
    });
  }
  function serviceView(key, pkg, cfg) {
    const fn = async function () {
      const d = await apiGet("service", { s: key });
      return wrap(`<div class="card"><h2>${esc(t(key, "nav"))}</h2>
        <div class="grid">
          ${stat(t("installed"), d.installed ? t("installed") : t("not_installed"))}
          ${stat(t("status"), d.running ? t("running") : t("stopped"))}
        </div>
        ${serviceBtns(key, cfg)}
        ${!d.installed ? `<p class="small muted">${esc(t("requires_pkg", "v"))}: <code>${esc(pkg || "")}</code></p>` : ""}
      </div>`);
    };
    fn.mount = bindSvc;
    return fn;
  }

  VIEWS.multiwan = async function () {
    const d = await apiGet("mwan");
    return wrap(`<div class="card"><h2>${esc(t("multiwan", "nav"))}</h2>
      <div class="grid">
        ${stat(t("installed"), d.installed ? t("installed") : t("not_installed"))}
        ${stat(t("status"), d.running ? t("running") : t("stopped"))}
      </div>
      ${serviceBtns("mwan3", "/cgi-bin/luci/admin/network/mwan3")}
      <pre class="log">${esc(d.status || d.interfaces || t("none"))}</pre>
    </div>`);
  };
  VIEWS.multiwan.mount = bindSvc;

  VIEWS.wgclient = async function () {
    const d = await apiGet("vpn");
    const rows = arr(d.wireguard).map(w => `<tr><td>${esc(w.iface)}</td><td>${esc(w.peers)}</td></tr>`).join("");
    return wrap(`<div class="card"><h2>${esc(t("wgclient", "nav"))}</h2>
      <div class="grid">${stat("WireGuard", d.wg_installed ? t("installed") : t("not_installed"))}</div>
      <table><thead><tr><th>${esc(t("wg_iface", "v"))}</th><th>${esc(t("peers", "v"))}</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="2" class="muted">${esc(t("none"))}</td></tr>`}</tbody></table>
      <p class="small muted">${esc(t("wg_hint", "v"))}</p>
      <div class="btn-row"><a class="ghost" style="padding:9px 16px;border-radius:9px" href="/cgi-bin/luci/admin/network/network" target="_blank">LuCI</a></div>
    </div>`);
  };
  VIEWS.wgserver = VIEWS.wgclient;

  VIEWS.ovpnclient = async function () {
    const [d, o] = await Promise.all([apiGet("vpn"), apiGet("ovpn")]);
    return wrap(`<div class="card"><h2>${esc(t("ovpnclient", "nav"))}</h2>
      <div class="grid">${stat("OpenVPN", d.ovpn_installed ? t("installed") : t("not_installed"))}</div>
      ${serviceBtns("openvpn", "/cgi-bin/luci/admin/vpn/openvpn")}
      <p class="small muted">${esc(t("profiles", "v"))}: ${esc(o.files || t("none"))}</p>
      <p class="small muted">${esc(t("ovpn_hint", "v"))}</p>
    </div>`);
  };
  VIEWS.ovpnclient.mount = bindSvc;
  VIEWS.ovpnserver = VIEWS.ovpnclient;

  VIEWS.tor = serviceView("tor", "tor", "/cgi-bin/luci/admin/services/tor");
  VIEWS.tailscale = serviceView("tailscale", "tailscale", "/cgi-bin/luci/admin/network/network");

  VIEWS.zerotier = async function () {
    const d = await apiGet("zerotier");
    return wrap(`<div class="card"><h2>${esc(t("zerotier", "nav"))}</h2>
      <div class="grid">${stat(t("installed"), d.installed ? t("installed") : t("not_installed"))}</div>
      <pre class="log">${esc((d.info || "") + "\n" + (d.networks || "")) || esc(t("none"))}</pre>
      <div class="row"><div><label>Network ID</label><input id="zt-nwid" placeholder="8056c2e21c000001"></div></div>
      <div class="btn-row"><button id="zt-join">${esc(t("connect"))}</button>${cfgBtn("/cgi-bin/luci/admin/network/network")}</div>
    </div>`);
  };
  VIEWS.zerotier.mount = function () {
    const b = $("#zt-join");
    if (b) b.onclick = async () => {
      const r = await apiPost("zerotier_set", { action: "join", nwid: $("#zt-nwid").value.trim() });
      toast(r.ok ? t("saved") : t("failed", "v"), r.ok ? "ok" : "err"); render();
    };
  };

  VIEWS.dns = async function () {
    const d = await apiGet("dns");
    return wrap(`<div class="card"><h2>${esc(t("dns", "nav"))}</h2>
      <div><label>${esc(t("upstream_dns", "v"))}</label><input id="dns-servers" value="${esc(d.servers || "")}"></div>
      <p class="small muted">${esc(d.resolv || "")}</p>
      <div class="btn-row"><button id="dns-save">${esc(t("save"))}</button>${cfgBtn("/cgi-bin/luci/admin/network/dhcp")}</div>
    </div>`);
  };
  VIEWS.dns.mount = function () {
    $("#dns-save").onclick = async () => {
      const r = await apiPost("dns_set", { servers: $("#dns-servers").value });
      toast(r.ok ? t("saved") : t("failed", "v"), r.ok ? "ok" : "err");
    };
  };

  VIEWS.ipv6 = async function () {
    const d = await apiGet("network");
    const rows = arr(d.interfaces).map(i => `<tr><td>${esc(i.name)}</td><td>${esc(i.ip || "-")}</td><td>${i.up ? t("on") : t("off")}</td></tr>`).join("");
    return wrap(`<div class="card"><h2>${esc(t("ipv6", "nav"))}</h2>
      <table><thead><tr><th>Interface</th><th>IP</th><th>${esc(t("status"))}</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="small muted">IPv6 (wan6/odhcp6c) is configured in /etc/config/network; use LuCI for advanced IPv6.</p>
      <div class="btn-row">${cfgBtn("/cgi-bin/luci/admin/network/network")}</div>
    </div>`);
  };

  VIEWS.firewall = async function () {
    const d = await apiGet("firewall");
    const zones = arr(d.zones).map(z => `<tr><td>${esc(z.name)}</td><td>${esc(z.network || "-")}</td><td>${esc(z.input)}</td><td>${esc(z.output)}</td><td>${esc(z.forward)}</td></tr>`).join("");
    const rules = arr(d.rules).map(r => `<tr><td>${esc(r.name || r.idx)}</td><td>${esc(r.src || "-")}</td><td>${esc(r.dest || "-")}</td><td>${esc(r.dest_port || "-")}</td><td>${esc(r.target)}</td></tr>`).join("");
    return wrap(`<div class="card"><h2>${esc(t("firewall", "nav"))}</h2>
      <table><thead><tr><th>${esc(t("zones", "v"))}</th><th>${esc(t("networks", "v"))}</th><th>${esc(t("input", "v"))}</th><th>${esc(t("output", "v"))}</th><th>${esc(t("forward", "v"))}</th></tr></thead>
      <tbody>${zones || `<tr><td colspan="5" class="muted">${esc(t("none"))}</td></tr>`}</tbody></table>
      <table><thead><tr><th>${esc(t("name"))}</th><th>src</th><th>dest</th><th>${esc(t("port", "v"))}</th><th>${esc(t("rule_target", "v"))}</th></tr></thead>
      <tbody>${rules || `<tr><td colspan="5" class="muted">${esc(t("none"))}</td></tr>`}</tbody></table>
      <div class="btn-row"><a class="ghost" style="padding:9px 16px;border-radius:9px" href="#/ports">${esc(t("ports", "nav"))} ›</a>${cfgBtn("/cgi-bin/luci/admin/network/firewall")}</div>
    </div>`);
  };

  VIEWS.vlan = async function () {
    const d = await apiGet("vlan");
    const devs = arr(d.devices).map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.type)}</td><td>${esc(x.ports || "-")}</td></tr>`).join("");
    const vlans = arr(d.vlans).map(v => `<tr><td>${esc(v.name)}</td><td>${esc(v.vid)}</td></tr>`).join("");
    return wrap(`<div class="card"><h2>${esc(t("vlan", "nav"))}</h2>
      <table><thead><tr><th>${esc(t("devices", "v"))}</th><th>type</th><th>${esc(t("ports", "v"))}</th></tr></thead>
      <tbody>${devs || `<tr><td colspan="3" class="muted">${esc(t("none"))}</td></tr>`}</tbody></table>
      <table><thead><tr><th>802.1Q</th><th>VLAN ID</th></tr></thead>
      <tbody>${vlans || `<tr><td colspan="2" class="muted">${esc(t("none"))}</td></tr>`}</tbody></table>
      <p class="small muted">${esc(t("vlan_note", "v"))}</p>
      <div class="btn-row">${cfgBtn("/cgi-bin/luci/admin/network/network")}</div>
    </div>`);
  };

  VIEWS.upgrade = async function () {
    const [d, u] = await Promise.all([apiGet("overview"), apiGet("upgrades")]);
    const rows = arr(u.upgradable).map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.to || "-")}</td></tr>`).join("");
    return wrap(`<div class="card"><h2>${esc(t("upgrade", "nav"))}</h2>
      <div class="grid">
        ${stat(t("firmware"), d.firmware, true)}
        ${stat(t("pkgtool", "v"), u.pkgtool || t("none"))}
        ${stat(t("upgradable", "v"), u.count)}
      </div>
      <table><thead><tr><th>${esc(t("package", "v"))}</th><th>${esc(t("new_version", "v"))}</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="2" class="muted">${esc(t("up_to_date", "v"))}</td></tr>`}</tbody></table>
      <p class="small muted">${esc(t("upgrade_note", "v"))}</p>
      <div class="btn-row"><a class="ghost" style="padding:9px 16px;border-radius:9px" href="/cgi-bin/luci/admin/system/flash" target="_blank">LuCI Flash</a></div>
    </div>`);
  };

  VIEWS.advanced = async function () {
    return wrap(`<div class="card"><h2>${esc(t("advanced", "nav"))}</h2>
      <p class="small muted">Full LuCI, package manager and diagnostics.</p>
      <div class="btn-row">
        <a class="ghost" style="padding:9px 16px;border-radius:9px" href="/cgi-bin/luci/admin" target="_blank">LuCI</a>
        <a class="ghost" style="padding:9px 16px;border-radius:9px" href="#/mirror">${esc(t("mirror", "nav"))} ›</a>
      </div>
    </div>`);
  };

  VIEWS.security = async function () {
    const d = await apiGet("security");
    const ports = arr(d.listening).map(p => `<tr><td>${esc(p.addr)}</td><td>${esc(p.port)}</td></tr>`).join("");
    const shell = arr(d.shell_access).map(s => `<tr><td>${esc(s.interface)}</td><td>${esc(s.port)}</td></tr>`).join("");
    return wrap(`<div class="card"><h2>${esc(t("security", "nav"))}</h2>
      <div class="grid">
        ${stat(t("root_password", "v"), d.root_password_locked ? t("pw_locked", "v") : t("pw_set", "v"))}
        ${stat(t("ssh_wan", "v"), d.ssh_wan ? t("on") : t("off"))}
        ${stat(t("web_wan", "v"), d.web_wan ? t("on") : t("off"))}
        ${stat("HTTPS", d.https ? t("on") : t("off"))}
      </div>
      <table><thead><tr><th>${esc(t("shell_access", "v"))}</th><th>${esc(t("port", "v"))}</th></tr></thead>
      <tbody>${shell || `<tr><td colspan="2" class="muted">${esc(t("none"))}</td></tr>`}</tbody></table>
      <table><thead><tr><th>${esc(t("listening_ports", "v"))}</th><th></th></tr></thead>
      <tbody>${ports || `<tr><td colspan="2" class="muted">${esc(t("none"))}</td></tr>`}</tbody></table>
      <p class="small muted">${esc(t("pw_note", "v"))}</p>
      <div class="btn-row">
        <a class="ghost" style="padding:9px 16px;border-radius:9px" href="#/remote">${esc(t("remote", "nav"))} ›</a>
        ${cfgBtn("/cgi-bin/luci/admin/system/admin")}
      </div>
    </div>`);
  };

  VIEWS.backup = async function () {
    const d = await apiGet("backup");
    const files = arr(d.files).map(f => `<tr><td>${esc(f)}</td></tr>`).join("");
    return wrap(`<div class="card"><h2>${esc(t("backup", "nav"))}</h2>
      <div class="grid">
        ${stat(t("config_files", "v"), d.count)}
        ${stat(t("keepfiles", "v"), d.keepfiles)}
        ${stat(t("pkgtool", "v"), d.tool ? "sysupgrade" : t("none"))}
      </div>
      <table><tbody>${files || `<tr><td class="muted">${esc(t("none"))}</td></tr>`}</tbody></table>
      <div class="btn-row">
        <a class="ghost" style="padding:9px 16px;border-radius:9px" href="${esc(d.download || "#")}">${esc(t("download_backup", "v"))}</a>
        ${cfgBtn("/cgi-bin/luci/admin/system/flash")}
      </div>
      <p class="small muted">${esc(t("restore_note", "v"))}</p>
    </div>`);
  };

  VIEWS.parental = async function () {
    const d = await apiGet("parental");
    const rows = arr(d.clients).map(c => `<tr>
      <td>${esc(c.name || "-")}</td><td>${esc(c.mac)}</td><td>${esc(c.ip || "-")}</td>
      <td>${c.blocked ? esc(t("blocked", "v")) : esc(t("allowed", "v"))}</td>
      <td>${c.blocked
        ? `<button class="ghost" data-unblock="${esc(c.mac)}">${esc(t("unblock", "v"))}</button>`
        : `<button data-block="${esc(c.mac)}">${esc(t("block", "v"))}</button>`}</td></tr>`).join("");
    return wrap(`<div class="card"><h2>${esc(t("parental", "nav"))}</h2>
      <table><thead><tr><th>${esc(t("name"))}</th><th>${esc(t("mac", "v"))}</th><th>IP</th>
      <th>${esc(t("status"))}</th><th>${esc(t("action"))}</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" class="muted">${esc(t("none"))}</td></tr>`}</tbody></table>
      <p class="small muted">${esc(t("parental_note", "v"))}</p>
      <div class="btn-row">${cfgBtn("/cgi-bin/luci/admin/network/firewall")}</div>
    </div>`);
  };
  VIEWS.parental.mount = function () {
    const run = async (c, mac) => {
      const r = await apiPost(c, { mac });
      toast(r.ok ? t("saved") : (r.error || t("failed", "v")), r.ok ? "ok" : "err");
      if (r.ok) render();
    };
    document.querySelectorAll("[data-block]").forEach(b =>
      b.onclick = () => run("parental_block", b.getAttribute("data-block")));
    document.querySelectorAll("[data-unblock]").forEach(b =>
      b.onclick = () => run("parental_unblock", b.getAttribute("data-unblock")));
  };

  VIEWS.astrowarp = async function () {
    return wrap(`<div class="card"><h2>${esc(t("astrowarp", "nav"))}</h2>
      <p class="small muted">AstroWarp is a GL.iNet proprietary service and is not available as an open-source OpenWrt package.</p>
    </div>`);
  };
  VIEWS.edgerouter = async function () {
    return wrap(`<div class="card"><h2>${esc(t("edgerouter", "nav"))}</h2>
      <p class="small muted">EdgeRouter is a GL.iNet proprietary feature and is not available as an open-source OpenWrt package.</p>
    </div>`);
  };

  /* ---------------- router ---------------- */
  const DEFAULT_ROUTE = "overview";

  function wrap(html) { return `<div class="view-body">${html}</div>`; }

  function currentRoute() {
    const h = (location.hash || "").replace(/^#\/?/, "");
    const key = h.split("/")[0] || DEFAULT_ROUTE;
    return VIEWS[key] ? key : DEFAULT_ROUTE;
  }

  let renderSeq = 0;
  async function render() {
    const key = currentRoute();
    const seq = ++renderSeq;
    $("#page-title").textContent = t(key, "nav");
    document.querySelectorAll(".nav-item").forEach(a =>
      a.classList.toggle("active", a.getAttribute("data-route") === key));
    const view = $("#view");
    view.innerHTML = `<div class="muted">${esc(t("loading"))}</div>`;
    try {
      const fn = VIEWS[key];
      const html = await fn();
      if (seq !== renderSeq) return;
      view.innerHTML = html;
      if (fn.mount) fn.mount();
      const st = $("#status-pill");
      st.className = "pill ok"; st.textContent = t("online", "v");
    } catch (e) {
      if (seq !== renderSeq) return;
      view.innerHTML = `<div class="card"><h2>Error</h2><pre class="log">${esc(e && e.stack || e)}</pre></div>`;
      const st = $("#status-pill"); st.className = "pill bad"; st.textContent = t("error", "v");
    }
  }

  window.addEventListener("hashchange", render);
  let started = false;
  function start() {
    if (started) return; started = true;
    renderNav();
    if (!location.hash) location.hash = "#/" + DEFAULT_ROUTE;
    render();
    const mt = $("#menu-toggle");
    if (mt) mt.onclick = () => $("#sidebar").classList.toggle("open");
    const tt = $("#theme-toggle");
    if (tt) tt.onclick = cycleTheme;
    const tqp = new URLSearchParams(location.search).get("theme");
    if (tqp === "dark" || tqp === "light" || tqp === "auto") localStorage.setItem("wrtweb.theme", tqp);
    applyTheme();
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq.addEventListener) mq.addEventListener("change", () => applyTheme());
    }
    const sw = $("#lang-switch");
    if (sw) sw.onchange = () => setLang(sw.value);
  }
  window.addEventListener("DOMContentLoaded", start);
  if (document.readyState !== "loading") start();
})();
