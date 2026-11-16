/* WrtWeb SPA
 * A full GL.iNet-style admin panel implemented as a single-page app.
 * Routes are hash-based (e.g. #/internet, #/clients) and every view talks
 * to the WrtWeb JSON backend at /cgi-bin/wrtweb-api.
 */
(function () {
  "use strict";

  const API_BASE = new URL("../cgi-bin/wrtweb-api", location.href).href;

  /* ---------------- i18n ---------------- */
  let LANG = localStorage.getItem("wrtweb.lang") || "en";
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

  function stat(k, v, small) {
    return `<div class="stat"><div class="k">${esc(k)}</div><div class="v ${small ? "sm" : ""}">${esc(v || "-")}</div></div>`;
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
    { group: "vpn", items: [
      { key: "vpn", ic: "🔒" },
      { key: "wgclient", ic: "W" },
      { key: "wgserver", ic: "W" },
      { key: "ovpnclient", ic: "O" },
      { key: "ovpnserver", ic: "O" },
      { key: "tor", ic: "T" },
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
      { key: "upgrade", ic: "⤒" },
      { key: "advanced", ic: "⚙" },
      { key: "security", ic: "🔑" },
      { key: "backup", ic: "🗄" },
      { key: "reboot", ic: "⏻" },
    ]},
  ];

  function renderNav() {
    const nav = $("#nav");
    let html = "";
    for (const g of NAV) {
      html += `<div class="nav-group">${esc(t(g.group, "groups"))}</div>`;
      for (const it of g.items) {
        html += `<a class="nav-item" data-route="${it.key}" href="#/${it.key}">
          <span class="ic">${it.ic}</span><span>${esc(t(it.key, "nav"))}</span></a>`;
      }
    }
    nav.innerHTML = html;
    $("#lang-switch").innerHTML =
      `<span title="language">${LANG === "zh" ? "中文" : "EN"}</span>`;
    $("#lang-switch").onclick = () => setLang(LANG === "zh" ? "en" : "zh");
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
          ${stat(t("model"), d.model)}
          ${stat(t("firmware"), d.firmware, true)}
          ${stat(t("hostname"), d.hostname)}
          ${stat(t("uptime"), uh + "h " + um + "m")}
          ${stat(t("load"), d.load)}
          ${stat(t("memory"), (d.memfree || 0) + " / " + (d.memtotal || 0) + " MB")}
          ${stat(t("wan_ip"), d.wan_ip || "-")}
          ${stat(t("clients"), d.clients)}
          ${stat(t("storage"), d.storage || "-")}
        </div>
      </div>`);
  };

  VIEWS.internet = async function () {
    const [ov, nets] = await Promise.all([apiGet("overview"), apiGet("repeater_scan")]);
    const list = (nets.networks || []);
    let rows = list.length
      ? list.map(n => `<div class="list-item">
          <div class="grow"><strong>${esc(n.ssid || "(hidden)")}</strong>
            <div class="small muted">${esc(n.bssid || "")} · ${esc(n.encryption || "")} · ${esc(n.signal || "")} dBm</div></div>
          <button class="ghost" data-join="${esc(n.ssid)}" data-bssid="${esc(n.bssid || "")}">${esc(t("connect"))}</button>
        </div>`).join("")
      : `<div class="muted">${esc(t("none"))}</div>`;

    const html = wrap(`
      <div class="card"><h2>${esc(t("internet"))} · ${esc(t("status"))}</h2>
        <div class="grid">
          ${stat(t("wan_ip"), ov.wan_ip || "-")}
          ${stat("WAN Proto", ov.wan_proto || "-")}
        </div>
      </div>
      <div class="card"><h2>${esc(t("nav") && "Repeater / Client")}</h2>
        <p class="muted small">Scan and join an upstream Wi-Fi; WrtWeb re-broadcasts it on your LAN.</p>
        <div class="btn-row"><button id="do-scan">${esc(t("scan"))}</button></div>
        <div id="net-list" style="margin-top:12px">${rows}</div>
      </div>
      <div class="card"><h2>Join manually</h2>
        <div class="row">
          <div><label>${esc(t("ssid"))}</label><input id="j-ssid"></div>
          <div><label>${esc(t("password"))}</label><input id="j-key" type="password"></div>
          <div><label>Encryption</label><select id="j-enc">
            <option value="psk2">WPA2</option><option value="sae">WPA3</option>
            <option value="psk-mixed">WPA/WPA2</option><option value="none">Open</option>
          </select></div>
        </div>
        <div class="btn-row"><button id="do-join">${esc(t("connect"))}</button></div>
      </div>`);
    return html;
  };
  VIEWS.internet.mount = function () {
    const scan = $("#do-scan");
    if (scan) scan.onclick = async () => { await render(); toast("Scanning…"); };
    document.querySelectorAll("[data-join]").forEach(b => {
      b.onclick = async () => {
        const ssid = b.getAttribute("data-join");
        const key = prompt("Password for " + ssid + " (blank if open)") || "";
        const enc = key ? "psk2" : "none";
        const r = await apiPost("repeater_join", { ssid, key, encryption: enc, bssid: b.getAttribute("data-bssid") });
        toast(r.ok ? "Connected to " + ssid : "Failed", r.ok ? "ok" : "err");
      };
    });
    const j = $("#do-join");
    if (j) j.onclick = async () => {
      const ssid = $("#j-ssid").value, key = $("#j-key").value, encryption = $("#j-enc").value;
      if (!ssid) return toast("SSID required", "err");
      const r = await apiPost("repeater_join", { ssid, key, encryption });
      toast(r.ok ? t("saved") : "Failed", r.ok ? "ok" : "err");
    };
  };

  VIEWS.wan = async function () {
    const d = await apiGet("wan");
    return wrap(`
      <div class="card"><h2>WAN</h2>
        <div class="row">
          <div><label>Protocol</label><select id="w-proto">
            ${["dhcp","static","pppoe"].map(p => `<option ${d.proto===p?"selected":""} value="${p}">${p.toUpperCase()}</option>`).join("")}
          </select></div>
        </div>
        <div class="row">
          <div><label>PPPoE user / Static IP</label><input id="w-user" value="${esc(d.username||d.ipaddr||"")}"></div>
          <div><label>Password / Netmask</label><input id="w-pass" value="${esc(d.netmask||"")}"></div>
          <div><label>Gateway</label><input id="w-gw" value="${esc(d.gateway||"")}"></div>
        </div>
        <div class="btn-row"><button id="w-save">${esc(t("save"))}</button></div>
        <p class="muted small">Current WAN IP: ${esc(d.ip||"-")}</p>
      </div>`);
  };
  VIEWS.wan.mount = function () {
    $("#w-save").onclick = async () => {
      const proto = $("#w-proto").value;
      const p = { proto };
      if (proto === "pppoe") { p.username = $("#w-user").value; p.password = $("#w-pass").value; }
      if (proto === "static") { p.ipaddr = $("#w-user").value; p.netmask = $("#w-pass").value; p.gateway = $("#w-gw").value; }
      const r = await apiPost("wan_set", p);
      toast(r.ok ? t("saved") : "Failed", r.ok ? "ok" : "err");
    };
  };

  VIEWS.clients = async function () {
    const d = await apiGet("clients");
    const rows = (d.clients || []).map(c => `<tr>
      <td>${esc(c.name || "-")}</td><td>${esc(c.ip || "-")}</td>
      <td class="small">${esc(c.mac || "")}</td>
      <td>${c.online ? `<span class="tag on">online</span>` : `<span class="tag off">off</span>`}</td>
      <td>${esc(c.source || "")}</td></tr>`).join("");
    return wrap(`<div class="card"><h2>${esc(t("clients"))}</h2>
      <table><thead><tr><th>${esc(t("name"))}</th><th>IP</th><th>MAC</th>
      <th>${esc(t("status"))}</th><th>Source</th></tr></thead><tbody>
      ${rows || `<tr><td colspan="5" class="muted">${esc(t("none"))}</td></tr>`}</tbody></table></div>`);
  };

  VIEWS.wireless = async function () {
    const d = await apiGet("wireless");
    const ifaces = (d.ifaces || []).map(i => `<div class="card">
      <h2>${esc(i.ssid || i.name)} <span class="tag">${esc(i.device || "")}</span></h2>
      <div class="row">
        <div><label>${esc(t("ssid"))}</label><input data-f="ssid" data-sec="${esc(i.name)}" value="${esc(i.ssid||"")}"></div>
        <div><label>${esc(t("password"))}</label><input data-f="key" data-sec="${esc(i.name)}" type="password" value="${esc(i.key||"")}"></div>
        <div><label>Encryption</label><select data-f="encryption" data-sec="${esc(i.name)}">
          ${["psk2","sae","sae-mixed","psk-mixed","none"].map(e=>`<option ${i.encryption===e?"selected":""} value="${e}">${e}</option>`).join("")}
        </select></div>
      </div>
      <div class="btn-row"><button data-save-sec="${esc(i.name)}">${esc(t("save"))}</button></div>
    </div>`).join("");
    return wrap(ifaces || `<div class="muted">No wireless interfaces</div>`);
  };
  VIEWS.wireless.mount = function () {
    document.querySelectorAll("[data-save-sec]").forEach(btn => {
      btn.onclick = async () => {
        const sec = btn.getAttribute("data-save-sec");
        const p = { iface: sec };
        document.querySelectorAll(`[data-sec="${sec}"]`).forEach(inp => p[inp.getAttribute("data-f")] = inp.value);
        const r = await apiPost("wireless_set", p);
        toast(r.ok ? t("saved") : "Failed", r.ok ? "ok" : "err");
      };
    });
  };

  VIEWS.lan = async function () {
    const d = await apiGet("lan");
    return wrap(`<div class="card"><h2>${esc(t("nav") && "LAN")}</h2>
      <div class="row">
        <div><label>IP</label><input id="l-ip" value="${esc(d.ipaddr||"")}"></div>
        <div><label>Netmask</label><input id="l-mask" value="${esc(d.netmask||"")}"></div>
        <div><label>DHCP start</label><input id="l-s" value="${esc(d.dhcp_start||"")}"></div>
        <div><label>DHCP limit</label><input id="l-l" value="${esc(d.dhcp_limit||"")}"></div>
      </div>
      <div class="btn-row"><button id="l-save">${esc(t("save"))}</button></div>
      <p class="muted small">Changing LAN IP may disconnect your session.</p></div>`);
  };
  VIEWS.lan.mount = function () {
    $("#l-save").onclick = async () => {
      const r = await apiPost("lan_set", { ipaddr:$("#l-ip").value, netmask:$("#l-mask").value,
        dhcp_start:$("#l-s").value, dhcp_limit:$("#l-l").value });
      toast(r.ok ? t("saved") : "Failed", r.ok ? "ok" : "err");
    };
  };

  VIEWS.guest = async function () {
    const d = await apiGet("wireless");
    const guest = (d.ifaces || []).find(i => i.network === "guest");
    return wrap(`<div class="card"><h2>${esc(t("guest"))}</h2>
      <p class="muted small">Guest network is an isolated SSID with its own firewall zone.</p>
      <div class="row">
        <div><label>${esc(t("ssid"))}</label><input id="g-ssid" value="${esc(guest?guest.ssid:"guest")}"></div>
        <div><label>${esc(t("password"))}</label><input id="g-key" type="password" value="${esc(guest?guest.key:"")}"></div>
      </div>
      <div class="btn-row"><button id="g-save">${esc(t("save"))}</button></div>
      <p class="muted small">Apply creates UCI guest wifi + zone via /usr/libexec/wrtweb/guest.sh</p>
    </div>`);
  };
  VIEWS.guest.mount = function () {
    $("#g-save").onclick = async () => {
      const r = await apiPost("guest_apply", { ssid:$("#g-ssid").value, key:$("#g-key").value, encryption:"psk2", isolate:"1" });
      toast(r.ok ? t("saved") : "Failed", r.ok ? "ok" : "err");
    };
  };

  VIEWS.ports = async function () {
    const d = await apiGet("portforward");
    const rows = (d.rules || []).map(r => `<tr>
      <td>${esc(r.name)}</td><td>${esc(r.proto)}</td><td>${esc(r.src_dport)}</td>
      <td>${esc(r.dest_ip)}:${esc(r.dest_port)}</td>
      <td><button class="ghost" data-del="${r.idx}">${esc(t("remove"))}</button></td></tr>`).join("");
    return wrap(`<div class="card"><h2>${esc(t("ports"))}</h2>
      <table><thead><tr><th>${esc(t("name"))}</th><th>Proto</th><th>Ext port</th><th>Internal</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" class="muted">${esc(t("none"))}</td></tr>`}</tbody></table></div>
      <div class="card"><h2>${esc(t("add"))}</h2>
        <div class="row">
          <div><label>${esc(t("name"))}</label><input id="p-name"></div>
          <div><label>Proto</label><select id="p-proto"><option>tcp</option><option>udp</option><option>tcp udp</option></select></div>
          <div><label>Ext port</label><input id="p-sport"></div>
          <div><label>Internal IP</label><input id="p-ip"></div>
          <div><label>Internal port</label><input id="p-dport"></div>
        </div>
        <div class="btn-row"><button id="p-add">${esc(t("add"))}</button></div></div>`);
  };
  VIEWS.ports.mount = function () {
    $("#p-add").onclick = async () => {
      const r = await apiPost("portforward_add", { name:$("#p-name").value, proto:$("#p-proto").value,
        src_dport:$("#p-sport").value, dest_ip:$("#p-ip").value, dest_port:$("#p-dport").value });
      if (r.ok) { toast(t("saved")); render(); } else toast("Failed", "err");
    };
    document.querySelectorAll("[data-del]").forEach(b => {
      b.onclick = async () => {
        const r = await apiPost("portforward_del", { idx: b.getAttribute("data-del") });
        if (r.ok) { toast(t("saved")); render(); } else toast("Failed", "err");
      };
    });
  };

  VIEWS.adguard = async function () {
    const d = await apiGet("adguard");
    return wrap(`<div class="card"><h2>AdGuard Home</h2>
      <div class="grid">
        ${stat(t("installed"), d.installed ? t("installed") : t("not_installed"))}
        ${stat(t("status"), d.running ? t("running") : t("stopped"))}
      </div>
      <div class="btn-row">
        <button id="ag-start">Start</button>
        <button class="ghost" id="ag-stop">Stop</button>
        <a class="ghost" style="padding:9px 16px;border-radius:9px" href="http://${esc(location.hostname)}:3000" target="_blank">Open UI</a>
      </div>
      <p class="muted small">Requires the "adguardhome" package (apk add adguardhome / opkg install adguardhome).</p>
    </div>`);
  };
  VIEWS.adguard.mount = function () {
    $("#ag-start").onclick = async () => { const r = await apiPost("adguard_set",{action:"start"}); toast(r.ok?"Started":"Failed",r.ok?"ok":"err"); };
    $("#ag-stop").onclick = async () => { const r = await apiPost("adguard_set",{action:"stop"}); toast(r.ok?"Stopped":"Failed",r.ok?"ok":"err"); };
  };

  VIEWS.nas = async function () {
    const d = await apiGet("nas");
    return wrap(`<div class="card"><h2>${esc(t("nas"))}</h2>
      <div class="grid">${stat("Samba", d.samba_enabled==="1" ? t("enabled") : t("disabled"))}</div>
      <p class="small muted">Mounts: ${esc(d.mounts || "-")}</p>
      <div class="btn-row">
        <button id="nas-on">${esc(t("enabled"))}</button>
        <button class="ghost" id="nas-off">${esc(t("disabled"))}</button>
      </div>
      <p class="muted small">Requires samba4-server. USB/NVMe storage auto-mounts at /mnt.</p>
    </div>`);
  };
  VIEWS.nas.mount = function () {
    $("#nas-on").onclick = async () => { const r=await apiPost("nas_set",{enabled:"1"}); toast(r.ok?t("saved"):"Failed",r.ok?"ok":"err"); };
    $("#nas-off").onclick = async () => { const r=await apiPost("nas_set",{enabled:"0"}); toast(r.ok?t("saved"):"Failed",r.ok?"ok":"err"); };
  };

  VIEWS.ddns = async function () {
    const d = await apiGet("ddns");
    const rows = (d.services||[]).map(s=>`<tr><td>${esc(s.service)}</td><td>${esc(s.domain)}</td><td>${esc(s.enabled)}</td></tr>`).join("");
    return wrap(`<div class="card"><h2>${esc(t("ddns"))}</h2>
      <table><thead><tr><th>Service</th><th>Domain</th><th>${esc(t("enabled"))}</th></tr></thead>
      <tbody>${rows||`<tr><td colspan="3" class="muted">${esc(t("none"))}</td></tr>`}</tbody></table>
      <p class="muted small">Configure via ddns-scripts; requires the ddns-scripts packages.</p></div>`);
  };

  VIEWS.vpn = async function () {
    const d = await apiGet("vpn");
    const wg = (d.wireguard||[]).map(w=>`<tr><td>${esc(w.iface)}</td><td>${esc(w.peers)}</td></tr>`).join("");
    return wrap(`<div class="card"><h2>${esc(t("vpn"))}</h2>
      <div class="grid">
        ${stat("WireGuard", d.wg_installed ? t("installed") : t("not_installed"))}
        ${stat("OpenVPN", d.ovpn_installed ? t("installed") : t("not_installed"))}
        ${stat("OVPN profiles", d.ovpn_count)}
      </div>
      <table style="margin-top:12px"><thead><tr><th>WG iface</th><th>Peers</th></tr></thead>
      <tbody>${wg||`<tr><td colspan="2" class="muted">${esc(t("none"))}</td></tr>`}</tbody></table></div>`);
  };

  VIEWS.plugins = async function () {
    const d = await apiGet("plugins");
    const pkgs = (d.packages || []);
    const rows = pkgs.slice(0, 500).map(p=>`<tr><td class="small">${esc(p)}</td></tr>`).join("");
    return wrap(`<div class="card"><h2>${esc(t("plugins"))} (${d.count||0})</h2>
      <pre class="log">${esc(pkgs.join("\n"))}</pre></div>`);
  };

  VIEWS.sysinfo = async function () {
    return VIEWS.overview();
  };

  VIEWS.logs = async function () {
    const d = await apiGet("logs");
    return wrap(`<div class="card"><h2>${esc(t("logs"))}</h2>
      <div class="btn-row"><button id="log-refresh">${esc(t("refresh"))}</button></div>
      <pre class="log" id="logbox">${esc(d.syslog||"")}</pre></div>`);
  };
  VIEWS.logs.mount = function () { const b=$("#log-refresh"); if(b) b.onclick = () => render(); };

  VIEWS.timezone = async function () {
    const d = await apiGet("system");
    const zones = ["UTC","Asia/Shanghai","Asia/Hong_Kong","Asia/Taipei","Asia/Tokyo","America/New_York","Europe/London","Europe/Berlin"];
    return wrap(`<div class="card"><h2>${esc(t("timezone"))} / ${esc(t("hostname"))}</h2>
      <div class="row">
        <div><label>${esc(t("hostname"))}</label><input id="tz-host" value="${esc(d.hostname||"")}"></div>
        <div><label>Time zone</label><select id="tz-zone">
          ${zones.map(z=>`<option ${d.timezone===z?"selected":""} value="${z}">${z}</option>`).join("")}
        </select></div>
      </div>
      <div class="btn-row"><button id="tz-save">${esc(t("save"))}</button></div></div>`);
  };
  VIEWS.timezone.mount = function () {
    $("#tz-save").onclick = async () => {
      const r = await apiPost("system_set", { hostname:$("#tz-host").value, timezone:$("#tz-zone").value });
      toast(r.ok?t("saved"):"Failed", r.ok?"ok":"err");
    };
  };

  VIEWS.reboot = async function () {
    return wrap(`<div class="card"><h2>${esc(t("reboot"))}</h2>
      <p class="muted">Reboot the device.</p>
      <div class="btn-row"><button class="danger" id="rb">${esc(t("reboot"))}</button></div></div>`);
  };
  VIEWS.reboot.mount = function () {
    $("#rb").onclick = async () => {
      if (!confirm(t("reboot_confirm"))) return;
      await apiPost("reboot", { confirm:"1" });
      toast("Rebooting…");
    };
  };

  // Generic placeholder views for GL sections whose daemons may be absent.
  function placeholder(key, desc, pkg) {
    return async function () {
      return wrap(`<div class="card"><h2>${esc(t(key,"nav"))}</h2>
        <p class="muted">${esc(desc)}</p>
        ${pkg ? `<p class="small muted">Requires package: <code>${esc(pkg)}</code></p>` : ""}
        <p class="small muted">This section is part of the WrtWeb full-panel scaffold and is wired
        to standard OpenWrt packages; install the package to enable full control.</p></div>`);
    };
  }
  VIEWS.multiwan = placeholder("multiwan", "Configure multiple WAN uplinks with failover.", "mwan3");
  VIEWS.wgclient = placeholder("wgclient", "Import a WireGuard client config as a tunnel.", "wireguard-tools");
  VIEWS.wgserver = placeholder("wgserver", "Run a WireGuard server and manage peers.", "wireguard-tools");
  VIEWS.ovpnclient = placeholder("ovpnclient", "Import an OpenVPN client profile.", "openvpn-openssl");
  VIEWS.ovpnserver = placeholder("ovpnserver", "Run an OpenVPN server.", "openvpn-openssl");
  VIEWS.tor = placeholder("tor", "Route traffic through Tor.", "tor");
  VIEWS.parental = placeholder("parental", "Block categories and schedule internet access.", "luci-app-parental-control");
  VIEWS.tailscale = placeholder("tailscale", "Join a Tailscale mesh VPN.", "tailscale");
  VIEWS.zerotier = placeholder("zerotier", "Join a ZeroTier network.", "zerotier");
  VIEWS.astrowarp = placeholder("astrowarp", "AstroWarp mesh acceleration (GL proprietary).", "");
  VIEWS.edgerouter = placeholder("edgerouter", "Edge routing / site-to-site (GL proprietary).", "");
  VIEWS.dns = placeholder("dns", "Configure upstream DNS and DNS-over-TLS.", "dnsmasq");
  VIEWS.ipv6 = placeholder("ipv6", "IPv6 LAN/WAN configuration.", "odhcp6c");
  VIEWS.firewall = placeholder("firewall", "Zones, forwarding and rules.", "firewall4");
  VIEWS.vlan = placeholder("vlan", "802.1Q VLAN and network segmentation.", "netifd");
  VIEWS.upgrade = placeholder("upgrade", "Firmware upgrade (sysupgrade) and attended upgrades.", "auc");
  VIEWS.advanced = placeholder("advanced", "Advanced LuCI / shell access and diagnostics.", "luci");
  VIEWS.security = placeholder("security", "Admin password and access control.", "dropbear");
  VIEWS.backup = placeholder("backup", "Backup and restore the configuration archive.", "sysupgrade");

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
      st.className = "pill ok"; st.textContent = "online";
    } catch (e) {
      if (seq !== renderSeq) return;
      view.innerHTML = `<div class="card"><h2>Error</h2><pre class="log">${esc(e && e.stack || e)}</pre></div>`;
      const st = $("#status-pill"); st.className = "pill bad"; st.textContent = "error";
    }
  }

  window.addEventListener("hashchange", render);
  window.addEventListener("DOMContentLoaded", () => {
    renderNav();
    if (!location.hash) location.hash = "#/" + DEFAULT_ROUTE;
    render();
    const mt = $("#menu-toggle");
    if (mt) mt.onclick = () => $("#sidebar").classList.toggle("open");
  });
  // In case DOMContentLoaded already fired
  if (document.readyState !== "loading") {
    renderNav();
    if (!location.hash) location.hash = "#/" + DEFAULT_ROUTE;
    render();
  }
})();
