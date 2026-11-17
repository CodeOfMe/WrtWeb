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

  VIEWS.overview = async function () {
    const d = await apiGet("overview");
    const up = d.uptime || 0;
    const uh = Math.floor(up / 3600), um = Math.floor((up % 3600) / 60);
    return wrap(`
      <div class="card"><h2>${esc(t("status"))}</h2>
        <div class="grid">
          ${stat(t("model"), d.model, false, "sysinfo")}
          ${stat(t("firmware"), d.firmware, true, "upgrade")}
          ${stat(t("hostname"), d.hostname, false, "timezone")}
          ${stat(t("uptime"), uh + "h " + um + "m", false, "sysinfo")}
          ${stat(t("load"), d.load, false, "sysinfo")}
          ${stat(t("memory"), (d.memfree || 0) + " / " + (d.memtotal || 0) + " MB", false, "sysinfo")}
          ${stat(t("wan_ip"), d.wan_ip || "-", false, "wan")}
          ${stat(t("clients", "nav"), d.clients, false, "clients")}
          ${stat(t("storage"), d.storage || "-", false, "nas")}
        </div>
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
        <div class="btn-row"><button id="do-scan">${esc(t("scan"))}</button></div>
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
        <div class="btn-row"><button id="w-save">${esc(t("save"))}</button></div>
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
    const rows = arr(d.clients).map(c => `<tr>
      <td>${esc(c.name || "-")}</td><td>${esc(c.ip || "-")}</td>
      <td class="small">${esc(c.mac || "")}</td>
      <td>${c.online ? `<span class="tag on">${esc(t("online", "v"))}</span>` : `<span class="tag off">${esc(t("offline", "v"))}</span>`}</td>
      <td>${esc(c.source || "")}</td></tr>`).join("");
    return wrap(`<div class="card"><h2>${esc(t("clients", "nav"))}</h2>
      <table><thead><tr><th>${esc(t("name"))}</th><th>IP</th><th>${esc(t("mac", "v"))}</th>
      <th>${esc(t("status"))}</th><th>${esc(t("source", "v"))}</th></tr></thead><tbody>
      ${rows || `<tr><td colspan="5" class="muted">${esc(t("none"))}</td></tr>`}</tbody></table></div>`);
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
    return wrap(ifaces || `<div class="muted">${esc(t("no_wireless", "v"))}</div>`);
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
      <div class="btn-row"><button id="l-save">${esc(t("save"))}</button></div>
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
      <div class="btn-row"><button id="g-save">${esc(t("save"))}</button></div>
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
        <div class="btn-row"><button id="p-add">${esc(t("add"))}</button></div></div>`);
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
      </div>
      <p class="muted small">${esc(t("ag_note", "v"))}</p>
    </div>`);
  };
  VIEWS.adguard.mount = function () {
    $("#ag-start").onclick = async () => { const r = await apiPost("adguard_set",{action:"start"}); toast(r.ok?t("started","v"):t("failed","v"),r.ok?"ok":"err"); };
    $("#ag-stop").onclick = async () => { const r = await apiPost("adguard_set",{action:"stop"}); toast(r.ok?t("stopped","v"):t("failed","v"),r.ok?"ok":"err"); };
  };

  VIEWS.nas = async function () {
    const d = await apiGet("nas");
    return wrap(`<div class="card"><h2>${esc(t("nas", "nav"))}</h2>
      <div class="grid">${stat(t("samba", "v"), d.samba_enabled==="1" ? t("enabled") : t("disabled"))}</div>
      <p class="small muted">${esc(t("mounts", "v"))}: ${esc(d.mounts || "-")}</p>
      <div class="btn-row">
        <button id="nas-on">${esc(t("enabled"))}</button>
        <button class="ghost" id="nas-off">${esc(t("disabled"))}</button>
      </div>
      <p class="muted small">${esc(t("nas_note", "v"))}</p>
    </div>`);
  };
  VIEWS.nas.mount = function () {
    $("#nas-on").onclick = async () => { const r=await apiPost("nas_set",{enabled:"1"}); toast(r.ok?t("saved"):t("failed", "v"),r.ok?"ok":"err"); };
    $("#nas-off").onclick = async () => { const r=await apiPost("nas_set",{enabled:"0"}); toast(r.ok?t("saved"):t("failed", "v"),r.ok?"ok":"err"); };
  };

  VIEWS.ddns = async function () {
    const d = await apiGet("ddns");
    const rows = arr(d.services).map(s=>`<tr><td>${esc(s.service)}</td><td>${esc(s.domain)}</td><td>${esc(s.enabled)}</td></tr>`).join("");
    return wrap(`<div class="card"><h2>${esc(t("ddns", "nav"))}</h2>
      <table><thead><tr><th>${esc(t("service", "v"))}</th><th>${esc(t("domain", "v"))}</th><th>${esc(t("enabled"))}</th></tr></thead>
      <tbody>${rows||`<tr><td colspan="3" class="muted">${esc(t("none"))}</td></tr>`}</tbody></table>
      <p class="muted small">${esc(t("ddns_note", "v"))}</p></div>`);
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
      <tbody>${wg||`<tr><td colspan="2" class="muted">${esc(t("none"))}</td></tr>`}</tbody></table></div>`);
  };

  VIEWS.clash = async function () {
    const d = await apiGet("clash");
    return wrap(`<div class="card"><h2>${esc(t("clash", "nav"))}</h2>
      <div class="grid">
        ${stat(t("installed"), d.installed ? t("installed") : t("not_installed"))}
        ${stat(t("status"), d.running ? t("running") : t("stopped"))}
      </div>
      <div class="btn-row">
        <button id="cl-start">${esc(t("start", "v"))}</button>
        <button class="ghost" id="cl-stop">${esc(t("stop", "v"))}</button>
      </div>
      <p class="muted small">${esc(t("clash_note", "v"))}</p>
      <p class="small muted">${esc(t("requires_pkg", "v"))}: <code>mihomo</code></p>
    </div>`);
  };
  VIEWS.clash.mount = function () {
    const s = $("#cl-start"), p = $("#cl-stop");
    if (s) s.onclick = async () => { const r = await apiPost("clash_set", { action: "start" }); toast(r.ok ? t("started", "v") : t("failed", "v"), r.ok ? "ok" : "err"); };
    if (p) p.onclick = async () => { const r = await apiPost("clash_set", { action: "stop" }); toast(r.ok ? t("stopped", "v") : t("failed", "v"), r.ok ? "ok" : "err"); };
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
      <pre class="log">${esc(pkgs.join("\n"))}</pre></div>`);
  };

  VIEWS.sysinfo = async function () {
    return VIEWS.overview();
  };

  VIEWS.logs = async function () {
    const d = await apiGet("logs");
    return wrap(`<div class="card"><h2>${esc(t("logs", "nav"))}</h2>
      <div class="btn-row"><button id="log-refresh">${esc(t("refresh"))}</button></div>
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
      <div class="btn-row"><button id="tz-save">${esc(t("save"))}</button></div></div>`);
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

  // Generic placeholder views for GL sections whose daemons may be absent.
  function placeholder(key, pkg) {
    return async function () {
      return wrap(`<div class="card"><h2>${esc(t(key, "nav"))}</h2>
        <p class="muted">${esc(t("scaffold_note", "v"))}</p>
        ${pkg ? `<p class="small muted">${esc(t("requires_pkg", "v"))}: <code>${esc(pkg)}</code></p>` : ""}
      </div>`);
    };
  }
  VIEWS.multiwan = placeholder("multiwan", "mwan3");
  VIEWS.wgclient = placeholder("wgclient", "wireguard-tools");
  VIEWS.wgserver = placeholder("wgserver", "wireguard-tools");
  VIEWS.ovpnclient = placeholder("ovpnclient", "openvpn-openssl");
  VIEWS.ovpnserver = placeholder("ovpnserver", "openvpn-openssl");
  VIEWS.tor = placeholder("tor", "tor");
  VIEWS.parental = placeholder("parental", "luci-app-parental-control");
  VIEWS.tailscale = placeholder("tailscale", "tailscale");
  VIEWS.zerotier = placeholder("zerotier", "zerotier");
  VIEWS.astrowarp = placeholder("astrowarp", "");
  VIEWS.edgerouter = placeholder("edgerouter", "");
  VIEWS.dns = placeholder("dns", "dnsmasq");
  VIEWS.ipv6 = placeholder("ipv6", "odhcp6c");
  VIEWS.firewall = placeholder("firewall", "firewall4");
  VIEWS.vlan = placeholder("vlan", "netifd");
  VIEWS.upgrade = placeholder("upgrade", "auc");
  VIEWS.advanced = placeholder("advanced", "luci");
  VIEWS.security = placeholder("security", "dropbear");
  VIEWS.backup = placeholder("backup", "sysupgrade");

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
    const sw = $("#lang-switch");
    if (sw) sw.onchange = () => setLang(sw.value);
  }
  window.addEventListener("DOMContentLoaded", start);
  if (document.readyState !== "loading") start();
})();
