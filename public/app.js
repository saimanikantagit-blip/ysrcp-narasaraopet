const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
let me = null,
  page = "Dashboard",
  conversations = [],
  activeConversation = null;
const items = [
  ["Dashboard", "◫"],
  ["Organizational Hierarchy", "⌘"],
  ["User Management", "♙"],
  ["Contact Directory", "▤"],
  ["Constitutional In-Charges", "♧"],
  ["Mandal-Level In-Charges", "⌖"],
  ["Village-Level In-Charges", "⌂"],
  ["Sarpanches", "♧"],
  ["Social Media In-Charges", "◎"],
  ["MBTC/MPTC Representatives", "♢"],
  ["Mandal Management", "▧"],
  ["Village Management", "⌂"],
  ["Contact Super Admin Inbox", "✉"],
  ["Announcements", "◉"],
  ["Tasks and Assignments", "✓"],
  ["Reports", "▥"],
  ["Issues and Requests", "⚑"],
  ["Documents", "▤"],
  ["Notifications", "♧"],
  ["Social Media Content", "▣"],
  ["Analytics", "⌁"],
  ["Audit Logs", "≋"],
  ["Application Settings", "⚙"],
  ["My Profile", "♙"],
];
const icons = {
  Dashboard: "◫",
  "Contact Directory": "▤",
  "Contact Super Admin": "✉",
};
function esc(v = "") {
  return String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
async function api(url, options = {}) {
  const r = await fetch("/api" + url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Request failed");
  return data;
}
function toast(s) {
  const t = $("#toast");
  t.textContent = s;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2700);
}
function admin() {
  return me.role === "Super Admin";
}
function allowedMenu() {
  if (admin()) return items;
  const base = [
    "Dashboard",
    "Organizational Hierarchy",
    "Contact Directory",
    "Announcements",
    "Tasks and Assignments",
    "Reports",
    "Issues and Requests",
    "Documents",
    "Notifications",
    "My Profile",
  ];
  if (me.role === "Social Media In-Charge") base.push("Social Media Content");
  base.push("Contact Super Admin");
  return base;
}
function shell() {
  $("#login").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#identity").innerHTML =
    `<b>${esc(me.full_name)}</b><span>${esc(me.role)}</span>`;
  $("#top-user").innerHTML =
    `${esc(me.full_name)}<small>${esc(me.jurisdiction || "Narasaraopet")}</small>`;
  $("#nav").innerHTML = allowedMenu()
    .map(
      (x) =>
        `<button class="nav-link ${x === page ? "active" : ""}" data-page="${esc(x)}"><span class="nav-icon">${items.find((i) => i[0] === x)?.[1] || "✉"}</span><span>${esc(x)}</span>${x === "Notifications" ? '<span class="nav-count" id="notification-count"></span>' : ""}</button>`,
    )
    .join("");
  if ($("#notification-count"))
    api("/notifications/unread-count")
      .then((x) => {
        const badge = $("#notification-count");
        if (badge) {
          badge.textContent = x.count > 99 ? "99+" : x.count;
          badge.classList.toggle("hidden", !x.count);
        }
      })
      .catch(() => {});
}
async function go(p) {
  page = p;
  $("#page-title").textContent = p;
  $("#crumb").textContent = admin() ? "ADMINISTRATION" : me.role.toUpperCase();
  shell();
  $("#content").innerHTML =
    '<div class="panel empty">Loading your workspace…</div>';
  try {
    if (p === "Dashboard") await dashboard();
    else if (p === "Contact Directory") await directory();
    else if (p === "Documents") await documents();
    else if (p === "Social Media Content") await socialContent();
    else if (p.includes("Inbox") || p === "Contact Super Admin") await inbox();
    else if (p === "Announcements") await announcements();
    else if (p === "Tasks and Assignments")
      await records("Tasks and Assignments", "/tasks");
    else if (p === "Reports") await reportsView();
    else if (p === "Issues and Requests") await issuesView();
    else if (p === "User Management") await users();
    else if (p === "Notifications") await notifications();
    else if (p === "Audit Logs") await auditLogs();
    else if (p === "Analytics") await analytics();
    else if (p === "Application Settings") await applicationSettings();
    else if (p === "My Profile") await myProfile();
    else if (p === "Mandal Management") await organizationUnits("Mandal");
    else if (p === "Village Management") await organizationUnits("Village");
    else if (
      p === "Organizational Hierarchy" ||
      p.includes("In-Charges") ||
      p === "Sarpanches" ||
      p.includes("Representatives")
    )
      await hierarchy(p);
    else await placeholder(p);
  } catch (e) {
    $("#content").innerHTML =
      `<div class="panel empty">${esc(e.message)}</div>`;
  }
}
function statsCard(name, value, icon, foot = "Live records") {
  return `<div class="stat"><div class="stat-top"><span>${esc(name)}</span><span class="stat-icon">${icon}</span></div><div class="stat-value">${value ?? "—"}</div><div class="stat-foot">${foot}</div></div>`;
}
function contactRows(rows) {
  return rows.length
    ? rows
        .map((x) => {
          const phone = String(x.phone || "").replace(/[^+\d]/g, ""),
            whatsapp = String(x.whatsapp || x.phone || "").replace(/\D/g, ""),
            email = String(x.email || "");
          return `<tr><td><span class="avatar">${esc((x.name || "?")[0].toUpperCase())}</span><span class="contact-name">${esc(x.name)}</span></td><td>${esc(x.designation || "—")}</td><td>${esc(x.role || "—")}</td><td>${esc(x.phone || "—")}<div class="contact-actions">${phone ? `<a class="button subtle" href="tel:${esc(phone)}">Call</a>` : ""}${whatsapp ? `<a class="button subtle" href="https://wa.me/${whatsapp}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ""}${email ? `<a class="button subtle" href="mailto:${esc(email)}">Email</a>` : ""}</div></td><td>${esc([x.mandal, x.village].filter(Boolean).join(" · ") || "—")}</td><td><span class="pill ${x.status === "active" ? "green" : ""}">${esc(x.status)}</span></td></tr>`;
        })
        .join("")
    : '<tr><td colspan="6" class="empty">No contacts found. Authorized administrators can add directory records.</td></tr>';
}
function newConversation() {
  modal(
    "Contact Super Admin",
    `<form id="record-form"><label>Subject<input name="subject" required maxlength="160"></label><label>Category<select name="category">${["General Request", "Account or Login Issue", "Organizational Update", "Contact Information Update", "Task or Report Issue", "Technical Support", "Urgent Matter", "Other"].map((x) => `<option>${x}</option>`).join("")}</select></label><label>Message<textarea name="body" required maxlength="5000"></textarea></label><p class="tiny muted">This conversation is private between you and Super Admin.</p><div class="form-actions"><button type="button" class="button" data-close>Cancel</button><button class="button primary">Send message</button></div></form>`,
    async (f) => {
      const data = await api("/conversations", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(f))),
      });
      toast("Message saved");
      go("Contact Super Admin");
      setTimeout(() => loadThread(data.id), 150);
    },
  );
}
async function hierarchy(section = "Organizational Hierarchy") {
  const roleByPage = {
    "Constitutional In-Charges": "Constitutional In-Charge",
    "Mandal-Level In-Charges": "Mandal-Level In-Charge",
    "Village-Level In-Charges": "Village-Level In-Charge",
    Sarpanches: "Sarpanch",
    "Social Media In-Charges": "Social Media In-Charge",
    "MBTC/MPTC Representatives": "MBTC/MPTC Representative",
  };
  const selectedRole = roleByPage[section];
  const [users, contacts, units] = await Promise.all([
    admin() ? api("/users") : Promise.resolve([]),
    api("/contacts"),
    admin() ? api("/organization-units") : Promise.resolve([]),
  ]);

  if (selectedRole) {
    const members = contacts.filter((contact) => contact.role === selectedRole);
    const roleAccounts = users.filter((user) => user.role === selectedRole);
    const render = () => {
      const query = $("#role-directory-search").value.trim().toLowerCase();
      const filtered = members.filter((contact) =>
        [
          contact.name,
          contact.designation,
          contact.phone,
          contact.email,
          contact.mandal,
          contact.village,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query),
      );
      $("#role-directory-count").textContent = `${filtered.length} contacts`;
      $("#role-directory-rows").innerHTML = contactRows(filtered);
    };
    $("#content").innerHTML =
      `<div class="panel"><div class="panel-head"><div><h2>${esc(section)}</h2><p>Contact records and assigned login accounts for this role</p></div><div class="quick-actions">${admin() ? '<button class="button subtle" id="manage-role-accounts">Manage login accounts</button><button class="button primary" id="add-role-contact">Add contact</button>' : ""}</div></div>${admin() ? `<div class="grid">${statsCard("Login accounts", roleAccounts.length, "U")}${statsCard("Active accounts", roleAccounts.filter((user) => user.status === "active").length, "✓")}${statsCard("Directory contacts", members.length, "C")}</div>` : ""}<div class="toolbar"><input id="role-directory-search" placeholder="Search name, designation, phone, or location"><span id="role-directory-count" class="tiny muted"></span></div><div class="table-wrap"><table><thead><tr><th>CONTACT</th><th>DESIGNATION</th><th>ROLE</th><th>PHONE</th><th>MANDAL / VILLAGE</th><th>STATUS</th></tr></thead><tbody id="role-directory-rows"></tbody></table></div>${admin() && roleAccounts.length ? `<div class="panel"><h3>Login accounts</h3>${roleAccounts.map((user) => `<div class="list-row"><div><b>${esc(user.full_name)}</b><small>${esc(user.username)} · ${esc(user.jurisdiction || "No jurisdiction")}</small></div><span class="pill ${user.status === "active" ? "green" : ""}">${esc(user.status)}</span></div>`).join("")}</div>` : ""}</div>`;
    $("#role-directory-search").oninput = render;
    render();
    if ($("#manage-role-accounts"))
      $("#manage-role-accounts").onclick = () => go("User Management");
    if ($("#add-role-contact"))
      $("#add-role-contact").onclick = () => go("Contact Directory");
    return;
  }

  const roles = Object.values(roleByPage);
  const mandals = units.filter((unit) => unit.unit_type === "Mandal");
  const villages = units.filter((unit) => unit.unit_type === "Village");
  $("#content").innerHTML =
    `<div class="welcome"><div><h2>Organizational structure</h2><p>Live role counts from accounts and directory contacts</p></div>${admin() ? '<div class="quick-actions"><button class="button subtle" data-page="Mandal Management">Manage mandals</button><button class="button subtle" data-page="Village Management">Manage villages</button></div>' : ""}</div><div class="grid">${roles.map((role) => statsCard(role, admin() ? users.filter((user) => user.role === role && user.status === "active").length : contacts.filter((contact) => contact.role === role && contact.status === "active").length, "•", "Active records")).join("")}</div><div class="panel"><div class="panel-head"><div><h2>Reporting structure</h2><p>Use configured unit and jurisdiction assignments to keep access scoped.</p></div></div><div class="list-row"><b>Super Admin</b><span class="pill">All authorized records</span></div><div class="list-row"><b>Constitutional In-Charge</b><span class="pill">Assigned constituency</span></div><div class="list-row"><b>Mandal-Level In-Charge</b><span class="pill">Assigned mandal</span></div><div class="list-row"><b>Village-Level In-Charge, Sarpanch, and representatives</b><span class="pill">Assigned village or role scope</span></div>${admin() ? `<div class="grid">${statsCard("Active mandals", mandals.filter((unit) => unit.status === "active").length, "M")}${statsCard("Active villages", villages.filter((unit) => unit.status === "active").length, "V")}</div>` : ""}<p class="tiny muted">The official reporting structure and role titles should be confirmed and configured by the organization.</p></div>`;
}
async function placeholder(p) {
  let text =
    p === "My Profile"
      ? `<div class="list-row"><div>Name<small>${esc(me.full_name)}</small></div></div><div class="list-row"><div>Username<small>${esc(me.username)}</small></div></div><div class="list-row"><div>Role<small>${esc(me.role)}</small></div></div><div class="list-row"><div>Jurisdiction<small>${esc(me.jurisdiction || "Not assigned")}</small></div></div>`
      : `<div class="empty">This workspace section is ready for authorized records as the module is configured.</div>`;
  $("#content").innerHTML =
    `<div class="panel"><div class="panel-head"><div><h2>${esc(p)}</h2><p>YSRCP Narasaraopet organizational workspace</p></div></div>${text}</div>`;
}
function modal(title, markup, save) {
  const old = $("#modal");
  if (old) old.remove();
  const el = document.createElement("div");
  el.id = "modal";
  el.className = "modal-backdrop";
  el.innerHTML = `<div class="modal"><div class="panel-head"><h2>${esc(title)}</h2><button class="text-button" data-close>Close</button></div>${markup}</div>`;
  document.body.append(el);
  el.querySelectorAll("[data-close]").forEach(
    (x) => (x.onclick = () => el.remove()),
  );
  el.onclick = (e) => {
    if (e.target === el) el.remove();
  };
  el.querySelector("#record-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await save(e.currentTarget);
      el.remove();
    } catch (err) {
      toast(err.message);
    }
  };
}
$("#login-form").onsubmit = async (e) => {
  e.preventDefault();
  $("#login-error").textContent = "";
  try {
    const data = await api("/login", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
    });
    me = data.user;
    await loadBranding();
    if (me.must_change_password) passwordScreen(true);
    else await go("Dashboard");
  } catch (err) {
    $("#login-error").textContent = err.message;
  }
};
$("#toggle-pass").onclick = () => {
  const i = $("[name=password]");
  i.type = i.type === "password" ? "text" : "password";
  $("#toggle-pass").textContent = i.type === "password" ? "Show" : "Hide";
};
$("#logout").onclick = async () => {
  await api("/logout", { method: "POST" });
  me = null;
  $("#app").classList.add("hidden");
  $("#login").classList.remove("hidden");
};
$("#menu-toggle").onclick = () => $(".sidebar").classList.toggle("open");
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-page]");
  if (b) go(b.dataset.page);
});

// Account editing and workflow status controls.
async function recordForm(title) {
  const task = title === "Tasks and Assignments",
    report = title === "Reports";
  let users = [];
  if (task && admin()) users = await api("/users");
  const assignees = users
    .map(
      (u) =>
        `<option value="${u.id}">${esc(u.full_name)} \u2014 ${esc(u.role)}</option>`,
    )
    .join("");
  modal(
    task ? "Assign task" : report ? "Submit report" : "Report an issue",
    `<form id="record-form"><label>Title<input name="title" required></label>${task ? `<label>Description<textarea name="description"></textarea></label><label>Assign to<select name="assigned_to"><option value="">Select an account</option>${assignees}</select></label><label>Jurisdiction<input name="jurisdiction"></label><label>Priority<select name="priority"><option>Normal</option><option>High</option><option>Urgent</option></select></label><label>Due date<input type="date" name="due_date"></label>` : report ? '<label>Report type<input name="report_type"></label><label>Reporting period<input name="period"></label><label>Description<textarea name="description"></textarea></label>' : '<label>Category<input name="category"></label><label>Priority<select name="priority"><option>Normal</option><option>High</option><option>Urgent</option></select></label><label>Description<textarea name="description"></textarea></label>'}<div class="form-actions"><button type="button" class="button" data-close>Cancel</button><button class="button primary">Save</button></div></form>`,
    async (f) => {
      const b = Object.fromEntries(new FormData(f));
      const route = task ? "/tasks" : report ? "/reports" : "/issues";
      await api(route, { method: "POST", body: JSON.stringify(b) });
      toast(task ? "Task assigned" : "Record submitted");
      go(title);
    },
  );
}
async function auditLogs() {
  const rows = await api("/audit");
  $("#content").innerHTML =
    `<div class="panel"><div class="panel-head"><div><h2>Audit logs</h2><p>Recent administrative and workflow events</p></div></div><div class="table-wrap"><table><thead><tr><th>TIME</th><th>ACTOR</th><th>ACTION</th><th>RECORD TYPE</th><th>RECORD ID</th></tr></thead><tbody>${rows.length ? rows.map((x) => `<tr><td>${new Date(x.created_at + "Z").toLocaleString()}</td><td>${esc(x.actor_name || "System")}</td><td>${esc(x.action)}</td><td>${esc(x.entity)}</td><td>${esc(x.entity_id || "—")}</td></tr>`).join("") : '<tr><td colspan="5" class="empty">No audit events yet.</td></tr>'}</tbody></table></div></div>`;
}
async function documents() {
  const rows = await api("/documents");
  $("#content").innerHTML =
    `<div class="panel"><div class="panel-head"><div><h2>Documents</h2><p>Private files shown only to their authorized role and jurisdiction</p></div>${admin() ? '<button class="button primary" id="upload-document">＋ Upload document</button>' : ""}</div><div class="table-wrap"><table><thead><tr><th>DOCUMENT</th><th>CATEGORY</th><th>FILE</th><th>JURISDICTION</th><th>UPLOADED</th><th>STATUS</th><th></th></tr></thead><tbody>${rows.length ? rows.map((d) => `<tr><td><b>${esc(d.title)}</b><br><span class="muted tiny">${esc(d.description || "")}</span></td><td>${esc(d.category)}</td><td>${esc(d.original_name)}<br><span class="muted tiny">${(d.byte_size / 1024).toFixed(0)} KB</span></td><td>${esc(d.jurisdiction || "All authorized jurisdictions")}</td><td>${new Date(d.created_at + "Z").toLocaleDateString()}<br><span class="muted tiny">${esc(d.uploaded_by_name)}</span></td><td><span class="pill ${d.archived ? "" : "green"}">${d.archived ? "Archived" : "Available"}</span></td><td><a class="button subtle" href="/api/documents/${encodeURIComponent(d.id)}/download">Download</a>${admin() ? ` <button class="button" data-archive-doc="${d.id}" data-archived="${d.archived ? 0 : 1}">${d.archived ? "Restore" : "Archive"}</button>` : ""}</td></tr>`).join("") : '<tr><td colspan="7" class="empty">No documents are available in your access scope.</td></tr>'}</tbody></table></div></div>`;
  if ($("#upload-document"))
    $("#upload-document").onclick = () => uploadDocument();
  $$("[data-archive-doc]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await api(`/documents/${b.dataset.archiveDoc}`, {
            method: "PATCH",
            body: JSON.stringify({ archived: b.dataset.archived === "1" }),
          });
          toast(
            b.dataset.archived === "1"
              ? "Document archived"
              : "Document restored",
          );
          documents();
        } catch (e) {
          toast(e.message);
        }
      }),
  );
}
function uploadDocument() {
  modal(
    "Upload private document",
    `<form id="record-form"><label>Document title<input name="title" required maxlength="160"></label><label>Description<textarea name="description" maxlength="2000"></textarea></label><div class="form-grid"><label>Category<input name="category" value="General"></label><label>Jurisdiction<input name="jurisdiction" placeholder="Leave blank for all jurisdictions"></label></div><label>Recipient roles (leave unselected for all roles)<select name="roles" multiple size="5">${["Super Admin", "Constitutional In-Charge", "Mandal-Level In-Charge", "Village-Level In-Charge", "Sarpanch", "Social Media In-Charge", "MBTC/MPTC Representative"].map((x) => `<option>${esc(x)}</option>`).join("")}</select></label><label>File (PDF, PNG, JPG, TXT, DOCX, XLSX; max 5 MB)<input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.docx,.xlsx" required></label><div class="form-actions"><button type="button" class="button" data-close>Cancel</button><button class="button primary">Upload document</button></div></form>`,
    async (form) => {
      const file = form.querySelector("[name=file]").files[0];
      if (!file) throw Error("Choose a document file.");
      if (file.size > 5 * 1024 * 1024)
        throw Error("The file must be no larger than 5 MB.");
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () =>
          reject(Error("Could not read the selected file."));
        reader.readAsDataURL(file);
      });
      const payload = {
        title: new FormData(form).get("title"),
        description: new FormData(form).get("description"),
        category: new FormData(form).get("category"),
        jurisdiction: new FormData(form).get("jurisdiction"),
        roles: [...form.querySelector("[name=roles]").selectedOptions].map(
          (x) => x.value,
        ),
        fileName: file.name,
        base64: String(dataUrl).split(",")[1],
      };
      await api("/documents", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast("Document saved securely");
      go("Documents");
    },
  );
}
async function socialContent() {
  if (!admin() && me.role !== "Social Media In-Charge")
    throw Error("Social media content access is restricted.");
  const rows = await api("/social-content");
  const statuses = [
    "Draft",
    "Submitted for Review",
    "Approved",
    "Changes Requested",
    "Scheduled",
    "Published",
    "Archived",
  ];
  $("#content").innerHTML =
    `<div class="panel"><div class="panel-head"><div><h2>Social media content planner</h2><p>Plan, submit, review, and schedule posts. No social platform is connected; publication is recorded manually.</p></div>${!admin() ? '<button class="button primary" id="new-post">＋ New draft</button>' : ""}</div><div class="table-wrap"><table><thead><tr><th>CONTENT</th><th>PLATFORM</th><th>SCHEDULE</th>${admin() ? "<th>CREATED BY</th>" : ""}<th>STATUS</th><th>ACTION</th></tr></thead><tbody>${rows.length ? rows.map((p) => `<tr><td><b>${esc(p.title)}</b><br><span class="muted tiny">${esc(p.body.slice(0, 140))}${p.body.length > 140 ? "…" : ""}</span></td><td>${esc(p.platform)}</td><td>${p.scheduled_at ? new Date(p.scheduled_at).toLocaleString() : "—"}</td>${admin() ? `<td>${esc(p.creator_name)}</td>` : ""}<td><span class="pill ${p.status === "Approved" || p.status === "Published" ? "green" : p.status === "Changes Requested" ? "amber" : ""}">${esc(p.status === "Published" ? "Published · manual" : p.status)}</span>${p.review_notes ? `<br><small class="muted">${esc(p.review_notes)}</small>` : ""}</td><td>${admin() ? `<button class="button subtle" data-review-post="${p.id}">Review</button>` : p.status === "Draft" || p.status === "Changes Requested" ? `<button class="button" data-edit-post="${p.id}">Edit</button> <button class="button subtle" data-submit-post="${p.id}">Submit</button>` : p.status === "Approved" || p.status === "Scheduled" ? `<button class="button subtle" data-plan-post="${p.id}">Schedule / update</button> ${p.status === "Approved" || p.status === "Scheduled" ? `<button class="button" data-published-post="${p.id}">Mark published</button>` : ""}` : "—"}</td></tr>`).join("") : '<tr><td colspan="6" class="empty">No content is planned yet.</td></tr>'}</tbody></table></div></div>`;
  if ($("#new-post")) $("#new-post").onclick = () => postForm();
  $$("[data-edit-post]").forEach(
    (b) =>
      (b.onclick = () =>
        postForm(rows.find((p) => p.id === b.dataset.editPost))),
  );
  $$("[data-submit-post]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await api(`/social-content/${b.dataset.submitPost}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "Submitted for Review" }),
          });
          toast("Submitted for review");
          socialContent();
        } catch (e) {
          toast(e.message);
        }
      }),
  );
  $$("[data-review-post]").forEach(
    (b) =>
      (b.onclick = () =>
        reviewPost(rows.find((p) => p.id === b.dataset.reviewPost))),
  );
  $$("[data-plan-post]").forEach(
    (b) =>
      (b.onclick = () =>
        postForm(
          rows.find((p) => p.id === b.dataset.planPost),
          true,
        )),
  );
  $$("[data-published-post]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (
          !confirm(
            "Record this post as published? The app cannot verify publication without a configured platform integration.",
          )
        )
          return;
        try {
          await api(`/social-content/${b.dataset.publishedPost}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "Published" }),
          });
          toast("Publication status recorded");
          socialContent();
        } catch (e) {
          toast(e.message);
        }
      }),
  );
}
function postForm(post = null, planOnly = false) {
  const editing = !!post,
    canEdit = !!post && planOnly;
  modal(
    editing
      ? planOnly
        ? "Schedule content"
        : "Edit draft"
      : "Create a content draft",
    `<form id="record-form"><label>Post title<input name="title" maxlength="160" value="${esc(post?.title || "")}" ${canEdit ? "disabled" : "required"}></label><label>Post text<textarea name="body" maxlength="10000" ${canEdit ? "disabled" : "required"}>${esc(post?.body || "")}</textarea></label><div class="form-grid"><label>Platform<input name="platform" value="${esc(post?.platform || "Unspecified")}" ${canEdit ? "disabled" : ""}></label><label>Schedule date and time<input name="scheduled_at" type="datetime-local" value="${post?.scheduled_at ? esc(new Date(post.scheduled_at).toISOString().slice(0, 16)) : ""}"></label></div><p class="tiny muted">Planning fields only. No post is sent to an external platform from this app.</p><div class="form-actions"><button type="button" class="button" data-close>Cancel</button><button class="button primary">${editing ? "Save" : "Save draft"}</button></div></form>`,
    async (f) => {
      const b = Object.fromEntries(new FormData(f));
      if (b.scheduled_at)
        b.scheduled_at = new Date(b.scheduled_at).toISOString();
      if (editing)
        await api(`/social-content/${post.id}`, {
          method: "PATCH",
          body: JSON.stringify(b),
        });
      else
        await api("/social-content", {
          method: "POST",
          body: JSON.stringify(b),
        });
      toast(editing ? "Content updated" : "Draft saved");
      go("Social Media Content");
    },
  );
}
function reviewPost(post) {
  modal(
    "Review social content",
    `<form id="record-form"><div class="list-row"><b>${esc(post.title)}</b><span class="pill">${esc(post.creator_name)}</span></div><div class="panel"><p>${esc(post.body)}</p></div><label>Review status<select name="status">${["Submitted for Review", "Approved", "Changes Requested", "Scheduled", "Published", "Archived"].map((s) => `<option ${s === post.status ? "selected" : ""}>${s}</option>`).join("")}</select></label><label>Review notes<textarea name="review_notes">${esc(post.review_notes || "")}</textarea></label><label>Scheduled date and time<input name="scheduled_at" type="datetime-local" value="${post.scheduled_at ? esc(new Date(post.scheduled_at).toISOString().slice(0, 16)) : ""}"></label><p class="tiny muted">No external publishing integration is connected. Published means the user recorded that status.</p><div class="form-actions"><button type="button" class="button" data-close>Cancel</button><button class="button primary">Save review</button></div></form>`,
    async (f) => {
      const b = Object.fromEntries(new FormData(f));
      if (b.scheduled_at)
        b.scheduled_at = new Date(b.scheduled_at).toISOString();
      else delete b.scheduled_at;
      await api(`/social-content/${post.id}`, {
        method: "PATCH",
        body: JSON.stringify(b),
      });
      toast("Review saved");
      go("Social Media Content");
    },
  );
}
async function myProfile() {
  $("#app").classList.remove("password-locked");
  $("#content").innerHTML =
    `<div class="panel"><div class="panel-head"><div><h2>My profile</h2><p>Account and security details</p></div></div><div class="list-row"><div>Name<small>${esc(me.full_name)}</small></div></div><div class="list-row"><div>Username<small>${esc(me.username)}</small></div></div><div class="list-row"><div>Role<small>${esc(me.role)}</small></div></div><div class="list-row"><div>Jurisdiction<small>${esc(me.jurisdiction || "Not assigned")}</small></div></div><div style="margin-top:15px"><button class="button primary" id="change-password">Change password</button></div></div>`;
  $("#change-password").onclick = () => passwordScreen(false);
}
function passwordScreen(forced) {
  $("#app").classList.toggle("password-locked", forced);
  shell();
  $("#crumb").textContent = "ACCOUNT SECURITY";
  $("#page-title").textContent = "Change password";
  $("#content").innerHTML =
    `<div class="panel password-panel"><div class="panel-head"><div><h2>${forced ? "Set a new password" : "Change your password"}</h2><p>${forced ? "Your administrator issued a temporary password. Choose a new password to continue." : "Enter your current password and choose a new one."}</p></div></div><form id="password-form"><label>Current password<input type="password" name="currentPassword" autocomplete="current-password" required></label><label>New password<input type="password" name="newPassword" minlength="12" autocomplete="new-password" required><small class="muted">Use at least 12 characters.</small></label><label>Confirm new password<input type="password" name="confirmPassword" minlength="12" autocomplete="new-password" required></label><p id="password-error" class="error" role="alert"></p><div class="form-actions">${forced ? "" : '<button type="button" class="button" id="cancel-password">Cancel</button>'}<button class="button primary">Update password</button></div></form></div>`;
  if ($("#cancel-password"))
    $("#cancel-password").onclick = () => go("My Profile");
  $("#password-form").onsubmit = async (e) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget));
    if (b.newPassword !== b.confirmPassword) {
      $("#password-error").textContent = "The new passwords do not match.";
      return;
    }
    try {
      await api("/password/change", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: b.currentPassword,
          newPassword: b.newPassword,
        }),
      });
      me.must_change_password = false;
      toast("Password updated");
      await go(forced ? "Dashboard" : "My Profile");
    } catch (err) {
      $("#password-error").textContent = err.message;
    }
  };
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-reset-user]");
  if (!b) return;
  const userName = b.closest("tr").querySelector("td").textContent;
  modal(
    "Set account password",
    `<form id="record-form"><p class="muted">Set a password for ${esc(userName)}. The user can sign in immediately with the login ID and password you provide. No OTP is used.</p><label>New password<input name="password" type="password" minlength="12" autocomplete="new-password" required></label><div class="form-actions"><button type="button" class="button" data-close>Cancel</button><button class="button primary">Save password</button></div></form>`,
    async (f) => {
      await api(`/users/${b.dataset.resetUser}/reset-password`, {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(f))),
      });
      toast("Password updated; existing sessions were signed out");
      go("User Management");
    },
  );
});

async function users() {
  const rows = await api("/users"),
    roles = [...new Set(rows.map((x) => x.role))].sort();
  $("#content").innerHTML =
    `<div class="panel"><div class="panel-head"><div><h2>User management</h2><p>Super Admin issues each login ID and password; no OTP is used at sign-in.</p></div><button class="button primary" id="add-user">+ Create account</button></div><div class="toolbar"><input id="user-search" placeholder="Search name, login ID, or jurisdiction"><select id="user-role"><option value="">All roles</option>${roles.map((r) => `<option>${esc(r)}</option>`).join("")}</select><select id="user-status"><option value="">All account states</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div><div class="table-wrap"><table><thead><tr><th>NAME</th><th>LOGIN ID</th><th>ROLE</th><th>JURISDICTION</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody id="user-rows"></tbody></table></div></div>`;
  const draw = () => {
    const q = $("#user-search").value.trim().toLowerCase(),
      role = $("#user-role").value,
      status = $("#user-status").value,
      found = rows.filter(
        (x) =>
          (!q ||
            [x.full_name, x.username, x.jurisdiction]
              .join(" ")
              .toLowerCase()
              .includes(q)) &&
          (!role || x.role === role) &&
          (!status || x.status === status),
      );
    $("#user-rows").innerHTML = found.length
      ? found
          .map(
            (x) =>
              `<tr><td>${esc(x.full_name)}</td><td>${esc(x.username)}</td><td>${esc(x.role)}</td><td>${esc(x.jurisdiction || "Unassigned")}</td><td><span class="pill ${x.status === "active" ? "green" : ""}">${esc(x.status)}</span></td><td>${x.role === roles[0] ? "Protected administrator account" : `<button class="button subtle" data-edit-user="${esc(x.id)}">Manage</button> <button class="button" data-reset-user="${esc(x.id)}">Set password</button>`}</td></tr>`,
          )
          .join("")
      : '<tr><td colspan="6" class="empty">No matching accounts.</td></tr>';
  };
  ["#user-search", "#user-role", "#user-status"].forEach((s) =>
    $(s).addEventListener(s === "#user-search" ? "input" : "change", draw),
  );
  draw();
  $("#add-user").onclick = () =>
    modal(
      "Create account",
      `<form id="record-form" class="form-grid"><label>Full name<input name="full_name" maxlength="160" required></label><label>Login ID<input name="username" maxlength="80" autocomplete="off" required></label><label>Role<select name="role">${["Constitutional In-Charge", "Mandal-Level In-Charge", "Village-Level In-Charge", "Sarpanch", "Social Media In-Charge", "MBTC/MPTC Representative"].map((r) => `<option>${esc(r)}</option>`).join("")}</select></label><label>Password (at least 12 characters)<input name="password" type="password" minlength="12" autocomplete="new-password" required></label><label>Jurisdiction<input name="jurisdiction"></label><label>Email<input name="email" type="email"></label><label>Phone<input name="phone"></label><p class="tiny muted wide">Give the user their login ID and password through a private channel. They can sign in directly; no OTP or first-login reset is required.</p><div class="form-actions wide"><button type="button" class="button" data-close>Cancel</button><button class="button primary">Create account</button></div></form>`,
      async (f) => {
        const r = await api("/users", {
          method: "POST",
          body: JSON.stringify(Object.fromEntries(new FormData(f))),
        });
        toast(`Account created: ${r.username}`);
        go("User Management");
      },
    );
  $$("[data-edit-user]").forEach(
    (btn) =>
      (btn.onclick = () => {
        const u = rows.find((x) => x.id === btn.dataset.editUser);
        modal(
          "Manage account",
          `<form id="record-form" class="form-grid"><label>Full name<input name="full_name" value="${esc(u.full_name)}" required></label><label>Login ID<input name="username" value="${esc(u.username)}" maxlength="80" required></label><label>Role<select name="role">${["Constitutional In-Charge", "Mandal-Level In-Charge", "Village-Level In-Charge", "Sarpanch", "Social Media In-Charge", "MBTC/MPTC Representative"].map((r) => `<option ${r === u.role ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></label><label>Account status<select name="status"><option value="active" ${u.status === "active" ? "selected" : ""}>Active</option><option value="inactive" ${u.status === "inactive" ? "selected" : ""}>Inactive</option></select></label><label>Jurisdiction<input name="jurisdiction" value="${esc(u.jurisdiction || "")}"></label><label>Email<input name="email" type="email" value="${esc(u.email || "")}"></label><label>Phone<input name="phone" value="${esc(u.phone || "")}"></label><div class="form-actions wide"><button type="button" class="button" data-close>Cancel</button><button class="button primary">Save changes</button></div></form>`,
          async (f) => {
            await api(`/users/${u.id}`, {
              method: "PATCH",
              body: JSON.stringify(Object.fromEntries(new FormData(f))),
            });
            toast("Account updated");
            go("User Management");
          },
        );
      }),
  );
}

function contactForm(contact = null) {
  const c = contact || {},
    editing = !!contact;
  modal(
    editing ? "Edit contact" : "Add directory contact",
    `<form id="record-form" class="form-grid"><label>Full name<input name="name" value="${esc(c.name || "")}" required maxlength="160"></label><label>Official designation<input name="designation" value="${esc(c.designation || "")}"></label><label>Role category<input name="role" value="${esc(c.role || "")}"></label><label>Phone<input name="phone" value="${esc(c.phone || "")}" inputmode="tel"></label><label>WhatsApp<input name="whatsapp" value="${esc(c.whatsapp || "")}" inputmode="tel"></label><label>Email<input name="email" value="${esc(c.email || "")}" type="email"></label><label>Mandal<input name="mandal" value="${esc(c.mandal || "")}"></label><label>Village<input name="village" value="${esc(c.village || "")}"></label><label>Jurisdiction<input name="jurisdiction" value="${esc(c.jurisdiction || "")}"></label><label>Status<select name="status"><option value="active" ${c.status !== "inactive" ? "selected" : ""}>Active</option><option value="inactive" ${c.status === "inactive" ? "selected" : ""}>Inactive</option></select></label><label>Address<input name="address" value="${esc(c.address || "")}"></label><label><span>Verified</span><select name="verified"><option value="0" ${!c.verified ? "selected" : ""}>Not verified</option><option value="1" ${c.verified ? "selected" : ""}>Verified</option></select></label><label class="wide">Administrative notes<textarea name="notes" maxlength="2000">${esc(c.notes || "")}</textarea></label><div class="form-actions wide"><button type="button" class="button" data-close>Cancel</button><button class="button primary">${editing ? "Save changes" : "Save contact"}</button></div></form>`,
    async (f) => {
      const data = Object.fromEntries(new FormData(f));
      data.verified = data.verified === "1";
      await api(editing ? `/contacts/${c.id}` : "/contacts", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(data),
      });
      toast(editing ? "Contact updated" : "Contact saved");
      go("Contact Directory");
    },
  );
}

async function dashboard() {
  const d = await api("/dashboard");
  const cards = admin()
    ? [
        ["Total accounts", d.totalUsers, "♙"],
        ["Active accounts", d.activeUsers, "✓"],
        ["Inactive accounts", d.inactiveUsers, "–"],
        [
          "Constitutional In-Charges",
          d.userCounts["Constitutional In-Charge"],
          "⌘",
        ],
        [
          "Mandal-Level In-Charges",
          d.userCounts["Mandal-Level In-Charge"],
          "⌖",
        ],
        [
          "Village-Level In-Charges",
          d.userCounts["Village-Level In-Charge"],
          "⌂",
        ],
        ["Sarpanches", d.userCounts.Sarpanch, "♧"],
        [
          "Social Media In-Charges",
          d.userCounts["Social Media In-Charge"],
          "◎",
        ],
        [
          "MBTC/MPTC Representatives",
          d.userCounts["MBTC/MPTC Representative"],
          "♢",
        ],
        ["Unread messages", d.unreadMessages, "✉"],
        ["Pending tasks", d.tasks, "✓"],
        ["Reports awaiting review", d.reportsAwaitingReview, "▥"],
        ["Open issues", d.openIssues, "⚑"],
        ["Directory contacts", d.contacts, "▤"],
      ]
    : [
        ["Directory contacts", d.contacts, "▤"],
        ["Open tasks", d.tasks, "✓"],
        ["Reports", d.reports, "▥"],
        ["Unread messages", d.unreadMessages, "✉"],
      ];
  $("#content").innerHTML =
    `<div class="welcome"><div><h2>Welcome back, ${esc(me.full_name.split(" ")[0])}</h2><p>Your ${esc(me.role)} workspace for YSRCP Narasaraopet.</p></div>${!admin() ? '<button class="button primary" data-action="contact">Contact Super Admin</button>' : ""}</div><div class="grid">${cards.map((c) => statsCard(...c)).join("")}</div><div class="two-col"><div class="panel"><div class="panel-head"><div><h2>Recent activity</h2><p>${admin() ? "Latest logged workspace actions" : "Your recent account actions"}</p></div></div>${d.activity.length ? d.activity.map((a) => `<div class="list-row"><div><b>${esc(a.actor_name || "You")}</b><small>${esc(a.action)} · ${esc(a.entity)}</small></div><span class="tiny muted">${new Date(a.created_at + "Z").toLocaleString()}</span></div>`).join("") : '<div class="empty">No recent activity recorded.</div>'}</div><div class="panel"><div class="panel-head"><div><h2>Quick access</h2><p>Common workspace actions</p></div></div><div class="quick-actions"><button class="button subtle" data-page="Contact Directory">Browse directory</button><button class="button subtle" data-page="Tasks and Assignments">View tasks</button><button class="button subtle" data-page="Reports">Reports</button><button class="button subtle" data-page="Issues and Requests">Issues and requests</button></div><div class="list-row"><div>Role<small>${esc(me.role)}</small></div><span class="pill green">Active</span></div><div class="list-row"><div>Jurisdiction<small>${esc(me.jurisdiction || "Authorized records")}</small></div></div></div></div>`;
  const contact = $("[data-action=contact]");
  if (contact) contact.onclick = () => go("Contact Super Admin");
}

async function announcements() {
  const rows = await api("/announcements");
  $("#content").innerHTML =
    `<div class="panel"><div class="panel-head"><div><h2>Announcements</h2><p>${admin() ? "Create, target, edit, publish, and unpublish notices" : "Updates for your role and assigned jurisdiction"}</p></div>${admin() ? '<button class="button primary" id="add-ann">+ New announcement</button>' : ""}</div>${rows.length ? rows.map((a) => `<div class="list-row"><div><b>${esc(a.title)}</b><small>${esc(a.body)}<br>Audience: ${esc(JSON.parse(a.roles || "[]").join(", ") || "All roles")} · ${esc(a.jurisdiction || "All jurisdictions")}</small></div><div>${admin() ? `<span class="pill ${a.status === "Published" ? "green" : ""}">${esc(a.status)}</span><div class="quick-actions" style="margin-top:7px"><button class="button subtle" data-edit-ann="${esc(a.id)}">Edit</button><button class="button" data-toggle-ann="${esc(a.id)}" data-status="${a.status === "Published" ? "Unpublished" : "Published"}">${a.status === "Published" ? "Unpublish" : "Publish"}</button></div>` : '<span class="pill green">Published</span>'}</div></div>`).join("") : '<div class="empty">No announcements available.</div>'}</div>`;
  if ($("#add-ann")) $("#add-ann").onclick = () => announcementForm();
  $$("[data-edit-ann]").forEach(
    (b) =>
      (b.onclick = () =>
        announcementForm(rows.find((a) => a.id === b.dataset.editAnn))),
  );
  $$("[data-toggle-ann]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await api(`/announcements/${b.dataset.toggleAnn}`, {
            method: "PATCH",
            body: JSON.stringify({ status: b.dataset.status }),
          });
          toast(`Announcement ${b.dataset.status.toLowerCase()}`);
          announcements();
        } catch (e) {
          toast(e.message);
        }
      }),
  );
}
function announcementForm(item = null) {
  const selected = item ? JSON.parse(item.roles || "[]") : [],
    choices = [
      "Super Admin",
      "Constitutional In-Charge",
      "Mandal-Level In-Charge",
      "Village-Level In-Charge",
      "Sarpanch",
      "Social Media In-Charge",
      "MBTC/MPTC Representative",
    ],
    localTime = (value) =>
      value ? new Date(value).toISOString().slice(0, 16) : "";
  modal(
    item ? "Edit announcement" : "Create announcement",
    `<form id="record-form"><label>Title<input name="title" maxlength="160" value="${esc(item?.title || "")}" required></label><label>Announcement<textarea name="body" maxlength="10000" required>${esc(item?.body || "")}</textarea></label><label>Recipient roles (leave blank for all)<select name="roles" multiple size="5">${choices.map((r) => `<option ${selected.includes(r) ? "selected" : ""}>${esc(r)}</option>`).join("")}</select></label><label>Jurisdiction (blank for all)<input name="jurisdiction" value="${esc(item?.jurisdiction || "")}"></label><div class="form-grid"><label>Status<select name="status">${["Draft", "Scheduled", "Published", "Unpublished"].map((s) => `<option ${s === (item?.status || "Published") ? "selected" : ""}>${s}</option>`).join("")}</select></label><label>Publish at<input name="scheduled_at" type="datetime-local" value="${esc(localTime(item?.scheduled_at))}"></label><label>Expire at (optional)<input name="expires_at" type="datetime-local" value="${esc(localTime(item?.expires_at))}"></label></div><p class="tiny muted">A future publish time holds the announcement until then. It expires automatically at the selected time.</p><div class="form-actions"><button type="button" class="button" data-close>Cancel</button><button class="button primary">${item ? "Save changes" : "Create announcement"}</button></div></form>`,
    async (f) => {
      const b = Object.fromEntries(new FormData(f));
      b.roles = [...f.querySelector("[name=roles]").selectedOptions].map(
        (o) => o.value,
      );
      for (const key of ["scheduled_at", "expires_at"])
        if (b[key]) b[key] = new Date(b[key]).toISOString();
        else b[key] = null;
      await api(item ? `/announcements/${item.id}` : "/announcements", {
        method: item ? "PATCH" : "POST",
        body: JSON.stringify(b),
      });
      toast(item ? "Announcement updated" : "Announcement created");
      go("Announcements");
    },
  );
}

// Rich record views for task progress, report review history, and issue ownership.
async function records(title, url) {
  const rows = await api(url),
    task = title === "Tasks and Assignments",
    report = title === "Reports",
    issue = !task && !report,
    accounts = admin() && (task || issue) ? await api("/users") : [];
  const names = Object.fromEntries(accounts.map((a) => [a.id, a.full_name]));
  const states = task
    ? [
        "Not Started",
        "In Progress",
        "Submitted",
        "Needs Revision",
        "Completed",
        "Cancelled",
      ]
    : report
      ? [
          "Submitted",
          "Under Review",
          "Changes Requested",
          "Approved",
          "Rejected",
        ]
      : [
          "Open",
          "Assigned",
          "In Progress",
          "Awaiting Information",
          "Resolved",
          "Closed",
        ];
  $("#content").innerHTML =
    `<div class="panel"><div class="panel-head"><div><h2>${esc(title)}</h2><p>${task ? "Track assignments and progress" : report ? "Submitted reports and review history" : "Submitted issues, ownership, and resolution notes"}</p></div>${admin() && task ? '<button class="button primary" id="add-record">+ Assign task</button>' : ""}</div><div class="table-wrap"><table><thead><tr><th>TITLE</th>${task ? "<th>ASSIGNEE</th><th>PROGRESS</th>" : report ? "<th>TYPE / PERIOD</th>" : "<th>ASSIGNEE</th>"}<th>JURISDICTION</th><th>STATUS</th><th>UPDATED</th><th>ACTION</th></tr></thead><tbody>${rows.length ? rows.map((r) => `<tr><td><b>${esc(r.title)}</b>${task && r.progress_note ? `<br><small class="muted">${esc(r.progress_note)}</small>` : ""}${report && r.review_comments ? `<br><small class="muted">${esc(r.review_comments)}</small>` : ""}${issue && r.resolution_notes ? `<br><small class="muted">${esc(r.resolution_notes)}</small>` : ""}</td>${task ? `<td>${esc(names[r.assigned_to] || "Unassigned")}</td><td><progress max="100" value="${Number(r.progress) || 0}"></progress> ${Number(r.progress) || 0}%</td>` : report ? `<td>${esc([r.report_type, r.period].filter(Boolean).join(" · ") || "—")}</td>` : `<td>${esc(names[r.assigned_to] || "Unassigned")}</td>`}<td>${esc(r.jurisdiction || "—")}</td><td><select data-record-status="${esc(r.id)}" data-kind="${task ? "task" : report ? "report" : "issue"}" ${admin() || task ? "" : "disabled"}>${states.map((s) => `<option ${s === r.status ? "selected" : ""}>${s}</option>`).join("")}</select></td><td>${new Date((r.updated_at || r.created_at) + "Z").toLocaleDateString()}</td><td>${task ? `<button class="button subtle" data-task-progress="${esc(r.id)}">Update</button>` : report ? `${admin() ? `<button class="button subtle" data-report-review="${esc(r.id)}">Review</button>` : ""}<button class="button" data-report-history="${esc(r.id)}">History</button>` : admin() ? `<button class="button subtle" data-issue-manage="${esc(r.id)}">Manage</button>` : "—"}</td></tr>`).join("") : `<tr><td colspan="6" class="empty">No records yet.</td></tr>`}</tbody></table></div>${!task ? `<button class="button subtle" id="add-record">+ Submit ${report ? "report" : "issue"}</button>` : ""}</div>`;
  if ($("#add-record")) $("#add-record").onclick = () => recordForm(title);
  $$("[data-record-status]").forEach(
    (sel) =>
      (sel.onchange = async () => {
        const kind = sel.dataset.kind;
        try {
          await api(
            `/${kind === "task" ? "tasks" : kind === "report" ? "reports" : "issues"}/${sel.dataset.recordStatus}`,
            { method: "PATCH", body: JSON.stringify({ status: sel.value }) },
          );
          toast("Status updated");
          records(title, url);
        } catch (e) {
          toast(e.message);
          records(title, url);
        }
      }),
  );
  $$("[data-task-progress]").forEach(
    (b) =>
      (b.onclick = () =>
        taskProgress(rows.find((r) => r.id === b.dataset.taskProgress))),
  );
  $$("[data-report-review]").forEach(
    (b) =>
      (b.onclick = () =>
        reportReview(rows.find((r) => r.id === b.dataset.reportReview))),
  );
  $$("[data-report-history]").forEach(
    (b) =>
      (b.onclick = () =>
        reportHistory(rows.find((r) => r.id === b.dataset.reportHistory))),
  );
  $$("[data-issue-manage]").forEach(
    (b) =>
      (b.onclick = () =>
        issueManage(
          rows.find((r) => r.id === b.dataset.issueManage),
          accounts,
        )),
  );
}
function taskProgress(t) {
  modal(
    "Update task progress",
    `<form id="record-form"><label>Status<select name="status">${["Not Started", "In Progress", "Submitted", "Needs Revision", "Completed", "Cancelled"].map((x) => `<option ${x === t.status ? "selected" : ""}>${x}</option>`).join("")}</select></label><label>Progress (%)<input type="number" name="progress" min="0" max="100" step="1" value="${Number(t.progress) || 0}" required></label><label>Progress note<textarea name="progress_note" maxlength="2000">${esc(t.progress_note || "")}</textarea></label><div class="form-actions"><button type="button" class="button" data-close>Cancel</button><button class="button primary">Save update</button></div></form>`,
    async (f) => {
      await api(`/tasks/${t.id}`, {
        method: "PATCH",
        body: JSON.stringify(Object.fromEntries(new FormData(f))),
      });
      toast("Task progress saved");
      go("Tasks and Assignments");
    },
  );
}
function reportReview(r) {
  modal(
    "Review report",
    `<form id="record-form"><label>Status<select name="status">${["Under Review", "Changes Requested", "Approved", "Rejected"].map((x) => `<option ${x === r.status ? "selected" : ""}>${x}</option>`).join("")}</select></label><label>Review comments<textarea name="review_comments" maxlength="4000">${esc(r.review_comments || "")}</textarea></label><div class="form-actions"><button type="button" class="button" data-close>Cancel</button><button class="button primary">Save review</button></div></form>`,
    async (f) => {
      await api(`/reports/${r.id}`, {
        method: "PATCH",
        body: JSON.stringify(Object.fromEntries(new FormData(f))),
      });
      toast("Report review saved");
      go("Reports");
    },
  );
}
async function reportHistory(r) {
  try {
    const rows = await api(`/reports/${r.id}/reviews`);
    modal(
      "Report review history",
      `<form id="record-form"><div class="list-row"><b>${esc(r.title)}</b></div>${rows.length ? rows.map((x) => `<div class="list-row"><div><b>${esc(x.status)}</b><small>${esc(x.reviewer_name)} · ${new Date(x.created_at + "Z").toLocaleString()}${x.comments ? `<br>${esc(x.comments)}` : ""}</small></div></div>`).join("") : '<div class="empty">No reviews have been recorded.</div>'}<div class="form-actions"><button type="button" class="button primary" data-close>Close</button></div></form>`,
      async () => {},
    );
  } catch (e) {
    toast(e.message);
  }
}
function issueManage(i, accounts) {
  modal(
    "Manage issue",
    `<form id="record-form"><label>Status<select name="status">${["Open", "Assigned", "In Progress", "Awaiting Information", "Resolved", "Closed"].map((x) => `<option ${x === i.status ? "selected" : ""}>${x}</option>`).join("")}</select></label><label>Assign to<select name="assigned_to"><option value="">Unassigned</option>${accounts
      .filter((a) => a.status === "active")
      .map(
        (a) =>
          `<option value="${esc(a.id)}" ${a.id === i.assigned_to ? "selected" : ""}>${esc(a.full_name)} · ${esc(a.role)}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Resolution notes<textarea name="resolution_notes" maxlength="4000">${esc(i.resolution_notes || "")}</textarea></label><div class="form-actions"><button type="button" class="button" data-close>Cancel</button><button class="button primary">Save issue</button></div></form>`,
    async (f) => {
      await api(`/issues/${i.id}`, {
        method: "PATCH",
        body: JSON.stringify(Object.fromEntries(new FormData(f))),
      });
      toast("Issue updated");
      go("Issues and Requests");
    },
  );
}
async function directory() {
  const rows = await api("/contacts"),
    roles = [...new Set(rows.map((x) => x.role).filter(Boolean))].sort(),
    mandals = [...new Set(rows.map((x) => x.mandal).filter(Boolean))].sort(),
    villages = [...new Set(rows.map((x) => x.village).filter(Boolean))].sort();
  $("#content").innerHTML =
    `<div class="panel"><div class="panel-head"><div><h2>Centralized contact directory</h2><p>Search and manage authorized organizational contacts</p></div>${admin() ? '<div class="quick-actions"><label class="button subtle" for="contact-csv">Import CSV</label><input id="contact-csv" type="file" accept=".csv" hidden><a class="button subtle" href="/api/contacts/export">Export CSV</a><button class="button primary" id="add-contact">+ Add contact</button></div>' : ""}</div><div class="toolbar"><input id="contact-search" placeholder="Search name, phone, or designation"><select id="role-filter"><option value="">All roles</option>${roles.map((x) => `<option>${esc(x)}</option>`).join("")}</select><select id="mandal-filter"><option value="">All mandals</option>${mandals.map((x) => `<option>${esc(x)}</option>`).join("")}</select><select id="village-filter"><option value="">All villages</option>${villages.map((x) => `<option>${esc(x)}</option>`).join("")}</select>${admin() ? '<select id="contact-status"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>' : ""}<span class="muted tiny" id="contact-count"></span></div><div class="table-wrap"><table><thead><tr><th>CONTACT</th><th>DESIGNATION</th><th>ROLE</th><th>PHONE</th><th>MANDAL / VILLAGE</th><th>STATUS</th>${admin() ? "<th>MANAGE</th>" : ""}</tr></thead><tbody id="contact-rows"></tbody></table></div></div>`;
  const draw = () => {
    const q = $("#contact-search").value.trim().toLowerCase(),
      role = $("#role-filter").value,
      mandal = $("#mandal-filter").value,
      village = $("#village-filter").value,
      status = $("#contact-status")?.value || "",
      filtered = rows.filter(
        (x) =>
          (!q ||
            [x.name, x.phone, x.designation, x.email, x.mandal, x.village]
              .join(" ")
              .toLowerCase()
              .includes(q)) &&
          (!role || x.role === role) &&
          (!mandal || x.mandal === mandal) &&
          (!village || x.village === village) &&
          (!status || x.status === status),
      );
    $("#contact-count").textContent = `${filtered.length} contacts`;
    $("#contact-rows").innerHTML = filtered.length
      ? filtered
          .map(
            (x) =>
              `<tr><td><span class="avatar">${esc((x.name || "?")[0].toUpperCase())}</span><span class="contact-name">${esc(x.name)}</span>${x.verified ? '<span class="pill green">Verified</span>' : ""}</td><td>${esc(x.designation || "—")}</td><td>${esc(x.role || "—")}</td><td>${x.phone ? `<a href="tel:${encodeURIComponent(x.phone)}">${esc(x.phone)}</a>` : "—"}${x.whatsapp ? `<br><a href="https://wa.me/${encodeURIComponent(x.whatsapp.replace(/\D/g, ""))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}${x.email ? `<br><a href="mailto:${encodeURIComponent(x.email)}">Email</a>` : ""}</td><td>${esc([x.mandal, x.village].filter(Boolean).join(" · ") || "—")}</td><td><span class="pill ${x.status === "active" ? "green" : ""}">${esc(x.status)}</span></td>${admin() ? `<td><button class="button subtle" data-edit-contact="${esc(x.id)}">Edit</button></td>` : ""}</tr>`,
          )
          .join("")
      : `<tr><td colspan="${admin() ? 7 : 6}" class="empty">No matching contacts.</td></tr>`;
  };
  [
    "#contact-search",
    "#role-filter",
    "#mandal-filter",
    "#village-filter",
    "#contact-status",
  ].forEach((s) => {
    if ($(s))
      $(s).addEventListener(s === "#contact-search" ? "input" : "change", draw);
  });
  draw();
  if ($("#add-contact")) $("#add-contact").onclick = () => contactForm();
  $$("[data-edit-contact]").forEach(
    (btn) =>
      (btn.onclick = () =>
        contactForm(rows.find((x) => x.id === btn.dataset.editContact))),
  );
  const fileInput = $("#contact-csv");
  if (fileInput)
    fileInput.onchange = async () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (file.size > 900000) {
        toast("CSV must be smaller than 900 KB");
        return;
      }
      try {
        const result = await api("/contacts/import", {
          method: "POST",
          body: JSON.stringify({ csv: await file.text() }),
        });
        toast(
          `Imported ${result.imported}; skipped ${result.skippedDuplicates} duplicates`,
        );
        directory();
      } catch (e) {
        toast(e.message);
      }
    };
}
async function reportsView() {
  const rows = await api("/reports"),
    jurisdictions = [
      ...new Set(rows.map((r) => r.jurisdiction).filter(Boolean)),
    ].sort(),
    statuses = [
      "Submitted",
      "Under Review",
      "Changes Requested",
      "Approved",
      "Rejected",
    ];
  $("#content").innerHTML =
    `<div class="panel"><div class="panel-head"><div><h2>Reports</h2><p>Review submissions, filter queues, and export report records</p></div><div class="quick-actions">${admin() ? '<a class="button subtle" id="export-reports" href="/api/reports/export">Export CSV</a>' : ""}<button class="button primary" id="submit-report">+ Submit report</button></div></div><div class="toolbar"><input id="report-search" placeholder="Search title, type, or period"><select id="report-status"><option value="">All statuses</option>${statuses.map((s) => `<option>${esc(s)}</option>`).join("")}</select><select id="report-jurisdiction"><option value="">All jurisdictions</option>${jurisdictions.map((j) => `<option>${esc(j)}</option>`).join("")}</select><span class="tiny muted" id="report-count"></span></div><div class="table-wrap"><table><thead><tr><th>REPORT</th><th>JURISDICTION</th><th>STATUS</th><th>SUBMITTED</th><th>ACTIONS</th></tr></thead><tbody id="report-rows"></tbody></table></div></div>`;
  const draw = () => {
    const q = $("#report-search").value.trim().toLowerCase(),
      status = $("#report-status").value,
      jurisdiction = $("#report-jurisdiction").value,
      filtered = rows.filter(
        (r) =>
          (!q ||
            [r.title, r.report_type, r.period]
              .join(" ")
              .toLowerCase()
              .includes(q)) &&
          (!status || r.status === status) &&
          (!jurisdiction || r.jurisdiction === jurisdiction),
      );
    $("#report-count").textContent = `${filtered.length} reports`;
    $("#report-rows").innerHTML = filtered.length
      ? filtered
          .map(
            (r) =>
              `<tr><td><b>${esc(r.title)}</b><br><span class="muted tiny">${esc([r.report_type, r.period].filter(Boolean).join(" · ") || "")}</span>${r.review_comments ? `<br><small class="muted">${esc(r.review_comments)}</small>` : ""}</td><td>${esc(r.jurisdiction || "–")}</td><td>${
                admin()
                  ? `<select data-report-status="${esc(r.id)}">${statuses
                      .slice(1)
                      .map(
                        (s) =>
                          `<option ${s === r.status ? "selected" : ""}>${s}</option>`,
                      )
                      .join("")}</select>`
                  : `<span class="pill">${esc(r.status)}</span>`
              }</td><td>${new Date(r.created_at + "Z").toLocaleDateString()}</td><td>${admin() ? `<button class="button subtle" data-report-review="${esc(r.id)}">Review</button> ` : ""}<button class="button" data-report-history="${esc(r.id)}">History</button></td></tr>`,
          )
          .join("")
      : '<tr><td colspan="5" class="empty">No reports match these filters.</td></tr>';
  };
  ["#report-search", "#report-status", "#report-jurisdiction"].forEach((s) =>
    $(s).addEventListener(s === "#report-search" ? "input" : "change", draw),
  );
  draw();
  $("#submit-report").onclick = () => recordForm("Reports");
  $$("[data-report-status]").forEach(
    (sel) =>
      (sel.onchange = async () => {
        try {
          await api(`/reports/${sel.dataset.reportStatus}`, {
            method: "PATCH",
            body: JSON.stringify({ status: sel.value }),
          });
          toast("Report status updated");
          reportsView();
        } catch (e) {
          toast(e.message);
        }
      }),
  );
  $$("[data-report-review]").forEach(
    (b) =>
      (b.onclick = () =>
        reportReview(rows.find((r) => r.id === b.dataset.reportReview))),
  );
  $$("[data-report-history]").forEach(
    (b) =>
      (b.onclick = () =>
        reportHistory(rows.find((r) => r.id === b.dataset.reportHistory))),
  );
  const exportLink = $("#export-reports");
  if (exportLink) {
    const updateExport = () => {
      const p = new URLSearchParams();
      if ($("#report-status").value) p.set("status", $("#report-status").value);
      if ($("#report-jurisdiction").value)
        p.set("jurisdiction", $("#report-jurisdiction").value);
      exportLink.href =
        "/api/reports/export" + (p.size ? "?" + p.toString() : "");
    };
    $("#report-status").addEventListener("change", updateExport);
    $("#report-jurisdiction").addEventListener("change", updateExport);
  }
}

async function notifications() {
  const rows = await api("/notifications"),
    unread = rows.filter((n) => !n.is_read).length,
    pages = {
      "/": "Dashboard",
      "/tasks": "Tasks and Assignments",
      "/reports": "Reports",
      "/issues": "Issues and Requests",
      "/announcements": "Announcements",
      "/documents": "Documents",
      "/social-content": "Social Media Content",
      "/inbox": "Contact Super Admin",
      "/messages": "Contact Super Admin",
    };
  $("#content").innerHTML =
    `<div class="panel"><div class="panel-head"><div><h2>Notifications</h2><p>Updates for your assignments, announcements, messages, and reviews</p></div><span class="pill green">${unread} unread</span></div>${rows.length ? rows.map((n) => `<div class="list-row"><div><b>${esc(n.title)}</b><small>${esc(n.body)} · ${new Date(n.created_at + "Z").toLocaleString()}</small></div><div class="quick-actions">${n.href ? `<button class="button subtle" data-open-notify="${esc(n.id)}" data-href="${esc(n.href)}">Open</button>` : ""}${n.is_read ? '<span class="pill">Read</span>' : `<button class="button" data-read="${esc(n.id)}">Mark read</button>`}</div></div>`).join("") : '<div class="empty">You have no notifications.</div>'}</div>`;
  const markRead = async (id) => {
    await api(`/notifications/${id}`, { method: "PATCH", body: "{}" });
  };
  $$("[data-read]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await markRead(b.dataset.read);
          notifications();
        } catch (e) {
          toast(e.message);
        }
      }),
  );
  $$("[data-open-notify]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          const row = rows.find((n) => n.id === b.dataset.openNotify);
          if (row && !row.is_read) await markRead(row.id);
          const target = pages[b.dataset.href] || "Notifications";
          await go(target);
        } catch (e) {
          toast(e.message);
        }
      }),
  );
}
async function inbox() {
  conversations = await api("/conversations");
  activeConversation = null;
  $("#content").innerHTML =
    `<div class="panel"><div class="panel-head"><div><h2>${admin() ? "Contact Super Admin inbox" : "Private messages with Super Admin"}</h2><p>${admin() ? "Search and filter private conversations" : "Your private conversation history"}</p></div>${!admin() ? '<button class="button primary" id="new-message">+ New message</button>' : ""}</div><div class="thread-layout"><div><div class="toolbar"><input id="thread-search" placeholder="Search subject, sender, or message category">${admin() ? `<select id="thread-status"><option value="">All statuses</option>${["New", "Open", "In Progress", "Awaiting Reply", "Resolved", "Archived"].map((s) => `<option>${esc(s)}</option>`).join("")}</select>` : ""}</div><div class="thread-list" id="thread-list"></div></div><div class="thread-view" id="thread-view"><div class="empty">${conversations.length ? "Select a conversation to read and reply." : "No conversations yet."}</div></div></div></div>`;
  const draw = () => {
    const q = $("#thread-search").value.trim().toLowerCase(),
      status = $("#thread-status")?.value || "",
      rows = conversations.filter(
        (c) =>
          (!q ||
            [
              c.subject,
              c.category,
              c.sender_name,
              c.sender_role,
              c.jurisdiction,
            ]
              .join(" ")
              .toLowerCase()
              .includes(q)) &&
          (!status || c.status === status),
      ),
      list = $("#thread-list");
    list.innerHTML = rows.length
      ? rows
          .map((c) => {
            const unread = admin() ? c.admin_unread : c.user_unread;
            return `<div class="thread-item ${activeConversation === c.id ? "selected" : ""}" data-thread="${esc(c.id)}"><b>${esc(admin() ? c.sender_name : c.subject)}${unread ? ' <span class="pill green">Unread</span>' : ""}</b><span>${esc(admin() ? `${c.sender_role} · ${c.jurisdiction || "No jurisdiction"} · ${c.subject}` : `${c.category} · ${c.status}`)}<br>${new Date(c.updated_at + "Z").toLocaleString()}</span></div>`;
          })
          .join("")
      : '<div class="empty">No conversations match.</div>';
    $$("[data-thread]").forEach(
      (el) => (el.onclick = () => loadThread(el.dataset.thread)),
    );
  };
  $("#thread-search").addEventListener("input", draw);
  if ($("#thread-status")) $("#thread-status").addEventListener("change", draw);
  draw();
  if ($("#new-message")) $("#new-message").onclick = newConversation;
}
async function loadThread(id) {
  activeConversation = id;
  try {
    const result = await api(`/conversations/${id}`),
      c = result.conversation;
    const row = conversations.find((x) => x.id === id);
    if (row) {
      if (admin()) row.admin_unread = 0;
      else row.user_unread = 0;
      row.status = c.status;
      drawInboxList();
    }
    const view = $("#thread-view");
    view.innerHTML = `<div class="panel-head"><div><h2>${esc(c.subject)}</h2><p>${esc(c.category)} · ${esc(c.status)}</p></div>${admin() ? `<select id="status-select" aria-label="Conversation status">${["New", "Open", "In Progress", "Awaiting Reply", "Resolved", "Archived"].map((s) => `<option ${s === c.status ? "selected" : ""}>${s}</option>`).join("")}</select>` : ""}</div><div class="messages">${result.messages.map((m) => `<div class="message ${m.sender_id === me.id ? "mine" : ""}">${esc(m.body)}<small>${esc(m.sender_name)} · ${new Date(m.created_at + "Z").toLocaleString()}</small></div>`).join("")}</div><form class="compose" id="reply-form"><textarea name="body" maxlength="5000" placeholder="Write a private reply..." required></textarea><button class="button primary">Send</button></form>`;
    $("#reply-form").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api(`/conversations/${id}/messages`, {
          method: "POST",
          body: JSON.stringify({
            body: new FormData(e.currentTarget).get("body"),
          }),
        });
        await loadThread(id);
        toast("Message saved");
      } catch (err) {
        toast(err.message);
      }
    };
    if ($("#status-select"))
      $("#status-select").onchange = async (e) => {
        try {
          await api(`/conversations/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: e.target.value }),
          });
          if (row) row.status = e.target.value;
          drawInboxList();
          toast("Status updated");
        } catch (err) {
          toast(err.message);
        }
      };
  } catch (e) {
    toast(e.message);
  }
}
function drawInboxList() {
  const list = $("#thread-list");
  if (!list) return;
  const q = $("#thread-search")?.value.trim().toLowerCase() || "",
    status = $("#thread-status")?.value || "",
    rows = conversations.filter(
      (c) =>
        (!q ||
          [c.subject, c.category, c.sender_name, c.sender_role, c.jurisdiction]
            .join(" ")
            .toLowerCase()
            .includes(q)) &&
        (!status || c.status === status),
    );
  list.innerHTML = rows.length
    ? rows
        .map((c) => {
          const unread = admin() ? c.admin_unread : c.user_unread;
          return `<div class="thread-item ${activeConversation === c.id ? "selected" : ""}" data-thread="${esc(c.id)}"><b>${esc(admin() ? c.sender_name : c.subject)}${unread ? ' <span class="pill green">Unread</span>' : ""}</b><span>${esc(admin() ? `${c.sender_role} · ${c.jurisdiction || "No jurisdiction"} · ${c.subject}` : `${c.category} · ${c.status}`)}<br>${new Date(c.updated_at + "Z").toLocaleString()}</span></div>`;
        })
        .join("")
    : '<div class="empty">No conversations match.</div>';
  $$("[data-thread]").forEach(
    (el) => (el.onclick = () => loadThread(el.dataset.thread)),
  );
}
async function issuesView() {
  const rows = await api("/issues"),
    jurisdictions = [
      ...new Set(rows.map((i) => i.jurisdiction).filter(Boolean)),
    ].sort(),
    statuses = [
      "Open",
      "Assigned",
      "In Progress",
      "Awaiting Information",
      "Resolved",
      "Closed",
    ],
    accounts = admin() ? await api("/users") : [],
    names = Object.fromEntries(accounts.map((a) => [a.id, a.full_name]));
  $("#content").innerHTML =
    `<div class="panel"><div class="panel-head"><div><h2>Issues and requests</h2><p>Track requests, assignment, and resolution status</p></div><div class="quick-actions">${admin() ? '<a class="button subtle" id="export-issues" href="/api/issues/export">Export CSV</a>' : ""}<button class="button primary" id="submit-issue">+ Report issue</button></div></div><div class="toolbar"><input id="issue-search" placeholder="Search title, category, or description"><select id="issue-status"><option value="">All statuses</option>${statuses.map((s) => `<option>${esc(s)}</option>`).join("")}</select><select id="issue-jurisdiction"><option value="">All jurisdictions</option>${jurisdictions.map((j) => `<option>${esc(j)}</option>`).join("")}</select><span id="issue-count" class="tiny muted"></span></div><div class="table-wrap"><table><thead><tr><th>ISSUE</th><th>CATEGORY / PRIORITY</th>${admin() ? "<th>ASSIGNED TO</th>" : ""}<th>JURISDICTION</th><th>STATUS</th><th>UPDATED</th><th>ACTION</th></tr></thead><tbody id="issue-rows"></tbody></table></div></div>`;
  const draw = () => {
    const q = $("#issue-search").value.trim().toLowerCase(),
      status = $("#issue-status").value,
      jurisdiction = $("#issue-jurisdiction").value,
      filtered = rows.filter(
        (i) =>
          (!q ||
            [i.title, i.category, i.description]
              .join(" ")
              .toLowerCase()
              .includes(q)) &&
          (!status || i.status === status) &&
          (!jurisdiction || i.jurisdiction === jurisdiction),
      );
    $("#issue-count").textContent = `${filtered.length} issues`;
    $("#issue-rows").innerHTML = filtered.length
      ? filtered
          .map(
            (i) =>
              `<tr><td><b>${esc(i.title)}</b>${i.resolution_notes ? `<br><small class="muted">${esc(i.resolution_notes)}</small>` : ""}</td><td>${esc(i.category || "General")} · ${esc(i.priority)}</td>${admin() ? `<td>${esc(names[i.assigned_to] || "Unassigned")}</td>` : ""}<td>${esc(i.jurisdiction || "—")}</td><td><span class="pill ${["Resolved", "Closed"].includes(i.status) ? "green" : ""}">${esc(i.status)}</span></td><td>${new Date((i.updated_at || i.created_at) + "Z").toLocaleDateString()}</td><td>${admin() ? `<button class="button subtle" data-manage-issue="${esc(i.id)}">Manage</button>` : "—"}</td></tr>`,
          )
          .join("")
      : '<tr><td colspan="7" class="empty">No issues match these filters.</td></tr>';
  };
  ["#issue-search", "#issue-status", "#issue-jurisdiction"].forEach((s) =>
    $(s).addEventListener(s === "#issue-search" ? "input" : "change", draw),
  );
  draw();
  $("#submit-issue").onclick = () => recordForm("Issues and Requests");
  $$("[data-manage-issue]").forEach(
    (b) =>
      (b.onclick = () =>
        issueManage(
          rows.find((i) => i.id === b.dataset.manageIssue),
          accounts,
        )),
  );
  const exportLink = $("#export-issues");
  if (exportLink) {
    const update = () => {
      const p = new URLSearchParams();
      if ($("#issue-status").value) p.set("status", $("#issue-status").value);
      if ($("#issue-jurisdiction").value)
        p.set("jurisdiction", $("#issue-jurisdiction").value);
      exportLink.href =
        "/api/issues/export" + (p.size ? "?" + p.toString() : "");
    };
    $("#issue-status").addEventListener("change", update);
    $("#issue-jurisdiction").addEventListener("change", update);
  }
}
function analyticsPanel(title, rows) {
  const max = Math.max(1, ...rows.map((x) => Number(x.value) || 0)),
    total = rows.reduce((sum, x) => sum + (Number(x.value) || 0), 0);
  return `<div class="panel"><div class="panel-head"><div><h2>${esc(title)}</h2><p>${total} records</p></div></div>${
    rows.length
      ? rows
          .map((x) => {
            const value = Number(x.value) || 0,
              width = Math.round((value / max) * 100);
            return `<div class="list-row"><div style="flex:1"><b>${esc(x.label || "Unspecified")}</b><div style="height:6px;border-radius:8px;background:#e7f3fb;margin-top:7px;overflow:hidden"><div style="height:100%;width:${width}%;background:var(--green)"></div></div></div><span class="pill">${value}</span></div>`;
          })
          .join("")
      : '<div class="empty">No records yet.</div>'
  }</div>`;
}
async function analytics() {
  const d = await api("/analytics"),
    sum = (x) => x.reduce((a, b) => a + (Number(b.value) || 0), 0),
    max = Math.max(1, ...d.monthly.map((x) => Number(x.value) || 0));
  $("#content").innerHTML =
    `<div class="welcome"><div><h2>Organizational analytics</h2><p>Live summaries from stored account and workflow records</p></div></div><div class="grid">${statsCard("Accounts", sum(d.accounts), "♙")}${statsCard("Tasks", sum(d.tasks), "✓")}${statsCard("Reports", sum(d.reports), "▥")}${statsCard("Issues", sum(d.issues), "⚑")}</div><div class="two-col">${analyticsPanel("Account status", d.accounts)}${analyticsPanel("Accounts by role", d.roles)}${analyticsPanel("Tasks by status", d.tasks)}${analyticsPanel("Reports by status", d.reports)}${analyticsPanel("Issues by status", d.issues)}<div class="panel"><div class="panel-head"><div><h2>Monthly submissions</h2><p>Reports, issues, and tasks created in the last 12 months</p></div></div><div style="height:180px;display:flex;align-items:end;gap:7px;padding:16px 4px 0">${d.monthly
      .map((m) => {
        const h = Math.max(3, Math.round(((Number(m.value) || 0) / max) * 130));
        return `<div title="${esc(m.month)}: ${Number(m.value) || 0}" style="height:${h}px;flex:1;min-width:8px;background:var(--blue);border-radius:5px 5px 0 0"></div>`;
      })
      .join(
        "",
      )}</div><div class="list-row"><small>Oldest: ${esc(d.monthly[0]?.month || "—")}</small><small>Latest: ${esc(d.monthly.at(-1)?.month || "—")}</small></div></div></div>`;
}
async function organizationUnits(type) {
  const rows = await api("/organization-units"),
    units = rows.filter((x) => x.unit_type === type),
    mandals = rows.filter(
      (x) => x.unit_type === "Mandal" && x.status === "active",
    );
  $("#content").innerHTML =
    `<div class="panel"><div class="panel-head"><div><h2>${esc(type)} management</h2><p>Manage canonical ${type.toLowerCase()} names and active status; retain inactive units for history</p></div><button class="button primary" id="add-unit">+ Add ${esc(type)}</button></div>${type === "Village" ? '<p class="tiny muted">Each village is linked to its parent Mandal.</p>' : ""}<div class="table-wrap"><table><thead><tr><th>NAME</th>${type === "Village" ? "<th>PARENT MANDAL</th>" : ""}<th>CONTACTS</th><th>ACTIVE USERS</th><th>STATUS</th><th></th></tr></thead><tbody>${units.length ? units.map((x) => `<tr><td>${esc(x.name)}</td>${type === "Village" ? `<td>${esc(x.parent_name || "Unassigned")}</td>` : ""}<td>${x.contact_count}</td><td>${x.user_count}</td><td><span class="pill ${x.status === "active" ? "green" : ""}">${esc(x.status)}</span></td><td><button class="button subtle" data-edit-unit="${esc(x.id)}">Edit</button></td></tr>`).join("") : `<tr><td colspan="${type === "Village" ? 6 : 5}" class="empty">No ${type.toLowerCase()}s configured.</td></tr>`}</tbody></table></div></div>`;
  $("#add-unit").onclick = () => unitForm(type, units, mandals);
  $$("[data-edit-unit]").forEach(
    (b) =>
      (b.onclick = () =>
        unitForm(
          type,
          units,
          mandals,
          units.find((x) => x.id === b.dataset.editUnit),
        )),
  );
}
function unitForm(type, units, mandals, unit = null) {
  modal(
    unit ? `Edit ${type}` : `Add ${type}`,
    `<form id="record-form"><label>${esc(type)} name<input name="name" maxlength="120" value="${esc(unit?.name || "")}" required></label>${type === "Village" ? `<label>Parent Mandal<select name="parent_id" required><option value="">Select Mandal</option>${mandals.map((m) => `<option value="${esc(m.id)}" ${m.id === unit?.parent_id ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></label>` : ""}${unit ? `<label>Status<select name="status"><option value="active" ${unit.status === "active" ? "selected" : ""}>Active</option><option value="inactive" ${unit.status === "inactive" ? "selected" : ""}>Inactive</option></select></label>` : ""}<div class="form-actions"><button type="button" class="button" data-close>Cancel</button><button class="button primary">${unit ? "Save changes" : "Add unit"}</button></div></form>`,
    async (f) => {
      const data = Object.fromEntries(new FormData(f));
      data.unit_type = type;
      await api(
        unit ? `/organization-units/${unit.id}` : "/organization-units",
        { method: unit ? "PATCH" : "POST", body: JSON.stringify(data) },
      );
      toast(`${type} saved`);
      go(type === "Mandal" ? "Mandal Management" : "Village Management");
    },
  );
}
document.addEventListener("click", (e) => {
  const target = e.target.closest(
    "#add-user,#add-contact,[data-edit-user],[data-edit-contact]",
  );
  if (!target) return;
  setTimeout(async () => {
    const form = $("#modal #record-form");
    if (!form) return;
    try {
      const units = await api("/organization-units"),
        sets = {
          jurisdiction: units.filter((x) => x.status === "active"),
          mandal: units.filter(
            (x) => x.unit_type === "Mandal" && x.status === "active",
          ),
          village: units.filter(
            (x) => x.unit_type === "Village" && x.status === "active",
          ),
        };
      for (const [field, items] of Object.entries(sets)) {
        const input = form.querySelector(`[name="${field}"]`);
        if (!input) continue;
        const listId = `suggest-${field}`,
          list = document.createElement("datalist");
        list.id = listId;
        list.innerHTML = [...new Set(items.map((x) => x.name))]
          .sort()
          .map((name) => `<option value="${esc(name)}"></option>`)
          .join("");
        form.append(list);
        input.setAttribute("list", listId);
      }
    } catch (err) {
      toast(err.message);
    }
  }, 0);
});
async function applicationSettings() {
  const s = await api("/settings"),
    blues = [
      ["#1769aa", "Classic blue"],
      ["#145da0", "Deep blue"],
      ["#0b67a3", "Ocean blue"],
      ["#1d4ed8", "Bright blue"],
    ],
    greens = [
      ["#16834a", "Classic green"],
      ["#15803d", "Forest green"],
      ["#166534", "Deep green"],
    ];
  $("#content").innerHTML =
    `<div class="panel"><div class="panel-head"><div><h2>Application settings</h2><p>Manage organization contact details and the approved color palette</p></div></div><form id="settings-form"><div class="form-grid"><label>Organization contact email<input name="contact_email" type="email" value="${esc(s.contact_email || "")}"></label><label>Organization contact phone<input name="contact_phone" value="${esc(s.contact_phone || "")}"></label><label class="wide">Office address<input name="office_address" maxlength="300" value="${esc(s.office_address || "")}"></label><label>Primary blue<select name="brand_blue">${blues.map(([v, n]) => `<option value="${v}" ${v === (s.brand_blue || "#1769aa") ? "selected" : ""}>${n}</option>`).join("")}</select></label><label>Primary green<select name="brand_green">${greens.map(([v, n]) => `<option value="${v}" ${v === (s.brand_green || "#16834a") ? "selected" : ""}>${n}</option>`).join("")}</select></label></div><p class="tiny muted">The interface stays within the blue, white, and green palette. Add an official logo only after an authorized image asset is provided.</p><div class="form-actions"><button class="button primary">Save settings</button></div></form></div>`;
  $("#settings-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await api("/settings", {
        method: "PATCH",
        body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
      });
      applyBranding(result);
      toast("Settings saved");
    } catch (err) {
      toast(err.message);
    }
  };
}
function applyBranding(s) {
  const root = document.documentElement.style;
  if (s.brand_blue) root.setProperty("--blue", s.brand_blue);
  if (s.brand_green) root.setProperty("--green", s.brand_green);
  const dark = {
    "#1769aa": "#10558f",
    "#145da0": "#104a80",
    "#0b67a3": "#084d7b",
    "#1d4ed8": "#1e40af",
  };
  if (s.brand_blue)
    root.setProperty("--blue-strong", dark[s.brand_blue] || s.brand_blue);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && s.brand_blue) meta.content = s.brand_blue;
  const box = $("#office-contact");
  if (box) {
    const parts = [];
    if (s.contact_email)
      parts.push(
        `<a href="mailto:${esc(s.contact_email)}">${esc(s.contact_email)}</a>`,
      );
    if (s.contact_phone) {
      const phone = s.contact_phone.replace(/[^+\d]/g, "");
      parts.push(`<a href="tel:${esc(phone)}">${esc(s.contact_phone)}</a>`);
    }
    if (s.office_address) parts.push(`<span>${esc(s.office_address)}</span>`);
    box.innerHTML = parts.length
      ? `<b>Office contact</b>${parts.join("")}`
      : "";
  }
}
async function loadBranding() {
  try {
    applyBranding(await api("/settings"));
  } catch {}
}
async function restoreSession() {
  try {
    const { user } = await api("/me");
    me = user;
    await loadBranding();
    if (me.must_change_password) passwordScreen(true);
    else await go("Dashboard");
  } catch {}
}
restoreSession();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {}),
  );
}
