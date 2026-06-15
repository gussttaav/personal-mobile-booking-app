/* @ds-bundle: {"format":3,"namespace":"GustavoAIDesignSystem_019dbf","components":[{"name":"BookingsPage","sourcePath":"src/app/admin/bookings/page.tsx"},{"name":"FailedBookingsPage","sourcePath":"src/app/admin/failed-bookings/page.tsx"},{"name":"AdminLayout","sourcePath":"src/app/admin/layout.tsx"},{"name":"AdminDashboard","sourcePath":"src/app/admin/page.tsx"},{"name":"PaymentsPage","sourcePath":"src/app/admin/payments/page.tsx"},{"name":"StudentDetailPage","sourcePath":"src/app/admin/students/[email]/page.tsx"},{"name":"StudentsPage","sourcePath":"src/app/admin/students/page.tsx"},{"name":"AdjustCreditsForm","sourcePath":"src/components/admin/AdjustCreditsForm.tsx"},{"name":"AdminNav","sourcePath":"src/components/admin/AdminNav.tsx"},{"name":"RetryButton","sourcePath":"src/components/admin/RetryButton.tsx"},{"name":"StatCard","sourcePath":"src/components/admin/StatCard.tsx"}],"sourceHashes":{"admin-app.jsx":"4cf3667e97d2","admin-data.js":"e4d130a143c6","design-canvas.jsx":"fb642362a04d","feedback-pages.jsx":"203ee2d7e98d","post-class-review.jsx":"658f2a1cc3fa","src/app/admin/bookings/page.tsx":"7a3d32f50738","src/app/admin/failed-bookings/page.tsx":"095d997e4d2e","src/app/admin/layout.tsx":"1bd53b376273","src/app/admin/page.tsx":"f841bd60262e","src/app/admin/payments/page.tsx":"f5c8ce050b6b","src/app/admin/students/[email]/page.tsx":"eed2459518f2","src/app/admin/students/page.tsx":"e6e4c4728865","src/components/admin/AdjustCreditsForm.tsx":"99561c66113f","src/components/admin/AdminNav.tsx":"b71f4a2d68eb","src/components/admin/RetryButton.tsx":"079d61b0ca8a","src/components/admin/StatCard.tsx":"b0bb9e56b245","tweaks-panel.jsx":"a1107c630a56","ui_kits/tutoring-platform/ChatWidget.jsx":"4bee9108dff2","ui_kits/tutoring-platform/Navbar.jsx":"5e7a976c77d0","ui_kits/tutoring-platform/PackCard.jsx":"ca677b4952bd","ui_kits/tutoring-platform/SessionCard.jsx":"2912db7d68b2"},"inlinedExternals":[],"unexposedExports":[{"name":"metadata","sourcePath":"src/app/admin/layout.tsx"}]} */

(() => {

const __ds_ns = (window.GustavoAIDesignSystem_019dbf = window.GustavoAIDesignSystem_019dbf || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// admin-app.jsx
try { (() => {
/* GustavoAI Admin Panel — prototype rebuilt from src/app/admin/* */

const {
  useState,
  useMemo,
  useEffect
} = React;
const NAV_LINKS = [{
  href: "/admin",
  label: "Panel",
  icon: "dashboard"
}, {
  href: "/admin/students",
  label: "Alumnos",
  icon: "groups"
}, {
  href: "/admin/bookings",
  label: "Reservas",
  icon: "calendar_month"
}, {
  href: "/admin/failed-bookings",
  label: "Fallidas",
  icon: "error"
}, {
  href: "/admin/payments",
  label: "Pagos",
  icon: "payments"
}];
const ADMIN_EMAIL = "gustavo@gustavoai.dev";

/* ─── Formatting helpers ─────────────────────────────────────────────── */
const fmtDate = iso => new Date(iso).toLocaleDateString("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});
const fmtDateTime = iso => new Date(iso).toLocaleString("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});
const fmtShort = iso => new Date(iso).toLocaleString("es-ES", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});
const relativeTime = iso => {
  const diffMs = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60000);
  const hrs = Math.round(abs / 3600000);
  const dys = Math.round(abs / 86400000);
  let s;
  if (mins < 60) s = `${mins} min`;else if (hrs < 24) s = `${hrs} h`;else s = `${dys} d`;
  return diffMs < 0 ? `hace ${s}` : `en ${s}`;
};

/* ─── Status badge ───────────────────────────────────────────────────── */
function StatusBadge({
  status,
  kind = "booking"
}) {
  const map = {
    booking: {
      confirmed: {
        c: "var(--green)",
        bg: "var(--green-dim)",
        label: "Confirmada"
      },
      completed: {
        c: "#9ec5ff",
        bg: "rgba(158,197,255,0.10)",
        label: "Completada"
      },
      cancelled: {
        c: "var(--text-dim)",
        bg: "rgba(255,255,255,0.05)",
        label: "Cancelada"
      },
      no_show: {
        c: "var(--error)",
        bg: "var(--error-bg)",
        label: "No asistió"
      }
    },
    payment: {
      succeeded: {
        c: "var(--green)",
        bg: "var(--green-dim)",
        label: "Cobrado"
      },
      pending: {
        c: "var(--warning)",
        bg: "var(--warning-bg)",
        label: "Pendiente"
      },
      refunded: {
        c: "#9ec5ff",
        bg: "rgba(158,197,255,0.10)",
        label: "Reembolso"
      },
      failed: {
        c: "var(--error)",
        bg: "var(--error-bg)",
        label: "Fallido"
      }
    }
  };
  const s = map[kind][status] ?? {
    c: "var(--text-dim)",
    bg: "rgba(255,255,255,0.05)",
    label: status
  };
  return /*#__PURE__*/React.createElement("span", {
    className: "badge",
    style: {
      color: s.c,
      background: s.bg
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "badge-dot",
    style: {
      background: s.c
    }
  }), s.label);
}

/* ─── Top-level chrome ───────────────────────────────────────────────── */
function AdminNav({
  pathname,
  onNavigate
}) {
  return /*#__PURE__*/React.createElement("nav", {
    className: "admin-nav"
  }, /*#__PURE__*/React.createElement("div", {
    className: "admin-nav-inner"
  }, /*#__PURE__*/React.createElement("a", {
    href: "/admin",
    className: "admin-nav-brand",
    onClick: e => {
      e.preventDefault();
      onNavigate("/admin");
    }
  }, /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: "20",
    height: "20",
    viewBox: "0 0 28 28",
    "aria-hidden": "true",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "admin-nav-g",
    x1: "0%",
    y1: "0%",
    x2: "100%",
    y2: "100%"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "#4edea3"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "#10b981"
  }))), /*#__PURE__*/React.createElement("path", {
    fill: "url(#admin-nav-g)",
    fillRule: "evenodd",
    d: "M21.8844 14.4497c-.4575-.1116-1.8449-.06-2.3983-.06h-1.0193l-.9593.06h-2.5782l-1.0192.0599h-1.7987c-.2045 0-.6032.0366-.7609-.0959-.1613-.1361-.1379-.3729-.1385-.5636v-1.9786c0-.1943-.0288-.6781.0612-.8304.1187-.2009.3351-.1877.5384-.1889h1.0792l.8994-.0599h12.7109c.2386 0 .7009-.054.8634.1385.1163.1379.0923.3525.0965.521l.0593.8394.0576 1.0792c-.0258.4893-.3975.7015-.7171 1.0193l-1.9786 1.9186-2.5781 2.4607-2.6981 2.6333-2.9979 2.8803-2.4582 2.3384c-.2129.2122-.6182.7279-.9539.6127-.2069-.0707-.6805-.6643-.8478-.8526l-2.0523-2.3383-7.0672-8.0342-2.458263-2.7977c-.170878-.1943-.6979014-.7027-.666124-.9569.017987-.1463.160685-.2746.260814-.3711l.834003-.7357L4.3169 8.44911l6.8351-5.91837 1.5589-1.35443c.2266-.19666.0229-.04193.2891-.14686.2272-.089335 1.7332-.032454 2-.029456h.5l1 .000004L17.5 1c.3106.0012.8805-.046088 1.1916.02946-.1259.42809-.5737.74946-.8993 1.03606l-1.9186 1.73876-3.4776 3.16094-3.47747 3.16098L7 11.8715c-.18887.1709-.75546.6332-.82441.8496-.06715.2105-.33995.3801-.21464.5294l1.29687 1.499 4.68268 5.3961 1.147 1.3191c.1193.1343.3219.3825.5228.3567.1541-.0204.5306-.3711.6595-.4862l1.4989-1.3443 3.7773-3.366c.5636-.4958 1.9457-1.656 2.3384-2.1752"
  })), /*#__PURE__*/React.createElement("span", {
    className: "admin-nav-wordmark"
  }, "GUSTAVO", /*#__PURE__*/React.createElement("span", {
    className: "admin-nav-wordmark-accent"
  }, "AI.DEV"))), /*#__PURE__*/React.createElement("div", {
    className: "admin-nav-links"
  }, NAV_LINKS.map(link => {
    const active = pathname === link.href || link.href !== "/admin" && pathname.startsWith(link.href);
    return /*#__PURE__*/React.createElement("a", {
      key: link.href,
      href: link.href,
      onClick: e => {
        e.preventDefault();
        onNavigate(link.href);
      },
      className: `admin-nav-link ${active ? "is-active" : ""}`
    }, /*#__PURE__*/React.createElement("span", {
      className: "material-symbols-outlined"
    }, link.icon), /*#__PURE__*/React.createElement("span", null, link.label));
  }))));
}

/* ─── Reusable bits ──────────────────────────────────────────────────── */
function PageHeader({
  overline,
  title,
  subtitle,
  right
}) {
  return /*#__PURE__*/React.createElement("header", {
    className: "page-header"
  }, /*#__PURE__*/React.createElement("div", null, overline && /*#__PURE__*/React.createElement("div", {
    className: "overline"
  }, overline), /*#__PURE__*/React.createElement("h1", {
    className: "page-title"
  }, title), subtitle && /*#__PURE__*/React.createElement("p", {
    className: "page-subtitle"
  }, subtitle)), right && /*#__PURE__*/React.createElement("div", {
    className: "page-header-right"
  }, right));
}
function StatCard({
  label,
  value,
  delta,
  deltaTone = "neutral",
  href,
  tone = "neutral",
  icon,
  onNavigate
}) {
  const isAlert = tone === "alert";
  return /*#__PURE__*/React.createElement("a", {
    href: href,
    onClick: e => {
      e.preventDefault();
      onNavigate(href);
    },
    className: `stat-card ${isAlert ? "is-alert" : ""}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-card-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "stat-card-label"
  }, label), icon && /*#__PURE__*/React.createElement("span", {
    className: `stat-card-icon material-symbols-outlined`
  }, icon)), /*#__PURE__*/React.createElement("div", {
    className: "stat-card-value"
  }, value), delta && /*#__PURE__*/React.createElement("div", {
    className: `stat-card-delta tone-${deltaTone}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined"
  }, deltaTone === "up" ? "trending_up" : deltaTone === "down" ? "trending_down" : "trending_flat"), delta), /*#__PURE__*/React.createElement("div", {
    className: "stat-card-cta"
  }, "Ver detalle ", /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined"
  }, "arrow_forward")));
}
function Card({
  title,
  action,
  children,
  padding = true
}) {
  return /*#__PURE__*/React.createElement("section", {
    className: "card"
  }, (title || action) && /*#__PURE__*/React.createElement("header", {
    className: "card-header"
  }, title && /*#__PURE__*/React.createElement("h2", {
    className: "card-title"
  }, title), action), /*#__PURE__*/React.createElement("div", {
    className: padding ? "card-body" : ""
  }, children));
}
function Empty({
  icon = "inbox",
  label
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "empty"
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined"
  }, icon), /*#__PURE__*/React.createElement("span", null, label));
}

/* ─── Dashboard ──────────────────────────────────────────────────────── */
function Dashboard({
  onNavigate
}) {
  const {
    stats,
    bookings,
    failed,
    students
  } = window.ADMIN_MOCK;
  const revenue = (stats.revenueCents / 100).toFixed(2);
  const upcoming = bookings.filter(b => b.status === "confirmed" && new Date(b.starts_at) > new Date()).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)).slice(0, 5);
  const lowCredit = students.filter(s => s.totalCredits <= 1).slice(0, 4);
  return /*#__PURE__*/React.createElement("div", {
    className: "page-stack"
  }, /*#__PURE__*/React.createElement(PageHeader, {
    overline: "Panel de control",
    title: "Resumen operativo",
    subtitle: `Lunes, ${new Date().toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    })}`
  }), /*#__PURE__*/React.createElement("div", {
    className: "stat-grid"
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Sesiones pr\xF3ximas",
    value: stats.upcoming,
    delta: "+3 esta semana",
    deltaTone: "up",
    icon: "event_available",
    href: "/admin/bookings",
    onNavigate: onNavigate
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Alumnos pocos cr\xE9ditos",
    value: stats.lowCredit,
    delta: "2 nuevos hoy",
    deltaTone: "up",
    icon: "warning",
    href: "/admin/students?filter=low-credit",
    tone: stats.lowCredit > 0 ? "alert" : "neutral",
    onNavigate: onNavigate
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Reservas fallidas",
    value: stats.failed,
    delta: "\u22121 vs. ayer",
    deltaTone: "down",
    icon: "report",
    href: "/admin/failed-bookings",
    tone: stats.failed > 0 ? "alert" : "neutral",
    onNavigate: onNavigate
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Ingresos \xB7 30 d\xEDas",
    value: `€${revenue}`,
    delta: "+18% vs. mes -1",
    deltaTone: "up",
    icon: "payments",
    href: "/admin/payments",
    onNavigate: onNavigate
  })), /*#__PURE__*/React.createElement("div", {
    className: "two-col"
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Pr\xF3ximas sesiones",
    action: /*#__PURE__*/React.createElement("a", {
      href: "/admin/bookings",
      onClick: e => {
        e.preventDefault();
        onNavigate("/admin/bookings");
      },
      className: "link-emerald"
    }, "Ver todas \u2192"),
    padding: false
  }, /*#__PURE__*/React.createElement("table", {
    className: "data-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Alumno"), /*#__PURE__*/React.createElement("th", null, "Tipo"), /*#__PURE__*/React.createElement("th", null, "Inicio"), /*#__PURE__*/React.createElement("th", null, "Estado"))), /*#__PURE__*/React.createElement("tbody", null, upcoming.map(b => /*#__PURE__*/React.createElement("tr", {
    key: b.id,
    onClick: () => onNavigate(`/admin/students/${encodeURIComponent(b.email)}`)
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "cell-stack"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cell-strong"
  }, b.name), /*#__PURE__*/React.createElement("span", {
    className: "cell-meta"
  }, b.email))), /*#__PURE__*/React.createElement("td", {
    className: "muted"
  }, b.session_type), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "cell-stack"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cell-strong"
  }, fmtShort(b.starts_at)), /*#__PURE__*/React.createElement("span", {
    className: "cell-meta"
  }, relativeTime(b.starts_at)))), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(StatusBadge, {
    status: b.status
  }))))))), /*#__PURE__*/React.createElement(Card, {
    title: "Alumnos con pocos cr\xE9ditos",
    action: /*#__PURE__*/React.createElement("a", {
      href: "/admin/students?filter=low-credit",
      onClick: e => {
        e.preventDefault();
        onNavigate("/admin/students?filter=low-credit");
      },
      className: "link-emerald"
    }, "Ver todos \u2192")
  }, /*#__PURE__*/React.createElement("ul", {
    className: "lc-list"
  }, lowCredit.map(s => /*#__PURE__*/React.createElement("li", {
    key: s.email,
    onClick: () => onNavigate(`/admin/students/${encodeURIComponent(s.email)}`)
  }, /*#__PURE__*/React.createElement("div", {
    className: "lc-avatar"
  }, s.name.split(" ").map(n => n[0]).slice(0, 2).join("")), /*#__PURE__*/React.createElement("div", {
    className: "lc-meta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lc-name"
  }, s.name), /*#__PURE__*/React.createElement("span", {
    className: "lc-email"
  }, s.email)), /*#__PURE__*/React.createElement("div", {
    className: `lc-credits ${s.totalCredits === 0 ? "is-zero" : ""}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "lc-credits-num"
  }, s.totalCredits), /*#__PURE__*/React.createElement("span", {
    className: "lc-credits-label"
  }, s.totalCredits === 1 ? "crédito" : "créditos"))))))), /*#__PURE__*/React.createElement(Card, {
    title: "Reservas fallidas \u2014 pendientes",
    padding: false
  }, failed.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card-body"
  }, /*#__PURE__*/React.createElement(Empty, {
    icon: "check_circle",
    label: "Sin reservas fallidas."
  })) : /*#__PURE__*/React.createElement("table", {
    className: "data-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Fecha fallo"), /*#__PURE__*/React.createElement("th", null, "Alumno"), /*#__PURE__*/React.createElement("th", null, "Slot"), /*#__PURE__*/React.createElement("th", null, "Error"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, failed.map(e => /*#__PURE__*/React.createElement("tr", {
    key: e.stripeSessionId
  }, /*#__PURE__*/React.createElement("td", {
    className: "muted"
  }, fmtShort(e.failedAt)), /*#__PURE__*/React.createElement("td", null, e.email), /*#__PURE__*/React.createElement("td", {
    className: "muted"
  }, fmtShort(e.startIso)), /*#__PURE__*/React.createElement("td", {
    className: "error-text",
    title: e.error
  }, e.error), /*#__PURE__*/React.createElement("td", {
    className: "cell-right"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn-ghost-sm",
    onClick: () => alert("POST /api/admin/failed-bookings\nstripeSessionId: " + e.stripeSessionId)
  }, "Reintentar"))))))));
}

/* ─── Students list ──────────────────────────────────────────────────── */
function StudentsPage({
  onNavigate,
  filter
}) {
  const all = window.ADMIN_MOCK.students;
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    let xs = filter === "low-credit" ? all.filter(s => s.totalCredits <= 1) : all;
    if (query) {
      const q = query.toLowerCase();
      xs = xs.filter(s => s.email.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
    }
    return xs;
  }, [filter, query, all]);
  return /*#__PURE__*/React.createElement("div", {
    className: "page-stack"
  }, /*#__PURE__*/React.createElement(PageHeader, {
    overline: "Operaciones",
    title: "Alumnos",
    subtitle: `Mostrando ${filtered.length} ${filter === "low-credit" ? "con ≤1 crédito" : "de hasta 100 alumnos"}`,
    right: /*#__PURE__*/React.createElement("div", {
      className: "filter-tabs"
    }, /*#__PURE__*/React.createElement("a", {
      href: "/admin/students",
      onClick: e => {
        e.preventDefault();
        onNavigate("/admin/students");
      },
      className: `filter-tab ${!filter ? "is-active" : ""}`
    }, "Todos", /*#__PURE__*/React.createElement("span", {
      className: "filter-tab-count"
    }, all.length)), /*#__PURE__*/React.createElement("a", {
      href: "/admin/students?filter=low-credit",
      onClick: e => {
        e.preventDefault();
        onNavigate("/admin/students?filter=low-credit");
      },
      className: `filter-tab ${filter === "low-credit" ? "is-active is-alert" : ""}`
    }, "Pocos cr\xE9ditos", /*#__PURE__*/React.createElement("span", {
      className: "filter-tab-count"
    }, all.filter(s => s.totalCredits <= 1).length)))
  }), /*#__PURE__*/React.createElement("div", {
    className: "toolbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "search"
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined"
  }, "search"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "Buscar por email o nombre\u2026",
    value: query,
    onChange: e => setQuery(e.target.value)
  }), query && /*#__PURE__*/React.createElement("button", {
    className: "search-clear",
    onClick: () => setQuery("")
  }, "\xD7")), /*#__PURE__*/React.createElement("button", {
    className: "btn-ghost"
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined"
  }, "download"), "Exportar CSV")), /*#__PURE__*/React.createElement(Card, {
    padding: false
  }, filtered.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card-body"
  }, /*#__PURE__*/React.createElement(Empty, {
    label: "No hay alumnos que coincidan."
  })) : /*#__PURE__*/React.createElement("table", {
    className: "data-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Alumno"), /*#__PURE__*/React.createElement("th", {
    className: "cell-right"
  }, "Cr\xE9ditos"), /*#__PURE__*/React.createElement("th", null, "Caduca"), /*#__PURE__*/React.createElement("th", null, "Pr\xF3xima sesi\xF3n"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(s => /*#__PURE__*/React.createElement("tr", {
    key: s.email,
    onClick: () => onNavigate(`/admin/students/${encodeURIComponent(s.email)}`)
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "cell-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lc-avatar lc-avatar-sm"
  }, s.name.split(" ").map(n => n[0]).slice(0, 2).join("")), /*#__PURE__*/React.createElement("div", {
    className: "cell-stack"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cell-strong"
  }, s.name), /*#__PURE__*/React.createElement("span", {
    className: "cell-meta"
  }, s.email)))), /*#__PURE__*/React.createElement("td", {
    className: "cell-right"
  }, /*#__PURE__*/React.createElement("div", {
    className: `credits-pill ${s.totalCredits <= 1 ? "is-low" : ""} ${s.totalCredits === 0 ? "is-zero" : ""}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "credits-num"
  }, s.totalCredits), /*#__PURE__*/React.createElement("span", {
    className: "credits-label"
  }, "cr."))), /*#__PURE__*/React.createElement("td", {
    className: "muted"
  }, s.earliestExpiry ? fmtDate(s.earliestExpiry) : "—"), /*#__PURE__*/React.createElement("td", {
    className: "muted"
  }, s.nextSession ? fmtShort(s.nextSession) : "—"), /*#__PURE__*/React.createElement("td", {
    className: "cell-right"
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined chevron"
  }, "chevron_right"))))))));
}

/* ─── Student detail ─────────────────────────────────────────────────── */
function StudentDetailPage({
  email,
  onNavigate
}) {
  const {
    focusStudent,
    focusPacks,
    focusBookings,
    focusAudit
  } = window.ADMIN_MOCK;
  // For prototype, all student detail routes show the focus student
  const student = focusStudent;
  const totalCredits = focusPacks.reduce((s, p) => s + p.credits_remaining, 0);
  return /*#__PURE__*/React.createElement("div", {
    className: "page-stack"
  }, /*#__PURE__*/React.createElement("a", {
    href: "/admin/students",
    onClick: e => {
      e.preventDefault();
      onNavigate("/admin/students");
    },
    className: "back-link"
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined"
  }, "arrow_back"), "Alumnos"), /*#__PURE__*/React.createElement("header", {
    className: "student-hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "student-hero-avatar"
  }, student.name.split(" ").map(n => n[0]).slice(0, 2).join("")), /*#__PURE__*/React.createElement("div", {
    className: "student-hero-meta"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "student-hero-name"
  }, student.name), /*#__PURE__*/React.createElement("p", {
    className: "student-hero-email"
  }, student.email), /*#__PURE__*/React.createElement("div", {
    className: "student-hero-tags"
  }, /*#__PURE__*/React.createElement("span", {
    className: "chip"
  }, "Alumno desde dic. 2025"), /*#__PURE__*/React.createElement("span", {
    className: "chip chip-warn"
  }, "\u26A0 Bajo en cr\xE9ditos"), /*#__PURE__*/React.createElement("span", {
    className: "chip"
  }, "Backend Node.js"))), /*#__PURE__*/React.createElement("div", {
    className: "student-hero-stats"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-stat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "hero-stat-value"
  }, totalCredits), /*#__PURE__*/React.createElement("span", {
    className: "hero-stat-label"
  }, "Cr\xE9ditos activos")), /*#__PURE__*/React.createElement("div", {
    className: "hero-stat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "hero-stat-value"
  }, focusBookings.filter(b => b.status === "completed").length), /*#__PURE__*/React.createElement("span", {
    className: "hero-stat-label"
  }, "Sesiones completadas")), /*#__PURE__*/React.createElement("div", {
    className: "hero-stat"
  }, /*#__PURE__*/React.createElement("span", {
    className: "hero-stat-value"
  }, "\u20AC215"), /*#__PURE__*/React.createElement("span", {
    className: "hero-stat-label"
  }, "LTV")))), /*#__PURE__*/React.createElement(Card, {
    title: "Cr\xE9ditos",
    action: /*#__PURE__*/React.createElement("span", {
      className: "card-meta"
    }, focusPacks.length, " packs"),
    padding: false
  }, /*#__PURE__*/React.createElement("table", {
    className: "data-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Pack"), /*#__PURE__*/React.createElement("th", {
    className: "cell-right"
  }, "Restantes"), /*#__PURE__*/React.createElement("th", null, "Caduca"), /*#__PURE__*/React.createElement("th", null, "Comprado"), /*#__PURE__*/React.createElement("th", null, "Stripe"))), /*#__PURE__*/React.createElement("tbody", null, focusPacks.map(p => {
    const expired = new Date(p.expires_at) < new Date();
    return /*#__PURE__*/React.createElement("tr", {
      key: p.id,
      className: expired ? "is-faded" : ""
    }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
      className: "cell-stack"
    }, /*#__PURE__*/React.createElement("span", {
      className: "cell-strong"
    }, p.pack_size, " sesiones"), /*#__PURE__*/React.createElement("span", {
      className: "cell-meta"
    }, "Pack ", p.pack_size === 5 ? "Estándar" : "Premium"))), /*#__PURE__*/React.createElement("td", {
      className: "cell-right"
    }, /*#__PURE__*/React.createElement("div", {
      className: "credit-bar"
    }, /*#__PURE__*/React.createElement("div", {
      className: "credit-bar-track"
    }, /*#__PURE__*/React.createElement("div", {
      className: "credit-bar-fill",
      style: {
        width: `${p.credits_remaining / p.pack_size * 100}%`
      }
    })), /*#__PURE__*/React.createElement("span", {
      className: "credit-bar-label"
    }, p.credits_remaining, "/", p.pack_size))), /*#__PURE__*/React.createElement("td", {
      className: expired ? "error-text" : "muted"
    }, fmtDate(p.expires_at), " ", expired && "· vencido"), /*#__PURE__*/React.createElement("td", {
      className: "muted"
    }, fmtDate(p.created_at)), /*#__PURE__*/React.createElement("td", {
      className: "mono muted"
    }, p.stripe_payment_id));
  }))), /*#__PURE__*/React.createElement(AdjustCreditsForm, {
    email: student.email
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Reservas",
    action: /*#__PURE__*/React.createElement("span", {
      className: "card-meta"
    }, "\xDAltimas 50"),
    padding: false
  }, /*#__PURE__*/React.createElement("table", {
    className: "data-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Tipo"), /*#__PURE__*/React.createElement("th", null, "Inicio"), /*#__PURE__*/React.createElement("th", null, "Fin"), /*#__PURE__*/React.createElement("th", null, "Estado"))), /*#__PURE__*/React.createElement("tbody", null, focusBookings.map(b => /*#__PURE__*/React.createElement("tr", {
    key: b.id
  }, /*#__PURE__*/React.createElement("td", null, b.session_type), /*#__PURE__*/React.createElement("td", {
    className: "muted"
  }, fmtDateTime(b.starts_at)), /*#__PURE__*/React.createElement("td", {
    className: "muted"
  }, fmtDateTime(b.ends_at)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(StatusBadge, {
    status: b.status
  }))))))), /*#__PURE__*/React.createElement(Card, {
    title: "Historial"
  }, /*#__PURE__*/React.createElement("ol", {
    className: "audit-log"
  }, focusAudit.map((entry, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    className: "audit-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "audit-time"
  }, /*#__PURE__*/React.createElement("span", {
    className: "audit-date"
  }, fmtShort(entry.ts)), /*#__PURE__*/React.createElement("span", {
    className: "audit-rel"
  }, relativeTime(entry.ts))), /*#__PURE__*/React.createElement("div", {
    className: "audit-rail"
  }, /*#__PURE__*/React.createElement("span", {
    className: "audit-dot"
  }), i < focusAudit.length - 1 && /*#__PURE__*/React.createElement("span", {
    className: "audit-line"
  })), /*#__PURE__*/React.createElement("div", {
    className: "audit-content"
  }, /*#__PURE__*/React.createElement("span", {
    className: "audit-action"
  }, entry.action), /*#__PURE__*/React.createElement("span", {
    className: "audit-meta"
  }, Object.entries(entry).filter(([k]) => k !== "action" && k !== "ts").map(([k, v]) => /*#__PURE__*/React.createElement("span", {
    key: k,
    className: "audit-kv"
  }, /*#__PURE__*/React.createElement("span", {
    className: "audit-k"
  }, k), /*#__PURE__*/React.createElement("span", {
    className: "audit-v"
  }, v))))))))));
}
function AdjustCreditsForm({
  email
}) {
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  return /*#__PURE__*/React.createElement("div", {
    className: "adjust-form"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adjust-form-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined"
  }, "tune"), /*#__PURE__*/React.createElement("h3", null, "Ajustar cr\xE9ditos"), /*#__PURE__*/React.createElement("span", {
    className: "adjust-form-hint"
  }, "Se registra en el historial")), /*#__PURE__*/React.createElement("div", {
    className: "adjust-form-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "adjust-stepper"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setAmount(a => a - 1)
  }, "\u2212"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: amount,
    onChange: e => setAmount(parseInt(e.target.value, 10) || 0)
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => setAmount(a => a + 1)
  }, "+")), /*#__PURE__*/React.createElement("input", {
    className: "adjust-reason",
    type: "text",
    placeholder: "Raz\xF3n \u2014 ej: Correcci\xF3n manual por error de cobro",
    value: reason,
    onChange: e => setReason(e.target.value)
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn-primary",
    onClick: () => {
      if (!reason.trim()) return;
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2000);
      setReason("");
      setAmount(1);
    }
  }, submitted ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined"
  }, "check"), " Hecho") : "Aplicar")), /*#__PURE__*/React.createElement("p", {
    className: "adjust-form-foot"
  }, "Acci\xF3n: ", /*#__PURE__*/React.createElement("code", null, "POST /api/admin/students/", email), " \xB7 ", /*#__PURE__*/React.createElement("code", null, `{ action: "adjust_credits", amount: ${amount}, reason }`)));
}

/* ─── Bookings list ──────────────────────────────────────────────────── */
function BookingsPage({
  onNavigate
}) {
  const {
    bookings
  } = window.ADMIN_MOCK;
  const [statusFilter, setStatusFilter] = useState("all");
  const counts = useMemo(() => ({
    all: bookings.length,
    confirmed: bookings.filter(b => b.status === "confirmed").length,
    completed: bookings.filter(b => b.status === "completed").length,
    cancelled: bookings.filter(b => b.status === "cancelled").length,
    no_show: bookings.filter(b => b.status === "no_show").length
  }), [bookings]);
  const filtered = bookings.filter(b => statusFilter === "all" || b.status === statusFilter);
  return /*#__PURE__*/React.createElement("div", {
    className: "page-stack"
  }, /*#__PURE__*/React.createElement(PageHeader, {
    overline: "Operaciones",
    title: "Reservas",
    subtitle: "Hasta 100 reservas m\xE1s recientes"
  }), /*#__PURE__*/React.createElement("div", {
    className: "filter-tabs filter-tabs-row"
  }, [["all", "Todas"], ["confirmed", "Confirmadas"], ["completed", "Completadas"], ["cancelled", "Canceladas"], ["no_show", "No asistió"]].map(([key, label]) => /*#__PURE__*/React.createElement("button", {
    key: key,
    className: `filter-tab ${statusFilter === key ? "is-active" : ""}`,
    onClick: () => setStatusFilter(key)
  }, label, /*#__PURE__*/React.createElement("span", {
    className: "filter-tab-count"
  }, counts[key])))), /*#__PURE__*/React.createElement(Card, {
    padding: false
  }, /*#__PURE__*/React.createElement("table", {
    className: "data-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Alumno"), /*#__PURE__*/React.createElement("th", null, "Tipo"), /*#__PURE__*/React.createElement("th", null, "Inicio"), /*#__PURE__*/React.createElement("th", null, "Fin"), /*#__PURE__*/React.createElement("th", null, "Estado"))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(b => /*#__PURE__*/React.createElement("tr", {
    key: b.id,
    onClick: () => onNavigate(`/admin/students/${encodeURIComponent(b.email)}`)
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "cell-stack"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cell-strong"
  }, b.name), /*#__PURE__*/React.createElement("span", {
    className: "cell-meta"
  }, b.email))), /*#__PURE__*/React.createElement("td", {
    className: "muted"
  }, b.session_type), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "cell-stack"
  }, /*#__PURE__*/React.createElement("span", null, fmtDateTime(b.starts_at)), /*#__PURE__*/React.createElement("span", {
    className: "cell-meta"
  }, relativeTime(b.starts_at)))), /*#__PURE__*/React.createElement("td", {
    className: "muted"
  }, fmtDateTime(b.ends_at)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(StatusBadge, {
    status: b.status
  }))))))));
}

/* ─── Failed bookings ────────────────────────────────────────────────── */
function FailedBookingsPage() {
  const {
    failed
  } = window.ADMIN_MOCK;
  const [retryStates, setRetryStates] = useState({});
  const retry = id => {
    setRetryStates(s => ({
      ...s,
      [id]: "loading"
    }));
    setTimeout(() => setRetryStates(s => ({
      ...s,
      [id]: "ok"
    })), 900);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "page-stack"
  }, /*#__PURE__*/React.createElement(PageHeader, {
    overline: "Operaciones",
    title: "Reservas fallidas",
    subtitle: "Cola de cartas muertas \u2014 pagos confirmados sin reserva creada"
  }), /*#__PURE__*/React.createElement("div", {
    className: "alert"
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined"
  }, "info"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "\xBFQu\xE9 es esta lista?"), /*#__PURE__*/React.createElement("p", null, "Pagos que se cobraron correctamente pero la reserva no lleg\xF3 a crearse en el calendario. Reintentar invoca ", /*#__PURE__*/React.createElement("code", null, "/api/admin/failed-bookings"), "; si sigue fallando hay que reembolsar manualmente desde Stripe."))), /*#__PURE__*/React.createElement(Card, {
    padding: false
  }, failed.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "card-body"
  }, /*#__PURE__*/React.createElement(Empty, {
    icon: "check_circle",
    label: "Sin reservas fallidas. Todo en orden."
  })) : /*#__PURE__*/React.createElement("table", {
    className: "data-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Fecha fallo"), /*#__PURE__*/React.createElement("th", null, "Alumno"), /*#__PURE__*/React.createElement("th", null, "Slot reservado"), /*#__PURE__*/React.createElement("th", null, "Error"), /*#__PURE__*/React.createElement("th", null, "Stripe"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, failed.map(e => {
    const state = retryStates[e.stripeSessionId] ?? "idle";
    return /*#__PURE__*/React.createElement("tr", {
      key: e.stripeSessionId
    }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
      className: "cell-stack"
    }, /*#__PURE__*/React.createElement("span", null, fmtDateTime(e.failedAt)), /*#__PURE__*/React.createElement("span", {
      className: "cell-meta"
    }, relativeTime(e.failedAt)))), /*#__PURE__*/React.createElement("td", null, e.email), /*#__PURE__*/React.createElement("td", {
      className: "muted"
    }, fmtDateTime(e.startIso)), /*#__PURE__*/React.createElement("td", {
      className: "error-text",
      style: {
        maxWidth: 320
      }
    }, e.error), /*#__PURE__*/React.createElement("td", {
      className: "mono muted"
    }, e.stripeSessionId), /*#__PURE__*/React.createElement("td", {
      className: "cell-right"
    }, state === "ok" ? /*#__PURE__*/React.createElement("span", {
      className: "success-text"
    }, "\u2713 Procesado") : state === "loading" ? /*#__PURE__*/React.createElement("button", {
      className: "btn-ghost-sm is-loading",
      disabled: true
    }, "Reintentando\u2026") : /*#__PURE__*/React.createElement("button", {
      className: "btn-ghost-sm",
      onClick: () => retry(e.stripeSessionId)
    }, "Reintentar")));
  })))));
}

/* ─── Payments ───────────────────────────────────────────────────────── */
function PaymentsPage({
  onNavigate
}) {
  const {
    payments,
    stats
  } = window.ADMIN_MOCK;
  const revenue = (stats.revenueCents / 100).toFixed(2);
  const succeeded = payments.filter(p => p.status === "succeeded").length;
  const refunded = payments.filter(p => p.status === "refunded").length;

  // Mini sparkline data — last 14 days
  const spark = useMemo(() => {
    const days = 14;
    const buckets = new Array(days).fill(0);
    for (const p of payments) {
      if (p.status !== "succeeded") continue;
      const d = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000);
      if (d >= 0 && d < days) buckets[days - 1 - d] += p.amount_cents;
    }
    return buckets;
  }, [payments]);
  const sparkMax = Math.max(...spark, 1);
  return /*#__PURE__*/React.createElement("div", {
    className: "page-stack"
  }, /*#__PURE__*/React.createElement(PageHeader, {
    overline: "Finanzas",
    title: "Pagos",
    subtitle: "Hasta 100 pagos m\xE1s recientes"
  }), /*#__PURE__*/React.createElement("div", {
    className: "stat-grid stat-grid-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-card stat-card-static"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-card-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "stat-card-label"
  }, "Ingresos \xB7 30 d\xEDas"), /*#__PURE__*/React.createElement("span", {
    className: "stat-card-icon material-symbols-outlined"
  }, "payments")), /*#__PURE__*/React.createElement("div", {
    className: "stat-card-value"
  }, "\u20AC", revenue), /*#__PURE__*/React.createElement("svg", {
    className: "sparkline",
    viewBox: "0 0 280 48",
    preserveAspectRatio: "none"
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "sparkFill",
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: "#4edea3",
    stopOpacity: "0.35"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: "#4edea3",
    stopOpacity: "0"
  }))), /*#__PURE__*/React.createElement("polyline", {
    points: spark.map((v, i) => `${i / (spark.length - 1) * 280},${48 - v / sparkMax * 40 - 4}`).join(" "),
    fill: "none",
    stroke: "#4edea3",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("polygon", {
    points: `0,48 ${spark.map((v, i) => `${i / (spark.length - 1) * 280},${48 - v / sparkMax * 40 - 4}`).join(" ")} 280,48`,
    fill: "url(#sparkFill)"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "stat-card stat-card-static"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-card-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "stat-card-label"
  }, "Cobros exitosos"), /*#__PURE__*/React.createElement("span", {
    className: "stat-card-icon material-symbols-outlined"
  }, "check_circle")), /*#__PURE__*/React.createElement("div", {
    className: "stat-card-value"
  }, succeeded), /*#__PURE__*/React.createElement("div", {
    className: "stat-card-delta tone-up"
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined"
  }, "trending_up"), "+12% vs. periodo anterior")), /*#__PURE__*/React.createElement("div", {
    className: "stat-card stat-card-static"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-card-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "stat-card-label"
  }, "Reembolsos"), /*#__PURE__*/React.createElement("span", {
    className: "stat-card-icon material-symbols-outlined"
  }, "undo")), /*#__PURE__*/React.createElement("div", {
    className: "stat-card-value"
  }, refunded), /*#__PURE__*/React.createElement("div", {
    className: "stat-card-delta tone-neutral"
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined"
  }, "trending_flat"), "Sin cambios"))), /*#__PURE__*/React.createElement(Card, {
    padding: false
  }, /*#__PURE__*/React.createElement("table", {
    className: "data-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Fecha"), /*#__PURE__*/React.createElement("th", null, "Alumno"), /*#__PURE__*/React.createElement("th", null, "Tipo"), /*#__PURE__*/React.createElement("th", {
    className: "cell-right"
  }, "Importe"), /*#__PURE__*/React.createElement("th", null, "Estado"), /*#__PURE__*/React.createElement("th", null, "Stripe ID"))), /*#__PURE__*/React.createElement("tbody", null, payments.map(p => /*#__PURE__*/React.createElement("tr", {
    key: p.id,
    onClick: () => onNavigate(`/admin/students/${encodeURIComponent(p.email)}`)
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "cell-stack"
  }, /*#__PURE__*/React.createElement("span", null, fmtDateTime(p.created_at)), /*#__PURE__*/React.createElement("span", {
    className: "cell-meta"
  }, relativeTime(p.created_at)))), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "cell-stack"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cell-strong"
  }, p.name), /*#__PURE__*/React.createElement("span", {
    className: "cell-meta"
  }, p.email))), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "type-pill"
  }, p.checkout_type === "single" ? "Sesión única" : `Pack ${p.checkout_type.split("_")[1]}`)), /*#__PURE__*/React.createElement("td", {
    className: "cell-right mono cell-strong"
  }, "\u20AC", (p.amount_cents / 100).toFixed(2)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(StatusBadge, {
    status: p.status,
    kind: "payment"
  })), /*#__PURE__*/React.createElement("td", {
    className: "mono muted truncate"
  }, p.stripe_payment_id)))))));
}

/* ─── Router ─────────────────────────────────────────────────────────── */
function App() {
  const [path, setPath] = useState(() => window.location.hash.replace(/^#/, "") || "/admin");
  const onNavigate = href => {
    setPath(href);
    window.location.hash = href;
    window.scrollTo({
      top: 0,
      behavior: "instant"
    });
  };
  useEffect(() => {
    const onHash = () => setPath(window.location.hash.replace(/^#/, "") || "/admin");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Parse path
  const [pathname, search] = path.split("?");
  const params = new URLSearchParams(search || "");
  let body;
  if (pathname === "/admin") body = /*#__PURE__*/React.createElement(Dashboard, {
    onNavigate: onNavigate
  });else if (pathname === "/admin/students") body = /*#__PURE__*/React.createElement(StudentsPage, {
    onNavigate: onNavigate,
    filter: params.get("filter")
  });else if (pathname.startsWith("/admin/students/")) body = /*#__PURE__*/React.createElement(StudentDetailPage, {
    onNavigate: onNavigate,
    email: decodeURIComponent(pathname.replace("/admin/students/", ""))
  });else if (pathname === "/admin/bookings") body = /*#__PURE__*/React.createElement(BookingsPage, {
    onNavigate: onNavigate
  });else if (pathname === "/admin/failed-bookings") body = /*#__PURE__*/React.createElement(FailedBookingsPage, null);else if (pathname === "/admin/payments") body = /*#__PURE__*/React.createElement(PaymentsPage, {
    onNavigate: onNavigate
  });else body = /*#__PURE__*/React.createElement(Dashboard, {
    onNavigate: onNavigate
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "admin-shell",
    "data-screen-label": pathname
  }, /*#__PURE__*/React.createElement(AdminNav, {
    pathname: pathname,
    onNavigate: onNavigate
  }), /*#__PURE__*/React.createElement("main", {
    className: "admin-main"
  }, body));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "admin-app.jsx", error: String((e && e.message) || e) }); }

// admin-data.js
try { (() => {
// Mock data shaped to match src/app/admin/_data.ts

window.ADMIN_MOCK = function () {
  const now = Date.now();
  const days = n => new Date(now + n * 86400000).toISOString();
  const hours = n => new Date(now + n * 3600000).toISOString();
  const students = [{
    email: "marina.calderon@estudiante.es",
    name: "Marina Calderón Vega",
    totalCredits: 8,
    earliestExpiry: days(54),
    nextSession: hours(20)
  }, {
    email: "diego.ramirez@estudiante.es",
    name: "Diego Ramírez Torres",
    totalCredits: 1,
    earliestExpiry: days(11),
    nextSession: hours(48)
  }, {
    email: "lucia.fdz@estudiante.es",
    name: "Lucía Fernández Olmo",
    totalCredits: 4,
    earliestExpiry: days(33),
    nextSession: hours(72)
  }, {
    email: "alejandro.serrano@estudiante.es",
    name: "Alejandro Serrano Gil",
    totalCredits: 0,
    earliestExpiry: null,
    nextSession: null
  }, {
    email: "ines.morales@estudiante.es",
    name: "Inés Morales Bautista",
    totalCredits: 6,
    earliestExpiry: days(72),
    nextSession: hours(120)
  }, {
    email: "javier.peña@estudiante.es",
    name: "Javier Peña Aguirre",
    totalCredits: 2,
    earliestExpiry: days(18),
    nextSession: hours(96)
  }, {
    email: "carla.benitez@estudiante.es",
    name: "Carla Benítez Cruz",
    totalCredits: 0,
    earliestExpiry: null,
    nextSession: null
  }, {
    email: "raul.cordero@estudiante.es",
    name: "Raúl Cordero Méndez",
    totalCredits: 12,
    earliestExpiry: days(81),
    nextSession: hours(8)
  }, {
    email: "noelia.rivas@estudiante.es",
    name: "Noelia Rivas Domínguez",
    totalCredits: 3,
    earliestExpiry: days(27),
    nextSession: hours(168)
  }, {
    email: "tomas.aguilar@estudiante.es",
    name: "Tomás Aguilar Soler",
    totalCredits: 1,
    earliestExpiry: days(9),
    nextSession: hours(36)
  }, {
    email: "sara.molina@estudiante.es",
    name: "Sara Molina Espinosa",
    totalCredits: 5,
    earliestExpiry: days(44),
    nextSession: hours(4)
  }, {
    email: "pablo.guerrero@estudiante.es",
    name: "Pablo Guerrero Fuentes",
    totalCredits: 7,
    earliestExpiry: days(61),
    nextSession: hours(192)
  }];
  const sessionTypes = ["AI / Machine Learning", "Backend Node.js", "Matemáticas Bach.", "DAM / DAW", "Python avanzado", "Análisis de datos"];
  const bookings = [];
  for (let i = 0; i < 24; i++) {
    const s = students[i % students.length];
    const startOffset = i < 8 ? (i + 1) * 12 : -i * 18;
    const status = i < 8 ? "confirmed" : i % 5 === 0 ? "no_show" : i % 3 === 0 ? "cancelled" : "completed";
    bookings.push({
      id: `bk_${1000 + i}`,
      session_type: sessionTypes[i % sessionTypes.length],
      starts_at: hours(startOffset),
      ends_at: hours(startOffset + 1),
      status,
      email: s.email,
      name: s.name
    });
  }
  const failed = [{
    stripeSessionId: "cs_test_b1Dx9k…GpZq",
    failedAt: hours(-3),
    email: "diego.ramirez@estudiante.es",
    startIso: hours(48),
    error: "Slot no longer available — calendar conflict on host side"
  }, {
    stripeSessionId: "cs_test_a2Mn4j…Hf7P",
    failedAt: hours(-26),
    email: "carla.benitez@estudiante.es",
    startIso: hours(72),
    error: "Google Calendar API: insertEvent failed (5xx)"
  }, {
    stripeSessionId: "cs_test_c8Lp1q…Wx3R",
    failedAt: hours(-50),
    email: "tomas.aguilar@estudiante.es",
    startIso: hours(36),
    error: "Webhook signature verification failed after retry"
  }];
  const payments = [];
  const checkoutTypes = ["pack_5", "pack_10", "single", "pack_5", "single", "pack_10"];
  const amounts = [7500, 14000, 1600, 7500, 1600, 14000, 7500, 14000, 1600, 1600, 14000, 7500];
  const statuses = ["succeeded", "succeeded", "succeeded", "succeeded", "refunded", "succeeded", "succeeded", "pending", "succeeded", "failed", "succeeded", "succeeded"];
  for (let i = 0; i < 18; i++) {
    const s = students[i % students.length];
    payments.push({
      id: `pay_${2000 + i}`,
      amount_cents: amounts[i % amounts.length],
      currency: "EUR",
      status: statuses[i % statuses.length],
      checkout_type: checkoutTypes[i % checkoutTypes.length],
      created_at: hours(-i * 9 - 1),
      stripe_payment_id: `pi_3PqR${(8000 + i).toString(16)}xK7Lm`,
      email: s.email,
      name: s.name
    });
  }

  // Student detail for the focus student (diego.ramirez)
  const focusEmail = "diego.ramirez@estudiante.es";
  const focusStudent = students.find(s => s.email === focusEmail);
  const focusPacks = [{
    id: "cp_1",
    pack_size: 5,
    credits_remaining: 1,
    expires_at: days(11),
    created_at: days(-78),
    stripe_payment_id: "pi_3PqR8001xK7Lm"
  }, {
    id: "cp_2",
    pack_size: 10,
    credits_remaining: 0,
    expires_at: days(-22),
    created_at: days(-130),
    stripe_payment_id: "pi_3PqR7991xK7Lm"
  }];
  const focusBookings = [{
    id: "bk_d1",
    session_type: "Backend Node.js",
    starts_at: hours(48),
    ends_at: hours(49),
    status: "confirmed"
  }, {
    id: "bk_d2",
    session_type: "Backend Node.js",
    starts_at: hours(-72),
    ends_at: hours(-71),
    status: "completed"
  }, {
    id: "bk_d3",
    session_type: "AI / Machine Learning",
    starts_at: hours(-216),
    ends_at: hours(-215),
    status: "completed"
  }, {
    id: "bk_d4",
    session_type: "Backend Node.js",
    starts_at: hours(-360),
    ends_at: hours(-359),
    status: "no_show"
  }, {
    id: "bk_d5",
    session_type: "AI / Machine Learning",
    starts_at: hours(-528),
    ends_at: hours(-527),
    status: "completed"
  }, {
    id: "bk_d6",
    session_type: "Python avanzado",
    starts_at: hours(-720),
    ends_at: hours(-719),
    status: "cancelled"
  }];
  const focusAudit = [{
    ts: hours(-2),
    action: "credits_adjusted",
    amount: "-1",
    reason: "no_show charge applied"
  }, {
    ts: hours(-72),
    action: "booking_completed",
    booking_id: "bk_d2",
    credits_used: "1"
  }, {
    ts: hours(-78),
    action: "pack_purchased",
    pack_size: "5",
    amount_cents: "7500"
  }, {
    ts: hours(-216),
    action: "booking_completed",
    booking_id: "bk_d3",
    credits_used: "1"
  }, {
    ts: hours(-360),
    action: "booking_no_show",
    booking_id: "bk_d4"
  }, {
    ts: hours(-528),
    action: "booking_completed",
    booking_id: "bk_d5",
    credits_used: "1"
  }, {
    ts: hours(-720),
    action: "booking_cancelled",
    booking_id: "bk_d6",
    refunded: "true"
  }, {
    ts: days(-130),
    action: "pack_purchased",
    pack_size: "10",
    amount_cents: "14000"
  }, {
    ts: days(-130),
    action: "user_signed_up",
    provider: "google"
  }];

  // Stats
  const stats = {
    upcoming: bookings.filter(b => b.status === "confirmed" && new Date(b.starts_at) > new Date()).length,
    lowCredit: students.filter(s => s.totalCredits <= 1).length,
    failed: failed.length,
    revenueCents: payments.filter(p => p.status === "succeeded" && Date.now() - new Date(p.created_at).getTime() < 30 * 86400000).reduce((sum, p) => sum + p.amount_cents, 0)
  };
  return {
    students,
    bookings,
    failed,
    payments,
    stats,
    focusEmail,
    focusStudent,
    focusPacks,
    focusBookings,
    focusAudit
  };
}();
})(); } catch (e) { __ds_ns.__errors.push({ path: "admin-data.js", error: String((e && e.message) || e) }); }

// design-canvas.jsx
try { (() => {
// DesignCanvas.jsx — Figma-ish design canvas wrapper
// Warm gray grid bg + Sections + Artboards + PostIt notes.
// Artboards are reorderable (grip-drag), deletable, labels/titles are
// inline-editable, and any artboard can be opened in a fullscreen focus
// overlay (←/→/Esc). State persists to a .design-canvas.state.json sidecar
// via the host bridge. No assets, no deps.
//
// Usage:
//   <DesignCanvas>
//     <DCSection id="onboarding" title="Onboarding" subtitle="First-run variants">
//       <DCArtboard id="a" label="A · Dusk" width={260} height={480}>…</DCArtboard>
//       <DCArtboard id="b" label="B · Minimal" width={260} height={480}>…</DCArtboard>
//     </DCSection>
//   </DesignCanvas>

const DC = {
  bg: '#f0eee9',
  grid: 'rgba(0,0,0,0.06)',
  label: 'rgba(60,50,40,0.7)',
  title: 'rgba(40,30,20,0.85)',
  subtitle: 'rgba(60,50,40,0.6)',
  postitBg: '#fef4a8',
  postitText: '#5a4a2a',
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'
};

// One-time CSS injection (classes are dc-prefixed so they don't collide with
// the hosted design's own styles).
if (typeof document !== 'undefined' && !document.getElementById('dc-styles')) {
  const s = document.createElement('style');
  s.id = 'dc-styles';
  s.textContent = ['.dc-editable{cursor:text;outline:none;white-space:nowrap;border-radius:3px;padding:0 2px;margin:0 -2px}', '.dc-editable:focus{background:#fff;box-shadow:0 0 0 1.5px #c96442}', '[data-dc-slot]{transition:transform .18s cubic-bezier(.2,.7,.3,1)}', '[data-dc-slot].dc-dragging{transition:none;z-index:10;pointer-events:none}', '[data-dc-slot].dc-dragging .dc-card{box-shadow:0 12px 40px rgba(0,0,0,.25),0 0 0 2px #c96442;transform:scale(1.02)}',
  // isolation:isolate contains artboard content's z-indexes so a
  // z-indexed child (sticky navbar etc.) can't paint over .dc-header or
  // the .dc-menu popover that drops into the top of the card.
  '.dc-card{isolation:isolate;transition:box-shadow .15s,transform .15s}', '.dc-card *{scrollbar-width:none}', '.dc-card *::-webkit-scrollbar{display:none}',
  // Per-artboard header: grip + label on the left, delete/expand on the
  // right. Single flex row; when the artboard's on-screen width is too
  // narrow for both the label yields (ellipsis, then hidden entirely below
  // ~4ch via the container query) and the buttons stay on the row.
  '.dc-header{position:absolute;bottom:100%;left:-4px;margin-bottom:calc(4px * var(--dc-inv-zoom,1));z-index:2;', '  display:flex;align-items:center;container-type:inline-size}', '.dc-labelrow{display:flex;align-items:center;gap:4px;height:24px;flex:1 1 auto;min-width:0}', '.dc-grip{flex:0 0 auto;cursor:grab;display:flex;align-items:center;padding:5px 4px;border-radius:4px;transition:background .12s,opacity .12s}', '.dc-grip:hover{background:rgba(0,0,0,.08)}', '.dc-grip:active{cursor:grabbing}', '.dc-labeltext{flex:1 1 auto;min-width:0;cursor:pointer;border-radius:4px;padding:3px 6px;', '  display:flex;align-items:center;transition:background .12s;overflow:hidden}',
  // Below ~4ch of label room: hide the label entirely, and drop the grip to
  // hover-only (same reveal rule as .dc-btns) so a narrow header is clean
  // until the card is moused.
  '@container (max-width: 110px){', '  .dc-labeltext{display:none}', '  .dc-grip{opacity:0}', '  [data-dc-slot]:hover .dc-grip{opacity:1}', '}', '.dc-labeltext:hover{background:rgba(0,0,0,.05)}', '.dc-labeltext .dc-editable{overflow:hidden;text-overflow:ellipsis;max-width:100%}', '.dc-labeltext .dc-editable:focus{overflow:visible;text-overflow:clip}', '.dc-btns{flex:0 0 auto;margin-left:auto;display:flex;gap:2px;opacity:0;transition:opacity .12s}', '[data-dc-slot]:hover .dc-btns,.dc-btns:has(.dc-menu){opacity:1}', '.dc-expand,.dc-kebab{width:22px;height:22px;border-radius:5px;border:none;cursor:pointer;padding:0;', '  background:transparent;color:rgba(60,50,40,.7);display:flex;align-items:center;justify-content:center;', '  font:inherit;transition:background .12s,color .12s}', '.dc-expand:hover,.dc-kebab:hover{background:rgba(0,0,0,.06);color:#2a251f}',
  // Slot hosting an open menu floats above later siblings (which otherwise
  // paint on top — same z-index:auto, later DOM order) so the popup isn't
  // clipped by the next card.
  '[data-dc-slot]:has(.dc-menu){z-index:10}', '.dc-menu{position:absolute;top:100%;right:0;margin-top:4px;background:#fff;border-radius:8px;', '  box-shadow:0 8px 28px rgba(0,0,0,.18),0 0 0 1px rgba(0,0,0,.05);padding:4px;min-width:160px;z-index:10}', '.dc-menu button{display:block;width:100%;padding:7px 10px;border:0;background:transparent;', '  border-radius:5px;font-family:inherit;font-size:13px;font-weight:500;line-height:1.2;', '  color:#29261b;cursor:pointer;text-align:left;transition:background .12s;white-space:nowrap}', '.dc-menu button:hover{background:rgba(0,0,0,.05)}', '.dc-menu hr{border:0;border-top:1px solid rgba(0,0,0,.08);margin:4px 2px}', '.dc-menu .dc-danger{color:#c96442}', '.dc-menu .dc-danger:hover{background:rgba(201,100,66,.1)}',
  // Chrome (titles / labels / buttons) counter-scales against the viewport
  // zoom so it stays a constant on-screen size. --dc-inv-zoom is set by
  // DCViewport on every transform update and inherits to all descendants —
  // any overlay inside the world (e.g. a TweaksPanel on an artboard) can use
  // it the same way.
  //
  // The header uses transform:scale (out-of-flow, so layout impact doesn't
  // matter) with its world-space width set to card-width / inv-zoom so that
  // after counter-scaling its on-screen width exactly matches the card's —
  // that's what lets the container query + text-overflow behave against the
  // card's visible edge at every zoom level.
  //
  // The section head uses CSS zoom instead of transform so its layout box
  // grows with the counter-scale, pushing the card row down — otherwise the
  // constant-screen-size title would overflow into the (shrinking) world-
  // space gap and overlap the artboard headers at low zoom.
  '.dc-header{width:calc((100% + 4px) / var(--dc-inv-zoom,1));', '  transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom left}', '.dc-sectionhead{zoom:var(--dc-inv-zoom,1)}'].join('\n');
  document.head.appendChild(s);
}
const DCCtx = React.createContext(null);

// Recursively unwrap React.Fragment so <>…</> grouping doesn't hide
// DCSection/DCArtboard children from the type-based walks below.
function dcFlatten(children) {
  const out = [];
  React.Children.forEach(children, c => {
    if (c && c.type === React.Fragment) out.push(...dcFlatten(c.props.children));else out.push(c);
  });
  return out;
}

// ─────────────────────────────────────────────────────────────
// DesignCanvas — stateful wrapper around the pan/zoom viewport.
// Owns runtime state (per-section order, renamed titles/labels, hidden
// artboards, focused artboard). Order/titles/labels/hidden persist to a
// .design-canvas.state.json
// sidecar next to the HTML. Reads go via plain fetch() so the saved
// arrangement is visible anywhere the HTML + sidecar are served together
// (omelette preview, direct link, downloaded zip). Writes go through the
// host's window.omelette bridge — editing requires the omelette runtime.
// Focus is ephemeral.
// ─────────────────────────────────────────────────────────────
const DC_STATE_FILE = '.design-canvas.state.json';
function DesignCanvas({
  children,
  minScale,
  maxScale,
  style
}) {
  const [state, setState] = React.useState({
    sections: {},
    focus: null
  });
  // Hold rendering until the sidecar read settles so the saved order/titles
  // appear on first paint (no source-order flash). didRead gates writes until
  // the read settles so the empty initial state can't clobber a slow read;
  // skipNextWrite suppresses the one echo-write that would otherwise follow
  // hydration.
  const [ready, setReady] = React.useState(false);
  const didRead = React.useRef(false);
  const skipNextWrite = React.useRef(false);
  React.useEffect(() => {
    let off = false;
    fetch('./' + DC_STATE_FILE).then(r => r.ok ? r.json() : null).then(saved => {
      if (off || !saved || !saved.sections) return;
      skipNextWrite.current = true;
      setState(s => ({
        ...s,
        sections: saved.sections
      }));
    }).catch(() => {}).finally(() => {
      didRead.current = true;
      if (!off) setReady(true);
    });
    const t = setTimeout(() => {
      if (!off) setReady(true);
    }, 150);
    return () => {
      off = true;
      clearTimeout(t);
    };
  }, []);
  React.useEffect(() => {
    if (!didRead.current) return;
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }
    const t = setTimeout(() => {
      window.omelette?.writeFile(DC_STATE_FILE, JSON.stringify({
        sections: state.sections
      })).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [state.sections]);

  // Build registries synchronously from children so FocusOverlay can read
  // them in the same render. Fragments are flattened; wrapping in other
  // elements still opts out of focus/reorder.
  const registry = {}; // slotId -> { sectionId, artboard }
  const sectionMeta = {}; // sectionId -> { title, subtitle, slotIds[] }
  const sectionOrder = [];
  dcFlatten(children).forEach(sec => {
    if (!sec || sec.type !== DCSection) return;
    const sid = sec.props.id ?? sec.props.title;
    if (!sid) return;
    sectionOrder.push(sid);
    const persisted = state.sections[sid] || {};
    const abs = [];
    dcFlatten(sec.props.children).forEach(ab => {
      if (!ab || ab.type !== DCArtboard) return;
      const aid = ab.props.id ?? ab.props.label;
      if (aid) abs.push([aid, ab]);
    });
    // hidden is scoped to one source revision — when the agent regenerates
    // (artboard-ID set changes), prior deletes don't apply to new content.
    const srcKey = abs.map(([k]) => k).join('\x1f');
    const hidden = persisted.srcKey === srcKey ? persisted.hidden || [] : [];
    const srcIds = [];
    abs.forEach(([aid, ab]) => {
      if (hidden.includes(aid)) return;
      registry[`${sid}/${aid}`] = {
        sectionId: sid,
        artboard: ab
      };
      srcIds.push(aid);
    });
    const kept = (persisted.order || []).filter(k => srcIds.includes(k));
    sectionMeta[sid] = {
      title: persisted.title ?? sec.props.title,
      subtitle: sec.props.subtitle,
      slotIds: [...kept, ...srcIds.filter(k => !kept.includes(k))]
    };
  });
  const api = React.useMemo(() => ({
    state,
    section: id => state.sections[id] || {},
    patchSection: (id, p) => setState(s => ({
      ...s,
      sections: {
        ...s.sections,
        [id]: {
          ...s.sections[id],
          ...(typeof p === 'function' ? p(s.sections[id] || {}) : p)
        }
      }
    })),
    setFocus: slotId => setState(s => ({
      ...s,
      focus: slotId
    }))
  }), [state]);

  // Esc exits focus; any outside pointerdown commits an in-progress rename.
  React.useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') api.setFocus(null);
    };
    const onPd = e => {
      const ae = document.activeElement;
      if (ae && ae.isContentEditable && !ae.contains(e.target)) ae.blur();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPd, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPd, true);
    };
  }, [api]);
  return /*#__PURE__*/React.createElement(DCCtx.Provider, {
    value: api
  }, /*#__PURE__*/React.createElement(DCViewport, {
    minScale: minScale,
    maxScale: maxScale,
    style: style
  }, ready && children), state.focus && registry[state.focus] && /*#__PURE__*/React.createElement(DCFocusOverlay, {
    entry: registry[state.focus],
    sectionMeta: sectionMeta,
    sectionOrder: sectionOrder
  }));
}

// ─────────────────────────────────────────────────────────────
// DCViewport — transform-based pan/zoom (internal)
//
// Input mapping (Figma-style):
//   • trackpad pinch  → zoom   (ctrlKey wheel; Safari gesture* events)
//   • trackpad scroll → pan    (two-finger)
//   • mouse wheel     → zoom   (notched; distinguished from trackpad scroll)
//   • middle-drag / primary-drag-on-bg → pan
//
// Transform state lives in a ref and is written straight to the DOM
// (translate3d + will-change) so wheel ticks don't go through React —
// keeps pans at 60fps on dense canvases.
// ─────────────────────────────────────────────────────────────
function DCViewport({
  children,
  minScale = 0.1,
  maxScale = 8,
  style = {}
}) {
  const vpRef = React.useRef(null);
  const worldRef = React.useRef(null);
  const tf = React.useRef({
    x: 0,
    y: 0,
    scale: 1
  });
  // Persist viewport across reloads so the user lands back where they were
  // after an agent edit or browser refresh. The sandbox origin is already
  // per-project; pathname keeps multiple canvas files in one project apart.
  const tfKey = 'dc-viewport:' + location.pathname;
  const saveT = React.useRef(0);
  const lastPostedScale = React.useRef();
  const apply = React.useCallback(() => {
    const {
      x,
      y,
      scale
    } = tf.current;
    const el = worldRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    // Exposed for zoom-invariant chrome (labels, buttons, TweaksPanel).
    el.style.setProperty('--dc-inv-zoom', String(1 / scale));
    // Keep the host toolbar's % readout in sync with the canvas scale. Pan
    // ticks leave scale unchanged — skip the cross-frame post for those.
    if (lastPostedScale.current !== scale) {
      lastPostedScale.current = scale;
      window.parent.postMessage({
        type: '__dc_zoom',
        scale
      }, '*');
    }
    clearTimeout(saveT.current);
    saveT.current = setTimeout(() => {
      try {
        localStorage.setItem(tfKey, JSON.stringify(tf.current));
      } catch {}
    }, 200);
  }, [tfKey]);
  React.useLayoutEffect(() => {
    const flush = () => {
      clearTimeout(saveT.current);
      try {
        localStorage.setItem(tfKey, JSON.stringify(tf.current));
      } catch {}
    };
    try {
      const s = JSON.parse(localStorage.getItem(tfKey) || 'null');
      if (s && Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.scale)) {
        tf.current = {
          x: s.x,
          y: s.y,
          scale: Math.min(maxScale, Math.max(minScale, s.scale))
        };
        apply();
      }
    } catch {}
    // Flush on pagehide and unmount so a reload within the 200ms debounce
    // window doesn't drop the last pan/zoom.
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);
  React.useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;
    const zoomAt = (cx, cy, factor) => {
      const r = vp.getBoundingClientRect();
      const px = cx - r.left,
        py = cy - r.top;
      const t = tf.current;
      const next = Math.min(maxScale, Math.max(minScale, t.scale * factor));
      const k = next / t.scale;
      // --dc-inv-zoom consumers (.dc-sectionhead's CSS zoom, each section's
      // marginBottom) reflow on every scale change, vertically shifting the
      // world layout — so a world point mathematically pinned under the cursor
      // drifts as you zoom (content creeps up on zoom-in, down on zoom-out).
      // Anchor the DOM element under the cursor instead: record its screen Y,
      // apply the transform + --dc-inv-zoom, then cancel whatever vertical
      // drift the reflow introduced so it stays put on screen.
      let marker = null,
        markerY0 = 0;
      if (k !== 1) {
        const hit = document.elementFromPoint(cx, cy);
        marker = hit && hit.closest ? hit.closest('[data-dc-slot],[data-dc-section]') : null;
        if (marker) markerY0 = marker.getBoundingClientRect().top;
      }
      // keep the world point under the cursor fixed
      t.x = px - (px - t.x) * k;
      t.y = py - (py - t.y) * k;
      t.scale = next;
      apply();
      if (marker) {
        // A pure zoom around (cx, cy) maps screen Y → cy + (Y - cy) * k. Any
        // departure after the --dc-inv-zoom reflow is the layout drift.
        const drift = marker.getBoundingClientRect().top - (cy + (markerY0 - cy) * k);
        if (Math.abs(drift) > 0.1) {
          t.y -= drift;
          apply();
        }
      }
    };

    // Mouse-wheel vs trackpad-scroll heuristic. A physical wheel sends
    // line-mode deltas (Firefox) or large integer pixel deltas with no X
    // component (Chrome/Safari, typically multiples of 100/120). Trackpad
    // two-finger scroll sends small/fractional pixel deltas, often with
    // non-zero deltaX. ctrlKey is set by the browser for trackpad pinch.
    const isMouseWheel = e => e.deltaMode !== 0 || e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 40;
    const onWheel = e => {
      e.preventDefault();
      if (isGesturing) return; // Safari: gesture* owns the pinch — discard concurrent wheels
      if ((e.ctrlKey || e.metaKey) && !isMouseWheel(e)) {
        // trackpad pinch, or ctrl/cmd + smooth-scroll mouse. Notched
        // wheels fall through to the fixed-step branch below.
        zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
      } else if (isMouseWheel(e)) {
        // notched mouse wheel — fixed-ratio step per click
        zoomAt(e.clientX, e.clientY, Math.exp(-Math.sign(e.deltaY) * 0.18));
      } else {
        // trackpad two-finger scroll — pan
        tf.current.x -= e.deltaX;
        tf.current.y -= e.deltaY;
        apply();
      }
    };

    // Safari sends native gesture* events for trackpad pinch with a smooth
    // e.scale; preferring these over the ctrl+wheel fallback gives a much
    // better feel there. No-ops on other browsers. Safari also fires
    // ctrlKey wheel events during the same pinch — isGesturing makes
    // onWheel drop those entirely so they neither zoom nor pan.
    let gsBase = 1;
    let isGesturing = false;
    const onGestureStart = e => {
      e.preventDefault();
      isGesturing = true;
      gsBase = tf.current.scale;
    };
    const onGestureChange = e => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, gsBase * e.scale / tf.current.scale);
    };
    const onGestureEnd = e => {
      e.preventDefault();
      isGesturing = false;
    };

    // Drag-pan: middle button anywhere, or primary button on canvas
    // background (anything that isn't an artboard or an inline editor).
    let drag = null;
    const onPointerDown = e => {
      const onBg = !e.target.closest('[data-dc-slot], .dc-editable');
      if (!(e.button === 1 || e.button === 0 && onBg)) return;
      e.preventDefault();
      vp.setPointerCapture(e.pointerId);
      drag = {
        id: e.pointerId,
        lx: e.clientX,
        ly: e.clientY
      };
      vp.style.cursor = 'grabbing';
    };
    const onPointerMove = e => {
      if (!drag || e.pointerId !== drag.id) return;
      tf.current.x += e.clientX - drag.lx;
      tf.current.y += e.clientY - drag.ly;
      drag.lx = e.clientX;
      drag.ly = e.clientY;
      apply();
    };
    const onPointerUp = e => {
      if (!drag || e.pointerId !== drag.id) return;
      vp.releasePointerCapture(e.pointerId);
      drag = null;
      vp.style.cursor = '';
    };

    // Host-driven zoom (toolbar % menu). Zooms around viewport centre so the
    // visible midpoint stays fixed — matching the host's iframe-zoom feel.
    const onHostMsg = e => {
      const d = e.data;
      if (d && d.type === '__dc_set_zoom' && typeof d.scale === 'number') {
        const r = vp.getBoundingClientRect();
        zoomAt(r.left + r.width / 2, r.top + r.height / 2, d.scale / tf.current.scale);
      } else if (d && d.type === '__dc_probe') {
        // Host's [readyGen] reset asks whether a canvas is present; it
        // fires on the iframe's native 'load', which for canvases with
        // images/fonts is after our mount-time announce, so re-announce.
        // Clear the pan-tick guard so apply() re-posts the current scale
        // even if it's unchanged — the host just reset dcScale to 1.
        window.parent.postMessage({
          type: '__dc_present'
        }, '*');
        lastPostedScale.current = undefined;
        apply();
      }
    };
    window.addEventListener('message', onHostMsg);
    // Announce canvas mode so the host toolbar proxies its % control here
    // instead of scaling the iframe element (which would just shrink the
    // viewport window of an infinite canvas). The apply() that follows emits
    // the initial __dc_zoom so the toolbar % is correct before first pinch.
    // lastPostedScale reset mirrors the __dc_probe handler: the layout
    // effect's restore-path apply() may already have posted the restored
    // scale (before __dc_present), so clear the guard to re-post it in order.
    window.parent.postMessage({
      type: '__dc_present'
    }, '*');
    lastPostedScale.current = undefined;
    apply();
    vp.addEventListener('wheel', onWheel, {
      passive: false
    });
    vp.addEventListener('gesturestart', onGestureStart, {
      passive: false
    });
    vp.addEventListener('gesturechange', onGestureChange, {
      passive: false
    });
    vp.addEventListener('gestureend', onGestureEnd, {
      passive: false
    });
    vp.addEventListener('pointerdown', onPointerDown);
    vp.addEventListener('pointermove', onPointerMove);
    vp.addEventListener('pointerup', onPointerUp);
    vp.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('message', onHostMsg);
      vp.removeEventListener('wheel', onWheel);
      vp.removeEventListener('gesturestart', onGestureStart);
      vp.removeEventListener('gesturechange', onGestureChange);
      vp.removeEventListener('gestureend', onGestureEnd);
      vp.removeEventListener('pointerdown', onPointerDown);
      vp.removeEventListener('pointermove', onPointerMove);
      vp.removeEventListener('pointerup', onPointerUp);
      vp.removeEventListener('pointercancel', onPointerUp);
    };
  }, [apply, minScale, maxScale]);
  const gridSvg = `url("data:image/svg+xml,%3Csvg width='120' height='120' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M120 0H0v120' fill='none' stroke='${encodeURIComponent(DC.grid)}' stroke-width='1'/%3E%3C/svg%3E")`;
  return /*#__PURE__*/React.createElement("div", {
    ref: vpRef,
    className: "design-canvas",
    style: {
      height: '100vh',
      width: '100vw',
      background: DC.bg,
      overflow: 'hidden',
      overscrollBehavior: 'none',
      touchAction: 'none',
      position: 'relative',
      fontFamily: DC.font,
      boxSizing: 'border-box',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: worldRef,
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      transformOrigin: '0 0',
      willChange: 'transform',
      width: 'max-content',
      minWidth: '100%',
      minHeight: '100%',
      padding: '60px 0 80px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: -6000,
      backgroundImage: gridSvg,
      backgroundSize: '120px 120px',
      pointerEvents: 'none',
      zIndex: -1
    }
  }), children));
}

// ─────────────────────────────────────────────────────────────
// DCSection — editable title + h-row of artboards in persisted order
// ─────────────────────────────────────────────────────────────
function DCSection({
  id,
  title,
  subtitle,
  children,
  gap = 48
}) {
  const ctx = React.useContext(DCCtx);
  const sid = id ?? title;
  const all = React.Children.toArray(dcFlatten(children));
  const artboards = all.filter(c => c && c.type === DCArtboard);
  const rest = all.filter(c => !(c && c.type === DCArtboard));
  const sec = ctx && sid && ctx.section(sid) || {};
  // Must match DesignCanvas's srcKey computation exactly (it filters falsy
  // IDs), or onDelete persists a srcKey that DesignCanvas never recognizes.
  const allIds = artboards.map(a => a.props.id ?? a.props.label).filter(Boolean);
  const srcKey = allIds.join('\x1f');
  const hidden = sec.srcKey === srcKey ? sec.hidden || [] : [];
  const srcOrder = allIds.filter(k => !hidden.includes(k));
  const order = React.useMemo(() => {
    const kept = (sec.order || []).filter(k => srcOrder.includes(k));
    return [...kept, ...srcOrder.filter(k => !kept.includes(k))];
  }, [sec.order, srcOrder.join('|')]);
  const byId = Object.fromEntries(artboards.map(a => [a.props.id ?? a.props.label, a]));

  // marginBottom counter-scales so the on-screen gap between sections stays
  // constant — otherwise at low zoom the (world-space) gap collapses while
  // the screen-constant sectionhead below it doesn't, and the title reads as
  // belonging to the section above. paddingBottom below is just enough for
  // the 24px artboard-header (abs-positioned above each card) plus ~8px, so
  // the title sits tight against its own row at every zoom.
  return /*#__PURE__*/React.createElement("div", {
    "data-dc-section": sid,
    style: {
      marginBottom: 'calc(80px * var(--dc-inv-zoom, 1))',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 60px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dc-sectionhead",
    style: {
      paddingBottom: 36
    }
  }, /*#__PURE__*/React.createElement(DCEditable, {
    tag: "div",
    value: sec.title ?? title,
    onChange: v => ctx && sid && ctx.patchSection(sid, {
      title: v
    }),
    style: {
      fontSize: 28,
      fontWeight: 600,
      color: DC.title,
      letterSpacing: -0.4,
      marginBottom: 6,
      display: 'inline-block'
    }
  }), subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: DC.subtitle
    }
  }, subtitle))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap,
      padding: '0 60px',
      alignItems: 'flex-start',
      width: 'max-content'
    }
  }, order.map(k => /*#__PURE__*/React.createElement(DCArtboardFrame, {
    key: k,
    sectionId: sid,
    artboard: byId[k],
    order: order,
    label: (sec.labels || {})[k] ?? byId[k].props.label,
    onRename: v => ctx && ctx.patchSection(sid, x => ({
      labels: {
        ...x.labels,
        [k]: v
      }
    })),
    onReorder: next => ctx && ctx.patchSection(sid, {
      order: next
    }),
    onDelete: () => ctx && ctx.patchSection(sid, x => ({
      hidden: [...(x.srcKey === srcKey ? x.hidden || [] : []), k],
      srcKey
    })),
    onFocus: () => ctx && ctx.setFocus(`${sid}/${k}`)
  }))), rest);
}

// DCArtboard — marker; rendered by DCArtboardFrame via DCSection.
function DCArtboard() {
  return null;
}

// Per-artboard export (kind: 'png' | 'html'). Both paths share the same
// self-contained clone: computed styles baked in, @font-face / <img> /
// inline-style background-image urls inlined as data URIs. PNG wraps the
// clone in foreignObject→canvas at 3× the artboard's natural width×height
// (same pipeline the host uses for page captures); HTML wraps it in a
// minimal standalone document. Both are independent of viewport zoom.
async function dcExport(node, w, h, name, kind) {
  try {
    await document.fonts.ready;
  } catch {}
  const toDataURL = url => fetch(url).then(r => r.blob()).then(b => new Promise(res => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => res(url);
    fr.readAsDataURL(b);
  })).catch(() => url);

  // Collect @font-face rules. ss.cssRules throws SecurityError on
  // cross-origin sheets (e.g. fonts.googleapis.com) — in that case fetch
  // the CSS text directly (those endpoints send ACAO:*) and regex-extract
  // the blocks. @import and @media/@supports are walked so nested
  // @font-face rules aren't missed.
  const fontRules = [],
    pending = [],
    seen = new Set();
  const scrapeCss = href => {
    if (seen.has(href)) return;
    seen.add(href);
    pending.push(fetch(href).then(r => r.text()).then(css => {
      for (const m of css.match(/@font-face\s*{[^}]*}/g) || []) fontRules.push({
        css: m,
        base: href
      });
      for (const m of css.matchAll(/@import\s+(?:url\()?['"]?([^'")\s;]+)/g)) scrapeCss(new URL(m[1], href).href);
    }).catch(() => {}));
  };
  const walk = (rules, base) => {
    for (const r of rules) {
      if (r.type === CSSRule.FONT_FACE_RULE) fontRules.push({
        css: r.cssText,
        base
      });else if (r.type === CSSRule.IMPORT_RULE && r.styleSheet) {
        const ibase = r.styleSheet.href || base;
        try {
          walk(r.styleSheet.cssRules, ibase);
        } catch {
          scrapeCss(ibase);
        }
      } else if (r.cssRules) walk(r.cssRules, base);
    }
  };
  for (const ss of document.styleSheets) {
    const base = ss.href || location.href;
    try {
      walk(ss.cssRules, base);
    } catch {
      if (ss.href) scrapeCss(ss.href);
    }
  }
  while (pending.length) await pending.shift();
  const fontCss = (await Promise.all(fontRules.map(async rule => {
    let out = rule.css,
      m;
    const re = /url\((['"]?)([^'")]+)\1\)/g;
    while (m = re.exec(rule.css)) {
      if (m[2].indexOf('data:') === 0) continue;
      let abs;
      try {
        abs = new URL(m[2], rule.base).href;
      } catch {
        continue;
      }
      out = out.split(m[0]).join('url("' + (await toDataURL(abs)) + '")');
    }
    return out;
  }))).join('\n');
  const cloneStyled = src => {
    if (src.nodeType === 8 || src.nodeType === 1 && src.tagName === 'SCRIPT') return document.createTextNode('');
    const dst = src.cloneNode(false);
    if (src.nodeType === 1) {
      const cs = getComputedStyle(src);
      let txt = '';
      for (let i = 0; i < cs.length; i++) txt += cs[i] + ':' + cs.getPropertyValue(cs[i]) + ';';
      dst.setAttribute('style', txt + 'animation:none;transition:none;');
      if (src.tagName === 'CANVAS') try {
        const im = document.createElement('img');
        im.src = src.toDataURL();
        im.setAttribute('style', txt);
        return im;
      } catch {}
    }
    for (let c = src.firstChild; c; c = c.nextSibling) dst.appendChild(cloneStyled(c));
    return dst;
  };
  const clone = cloneStyled(node);
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  // Drop the card's own shadow/radius so the export is a flush w×h rect;
  // the artboard's own background (if any) is already in the computed style.
  clone.style.boxShadow = 'none';
  clone.style.borderRadius = '0';
  const jobs = [];
  clone.querySelectorAll('img').forEach(el => {
    const s = el.getAttribute('src');
    if (s && s.indexOf('data:') !== 0) jobs.push(toDataURL(el.src).then(d => el.setAttribute('src', d)));
  });
  [clone, ...clone.querySelectorAll('*')].forEach(el => {
    const bg = el.style.backgroundImage;
    if (!bg) return;
    let m;
    const re = /url\(["']?([^"')]+)["']?\)/g;
    while (m = re.exec(bg)) {
      const tok = m[0],
        url = m[1];
      if (url.indexOf('data:') === 0) continue;
      jobs.push(toDataURL(url).then(d => {
        el.style.backgroundImage = el.style.backgroundImage.split(tok).join('url("' + d + '")');
      }));
    }
  });
  await Promise.all(jobs);
  const xml = new XMLSerializer().serializeToString(clone);
  const save = (blob, ext) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name + '.' + ext;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  if (kind === 'html') {
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>' + name + '</title>' + (fontCss ? '<style>' + fontCss + '</style>' : '') + '</head><body style="margin:0">' + xml + '</body></html>';
    return save(new Blob([html], {
      type: 'text/html'
    }), 'html');
  }

  // PNG: the SVG's own width/height must be the output resolution — an
  // <img>-loaded SVG rasterizes at its intrinsic size, so sizing it at 1×
  // and ctx.scale()-ing up would just upscale a 1× bitmap. viewBox maps the
  // w×h foreignObject onto the px·w × px·h SVG canvas so the browser renders
  // the HTML at full resolution.
  const px = 3;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w * px + '" height="' + h * px + '" viewBox="0 0 ' + w + ' ' + h + '"><foreignObject width="' + w + '" height="' + h + '">' + (fontCss ? '<style><![CDATA[' + fontCss + ']]></style>' : '') + xml + '</foreignObject></svg>';
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = () => rej(new Error('svg load failed'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  const cv = document.createElement('canvas');
  cv.width = w * px;
  cv.height = h * px;
  cv.getContext('2d').drawImage(img, 0, 0);
  cv.toBlob(blob => save(blob, 'png'), 'image/png');
}
function DCArtboardFrame({
  sectionId,
  artboard,
  label,
  order,
  onRename,
  onReorder,
  onFocus,
  onDelete
}) {
  const {
    id: rawId,
    label: rawLabel,
    width = 260,
    height = 480,
    children,
    style = {}
  } = artboard.props;
  const id = rawId ?? rawLabel;
  const ref = React.useRef(null);
  const cardRef = React.useRef(null);
  const menuRef = React.useRef(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  // ⋯ menu: close on any outside pointerdown. Two-click delete lives inside
  // the menu — first click arms the row, second commits; closing disarms.
  React.useEffect(() => {
    if (!menuOpen) {
      setConfirming(false);
      return;
    }
    const off = e => {
      if (!menuRef.current || !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', off, true);
    return () => document.removeEventListener('pointerdown', off, true);
  }, [menuOpen]);
  const doExport = kind => {
    setMenuOpen(false);
    if (!cardRef.current) return;
    const name = String(label || id || 'artboard').replace(/[^\w\s.-]+/g, '_');
    dcExport(cardRef.current, width, height, name, kind).catch(e => console.error('[design-canvas] export failed:', e));
  };

  // Live drag-reorder: dragged card sticks to cursor; siblings slide into
  // their would-be slots in real time via transforms. DOM order only
  // changes on drop.
  const onGripDown = e => {
    e.preventDefault();
    e.stopPropagation();
    const me = ref.current;
    // translateX is applied in local (pre-scale) space but pointer deltas and
    // getBoundingClientRect().left are screen-space — divide by the viewport's
    // current scale so the dragged card tracks the cursor at any zoom level.
    const scale = me.getBoundingClientRect().width / me.offsetWidth || 1;
    const peers = Array.from(document.querySelectorAll(`[data-dc-section="${sectionId}"] [data-dc-slot]`));
    const homes = peers.map(el => ({
      el,
      id: el.dataset.dcSlot,
      x: el.getBoundingClientRect().left
    }));
    const slotXs = homes.map(h => h.x);
    const startIdx = order.indexOf(id);
    const startX = e.clientX;
    let liveOrder = order.slice();
    me.classList.add('dc-dragging');
    const layout = () => {
      for (const h of homes) {
        if (h.id === id) continue;
        const slot = liveOrder.indexOf(h.id);
        h.el.style.transform = `translateX(${(slotXs[slot] - h.x) / scale}px)`;
      }
    };
    const move = ev => {
      const dx = ev.clientX - startX;
      me.style.transform = `translateX(${dx / scale}px)`;
      const cur = homes[startIdx].x + dx;
      let nearest = 0,
        best = Infinity;
      for (let i = 0; i < slotXs.length; i++) {
        const d = Math.abs(slotXs[i] - cur);
        if (d < best) {
          best = d;
          nearest = i;
        }
      }
      if (liveOrder.indexOf(id) !== nearest) {
        liveOrder = order.filter(k => k !== id);
        liveOrder.splice(nearest, 0, id);
        layout();
      }
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      const finalSlot = liveOrder.indexOf(id);
      me.classList.remove('dc-dragging');
      me.style.transform = `translateX(${(slotXs[finalSlot] - homes[startIdx].x) / scale}px)`;
      // After the settle transition, kill transitions + clear transforms +
      // commit the reorder in the same frame so there's no visual snap-back.
      setTimeout(() => {
        for (const h of homes) {
          h.el.style.transition = 'none';
          h.el.style.transform = '';
        }
        if (liveOrder.join('|') !== order.join('|')) onReorder(liveOrder);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          for (const h of homes) h.el.style.transition = '';
        }));
      }, 180);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    "data-dc-slot": id,
    style: {
      position: 'relative',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "dc-header",
    style: {
      color: DC.label
    },
    onPointerDown: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "dc-labelrow"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dc-grip",
    onPointerDown: onGripDown,
    title: "Drag to reorder"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "9",
    height: "13",
    viewBox: "0 0 9 13",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "2",
    cy: "2",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "2",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "2",
    cy: "6.5",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "6.5",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "2",
    cy: "11",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "11",
    r: "1.1"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "dc-labeltext",
    onClick: onFocus,
    title: "Click to focus"
  }, /*#__PURE__*/React.createElement(DCEditable, {
    value: label,
    onChange: onRename,
    onClick: e => e.stopPropagation(),
    style: {
      fontSize: 15,
      fontWeight: 500,
      color: DC.label,
      lineHeight: 1
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "dc-btns"
  }, /*#__PURE__*/React.createElement("div", {
    ref: menuRef,
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "dc-kebab",
    title: "More",
    onClick: () => setMenuOpen(o => !o)
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 12 12",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "2.5",
    cy: "6",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "6",
    cy: "6",
    r: "1.1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "9.5",
    cy: "6",
    r: "1.1"
  }))), menuOpen && /*#__PURE__*/React.createElement("div", {
    className: "dc-menu",
    onPointerDown: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => doExport('png')
  }, "Download PNG"), /*#__PURE__*/React.createElement("button", {
    onClick: () => doExport('html')
  }, "Download HTML"), /*#__PURE__*/React.createElement("hr", null), /*#__PURE__*/React.createElement("button", {
    className: "dc-danger",
    onClick: () => {
      if (confirming) {
        setMenuOpen(false);
        onDelete();
      } else setConfirming(true);
    }
  }, confirming ? 'Click again to delete' : 'Delete'))), /*#__PURE__*/React.createElement("button", {
    className: "dc-expand",
    onClick: onFocus,
    title: "Focus"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 12 12",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M7 1h4v4M5 11H1V7M11 1L7.5 4.5M1 11l3.5-3.5"
  }))))), /*#__PURE__*/React.createElement("div", {
    ref: cardRef,
    className: "dc-card",
    style: {
      borderRadius: 2,
      boxShadow: '0 1px 3px rgba(0,0,0,.08),0 4px 16px rgba(0,0,0,.06)',
      overflow: 'hidden',
      width,
      height,
      background: '#fff',
      ...style
    }
  }, children || /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#bbb',
      fontSize: 13,
      fontFamily: DC.font
    }
  }, id)));
}

// Inline rename — commits on blur or Enter.
function DCEditable({
  value,
  onChange,
  style,
  tag = 'span',
  onClick
}) {
  const T = tag;
  return /*#__PURE__*/React.createElement(T, {
    className: "dc-editable",
    contentEditable: true,
    suppressContentEditableWarning: true,
    onClick: onClick,
    onPointerDown: e => e.stopPropagation(),
    onBlur: e => onChange && onChange(e.currentTarget.textContent),
    onKeyDown: e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.currentTarget.blur();
      }
    },
    style: style
  }, value);
}

// ─────────────────────────────────────────────────────────────
// Focus mode — overlay one artboard; ←/→ within section, ↑/↓ across
// sections, Esc or backdrop click to exit.
// ─────────────────────────────────────────────────────────────
function DCFocusOverlay({
  entry,
  sectionMeta,
  sectionOrder
}) {
  const ctx = React.useContext(DCCtx);
  const {
    sectionId,
    artboard
  } = entry;
  const sec = ctx.section(sectionId);
  const meta = sectionMeta[sectionId];
  const peers = meta.slotIds;
  const aid = artboard.props.id ?? artboard.props.label;
  const idx = peers.indexOf(aid);
  const secIdx = sectionOrder.indexOf(sectionId);
  const go = d => {
    const n = peers[(idx + d + peers.length) % peers.length];
    if (n) ctx.setFocus(`${sectionId}/${n}`);
  };
  const goSection = d => {
    // Sections whose artboards are all deleted have slotIds:[] — step past
    // them to the next non-empty section so ↑/↓ doesn't dead-end.
    const n = sectionOrder.length;
    for (let i = 1; i < n; i++) {
      const ns = sectionOrder[((secIdx + d * i) % n + n) % n];
      const first = sectionMeta[ns] && sectionMeta[ns].slotIds[0];
      if (first) {
        ctx.setFocus(`${ns}/${first}`);
        return;
      }
    }
  };
  React.useEffect(() => {
    const k = e => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(1);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        goSection(-1);
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        goSection(1);
      }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  });
  const {
    width = 260,
    height = 480,
    children
  } = artboard.props;
  const [vp, setVp] = React.useState({
    w: window.innerWidth,
    h: window.innerHeight
  });
  React.useEffect(() => {
    const r = () => setVp({
      w: window.innerWidth,
      h: window.innerHeight
    });
    window.addEventListener('resize', r);
    return () => window.removeEventListener('resize', r);
  }, []);
  const scale = Math.max(0.1, Math.min((vp.w - 200) / width, (vp.h - 260) / height, 2));
  const [ddOpen, setDd] = React.useState(false);
  const Arrow = ({
    dir,
    onClick
  }) => /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      onClick();
    },
    style: {
      position: 'absolute',
      top: '50%',
      [dir]: 28,
      transform: 'translateY(-50%)',
      border: 'none',
      background: 'rgba(255,255,255,.08)',
      color: 'rgba(255,255,255,.9)',
      width: 44,
      height: 44,
      borderRadius: 22,
      fontSize: 18,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background .15s'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'rgba(255,255,255,.18)',
    onMouseLeave: e => e.currentTarget.style.background = 'rgba(255,255,255,.08)'
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 18 18",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: dir === 'left' ? 'M11 3L5 9l6 6' : 'M7 3l6 6-6 6'
  })));

  // Portal to body so position:fixed is the real viewport regardless of any
  // transform on DesignCanvas's ancestors (including the canvas zoom itself).
  return ReactDOM.createPortal(/*#__PURE__*/React.createElement("div", {
    onClick: () => ctx.setFocus(null),
    onWheel: e => e.preventDefault(),
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'rgba(24,20,16,.6)',
      backdropFilter: 'blur(14px)',
      fontFamily: DC.font,
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 72,
      display: 'flex',
      alignItems: 'flex-start',
      padding: '16px 20px 0',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setDd(o => !o),
    style: {
      border: 'none',
      background: 'transparent',
      color: '#fff',
      cursor: 'pointer',
      padding: '6px 8px',
      borderRadius: 6,
      textAlign: 'left',
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 600,
      letterSpacing: -0.3
    }
  }, meta.title), /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 11 11",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    style: {
      opacity: .7
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 4l3.5 3.5L9 4"
  }))), meta.subtitle && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 13,
      opacity: .6,
      fontWeight: 400,
      marginTop: 2
    }
  }, meta.subtitle)), ddOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: '100%',
      left: 0,
      marginTop: 4,
      background: '#2a251f',
      borderRadius: 8,
      boxShadow: '0 8px 32px rgba(0,0,0,.4)',
      padding: 4,
      minWidth: 200,
      zIndex: 10
    }
  }, sectionOrder.filter(sid => sectionMeta[sid].slotIds.length).map(sid => /*#__PURE__*/React.createElement("button", {
    key: sid,
    onClick: () => {
      setDd(false);
      const f = sectionMeta[sid].slotIds[0];
      if (f) ctx.setFocus(`${sid}/${f}`);
    },
    style: {
      display: 'block',
      width: '100%',
      textAlign: 'left',
      border: 'none',
      cursor: 'pointer',
      background: sid === sectionId ? 'rgba(255,255,255,.1)' : 'transparent',
      color: '#fff',
      padding: '8px 12px',
      borderRadius: 5,
      fontSize: 14,
      fontWeight: sid === sectionId ? 600 : 400,
      fontFamily: 'inherit'
    }
  }, sectionMeta[sid].title)))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => ctx.setFocus(null),
    onMouseEnter: e => e.currentTarget.style.background = 'rgba(255,255,255,.12)',
    onMouseLeave: e => e.currentTarget.style.background = 'transparent',
    style: {
      border: 'none',
      background: 'transparent',
      color: 'rgba(255,255,255,.7)',
      width: 32,
      height: 32,
      borderRadius: 16,
      fontSize: 20,
      cursor: 'pointer',
      lineHeight: 1,
      transition: 'background .12s'
    }
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 64,
      bottom: 56,
      left: 100,
      right: 100,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: width * scale,
      height: height * scale,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width,
      height,
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
      background: '#fff',
      borderRadius: 2,
      overflow: 'hidden',
      boxShadow: '0 20px 80px rgba(0,0,0,.4)'
    }
  }, children || /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#bbb'
    }
  }, aid))), /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      fontSize: 14,
      fontWeight: 500,
      opacity: .85,
      textAlign: 'center'
    }
  }, (sec.labels || {})[aid] ?? artboard.props.label, /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: .5,
      marginLeft: 10,
      fontVariantNumeric: 'tabular-nums'
    }
  }, idx + 1, " / ", peers.length))), /*#__PURE__*/React.createElement(Arrow, {
    dir: "left",
    onClick: () => go(-1)
  }), /*#__PURE__*/React.createElement(Arrow, {
    dir: "right",
    onClick: () => go(1)
  }), /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      position: 'absolute',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: 8
    }
  }, peers.map((p, i) => /*#__PURE__*/React.createElement("button", {
    key: p,
    onClick: () => ctx.setFocus(`${sectionId}/${p}`),
    style: {
      border: 'none',
      padding: 0,
      cursor: 'pointer',
      width: 6,
      height: 6,
      borderRadius: 3,
      background: i === idx ? '#fff' : 'rgba(255,255,255,.3)'
    }
  })))), document.body);
}

// ─────────────────────────────────────────────────────────────
// Post-it — absolute-positioned sticky note
// ─────────────────────────────────────────────────────────────
function DCPostIt({
  children,
  top,
  left,
  right,
  bottom,
  rotate = -2,
  width = 180
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top,
      left,
      right,
      bottom,
      width,
      background: DC.postitBg,
      padding: '14px 16px',
      fontFamily: '"Comic Sans MS", "Marker Felt", "Segoe Print", cursive',
      fontSize: 14,
      lineHeight: 1.4,
      color: DC.postitText,
      boxShadow: '0 2px 8px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
      transform: `rotate(${rotate}deg)`,
      zIndex: 5
    }
  }, children);
}
Object.assign(window, {
  DesignCanvas,
  DCSection,
  DCArtboard,
  DCPostIt
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "design-canvas.jsx", error: String((e && e.message) || e) }); }

// feedback-pages.jsx
try { (() => {
/* eslint-disable */
/* global React, DesignCanvas, DCSection, DCArtboard */

const {
  useState
} = React;

// ────────────────────────────────────────────────────────────────────────────
//  Emerald Nocturne · Feedback System
//  Atoms shared across every state so the system stays consistent.
// ────────────────────────────────────────────────────────────────────────────

const TONE = {
  success: {
    label: "ÉXITO",
    fg: "#4edea3",
    fgSoft: "#9ed2b5",
    bg: "rgba(78, 222, 163, 0.10)",
    bgStrong: "rgba(78, 222, 163, 0.16)",
    border: "rgba(78, 222, 163, 0.28)",
    halo: "0 0 60px rgba(78, 222, 163, 0.35), 0 0 0 1px rgba(78, 222, 163, 0.22) inset"
  },
  error: {
    label: "ERROR",
    fg: "#ffb4ab",
    fgSoft: "#ffd4cf",
    bg: "rgba(255, 180, 171, 0.10)",
    bgStrong: "rgba(255, 180, 171, 0.16)",
    border: "rgba(255, 180, 171, 0.28)",
    halo: "0 0 60px rgba(255, 180, 171, 0.28), 0 0 0 1px rgba(255, 180, 171, 0.20) inset"
  },
  warning: {
    label: "ATENCIÓN",
    fg: "#fbbf24",
    fgSoft: "#fcd34d",
    bg: "rgba(251, 191, 36, 0.10)",
    bgStrong: "rgba(251, 191, 36, 0.16)",
    border: "rgba(251, 191, 36, 0.28)",
    halo: "0 0 60px rgba(251, 191, 36, 0.25), 0 0 0 1px rgba(251, 191, 36, 0.22) inset"
  },
  confirm: {
    label: "CONFIRMACIÓN",
    fg: "#bbcabf",
    fgSoft: "#e5e1e4",
    bg: "rgba(255, 255, 255, 0.04)",
    bgStrong: "rgba(255, 255, 255, 0.07)",
    border: "rgba(255, 255, 255, 0.10)",
    halo: "0 0 0 1px rgba(255, 255, 255, 0.06) inset"
  },
  destructive: {
    label: "ACCIÓN IRREVERSIBLE",
    fg: "#ffb4ab",
    fgSoft: "#ffd4cf",
    bg: "rgba(255, 180, 171, 0.08)",
    bgStrong: "rgba(255, 180, 171, 0.14)",
    border: "rgba(255, 180, 171, 0.22)",
    halo: "0 0 60px rgba(255, 180, 171, 0.22), 0 0 0 1px rgba(255, 180, 171, 0.20) inset"
  },
  empty: {
    label: "VACÍO",
    fg: "#86948a",
    fgSoft: "#bbcabf",
    bg: "rgba(255, 255, 255, 0.03)",
    bgStrong: "rgba(255, 255, 255, 0.06)",
    border: "rgba(255, 255, 255, 0.08)",
    halo: "0 0 0 1px rgba(255, 255, 255, 0.06) inset"
  }
};

// ── Page background — emerald orb + ultra-subtle grid ────────────────────────
const PageBg = ({
  children
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    position: "absolute",
    inset: 0,
    background: "#131315",
    overflow: "hidden"
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    position: "absolute",
    top: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "120%",
    height: "85%",
    background: "radial-gradient(ellipse at 50% -10%, rgba(78,222,163,0.18) 0%, rgba(19,19,21,0) 55%)",
    pointerEvents: "none"
  }
}), /*#__PURE__*/React.createElement("div", {
  style: {
    position: "absolute",
    inset: 0,
    backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
    backgroundSize: "60px 60px",
    pointerEvents: "none"
  }
}), /*#__PURE__*/React.createElement("div", {
  style: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 32px"
  }
}, children));

// ── Card shell ───────────────────────────────────────────────────────────────
const Card = ({
  children,
  width = 460
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    width,
    maxWidth: "100%",
    background: "#1c1b1d",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 36,
    boxShadow: "0 24px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)",
    display: "flex",
    flexDirection: "column",
    gap: 22
  }
}, children);

// ── Status icon — concentric ring with material symbol, optional halo ────────
const StatusIcon = ({
  tone,
  icon,
  halo = true,
  filled = false
}) => {
  const t = TONE[tone];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 72,
      height: 72,
      borderRadius: "50%",
      background: t.bg,
      border: `1px solid ${t.border}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: halo ? t.halo : "none",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: "50%",
      background: t.bgStrong,
      border: `1px solid ${t.border}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: t.fg
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined",
    style: {
      fontSize: 26,
      fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 500, 'GRAD' 0, 'opsz' 24`
    }
  }, icon)));
};

// ── Eyebrow chip ─────────────────────────────────────────────────────────────
const Eyebrow = ({
  tone,
  label
}) => {
  const t = TONE[tone];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 10px",
      borderRadius: 999,
      background: t.bg,
      border: `1px solid ${t.border}`,
      color: t.fg,
      fontFamily: "Inter, sans-serif",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      lineHeight: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 5,
      height: 5,
      borderRadius: "50%",
      background: t.fg,
      boxShadow: `0 0 8px ${t.fg}`
    }
  }), label || t.label);
};

// ── Heading & body type ──────────────────────────────────────────────────────
const H = ({
  children
}) => /*#__PURE__*/React.createElement("h1", {
  style: {
    fontFamily: "Manrope, sans-serif",
    fontSize: 26,
    fontWeight: 800,
    lineHeight: 1.15,
    letterSpacing: "-0.02em",
    color: "#e5e1e4",
    margin: 0
  }
}, children);
const P = ({
  children,
  dim = false,
  center = true
}) => /*#__PURE__*/React.createElement("p", {
  style: {
    fontFamily: "Inter, sans-serif",
    fontSize: 14.5,
    lineHeight: 1.55,
    color: dim ? "#86948a" : "#bbcabf",
    margin: 0,
    textAlign: center ? "center" : "left",
    textWrap: "pretty"
  }
}, children);

// ── Detail row used inside info cards ────────────────────────────────────────
const Row = ({
  label,
  value,
  icon,
  valueColor
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 13,
    fontFamily: "Inter, sans-serif"
  }
}, /*#__PURE__*/React.createElement("span", {
  style: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#86948a"
  }
}, icon && /*#__PURE__*/React.createElement("span", {
  className: "material-symbols-outlined",
  style: {
    fontSize: 16,
    fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20"
  }
}, icon), label), /*#__PURE__*/React.createElement("span", {
  style: {
    color: valueColor || "#e5e1e4",
    fontWeight: 500,
    textAlign: "right"
  }
}, value));

// ── Info / detail container ──────────────────────────────────────────────────
const InfoCard = ({
  children,
  tone,
  dense = false
}) => {
  const t = tone ? TONE[tone] : null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: t ? t.bg : "#131315",
      border: `1px solid ${t ? t.border : "rgba(255,255,255,0.06)"}`,
      borderRadius: 12,
      padding: dense ? "12px 14px" : "16px",
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, children);
};

// ── Buttons ──────────────────────────────────────────────────────────────────
const Btn = ({
  variant = "primary",
  icon,
  iconRight,
  children,
  tone
}) => {
  const t = tone ? TONE[tone] : TONE.success;
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    height: 44,
    borderRadius: 10,
    fontFamily: "Inter, sans-serif",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s ease",
    padding: "0 18px",
    fontFeatureSettings: "'tnum' 1"
  };
  if (variant === "primary") {
    return /*#__PURE__*/React.createElement("button", {
      style: {
        ...base,
        background: "linear-gradient(135deg, #4edea3, #10b981)",
        border: "none",
        color: "#003824",
        fontWeight: 700,
        boxShadow: "0 8px 24px -8px rgba(78,222,163,0.45)"
      }
    }, icon && /*#__PURE__*/React.createElement("span", {
      className: "material-symbols-outlined",
      style: {
        fontSize: 18
      }
    }, icon), children, iconRight && /*#__PURE__*/React.createElement("span", {
      className: "material-symbols-outlined",
      style: {
        fontSize: 18
      }
    }, iconRight));
  }
  if (variant === "danger") {
    return /*#__PURE__*/React.createElement("button", {
      style: {
        ...base,
        background: TONE.destructive.bgStrong,
        border: `1px solid ${TONE.destructive.border}`,
        color: TONE.destructive.fg
      }
    }, icon && /*#__PURE__*/React.createElement("span", {
      className: "material-symbols-outlined",
      style: {
        fontSize: 18
      }
    }, icon), children);
  }

  // ghost / secondary
  return /*#__PURE__*/React.createElement("button", {
    style: {
      ...base,
      background: "transparent",
      border: "1px solid rgba(255,255,255,0.10)",
      color: "#bbcabf"
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined",
    style: {
      fontSize: 18
    }
  }, icon), children, iconRight && /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined",
    style: {
      fontSize: 18
    }
  }, iconRight));
};

// ── Footer support link ──────────────────────────────────────────────────────
const Footer = ({
  children
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    paddingTop: 14,
    borderTop: "1px solid rgba(255,255,255,0.05)",
    fontFamily: "Inter, sans-serif",
    fontSize: 12,
    color: "#86948a",
    textAlign: "center",
    lineHeight: 1.5
  }
}, children);

// ────────────────────────────────────────────────────────────────────────────
//  Anatomy reference
// ────────────────────────────────────────────────────────────────────────────
const Anatomy = () => /*#__PURE__*/React.createElement(PageBg, null, /*#__PURE__*/React.createElement("div", {
  style: {
    display: "grid",
    gridTemplateColumns: "1fr 220px",
    gap: 40,
    alignItems: "center",
    maxWidth: 760
  }
}, /*#__PURE__*/React.createElement(Card, {
  width: 460
}, /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    justifyContent: "center"
  }
}, /*#__PURE__*/React.createElement(StatusIcon, {
  tone: "success",
  icon: "check"
})), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10
  }
}, /*#__PURE__*/React.createElement(Eyebrow, {
  tone: "success"
}), /*#__PURE__*/React.createElement(H, null, "T\xEDtulo de la acci\xF3n"), /*#__PURE__*/React.createElement(P, null, "Descripci\xF3n breve. Una o dos frases que aclaren lo que pas\xF3 y qu\xE9 puede hacer la persona a continuaci\xF3n.")), /*#__PURE__*/React.createElement(InfoCard, null, /*#__PURE__*/React.createElement(Row, {
  label: "Detalle clave",
  value: "Valor",
  icon: "info"
}), /*#__PURE__*/React.createElement(Row, {
  label: "Otro detalle",
  value: "Valor",
  icon: "calendar_month"
})), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    gap: 10
  }
}, /*#__PURE__*/React.createElement(Btn, {
  variant: "primary",
  iconRight: "arrow_forward"
}, "Acci\xF3n primaria"), /*#__PURE__*/React.createElement(Btn, {
  variant: "ghost"
}, "Acci\xF3n secundaria")), /*#__PURE__*/React.createElement(Footer, null, "\xBFNecesitas ayuda? ", /*#__PURE__*/React.createElement("span", {
  style: {
    color: "#4edea3"
  }
}, "contacto@gustavoai.dev"))), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    color: "#86948a",
    lineHeight: 1.5
  }
}, /*#__PURE__*/React.createElement(Spec, {
  n: "01",
  t: "Status icon",
  d: "72px halo, tone-tinted ring + filled centre. Material Symbols Outlined."
}), /*#__PURE__*/React.createElement(Spec, {
  n: "02",
  t: "Eyebrow chip",
  d: "Pill, 10/0.14em uppercase. Tone defines fg/bg."
}), /*#__PURE__*/React.createElement(Spec, {
  n: "03",
  t: "Title",
  d: "Manrope 800 / 26px / -0.02em"
}), /*#__PURE__*/React.createElement(Spec, {
  n: "04",
  t: "Description",
  d: "Inter 400 / 14.5px / 1.55. Max ~52ch."
}), /*#__PURE__*/React.createElement(Spec, {
  n: "05",
  t: "Detail card",
  d: "#131315 inset, 12px radius. Rows or notice."
}), /*#__PURE__*/React.createElement(Spec, {
  n: "06",
  t: "CTAs",
  d: "Primary gradient \u2192 Ghost. 44px tall, 10px radius."
}), /*#__PURE__*/React.createElement(Spec, {
  n: "07",
  t: "Helper",
  d: "Top border separator, 12px dim."
}))));
const Spec = ({
  n,
  t,
  d
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    gap: 10
  }
}, /*#__PURE__*/React.createElement("span", {
  style: {
    flexShrink: 0,
    width: 22,
    height: 22,
    borderRadius: 6,
    background: "rgba(78,222,163,0.10)",
    border: "1px solid rgba(78,222,163,0.25)",
    color: "#4edea3",
    fontSize: 10,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  }
}, n), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
  style: {
    color: "#e5e1e4",
    fontWeight: 600,
    fontSize: 12,
    marginBottom: 2
  }
}, t), /*#__PURE__*/React.createElement("div", null, d)));

// ────────────────────────────────────────────────────────────────────────────
//  SUCCESS
// ────────────────────────────────────────────────────────────────────────────

const SuccessPayment = () => /*#__PURE__*/React.createElement(PageBg, null, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    justifyContent: "center"
  }
}, /*#__PURE__*/React.createElement(StatusIcon, {
  tone: "success",
  icon: "check"
})), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10
  }
}, /*#__PURE__*/React.createElement(Eyebrow, {
  tone: "success",
  label: "PAGO CONFIRMADO"
}), /*#__PURE__*/React.createElement(H, null, "\xA1Pago completado!"), /*#__PURE__*/React.createElement(P, null, "Gracias, ", /*#__PURE__*/React.createElement("span", {
  style: {
    color: "#e5e1e4",
    fontWeight: 600
  }
}, "Mar\xEDa"), ". Tu Pack 8 ha sido activado correctamente.")), /*#__PURE__*/React.createElement(InfoCard, {
  tone: "success"
}, /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  }
}, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: "Manrope",
    fontSize: 22,
    fontWeight: 800,
    color: "#4edea3",
    lineHeight: 1
  }
}, "8 clases"), /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 11.5,
    color: "#bbcabf",
    marginTop: 4
  }
}, "disponibles en tu pack")), /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 11,
    color: "#bbcabf",
    padding: "5px 10px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.06)"
  }
}, "V\xE1lidas 6 meses"))), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    gap: 10
  }
}, /*#__PURE__*/React.createElement(Btn, {
  variant: "primary",
  iconRight: "arrow_forward"
}, "Reservar mis clases"), /*#__PURE__*/React.createElement(Btn, {
  variant: "ghost"
}, "Volver al inicio")), /*#__PURE__*/React.createElement(Footer, null, /*#__PURE__*/React.createElement("span", {
  className: "material-symbols-outlined",
  style: {
    fontSize: 13,
    verticalAlign: "-2px",
    marginRight: 4
  }
}, "mail"), "Te hemos enviado el recibo a maria@ejemplo.com")));
const SuccessCancelled = () => /*#__PURE__*/React.createElement(PageBg, null, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    justifyContent: "center"
  }
}, /*#__PURE__*/React.createElement(StatusIcon, {
  tone: "success",
  icon: "task_alt"
})), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10
  }
}, /*#__PURE__*/React.createElement(Eyebrow, {
  tone: "success",
  label: "RESERVA CANCELADA"
}), /*#__PURE__*/React.createElement(H, null, "Reserva cancelada"), /*#__PURE__*/React.createElement(P, null, "Tu sesi\xF3n del ", /*#__PURE__*/React.createElement("span", {
  style: {
    color: "#e5e1e4",
    fontWeight: 600
  }
}, "martes 18 de marzo \xB7 16:00"), " ha sido cancelada.")), /*#__PURE__*/React.createElement(InfoCard, {
  tone: "success"
}, /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10
  }
}, /*#__PURE__*/React.createElement("span", {
  className: "material-symbols-outlined",
  style: {
    fontSize: 18,
    color: "#4edea3",
    marginTop: 1
  }
}, "redeem"), /*#__PURE__*/React.createElement("div", {
  style: {
    flex: 1
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 13.5,
    fontWeight: 600,
    color: "#4edea3",
    marginBottom: 2
  }
}, "Cr\xE9dito devuelto al pack"), /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 12.5,
    color: "#bbcabf",
    lineHeight: 1.5
  }
}, "Te quedan ", /*#__PURE__*/React.createElement("strong", {
  style: {
    color: "#e5e1e4"
  }
}, "5 clases"), " disponibles. Reserva otra cuando quieras.")))), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    gap: 10
  }
}, /*#__PURE__*/React.createElement(Btn, {
  variant: "primary",
  icon: "calendar_add_on"
}, "Reservar otra clase"), /*#__PURE__*/React.createElement(Btn, {
  variant: "ghost"
}, "Volver al inicio")), /*#__PURE__*/React.createElement(Footer, null, "Recibir\xE1s confirmaci\xF3n por email en unos minutos.")));

// ────────────────────────────────────────────────────────────────────────────
//  ERROR
// ────────────────────────────────────────────────────────────────────────────

const ErrorBooking = () => /*#__PURE__*/React.createElement(PageBg, null, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    justifyContent: "center"
  }
}, /*#__PURE__*/React.createElement(StatusIcon, {
  tone: "error",
  icon: "error"
})), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10
  }
}, /*#__PURE__*/React.createElement(Eyebrow, {
  tone: "error",
  label: "ALGO SALI\xD3 MAL"
}), /*#__PURE__*/React.createElement(H, null, "No pudimos completar tu reserva"), /*#__PURE__*/React.createElement(P, null, "Fall\xF3 en el \xFAltimo paso. ", /*#__PURE__*/React.createElement("span", {
  style: {
    color: "#e5e1e4"
  }
}, "No se ha realizado ning\xFAn cargo"), " y el horario sigue disponible.")), /*#__PURE__*/React.createElement(InfoCard, null, /*#__PURE__*/React.createElement(Row, {
  label: "Estado",
  value: "No procesada",
  icon: "sync_problem",
  valueColor: "#ffb4ab"
}), /*#__PURE__*/React.createElement(Row, {
  label: "Referencia",
  value: "BK-2C4F9\xB71748",
  icon: "tag"
}), /*#__PURE__*/React.createElement(Row, {
  label: "Hora del intento",
  value: "Hace 12 segundos",
  icon: "schedule"
})), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    gap: 10
  }
}, /*#__PURE__*/React.createElement(Btn, {
  variant: "primary",
  icon: "refresh"
}, "Intentar de nuevo"), /*#__PURE__*/React.createElement(Btn, {
  variant: "ghost",
  iconRight: "arrow_forward"
}, "Elegir otro horario")), /*#__PURE__*/React.createElement(Footer, null, "\xBFSigue fallando? Escribe a", " ", /*#__PURE__*/React.createElement("span", {
  style: {
    color: "#4edea3"
  }
}, "contacto@gustavoai.dev"), " con la referencia.")));

// ────────────────────────────────────────────────────────────────────────────
//  WARNING
// ────────────────────────────────────────────────────────────────────────────

const WarningActivation = () => /*#__PURE__*/React.createElement(PageBg, null, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    justifyContent: "center"
  }
}, /*#__PURE__*/React.createElement(StatusIcon, {
  tone: "warning",
  icon: "hourglass_top"
})), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10
  }
}, /*#__PURE__*/React.createElement(Eyebrow, {
  tone: "warning",
  label: "ACTIVACI\xD3N EN CURSO"
}), /*#__PURE__*/React.createElement(H, null, "Esto est\xE1 tardando un poco m\xE1s"), /*#__PURE__*/React.createElement(P, null, "Tu pago lleg\xF3 correctamente. La activaci\xF3n de cr\xE9ditos suele tomar segundos, pero ocasionalmente puede demorar hasta dos minutos.")), /*#__PURE__*/React.createElement(InfoCard, {
  tone: "warning"
}, /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    gap: 10
  }
}, /*#__PURE__*/React.createElement(StepRow, {
  icon: "check",
  status: "done",
  label: "Pago verificado por Stripe",
  time: "hace 38 s"
}), /*#__PURE__*/React.createElement(StepRow, {
  icon: "sync",
  status: "loading",
  label: "Activando cr\xE9ditos en tu cuenta",
  time: "en curso"
}), /*#__PURE__*/React.createElement(StepRow, {
  icon: "mail",
  status: "pending",
  label: "Enviar confirmaci\xF3n por email"
}))), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    gap: 10
  }
}, /*#__PURE__*/React.createElement(Btn, {
  variant: "primary",
  icon: "refresh"
}, "Comprobar de nuevo"), /*#__PURE__*/React.createElement(Btn, {
  variant: "ghost",
  icon: "forum"
}, "Contactar con Gustavo")), /*#__PURE__*/React.createElement(Footer, null, "Tu pago est\xE1 seguro. Si no se resuelve en 5 minutos, te contactaremos.")));
const StepRow = ({
  icon,
  status,
  label,
  time
}) => {
  const map = {
    done: {
      color: "#4edea3",
      bg: "rgba(78,222,163,0.15)"
    },
    loading: {
      color: "#fbbf24",
      bg: "rgba(251,191,36,0.15)"
    },
    pending: {
      color: "#86948a",
      bg: "rgba(255,255,255,0.04)"
    }
  };
  const s = map[status];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 22,
      height: 22,
      borderRadius: 999,
      background: s.bg,
      color: s.color,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined",
    style: {
      fontSize: 14,
      animation: status === "loading" ? "spin 1.4s linear infinite" : "none"
    }
  }, icon)), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 13,
      color: status === "pending" ? "#86948a" : "#e5e1e4"
    }
  }, label), time && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "#86948a",
      fontFamily: "JetBrains Mono, monospace"
    }
  }, time), /*#__PURE__*/React.createElement("style", null, `@keyframes spin { to { transform: rotate(360deg); } }`));
};

// ────────────────────────────────────────────────────────────────────────────
//  CONFIRMATION
// ────────────────────────────────────────────────────────────────────────────

const ConfirmCancel = () => /*#__PURE__*/React.createElement(PageBg, null, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    justifyContent: "center"
  }
}, /*#__PURE__*/React.createElement(StatusIcon, {
  tone: "destructive",
  icon: "event_busy"
})), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10
  }
}, /*#__PURE__*/React.createElement(Eyebrow, {
  tone: "destructive",
  label: "CONFIRMACI\xD3N REQUERIDA"
}), /*#__PURE__*/React.createElement(H, null, "\xBFCancelar esta reserva?"), /*#__PURE__*/React.createElement(P, null, "Esta acci\xF3n no se puede deshacer.")), /*#__PURE__*/React.createElement(InfoCard, null, /*#__PURE__*/React.createElement(Row, {
  label: "Sesi\xF3n",
  value: "Sesi\xF3n Estrat\xE9gica \xB7 60 min",
  icon: "school"
}), /*#__PURE__*/React.createElement(Row, {
  label: "Fecha",
  value: "Martes 18 mar \xB7 16:00",
  icon: "calendar_month"
}), /*#__PURE__*/React.createElement(Row, {
  label: "Plataforma",
  value: "Google Meet",
  icon: "videocam"
}), /*#__PURE__*/React.createElement("div", {
  style: {
    height: 1,
    background: "rgba(255,255,255,0.05)",
    margin: "4px 0"
  }
}), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start"
  }
}, /*#__PURE__*/React.createElement("span", {
  className: "material-symbols-outlined",
  style: {
    fontSize: 16,
    color: "#4edea3",
    marginTop: 2
  }
}, "redeem"), /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 12.5,
    color: "#bbcabf",
    lineHeight: 1.55
  }
}, "Si cancelas, el cr\xE9dito vuelve a tu pack autom\xE1ticamente."))), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    gap: 10
  }
}, /*#__PURE__*/React.createElement(Btn, {
  variant: "danger",
  icon: "delete_outline"
}, "S\xED, cancelar reserva"), /*#__PURE__*/React.createElement(Btn, {
  variant: "ghost"
}, "Mantener reserva"))));
const ConfirmBooking = () => /*#__PURE__*/React.createElement(PageBg, null, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    justifyContent: "center"
  }
}, /*#__PURE__*/React.createElement(StatusIcon, {
  tone: "confirm",
  icon: "event_available"
})), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10
  }
}, /*#__PURE__*/React.createElement(Eyebrow, {
  tone: "confirm",
  label: "REVISAR Y CONFIRMAR"
}), /*#__PURE__*/React.createElement(H, null, "Confirmar tu reserva"), /*#__PURE__*/React.createElement(P, null, "Estos son los detalles. Recibir\xE1s confirmaci\xF3n por correo al confirmar.")), /*#__PURE__*/React.createElement(InfoCard, null, /*#__PURE__*/React.createElement(Row, {
  label: "Sesi\xF3n",
  value: "Sesi\xF3n Estrat\xE9gica",
  icon: "psychology"
}), /*#__PURE__*/React.createElement(Row, {
  label: "Cu\xE1ndo",
  value: "Jue 20 mar \xB7 18:00 \u2013 19:00",
  icon: "calendar_month"
}), /*#__PURE__*/React.createElement(Row, {
  label: "Duraci\xF3n",
  value: "60 minutos",
  icon: "timer"
}), /*#__PURE__*/React.createElement(Row, {
  label: "Zona horaria",
  value: "Madrid (GMT+1)",
  icon: "public"
})), /*#__PURE__*/React.createElement("div", {
  style: {
    background: "rgba(78,222,163,0.08)",
    border: "1px solid rgba(78,222,163,0.20)",
    borderRadius: 10,
    padding: "11px 14px",
    display: "flex",
    alignItems: "center",
    gap: 10
  }
}, /*#__PURE__*/React.createElement("span", {
  className: "material-symbols-outlined",
  style: {
    fontSize: 18,
    color: "#4edea3"
  }
}, "confirmation_number"), /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 13,
    color: "#4edea3",
    lineHeight: 1.4
  }
}, "Se descontar\xE1 ", /*#__PURE__*/React.createElement("strong", null, "1 clase"), " de tu pack.", /*#__PURE__*/React.createElement("span", {
  style: {
    color: "#bbcabf",
    fontSize: 12,
    display: "block",
    marginTop: 2
  }
}, "Te quedar\xE1n 4 clases disponibles."))), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    gap: 10
  }
}, /*#__PURE__*/React.createElement(Btn, {
  variant: "primary",
  icon: "check"
}, "Confirmar reserva"), /*#__PURE__*/React.createElement(Btn, {
  variant: "ghost"
}, "Elegir otro horario"))));

// ────────────────────────────────────────────────────────────────────────────
//  EMPTY
// ────────────────────────────────────────────────────────────────────────────

const EmptyBookings = () => /*#__PURE__*/React.createElement(PageBg, null, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    justifyContent: "center"
  }
}, /*#__PURE__*/React.createElement(StatusIcon, {
  tone: "empty",
  icon: "calendar_today",
  halo: false
})), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10
  }
}, /*#__PURE__*/React.createElement(Eyebrow, {
  tone: "empty",
  label: "TU AGENDA"
}), /*#__PURE__*/React.createElement(H, null, "A\xFAn no tienes clases reservadas"), /*#__PURE__*/React.createElement(P, null, "Cuando reserves una sesi\xF3n, aparecer\xE1 aqu\xED con todos los detalles para unirte.")), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    gap: 8
  }
}, /*#__PURE__*/React.createElement(SuggestionRow, {
  icon: "calculate",
  label: "Sesi\xF3n de matem\xE1ticas",
  sub: "60 min \xB7 \u20AC16"
}), /*#__PURE__*/React.createElement(SuggestionRow, {
  icon: "code",
  label: "Programaci\xF3n o algoritmos",
  sub: "60 min \xB7 \u20AC16"
}), /*#__PURE__*/React.createElement(SuggestionRow, {
  icon: "bolt",
  label: "Encuentro inicial",
  sub: "15 min \xB7 gratis",
  highlight: true
})), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    gap: 10
  }
}, /*#__PURE__*/React.createElement(Btn, {
  variant: "primary",
  iconRight: "arrow_forward"
}, "Reservar primera clase"), /*#__PURE__*/React.createElement(Btn, {
  variant: "ghost",
  icon: "schedule"
}, "Ver disponibilidad"))));
const SuggestionRow = ({
  icon,
  label,
  sub,
  highlight
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 10,
    background: highlight ? "rgba(78,222,163,0.06)" : "#131315",
    border: highlight ? "1px solid rgba(78,222,163,0.22)" : "1px solid rgba(255,255,255,0.05)",
    cursor: "pointer",
    transition: "border-color 0.15s"
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: highlight ? "rgba(78,222,163,0.12)" : "rgba(255,255,255,0.04)",
    color: highlight ? "#4edea3" : "#bbcabf",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  }
}, /*#__PURE__*/React.createElement("span", {
  className: "material-symbols-outlined",
  style: {
    fontSize: 18
  }
}, icon)), /*#__PURE__*/React.createElement("div", {
  style: {
    flex: 1,
    minWidth: 0
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 13.5,
    color: "#e5e1e4",
    fontWeight: 500
  }
}, label), /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 11.5,
    color: "#86948a",
    fontFamily: "JetBrains Mono, monospace",
    marginTop: 1
  }
}, sub)), /*#__PURE__*/React.createElement("span", {
  className: "material-symbols-outlined",
  style: {
    fontSize: 18,
    color: highlight ? "#4edea3" : "#86948a"
  }
}, "chevron_right"));
const EmptyAvailability = () => /*#__PURE__*/React.createElement(PageBg, null, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    justifyContent: "center"
  }
}, /*#__PURE__*/React.createElement(StatusIcon, {
  tone: "empty",
  icon: "event_busy",
  halo: false
})), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10
  }
}, /*#__PURE__*/React.createElement(Eyebrow, {
  tone: "empty",
  label: "SEMANA COMPLETA"
}), /*#__PURE__*/React.createElement(H, null, "No hay horarios disponibles esta semana"), /*#__PURE__*/React.createElement(P, null, "Gustavo ya tiene todas sus clases ocupadas hasta el pr\xF3ximo lunes.")), /*#__PURE__*/React.createElement(InfoCard, null, /*#__PURE__*/React.createElement(Row, {
  label: "Pr\xF3xima semana libre",
  value: "24 \u2013 30 marzo",
  icon: "event_upcoming",
  valueColor: "#4edea3"
}), /*#__PURE__*/React.createElement(Row, {
  label: "Huecos disponibles",
  value: "9 horarios",
  icon: "schedule"
})), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    gap: 10
  }
}, /*#__PURE__*/React.createElement(Btn, {
  variant: "primary",
  iconRight: "arrow_forward"
}, "Ver pr\xF3xima semana"), /*#__PURE__*/React.createElement(Btn, {
  variant: "ghost",
  icon: "notifications"
}, "Av\xEDsame cuando haya hueco")), /*#__PURE__*/React.createElement(Footer, null, "\xBFUrgente? Escribe a", " ", /*#__PURE__*/React.createElement("span", {
  style: {
    color: "#4edea3"
  }
}, "contacto@gustavoai.dev"))));

// ────────────────────────────────────────────────────────────────────────────
//  Canvas
// ────────────────────────────────────────────────────────────────────────────

const W = 760;
const H_ = 760;
function App() {
  return /*#__PURE__*/React.createElement(DesignCanvas, {
    title: "Emerald Nocturne \xB7 Unified Feedback System",
    subtitle: "Success \xB7 Error \xB7 Warning \xB7 Confirmation \xB7 Empty \u2014 one anatomy, five tones"
  }, /*#__PURE__*/React.createElement(DCSection, {
    id: "anatomy",
    title: "System anatomy"
  }, /*#__PURE__*/React.createElement(DCArtboard, {
    id: "anatomy-1",
    label: "The 7 parts of every feedback page",
    width: 920,
    height: H_
  }, /*#__PURE__*/React.createElement(Anatomy, null))), /*#__PURE__*/React.createElement(DCSection, {
    id: "success",
    title: "Success \u2014 reassuring and positive"
  }, /*#__PURE__*/React.createElement(DCArtboard, {
    id: "success-payment",
    label: "Payment completed \xB7 pack activation",
    width: W,
    height: H_
  }, /*#__PURE__*/React.createElement(SuccessPayment, null)), /*#__PURE__*/React.createElement(DCArtboard, {
    id: "success-cancelled",
    label: "Booking cancelled \xB7 credit returned",
    width: W,
    height: H_
  }, /*#__PURE__*/React.createElement(SuccessCancelled, null))), /*#__PURE__*/React.createElement(DCSection, {
    id: "error",
    title: "Error \u2014 calm and actionable"
  }, /*#__PURE__*/React.createElement(DCArtboard, {
    id: "error-booking",
    label: "Booking failed \xB7 retry available",
    width: W,
    height: H_
  }, /*#__PURE__*/React.createElement(ErrorBooking, null))), /*#__PURE__*/React.createElement(DCSection, {
    id: "warning",
    title: "Warning \u2014 noticeable but not alarming"
  }, /*#__PURE__*/React.createElement(DCArtboard, {
    id: "warning-activation",
    label: "Activation delayed \xB7 in progress",
    width: W,
    height: H_
  }, /*#__PURE__*/React.createElement(WarningActivation, null))), /*#__PURE__*/React.createElement(DCSection, {
    id: "confirmation",
    title: "Confirmation \u2014 focused and low-friction"
  }, /*#__PURE__*/React.createElement(DCArtboard, {
    id: "confirm-cancel",
    label: "Destructive \xB7 cancel booking",
    width: W,
    height: H_
  }, /*#__PURE__*/React.createElement(ConfirmCancel, null)), /*#__PURE__*/React.createElement(DCArtboard, {
    id: "confirm-booking",
    label: "Positive \xB7 confirm new booking",
    width: W,
    height: H_
  }, /*#__PURE__*/React.createElement(ConfirmBooking, null))), /*#__PURE__*/React.createElement(DCSection, {
    id: "empty",
    title: "Empty state \u2014 helpful and motivating"
  }, /*#__PURE__*/React.createElement(DCArtboard, {
    id: "empty-bookings",
    label: "No bookings yet \xB7 with suggestions",
    width: W,
    height: H_
  }, /*#__PURE__*/React.createElement(EmptyBookings, null)), /*#__PURE__*/React.createElement(DCArtboard, {
    id: "empty-availability",
    label: "No availability \xB7 push to next week",
    width: W,
    height: H_
  }, /*#__PURE__*/React.createElement(EmptyAvailability, null))));
}
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "feedback-pages.jsx", error: String((e && e.message) || e) }); }

// post-class-review.jsx
try { (() => {
/* eslint-disable */
/* global React, ReactDOM, TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakSelect, TweakToggle */

const {
  useState,
  useEffect,
  useRef,
  useMemo
} = React;

// ── Brand constants ─────────────────────────────────────────────────────────
const GREEN = "#4edea3";
const GREEN_DEEP = "#10b981";
const GREEN_ON = "#003824";
const TEXT = "#e5e1e4";
const TEXT_MUTED = "#bbcabf";
const TEXT_DIM = "#86948a";
const SURFACE = "#131315";
const SURFACE_LOW = "#1c1b1d";
const BORDER = "rgba(255,255,255,0.06)";

// ── Rating content table ────────────────────────────────────────────────────
const RATINGS = [{
  value: 1,
  emoji: "😞",
  icon: "sentiment_very_dissatisfied",
  label: "Lo siento mucho",
  placeholder: "¿Qué podría haber sido mejor? Tu opinión me ayuda a mejorar."
}, {
  value: 2,
  emoji: "😕",
  icon: "sentiment_dissatisfied",
  label: "No fue lo que esperaba",
  placeholder: "¿Qué podría haber sido mejor? Tu opinión me ayuda a mejorar."
}, {
  value: 3,
  emoji: "😐",
  icon: "sentiment_neutral",
  label: "Estuvo bien",
  placeholder: "¿Hay algo concreto que podría hacer diferente la próxima vez?"
}, {
  value: 4,
  emoji: "🙂",
  icon: "sentiment_satisfied",
  label: "Muy buena clase",
  placeholder: "¿Qué te resultó más útil de la clase de hoy?"
}, {
  value: 5,
  emoji: "🤩",
  icon: "sentiment_very_satisfied",
  label: "¡Excelente!",
  placeholder: "¿Qué destacarías? Si das tu permiso, podría publicarse en mi perfil."
}];

// ── Top context strip ───────────────────────────────────────────────────────
function ClassContext({
  subject,
  duration,
  when
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "10px 16px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid " + BORDER,
      fontFamily: "Inter, sans-serif",
      fontSize: 12.5,
      color: TEXT_DIM,
      animation: "pcrFadeUp 0.6s ease both"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: GREEN,
      boxShadow: "0 0 12px " + GREEN
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: TEXT_MUTED
    }
  }, "Clase finalizada"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "rgba(255,255,255,0.10)"
    }
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, subject), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "rgba(255,255,255,0.10)"
    }
  }, "\xB7"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "JetBrains Mono, monospace",
      fontSize: 11.5
    }
  }, when, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "rgba(255,255,255,0.15)"
    }
  }, "\xB7"), " ", duration, " min"));
}

// ── Student avatar (centered, the "you" in this moment) ─────────────────────
function StudentAvatar({
  initials = "MR"
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 64,
      height: 64,
      animation: "pcrFadeUp 0.5s ease both"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: -8,
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(78,222,163,0.22) 0%, rgba(78,222,163,0) 65%)",
      pointerEvents: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: "100%",
      height: "100%",
      borderRadius: "50%",
      background: "radial-gradient(circle at 35% 30%, #4edea3 0%, #10b981 55%, #0a5d3f 100%)",
      border: "1px solid rgba(78,222,163,0.45)",
      boxShadow: "0 8px 28px -8px rgba(78,222,163,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: GREEN_ON,
      fontFamily: "Manrope, sans-serif",
      fontWeight: 800,
      fontSize: 22,
      letterSpacing: "-0.02em"
    }
  }, initials));
}

// ── A single rating face button ─────────────────────────────────────────────
function FaceButton({
  rating,
  selected,
  hovered,
  anySelected,
  anyHovered,
  style,
  onSelect,
  onHover,
  onLeave
}) {
  const isActive = selected === rating.value;
  const isHovered = hovered === rating.value;
  // dimming: if something else is selected/hovered, this one fades
  const dim = anySelected != null && !isActive || anySelected == null && anyHovered != null && !isHovered;
  const lift = isActive || isHovered;
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Valoración " + rating.value + " de 5: " + rating.label,
    onClick: () => onSelect(rating.value),
    onMouseEnter: () => onHover(rating.value),
    onMouseLeave: onLeave,
    onFocus: () => onHover(rating.value),
    onBlur: onLeave,
    style: {
      all: "unset",
      cursor: "pointer",
      width: 64,
      height: 64,
      borderRadius: 999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: isActive ? "rgba(78,222,163,0.10)" : isHovered ? "rgba(255,255,255,0.04)" : "transparent",
      border: isActive ? "1px solid rgba(78,222,163,0.45)" : "1px solid rgba(255,255,255,0.04)",
      boxShadow: isActive ? "0 0 32px rgba(78,222,163,0.22)" : "none",
      transform: lift ? "scale(1.12)" : "scale(1)",
      opacity: dim ? 0.32 : 1,
      filter: dim ? "saturate(0.4)" : "none",
      transition: "transform 0.22s cubic-bezier(.34,1.4,.5,1), opacity 0.18s ease, filter 0.18s ease, background 0.18s ease, border-color 0.18s ease, box-shadow 0.22s ease",
      ...style
    }
  }, style && style.iconMode ? null : null, /*#__PURE__*/React.createElement(FaceGlyph, {
    rating: rating,
    isActive: isActive,
    isHovered: isHovered,
    mode: style?.mode
  }));
}
function FaceGlyph({
  rating,
  isActive,
  mode
}) {
  if (mode === "icons") {
    // Material Symbols variant — emerald-tinted, fills + slight weight bump when active
    return /*#__PURE__*/React.createElement("span", {
      className: "material-symbols-outlined",
      style: {
        fontSize: 36,
        color: isActive ? GREEN : TEXT_MUTED,
        fontVariationSettings: "'FILL' " + (isActive ? 1 : 0) + ", 'wght' " + (isActive ? 500 : 300) + ", 'GRAD' 0, 'opsz' 40",
        transition: "color 0.18s ease, font-variation-settings 0.18s ease"
      }
    }, rating.icon);
  }
  // Emoji variant
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 36,
      lineHeight: 1,
      // soft drop so emoji read on dark bg without looking like stickers
      filter: isActive ? "drop-shadow(0 2px 14px rgba(78,222,163,0.35))" : "drop-shadow(0 1px 6px rgba(0,0,0,0.5))",
      transition: "filter 0.2s ease"
    }
  }, rating.emoji);
}

// ── Rating row ──────────────────────────────────────────────────────────────
function RatingRow({
  selected,
  onSelect,
  mode
}) {
  const [hovered, setHovered] = useState(null);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 14,
      justifyContent: "center",
      padding: "8px 4px"
    },
    onMouseLeave: () => setHovered(null)
  }, RATINGS.map(r => /*#__PURE__*/React.createElement(FaceButton, {
    key: r.value,
    rating: r,
    selected: selected,
    hovered: hovered,
    anySelected: selected,
    anyHovered: hovered,
    style: {
      mode
    },
    onSelect: onSelect,
    onHover: setHovered,
    onLeave: () => setHovered(null)
  })));
}

// ── Dynamic label below faces ───────────────────────────────────────────────
function RatingLabel({
  rating
}) {
  const text = rating ? RATINGS.find(r => r.value === rating)?.label : "Toca una carita para valorar";
  return /*#__PURE__*/React.createElement("div", {
    key: text /* re-trigger animation when text changes */,
    style: {
      minHeight: 28,
      textAlign: "center",
      fontFamily: "Manrope, sans-serif",
      fontWeight: rating ? 700 : 500,
      fontSize: rating ? 17 : 14,
      color: rating ? TEXT : TEXT_DIM,
      letterSpacing: rating ? "-0.01em" : "0",
      animation: "pcrFadeIn 0.35s ease both",
      transition: "color 0.2s ease"
    }
  }, text);
}

// ── Comment area (textarea + send) ──────────────────────────────────────────
function CommentArea({
  rating,
  value,
  onChange,
  onSubmit,
  sending
}) {
  const placeholder = RATINGS.find(r => r.value === rating)?.placeholder || "";
  const taRef = useRef(null);
  const hasText = value.trim().length > 0;

  // auto-resize
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }, [value]);

  // focus on mount
  useEffect(() => {
    const id = setTimeout(() => taRef.current?.focus(), 320);
    return () => clearTimeout(id);
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      animation: "pcrFadeUp 0.45s 0.05s ease both"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      background: "rgba(255,255,255,0.025)",
      borderRadius: 18,
      padding: "18px 20px 14px",
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04), 0 8px 28px rgba(0,0,0,0.25)",
      transition: "box-shadow 0.2s ease, background 0.2s ease"
    }
  }, /*#__PURE__*/React.createElement("textarea", {
    ref: taRef,
    value: value,
    onChange: e => onChange(e.target.value),
    placeholder: placeholder,
    rows: 2,
    style: {
      width: "100%",
      background: "transparent",
      border: "none",
      outline: "none",
      resize: "none",
      color: TEXT,
      fontFamily: "Inter, sans-serif",
      fontSize: 15,
      lineHeight: 1.6,
      minHeight: 56
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 4,
      paddingTop: 10,
      borderTop: "1px solid rgba(255,255,255,0.04)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "Inter, sans-serif",
      fontSize: 11.5,
      color: TEXT_DIM,
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined",
    style: {
      fontSize: 14,
      color: TEXT_DIM
    }
  }, "lock"), "La valoraci\xF3n es privada"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onSubmit,
    disabled: !hasText || sending,
    style: {
      all: "unset",
      cursor: hasText && !sending ? "pointer" : "default",
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "8px 16px",
      borderRadius: 999,
      fontFamily: "Inter, sans-serif",
      fontSize: 13,
      fontWeight: 700,
      color: hasText ? GREEN_ON : TEXT_DIM,
      background: hasText ? "linear-gradient(135deg, #4edea3, #10b981)" : "rgba(255,255,255,0.04)",
      boxShadow: hasText ? "0 6px 20px -6px rgba(78,222,163,0.55)" : "none",
      opacity: hasText ? 1 : 0,
      transform: hasText ? "translateY(0)" : "translateY(6px)",
      pointerEvents: hasText && !sending ? "auto" : "none",
      transition: "opacity 0.25s ease, transform 0.25s ease, box-shadow 0.2s ease, background 0.2s ease"
    }
  }, sending ? "Enviando…" : "Enviar", !sending && /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined",
    style: {
      fontSize: 16
    }
  }, "arrow_forward")))));
}

// ── Animated check ──────────────────────────────────────────────────────────
function AnimatedCheck() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 84,
      height: 84,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      animation: "pcrFadeIn 0.3s ease both"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      borderRadius: "50%",
      background: "rgba(78,222,163,0.10)",
      boxShadow: "0 0 60px rgba(78,222,163,0.35)",
      animation: "pcrPulse 1.8s ease-out 0.4s both"
    }
  }), /*#__PURE__*/React.createElement("svg", {
    width: "84",
    height: "84",
    viewBox: "0 0 84 84",
    fill: "none"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "42",
    cy: "42",
    r: "34",
    stroke: GREEN,
    strokeWidth: "2",
    strokeLinecap: "round",
    style: {
      strokeDasharray: 220,
      strokeDashoffset: 220,
      animation: "pcrDraw 0.55s 0.05s cubic-bezier(.65,0,.35,1) forwards",
      transformOrigin: "center",
      transform: "rotate(-90deg)"
    }
  }), /*#__PURE__*/React.createElement("path", {
    d: "M27 43 L38 54 L58 33",
    stroke: GREEN,
    strokeWidth: "3",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      strokeDasharray: 60,
      strokeDashoffset: 60,
      animation: "pcrDraw 0.35s 0.5s cubic-bezier(.65,0,.35,1) forwards"
    }
  })));
}

// ── Google review card (appears after thanks for high ratings) ──────────────
function GooglePrompt({
  onAccept,
  onDecline
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      maxWidth: 460,
      marginTop: 24,
      padding: "20px 22px",
      background: "rgba(255,255,255,0.03)",
      border: "1px solid " + BORDER,
      borderRadius: 18,
      display: "flex",
      flexDirection: "column",
      gap: 14,
      animation: "pcrFadeUp 0.5s ease both",
      boxShadow: "0 12px 36px rgba(0,0,0,0.25)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 10,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid " + BORDER,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 48 48",
    "aria-hidden": true
  }, /*#__PURE__*/React.createElement("path", {
    fill: "#EA4335",
    d: "M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
  }), /*#__PURE__*/React.createElement("path", {
    fill: "#4285F4",
    d: "M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
  }), /*#__PURE__*/React.createElement("path", {
    fill: "#FBBC05",
    d: "M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
  }), /*#__PURE__*/React.createElement("path", {
    fill: "#34A853",
    d: "M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "Manrope, sans-serif",
      fontSize: 16,
      fontWeight: 700,
      color: TEXT,
      letterSpacing: "-0.01em",
      marginBottom: 4
    }
  }, "\xBFLo compartes tambi\xE9n en Google?"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "Inter, sans-serif",
      fontSize: 13.5,
      color: TEXT_MUTED,
      lineHeight: 1.55
    }
  }, "Ayuda a otros estudiantes a encontrarme. Tarda menos de un minuto."))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onAccept,
    style: {
      all: "unset",
      cursor: "pointer",
      flex: 1,
      textAlign: "center",
      padding: "11px 16px",
      borderRadius: 10,
      background: "linear-gradient(135deg, #4edea3, #10b981)",
      color: GREEN_ON,
      fontFamily: "Inter, sans-serif",
      fontWeight: 700,
      fontSize: 13.5,
      boxShadow: "0 8px 24px -8px rgba(78,222,163,0.55)",
      transition: "filter 0.15s ease, transform 0.15s ease",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8
    },
    onMouseEnter: e => e.currentTarget.style.filter = "brightness(1.08)",
    onMouseLeave: e => e.currentTarget.style.filter = "brightness(1)"
  }, "Dejar rese\xF1a en Google", /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined",
    style: {
      fontSize: 16
    }
  }, "open_in_new")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onDecline,
    style: {
      all: "unset",
      cursor: "pointer",
      padding: "11px 14px",
      fontFamily: "Inter, sans-serif",
      fontSize: 13,
      color: TEXT_DIM,
      transition: "color 0.15s ease"
    },
    onMouseEnter: e => e.currentTarget.style.color = TEXT_MUTED,
    onMouseLeave: e => e.currentTarget.style.color = TEXT_DIM
  }, "No, gracias")));
}

// ── Skip / Continue link (always visible until done) ────────────────────────
function SkipLink({
  label,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    style: {
      all: "unset",
      cursor: "pointer",
      fontFamily: "Inter, sans-serif",
      fontSize: 13,
      color: TEXT_DIM,
      padding: "8px 14px",
      borderRadius: 999,
      transition: "color 0.15s ease, background 0.15s ease",
      display: "inline-flex",
      alignItems: "center",
      gap: 6
    },
    onMouseEnter: e => {
      e.currentTarget.style.color = TEXT_MUTED;
      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
    },
    onMouseLeave: e => {
      e.currentTarget.style.color = TEXT_DIM;
      e.currentTarget.style.background = "transparent";
    }
  }, label, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined",
    style: {
      fontSize: 15
    }
  }, "arrow_forward"));
}

// ── Backdrop (orb + grid) ───────────────────────────────────────────────────
function Backdrop() {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: SURFACE,
      zIndex: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      top: 0,
      left: "50%",
      transform: "translateX(-50%)",
      width: "120%",
      height: "85vh",
      background: "radial-gradient(ellipse at 50% -10%, rgba(78,222,163,0.18) 0%, rgba(19,19,21,0) 55%)",
      pointerEvents: "none",
      zIndex: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
      backgroundSize: "60px 60px",
      pointerEvents: "none",
      zIndex: 0
    }
  }));
}

// ── Closing screen (after No thanks / done) ─────────────────────────────────
function ClosingScreen({
  onReplay
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 18,
      animation: "pcrFadeIn 0.4s ease both"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "Manrope, sans-serif",
      fontSize: 22,
      fontWeight: 700,
      color: TEXT,
      letterSpacing: "-0.01em"
    }
  }, "Hasta la pr\xF3xima clase."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "Inter, sans-serif",
      fontSize: 14,
      color: TEXT_DIM
    }
  }, "Cerrando la sesi\xF3n\u2026"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onReplay,
    style: {
      all: "unset",
      cursor: "pointer",
      marginTop: 12,
      fontFamily: "Inter, sans-serif",
      fontSize: 12,
      color: TEXT_DIM,
      textDecoration: "underline",
      textUnderlineOffset: 3
    }
  }, "Reiniciar flujo (demo)"));
}

// ── Main screen ─────────────────────────────────────────────────────────────
function ReviewScreen({
  initialState,
  mode,
  subject,
  duration,
  when
}) {
  // states: rating → comment → thanks → google → done
  const [phase, setPhase] = useState(initialState || "rating");
  const [rating, setRating] = useState(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  // Sync external (Tweaks) initial-state changes
  useEffect(() => {
    setPhase(initialState || "rating");
    if (initialState === "thanks" || initialState === "google") {
      // synthesize a plausible rating so labels make sense
      if (!rating) setRating(initialState === "google" ? 5 : 4);
    }
    if (initialState === "rating") {
      setRating(null);
      setComment("");
    }
    // eslint-disable-next-line
  }, [initialState]);

  // After "thanks" with high rating, auto-show Google prompt at +2s
  useEffect(() => {
    if (phase === "thanks" && rating != null && rating >= 4) {
      const id = setTimeout(() => setPhase("google"), 2000);
      return () => clearTimeout(id);
    }
  }, [phase, rating]);
  const handleSelect = v => {
    setRating(v);
    if (phase === "rating") setPhase("comment");
  };
  const handleSubmit = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setPhase("thanks");
    }, 500);
  };
  const handleSkip = () => {
    setPhase("thanks");
  };
  const handleReplay = () => {
    setPhase("rating");
    setRating(null);
    setComment("");
  };

  // ── Render by phase ──
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      zIndex: 1,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "min(8vh, 64px) 24px 32px",
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement("div", {
    "aria-hidden": true,
    style: {
      height: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "1 1 auto",
      width: "100%",
      maxWidth: 560,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 28,
      padding: "32px 0"
    }
  }, (phase === "rating" || phase === "comment") && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StudentAvatar, {
    initials: "MR"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "Manrope, sans-serif",
      fontSize: "clamp(26px, 4.6vw, 38px)",
      fontWeight: 800,
      lineHeight: 1.15,
      letterSpacing: "-0.025em",
      color: TEXT,
      textAlign: "center",
      textWrap: "balance",
      margin: 0,
      animation: "pcrFadeUp 0.55s ease both"
    }
  }, "\xBFC\xF3mo ha ido tu clase?"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 14,
      animation: "pcrFadeUp 0.6s 0.1s ease both"
    }
  }, /*#__PURE__*/React.createElement(RatingRow, {
    selected: rating,
    onSelect: handleSelect,
    mode: mode
  }), /*#__PURE__*/React.createElement(RatingLabel, {
    rating: rating
  })), phase === "comment" && /*#__PURE__*/React.createElement(CommentArea, {
    rating: rating,
    value: comment,
    onChange: setComment,
    onSubmit: handleSubmit,
    sending: sending
  })), (phase === "thanks" || phase === "google") && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 22
    }
  }, /*#__PURE__*/React.createElement(AnimatedCheck, null), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "Manrope, sans-serif",
      fontSize: "clamp(26px, 4.4vw, 36px)",
      fontWeight: 800,
      color: TEXT,
      letterSpacing: "-0.025em",
      lineHeight: 1.15,
      margin: 0,
      animation: "pcrFadeUp 0.45s 0.25s ease both"
    }
  }, "\xA1Gracias!"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "Inter, sans-serif",
      fontSize: 15,
      color: TEXT_MUTED,
      maxWidth: 380,
      textAlign: "center",
      lineHeight: 1.55,
      margin: 0,
      animation: "pcrFadeUp 0.45s 0.35s ease both"
    }
  }, rating != null && rating >= 4 ? "Tu opinión me ayuda a mejorar." : "Tu opinión me ayuda a mejorar."), phase === "google" && /*#__PURE__*/React.createElement(GooglePrompt, {
    onAccept: () => {
      window.open("https://www.google.com/search?q=gustavoai+reseñas", "_blank");
      setTimeout(() => setPhase("done"), 200);
    },
    onDecline: () => setPhase("done")
  })), phase === "done" && /*#__PURE__*/React.createElement(ClosingScreen, {
    onReplay: handleReplay
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 44,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, (phase === "rating" || phase === "comment") && /*#__PURE__*/React.createElement(SkipLink, {
    label: "Saltar",
    onClick: handleSkip
  }), phase === "thanks" && rating != null && rating >= 4 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "Inter, sans-serif",
      fontSize: 12,
      color: TEXT_DIM,
      animation: "pcrFadeIn 0.4s ease both"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: GREEN,
      marginRight: 8,
      verticalAlign: "middle",
      animation: "pcrDot 1.4s ease-in-out infinite"
    }
  }), "un momento\u2026"), phase === "thanks" && rating != null && rating < 4 && /*#__PURE__*/React.createElement(SkipLink, {
    label: "Continuar",
    onClick: () => setPhase("done")
  }), phase === "google" && /*#__PURE__*/React.createElement(SkipLink, {
    label: "Continuar sin rese\xF1a",
    onClick: () => setPhase("done")
  })));
}

// ── Top-level app w/ Tweaks ─────────────────────────────────────────────────
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "mode": "emoji",
  "subject": "Programación",
  "duration": 60,
  "initialState": "rating"
} /*EDITMODE-END*/;
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // bumping `key` resets the phase machine when reviewer picks a new initial state
  const stateKey = t.initialState + "|" + t.subject;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Backdrop, null), /*#__PURE__*/React.createElement(ReviewScreen, {
    key: stateKey,
    initialState: t.initialState,
    mode: t.mode,
    subject: t.subject,
    duration: t.duration,
    when: "14:00"
  }), /*#__PURE__*/React.createElement(TweaksPanel, {
    title: "Tweaks"
  }, /*#__PURE__*/React.createElement(TweakSection, {
    label: "Rating style"
  }, /*#__PURE__*/React.createElement(TweakRadio, {
    label: "Style",
    value: t.mode,
    onChange: v => setTweak("mode", v),
    options: [{
      value: "emoji",
      label: "Emoji"
    }, {
      value: "icons",
      label: "Icons"
    }]
  })), /*#__PURE__*/React.createElement(TweakSection, {
    label: "Class"
  }, /*#__PURE__*/React.createElement(TweakSelect, {
    label: "Subject",
    value: t.subject,
    onChange: v => setTweak("subject", v),
    options: [{
      value: "Programación",
      label: "Programación"
    }, {
      value: "Matemáticas",
      label: "Matemáticas"
    }, {
      value: "IA y Machine Learning",
      label: "IA / ML"
    }, {
      value: "Sesión Estratégica",
      label: "Sesión Estratégica"
    }]
  })), /*#__PURE__*/React.createElement(TweakSection, {
    label: "Preview state"
  }, /*#__PURE__*/React.createElement(TweakSelect, {
    label: "Phase",
    value: t.initialState,
    onChange: v => setTweak("initialState", v),
    options: [{
      value: "rating",
      label: "1 · Rating (initial)"
    }, {
      value: "comment",
      label: "2 · Comment open"
    }, {
      value: "thanks",
      label: "3 · Thank you"
    }, {
      value: "google",
      label: "4 · Google prompt"
    }, {
      value: "done",
      label: "5 · Closing"
    }]
  }))));
}
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "post-class-review.jsx", error: String((e && e.message) || e) }); }

// src/app/admin/bookings/page.tsx
try { (() => {
/**
 * ADMIN-01: Admin bookings list — all bookings ordered by start time (most recent first).
 */

function formatDateTime(iso) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
function statusBadge(status) {
  const classes = {
    confirmed: "bg-primary/10 text-primary",
    cancelled: "bg-white/10 text-white/40",
    completed: "bg-blue-500/10 text-blue-400",
    no_show: "bg-red-500/10 text-red-400"
  };
  return /*#__PURE__*/React.createElement("span", {
    className: `rounded px-2 py-0.5 text-xs ${classes[status] ?? "bg-white/10 text-white/40"}`
  }, status);
}
async function BookingsPage() {
  const bookings = await __ds_scope.fetchAllBookings();
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    className: "mb-6 text-2xl font-bold"
  }, "Reservas"), /*#__PURE__*/React.createElement("p", {
    className: "mb-3 text-xs text-white/30"
  }, "Mostrando hasta 100 reservas m\xE1s recientes."), bookings.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-white/40"
  }, "No hay reservas.") : /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto rounded-lg border border-white/10"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-white/10 bg-[#1e1e20] text-left text-xs text-white/40"
  }, /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Alumno"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Tipo"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Inicio"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Fin"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Estado"))), /*#__PURE__*/React.createElement("tbody", null, bookings.map(b => /*#__PURE__*/React.createElement("tr", {
    key: b.id,
    className: "border-b border-white/5 hover:bg-white/3 transition-colors"
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, /*#__PURE__*/React.createElement(Link, {
    href: `/admin/students/${encodeURIComponent(b.email)}`,
    className: "text-primary hover:underline"
  }, b.email)), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-white/70"
  }, b.session_type), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-white/50"
  }, formatDateTime(b.starts_at)), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-white/50"
  }, formatDateTime(b.ends_at)), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, statusBadge(b.status))))))));
}
Object.assign(__ds_scope, { BookingsPage });
})(); } catch (e) { __ds_ns.__errors.push({ path: "src/app/admin/bookings/page.tsx", error: String((e && e.message) || e) }); }

// src/app/admin/failed-bookings/page.tsx
try { (() => {
/**
 * ADMIN-01: Failed bookings (dead-letter) UI.
 * Uses paymentService.listFailedBookings() and the existing retry API (REL-03).
 */

function formatDateTime(iso) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
async function FailedBookingsPage() {
  const entries = await paymentService.listFailedBookings();
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    className: "mb-6 text-2xl font-bold"
  }, "Reservas fallidas"), entries.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-white/40"
  }, "Sin reservas fallidas.") : /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto rounded-lg border border-white/10"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-white/10 bg-[#1e1e20] text-left text-xs text-white/40"
  }, /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Fecha fallo"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Alumno"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Slot"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Error"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Acci\xF3n"))), /*#__PURE__*/React.createElement("tbody", null, entries.map(e => /*#__PURE__*/React.createElement("tr", {
    key: e.stripeSessionId,
    className: "border-b border-white/5"
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-white/50 whitespace-nowrap"
  }, formatDateTime(e.failedAt)), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-white/70"
  }, e.email), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-white/50 whitespace-nowrap"
  }, formatDateTime(e.startIso)), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-red-400 text-xs max-w-xs truncate",
    title: e.error
  }, e.error), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, /*#__PURE__*/React.createElement(RetryButton, {
    stripeSessionId: e.stripeSessionId
  }))))))));
}
Object.assign(__ds_scope, { FailedBookingsPage });
})(); } catch (e) { __ds_ns.__errors.push({ path: "src/app/admin/failed-bookings/page.tsx", error: String((e && e.message) || e) }); }

// src/app/admin/layout.tsx
try { (() => {
/**
 * ADMIN-01: Protected admin layout.
 * Redirects non-admins to "/" using the isAdmin helper (REL-03).
 */

const metadata = {
  title: "Admin — gustavoai.dev"
};
async function AdminLayout({
  children
}) {
  const session = await auth();
  if (!isAdmin(session)) {
    redirect("/");
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "min-h-screen bg-[#131315] text-white"
  }, /*#__PURE__*/React.createElement(AdminNav, {
    email: session.user.email
  }), /*#__PURE__*/React.createElement("main", {
    className: "mx-auto max-w-7xl px-6 py-8"
  }, children));
}
Object.assign(__ds_scope, { metadata, AdminLayout });
})(); } catch (e) { __ds_ns.__errors.push({ path: "src/app/admin/layout.tsx", error: String((e && e.message) || e) }); }

// src/app/admin/page.tsx
try { (() => {
/**
 * ADMIN-01: Admin dashboard home — 4 key metric cards.
 */

async function AdminDashboard() {
  const [upcoming, lowCredit, failed, revenueCents] = await Promise.all([__ds_scope.countUpcomingBookings(), __ds_scope.countStudentsWithLowCredits(), __ds_scope.countFailedBookings(), __ds_scope.sumRevenueLast30Days()]);
  const revenue = (revenueCents / 100).toFixed(2);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    className: "mb-6 text-2xl font-bold"
  }, "Panel de control"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-4 md:grid-cols-4"
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Sesiones pr\xF3ximas",
    value: upcoming,
    href: "/admin/bookings"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Alumnos con pocos cr\xE9ditos",
    value: lowCredit,
    href: "/admin/students?filter=low-credit",
    tone: lowCredit > 0 ? "alert" : "neutral"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Reservas fallidas",
    value: failed,
    href: "/admin/failed-bookings",
    tone: failed > 0 ? "alert" : "neutral"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Ingresos (30 d\xEDas)",
    value: `€${revenue}`,
    href: "/admin/payments"
  })));
}
Object.assign(__ds_scope, { AdminDashboard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "src/app/admin/page.tsx", error: String((e && e.message) || e) }); }

// src/app/admin/payments/page.tsx
try { (() => {
/**
 * ADMIN-01: Payment history — last 100 payments with 30-day revenue total.
 */

function formatDateTime(iso) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
function statusBadge(status) {
  const classes = {
    succeeded: "bg-primary/10 text-primary",
    pending: "bg-yellow-500/10 text-yellow-400",
    refunded: "bg-blue-500/10 text-blue-400",
    failed: "bg-red-500/10 text-red-400"
  };
  return /*#__PURE__*/React.createElement("span", {
    className: `rounded px-2 py-0.5 text-xs ${classes[status] ?? "bg-white/10 text-white/40"}`
  }, status);
}
async function PaymentsPage() {
  const [payments, revenueCents] = await Promise.all([__ds_scope.fetchPayments(), __ds_scope.sumRevenueLast30Days()]);
  const revenue = (revenueCents / 100).toFixed(2);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "mb-6 flex items-baseline gap-6"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "text-2xl font-bold"
  }, "Pagos"), /*#__PURE__*/React.createElement("span", {
    className: "text-sm text-white/40"
  }, "Ingresos \xFAltimos 30 d\xEDas:", " ", /*#__PURE__*/React.createElement("span", {
    className: "font-semibold text-primary"
  }, "\u20AC", revenue))), /*#__PURE__*/React.createElement("p", {
    className: "mb-3 text-xs text-white/30"
  }, "Mostrando hasta 100 pagos m\xE1s recientes."), payments.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-white/40"
  }, "No hay pagos.") : /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto rounded-lg border border-white/10"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-white/10 bg-[#1e1e20] text-left text-xs text-white/40"
  }, /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Fecha"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Alumno"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Tipo"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3 text-right"
  }, "Importe"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Estado"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Stripe ID"))), /*#__PURE__*/React.createElement("tbody", null, payments.map(p => /*#__PURE__*/React.createElement("tr", {
    key: p.id,
    className: "border-b border-white/5 hover:bg-white/3 transition-colors"
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-white/50 whitespace-nowrap"
  }, formatDateTime(p.created_at)), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-white/70"
  }, p.email), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-white/50"
  }, p.checkout_type), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-right font-mono"
  }, "\u20AC", (p.amount_cents / 100).toFixed(2)), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, statusBadge(p.status)), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-white/30 text-xs font-mono truncate max-w-[140px]",
    title: p.stripe_payment_id
  }, p.stripe_payment_id)))))));
}
Object.assign(__ds_scope, { PaymentsPage });
})(); } catch (e) { __ds_ns.__errors.push({ path: "src/app/admin/payments/page.tsx", error: String((e && e.message) || e) }); }

// src/app/admin/students/[email]/page.tsx
try { (() => {
/**
 * ADMIN-01: Student detail page — credit packs, bookings, audit log, and credit adjustment.
 */

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}
function formatDateTime(iso) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
function statusBadge(status) {
  const classes = {
    confirmed: "bg-primary/10 text-primary",
    cancelled: "bg-white/10 text-white/40",
    completed: "bg-blue-500/10 text-blue-400",
    no_show: "bg-red-500/10 text-red-400"
  };
  return /*#__PURE__*/React.createElement("span", {
    className: `rounded px-2 py-0.5 text-xs ${classes[status] ?? "bg-white/10 text-white/40"}`
  }, status);
}
async function StudentDetailPage({
  params
}) {
  const {
    email: rawEmail
  } = await params;
  const email = decodeURIComponent(rawEmail);
  const [student, packs, bookings, audit] = await Promise.all([__ds_scope.fetchStudent(email), __ds_scope.fetchCreditPacks(email), __ds_scope.fetchStudentBookings(email), __ds_scope.fetchAuditLog(email)]);
  if (!student) notFound();
  return /*#__PURE__*/React.createElement("div", {
    className: "space-y-8"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Link, {
    href: "/admin/students",
    className: "text-xs text-white/40 hover:text-white/70"
  }, "\u2190 Alumnos"), /*#__PURE__*/React.createElement("h1", {
    className: "mt-2 text-2xl font-bold"
  }, student.name), /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-white/40"
  }, student.email)), /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement("h2", {
    className: "mb-3 text-lg font-semibold"
  }, "Cr\xE9ditos"), packs.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-white/40"
  }, "Sin packs de cr\xE9ditos.") : /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto rounded-lg border border-white/10"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-white/10 bg-[#1e1e20] text-left text-xs text-white/40"
  }, /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Pack"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3 text-right"
  }, "Restantes"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Caduca"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Comprado"))), /*#__PURE__*/React.createElement("tbody", null, packs.map(p => {
    const expired = new Date(p.expires_at) < new Date();
    return /*#__PURE__*/React.createElement("tr", {
      key: p.id,
      className: `border-b border-white/5 ${expired ? "opacity-40" : ""}`
    }, /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3 text-white/70"
    }, p.pack_size, " sesiones"), /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3 text-right font-mono"
    }, p.credits_remaining), /*#__PURE__*/React.createElement("td", {
      className: `px-4 py-3 ${expired ? "text-red-400" : "text-white/50"}`
    }, formatDate(p.expires_at), " ", expired && "(vencido)"), /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-3 text-white/50"
    }, formatDate(p.created_at)));
  })))), /*#__PURE__*/React.createElement(AdjustCreditsForm, {
    email: email
  })), /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement("h2", {
    className: "mb-3 text-lg font-semibold"
  }, "Reservas"), bookings.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-white/40"
  }, "Sin reservas.") : /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto rounded-lg border border-white/10"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-white/10 bg-[#1e1e20] text-left text-xs text-white/40"
  }, /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Tipo"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Inicio"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Fin"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Estado"))), /*#__PURE__*/React.createElement("tbody", null, bookings.map(b => /*#__PURE__*/React.createElement("tr", {
    key: b.id,
    className: "border-b border-white/5"
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-white/70"
  }, b.session_type), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-white/50"
  }, formatDateTime(b.starts_at)), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-white/50"
  }, formatDateTime(b.ends_at)), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, statusBadge(b.status)))))))), /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement("h2", {
    className: "mb-3 text-lg font-semibold"
  }, "Historial"), audit.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-white/40"
  }, "Sin entradas.") : /*#__PURE__*/React.createElement("div", {
    className: "rounded-lg border border-white/10 divide-y divide-white/5"
  }, audit.map((entry, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "flex items-start gap-4 px-4 py-3 text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-36 shrink-0 text-xs text-white/30"
  }, entry.ts ? formatDateTime(entry.ts) : "—"), /*#__PURE__*/React.createElement("span", {
    className: "rounded bg-white/5 px-1.5 py-0.5 text-xs text-white/60"
  }, entry.action), /*#__PURE__*/React.createElement("span", {
    className: "text-white/40 text-xs font-mono break-all"
  }, Object.entries(entry).filter(([k]) => k !== "action" && k !== "ts").map(([k, v]) => `${k}: ${v}`).join(" · ")))))));
}
Object.assign(__ds_scope, { StudentDetailPage });
})(); } catch (e) { __ds_ns.__errors.push({ path: "src/app/admin/students/[email]/page.tsx", error: String((e && e.message) || e) }); }

// src/app/admin/students/page.tsx
try { (() => {
/**
 * ADMIN-01: Student list with optional low-credit filter.
 */

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}
function formatDateTime(iso) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
async function StudentsPage({
  searchParams
}) {
  const {
    filter
  } = await searchParams;
  const students = await __ds_scope.fetchStudents(filter);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "mb-6 flex items-center justify-between"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "text-2xl font-bold"
  }, "Alumnos"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 text-sm"
  }, /*#__PURE__*/React.createElement(Link, {
    href: "/admin/students",
    className: `rounded px-3 py-1.5 transition-colors ${!filter ? "bg-primary/10 text-primary" : "text-white/50 hover:text-white"}`
  }, "Todos"), /*#__PURE__*/React.createElement(Link, {
    href: "/admin/students?filter=low-credit",
    className: `rounded px-3 py-1.5 transition-colors ${filter === "low-credit" ? "bg-red-500/10 text-red-400" : "text-white/50 hover:text-white"}`
  }, "Pocos cr\xE9ditos"))), /*#__PURE__*/React.createElement("p", {
    className: "mb-3 text-xs text-white/30"
  }, "Mostrando ", students.length, " ", filter === "low-credit" ? "alumnos con ≤1 crédito" : `de hasta 100 alumnos`), students.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-white/40"
  }, "No hay alumnos.") : /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto rounded-lg border border-white/10"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-sm"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-white/10 bg-[#1e1e20] text-left text-xs text-white/40"
  }, /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Email"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Nombre"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3 text-right"
  }, "Cr\xE9ditos"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Caduca"), /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-3"
  }, "Pr\xF3x. sesi\xF3n"))), /*#__PURE__*/React.createElement("tbody", null, students.map(s => /*#__PURE__*/React.createElement("tr", {
    key: s.email,
    className: "border-b border-white/5 hover:bg-white/3 transition-colors"
  }, /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3"
  }, /*#__PURE__*/React.createElement(Link, {
    href: `/admin/students/${encodeURIComponent(s.email)}`,
    className: "text-primary hover:underline"
  }, s.email)), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-white/70"
  }, s.name), /*#__PURE__*/React.createElement("td", {
    className: `px-4 py-3 text-right font-mono ${s.totalCredits <= 1 ? "text-red-400" : "text-white"}`
  }, s.totalCredits), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-white/50"
  }, s.earliestExpiry ? formatDate(s.earliestExpiry) : "—"), /*#__PURE__*/React.createElement("td", {
    className: "px-4 py-3 text-white/50"
  }, s.nextSession ? formatDateTime(s.nextSession) : "—")))))));
}
Object.assign(__ds_scope, { StudentsPage });
})(); } catch (e) { __ds_ns.__errors.push({ path: "src/app/admin/students/page.tsx", error: String((e && e.message) || e) }); }

// src/components/admin/AdjustCreditsForm.tsx
try { (() => {
/**
 * ADMIN-01: Client component for adjusting a student's credit balance.
 * POSTs to /api/admin/students/[email] and reloads the page on success.
 */
"use client";

const {
  useState
} = React;
function AdjustCreditsForm({
  email
}) {
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  async function submit() {
    if (!reason.trim()) {
      setError("La razón es obligatoria.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/students/${encodeURIComponent(email)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "adjust_credits",
          amount,
          reason: reason.trim()
        })
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Error al ajustar créditos.");
      }
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "mt-4 rounded-lg border border-white/10 bg-[#1e1e20] p-4"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "mb-3 text-sm font-medium text-white/70"
  }, "Ajustar cr\xE9ditos"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap items-end gap-3"
  }, /*#__PURE__*/React.createElement("label", {
    className: "flex flex-col gap-1 text-xs text-white/50"
  }, "Cantidad (+/\u2212)", /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: amount,
    onChange: e => setAmount(parseInt(e.target.value, 10) || 0),
    className: "w-24 rounded border border-white/10 bg-[#131315] px-2 py-1.5 text-sm text-white focus:border-primary focus:outline-none"
  })), /*#__PURE__*/React.createElement("label", {
    className: "flex flex-1 flex-col gap-1 text-xs text-white/50"
  }, "Raz\xF3n (se registra en el historial)", /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: reason,
    onChange: e => setReason(e.target.value),
    placeholder: "Ej: Correcci\xF3n manual por error de cobro",
    className: "rounded border border-white/10 bg-[#131315] px-2 py-1.5 text-sm text-white focus:border-primary focus:outline-none"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    disabled: loading,
    className: "rounded bg-primary px-4 py-1.5 text-sm font-medium text-[#131315] transition-opacity hover:opacity-80 disabled:opacity-40"
  }, loading ? "Guardando…" : "Ajustar")), error && /*#__PURE__*/React.createElement("p", {
    className: "mt-2 text-xs text-red-400"
  }, error));
}
Object.assign(__ds_scope, { AdjustCreditsForm });
})(); } catch (e) { __ds_ns.__errors.push({ path: "src/components/admin/AdjustCreditsForm.tsx", error: String((e && e.message) || e) }); }

// src/components/admin/AdminNav.tsx
try { (() => {
/**
 * ADMIN-01: Admin navigation bar.
 */
"use client";

const NAV_LINKS = [{
  href: "/admin",
  label: "Panel"
}, {
  href: "/admin/students",
  label: "Alumnos"
}, {
  href: "/admin/bookings",
  label: "Reservas"
}, {
  href: "/admin/failed-bookings",
  label: "Fallidas"
}, {
  href: "/admin/payments",
  label: "Pagos"
}];
function AdminNav({
  email
}) {
  const pathname = usePathname();
  return /*#__PURE__*/React.createElement("nav", {
    className: "flex items-center gap-1 px-6 py-3 bg-[#1e1e20] border-b border-white/10"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-primary font-bold mr-4 text-sm tracking-wide uppercase"
  }, "Admin"), NAV_LINKS.map(link => {
    const active = pathname === link.href || link.href !== "/admin" && pathname.startsWith(link.href);
    return /*#__PURE__*/React.createElement(Link, {
      key: link.href,
      href: link.href,
      className: `px-3 py-1.5 rounded text-sm transition-colors ${active ? "bg-primary/10 text-primary font-medium" : "text-white/60 hover:text-white hover:bg-white/5"}`
    }, link.label);
  }), /*#__PURE__*/React.createElement("span", {
    className: "ml-auto text-xs text-white/40"
  }, email));
}
Object.assign(__ds_scope, { AdminNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "src/components/admin/AdminNav.tsx", error: String((e && e.message) || e) }); }

// src/components/admin/RetryButton.tsx
try { (() => {
/**
 * ADMIN-01: Client component to retry a failed booking.
 * POSTs to the existing /api/admin/failed-bookings endpoint (REL-03).
 */
"use client";

const {
  useState
} = React;
function RetryButton({
  stripeSessionId
}) {
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState(null);
  async function retry() {
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/failed-bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          stripeSessionId
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setStatus("ok");
        setMessage("Procesado correctamente.");
      } else {
        setStatus("error");
        setMessage(data.error ?? "Error al reintentar.");
      }
    } catch {
      setStatus("error");
      setMessage("Error de red.");
    }
  }
  if (status === "ok") {
    return /*#__PURE__*/React.createElement("span", {
      className: "text-xs text-primary"
    }, "\u2713 ", message);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col items-start gap-1"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: retry,
    disabled: status === "loading",
    className: "rounded border border-white/10 px-3 py-1 text-xs text-white/70 transition-colors hover:border-white/30 hover:text-white disabled:opacity-40"
  }, status === "loading" ? "Reintentando…" : "Reintentar"), status === "error" && message && /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-red-400"
  }, message));
}
Object.assign(__ds_scope, { RetryButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "src/components/admin/RetryButton.tsx", error: String((e && e.message) || e) }); }

// src/components/admin/StatCard.tsx
try { (() => {
/**
 * ADMIN-01: Dashboard metric card.
 */

function StatCard({
  label,
  value,
  href,
  tone = "neutral"
}) {
  const isAlert = tone === "alert";
  return /*#__PURE__*/React.createElement(Link, {
    href: href,
    className: `block rounded-lg border p-5 transition-colors hover:border-white/20 ${isAlert ? "border-red-500/40 bg-red-950/20" : "border-white/10 bg-[#1e1e20]"}`
  }, /*#__PURE__*/React.createElement("div", {
    className: `text-2xl font-bold ${isAlert ? "text-red-400" : "text-primary"}`
  }, value), /*#__PURE__*/React.createElement("div", {
    className: "mt-1 text-sm text-white/50"
  }, label));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "src/components/admin/StatCard.tsx", error: String((e && e.message) || e) }); }

// tweaks-panel.jsx
try { (() => {
// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;width:100%;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null ? keyOrEdits : {
      [keyOrEdits]: val
    };
    setValues(prev => ({
      ...prev,
      ...edits
    }));
    window.parent.postMessage({
      type: '__edit_mode_set_keys',
      edits
    }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', {
      detail: edits
    }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({
  title = 'Tweaks',
  noDeckControls = false,
  children
}) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  // Auto-inject a rail toggle when a <deck-stage> is on the page. The
  // toggle drives the deck's per-viewer _railVisible via window message;
  // state is mirrored from the same localStorage key the deck reads so
  // the control reflects reality across reloads. The mechanism is the
  // message — authors who want custom placement can post it directly
  // and pass noDeckControls to suppress this one.
  const hasDeckStage = React.useMemo(() => typeof document !== 'undefined' && !!document.querySelector('deck-stage'), []);
  // Hide the toggle until the host has actually enabled the rail (the
  // __omelette_rail_enabled window message, posted only when the
  // omelette_deck_rail_enabled flag is on for this user). The initial read
  // covers TweaksPanel mounting after the message already arrived; the
  // listener covers the common case of mounting first.
  const [railEnabled, setRailEnabled] = React.useState(() => hasDeckStage && !!document.querySelector('deck-stage')?._railEnabled);
  React.useEffect(() => {
    if (!hasDeckStage || railEnabled) return undefined;
    const onMsg = e => {
      if (e.data && e.data.type === '__omelette_rail_enabled') setRailEnabled(true);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [hasDeckStage, railEnabled]);
  const [railVisible, setRailVisible] = React.useState(() => {
    try {
      return localStorage.getItem('deck-stage.railVisible') !== '0';
    } catch (e) {
      return true;
    }
  });
  const toggleRail = on => {
    setRailVisible(on);
    window.postMessage({
      type: '__deck_rail_visible',
      on
    }, '*');
  };
  const offsetRef = React.useRef({
    x: 16,
    y: 16
  });
  const PAD = 16;
  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth,
      h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y))
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);
  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);
  React.useEffect(() => {
    const onMsg = e => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({
      type: '__edit_mode_available'
    }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({
      type: '__edit_mode_dismissed'
    }, '*');
  };
  const onDragStart = e => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX,
      sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = ev => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy)
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("style", null, __TWEAKS_STYLE), /*#__PURE__*/React.createElement("div", {
    ref: dragRef,
    className: "twk-panel",
    "data-noncommentable": "",
    style: {
      right: offsetRef.current.x,
      bottom: offsetRef.current.y
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-hd",
    onMouseDown: onDragStart
  }, /*#__PURE__*/React.createElement("b", null, title), /*#__PURE__*/React.createElement("button", {
    className: "twk-x",
    "aria-label": "Close tweaks",
    onMouseDown: e => e.stopPropagation(),
    onClick: dismiss
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "twk-body"
  }, children, hasDeckStage && railEnabled && !noDeckControls && /*#__PURE__*/React.createElement(TweakSection, {
    label: "Deck"
  }, /*#__PURE__*/React.createElement(TweakToggle, {
    label: "Thumbnail rail",
    value: railVisible,
    onChange: toggleRail
  })))));
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "twk-sect"
  }, label), children);
}
function TweakRow({
  label,
  value,
  children,
  inline = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: inline ? 'twk-row twk-row-h' : 'twk-row'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label), value != null && /*#__PURE__*/React.createElement("span", {
    className: "twk-val"
  }, value)), children);
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label,
    value: `${value}${unit}`
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "twk-slider",
    min: min,
    max: max,
    step: step,
    value: value,
    onChange: e => onChange(Number(e.target.value))
  }));
}
function TweakToggle({
  label,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-row twk-row-h"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "twk-toggle",
    "data-on": value ? '1' : '0',
    role: "switch",
    "aria-checked": !!value,
    onClick: () => onChange(!value)
  }, /*#__PURE__*/React.createElement("i", null)));
}
function TweakRadio({
  label,
  value,
  options,
  onChange
}) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = o => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({
    2: 16,
    3: 10
  }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = s => {
      const m = options.find(o => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return /*#__PURE__*/React.createElement(TweakSelect, {
      label: label,
      value: value,
      options: options,
      onChange: s => onChange(resolve(s))
    });
  }
  const opts = options.map(o => typeof o === 'object' ? o : {
    value: o,
    label: o
  });
  const idx = Math.max(0, opts.findIndex(o => o.value === value));
  const n = opts.length;
  const segAt = clientX => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor((clientX - r.left - 2) / inner * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };
  const onPointerDown = e => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = ev => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    ref: trackRef,
    role: "radiogroup",
    onPointerDown: onPointerDown,
    className: dragging ? 'twk-seg dragging' : 'twk-seg'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-seg-thumb",
    style: {
      left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
      width: `calc((100% - 4px) / ${n})`
    }
  }), opts.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    type: "button",
    role: "radio",
    "aria-checked": o.value === value
  }, o.label))));
}
function TweakSelect({
  label,
  value,
  options,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("select", {
    className: "twk-field",
    value: value,
    onChange: e => onChange(e.target.value)
  }, options.map(o => {
    const v = typeof o === 'object' ? o.value : o;
    const l = typeof o === 'object' ? o.label : o;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })));
}
function TweakText({
  label,
  value,
  placeholder,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("input", {
    className: "twk-field",
    type: "text",
    value: value,
    placeholder: placeholder,
    onChange: e => onChange(e.target.value)
  }));
}
function TweakNumber({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange
}) {
  const clamp = n => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({
    x: 0,
    val: 0
  });
  const onScrubStart = e => {
    e.preventDefault();
    startRef.current = {
      x: e.clientX,
      val: value
    };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = ev => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-num"
  }, /*#__PURE__*/React.createElement("span", {
    className: "twk-num-lbl",
    onPointerDown: onScrubStart
  }, label), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: value,
    min: min,
    max: max,
    step: step,
    onChange: e => onChange(clamp(Number(e.target.value)))
  }), unit && /*#__PURE__*/React.createElement("span", {
    className: "twk-num-unit"
  }, unit));
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, c => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = n >> 16 & 255,
    g = n >> 8 & 255,
    b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}
const __TwkCheck = ({
  light
}) => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 14 14",
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("path", {
  d: "M3 7.2 5.8 10 11 4.2",
  fill: "none",
  strokeWidth: "2.2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  stroke: light ? 'rgba(0,0,0,.78)' : '#fff'
}));

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({
  label,
  value,
  options,
  onChange
}) {
  if (!options || !options.length) {
    return /*#__PURE__*/React.createElement("div", {
      className: "twk-row twk-row-h"
    }, /*#__PURE__*/React.createElement("div", {
      className: "twk-lbl"
    }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("input", {
      type: "color",
      className: "twk-swatch",
      value: value,
      onChange: e => onChange(e.target.value)
    }));
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = o => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-chips",
    role: "radiogroup"
  }, options.map((o, i) => {
    const colors = Array.isArray(o) ? o : [o];
    const [hero, ...rest] = colors;
    const sup = rest.slice(0, 4);
    const on = key(o) === cur;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      className: "twk-chip",
      role: "radio",
      "aria-checked": on,
      "data-on": on ? '1' : '0',
      "aria-label": colors.join(', '),
      title: colors.join(' · '),
      style: {
        background: hero
      },
      onClick: () => onChange(o)
    }, sup.length > 0 && /*#__PURE__*/React.createElement("span", null, sup.map((c, j) => /*#__PURE__*/React.createElement("i", {
      key: j,
      style: {
        background: c
      }
    }))), on && /*#__PURE__*/React.createElement(__TwkCheck, {
      light: __twkIsLight(hero)
    }));
  })));
}
function TweakButton({
  label,
  onClick,
  secondary = false
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: secondary ? 'twk-btn secondary' : 'twk-btn',
    onClick: onClick
  }, label);
}
Object.assign(window, {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRow,
  TweakSlider,
  TweakToggle,
  TweakRadio,
  TweakSelect,
  TweakText,
  TweakNumber,
  TweakColor,
  TweakButton
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "tweaks-panel.jsx", error: String((e && e.message) || e) }); }

// ui_kits/tutoring-platform/ChatWidget.jsx
try { (() => {
// ChatWidget.jsx — GustavoAI Design System
// Matches: src/components/Chat.tsx + src/app/globals.css chat styles

function ChatWidget() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState([{
    role: "bot",
    text: "¡Hola! Soy el asistente virtual de Gustavo. ¿En qué puedo ayudarte?"
  }]);
  const [input, setInput] = React.useState("");
  const messagesEndRef = React.useRef(null);
  const SUGGESTIONS = ["¿Cuánto cuesta una clase?", "¿Qué materias imparte?", "¿Cómo reservo?"];
  const sendMessage = text => {
    const msg = text || input.trim();
    if (!msg) return;
    setMessages(prev => [...prev, {
      role: "user",
      text: msg
    }]);
    setInput("");
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: "bot",
        text: "Puedes encontrar toda la información en la página, o reservar una sesión gratuita de 15 minutos directamente."
      }]);
    }, 900);
  };
  React.useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
  }, [messages]);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      bottom: 108,
      right: 32,
      width: 340,
      height: 510,
      background: "#2a2a2c",
      border: "1px solid rgba(78,222,163,0.2)",
      borderRadius: 18,
      boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
      zIndex: 999,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      opacity: open ? 1 : 0,
      transform: open ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
      pointerEvents: open ? "all" : "none",
      transition: "opacity 0.22s ease, transform 0.22s ease",
      transformOrigin: "bottom right"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "14px 16px 12px",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: "50%",
      background: "rgba(78,222,163,0.12)",
      border: "1px solid rgba(78,222,163,0.3)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "#4edea3"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      color: "#e5e1e4",
      lineHeight: 1.2
    }
  }, "Asistente de Gustavo"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#4edea3",
      display: "flex",
      alignItems: "center",
      gap: 4,
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: "#4edea3",
      display: "inline-block"
    }
  }), "En l\xEDnea")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpen(false),
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      color: "#86948a",
      padding: 4,
      borderRadius: 6,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "color 0.15s"
    },
    onMouseEnter: e => e.currentTarget.style.color = "#e5e1e4",
    onMouseLeave: e => e.currentTarget.style.color = "#86948a"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "6",
    x2: "6",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "6",
    x2: "18",
    y2: "18"
  })))), /*#__PURE__*/React.createElement("div", {
    ref: messagesEndRef,
    style: {
      flex: 1,
      minHeight: 0,
      overflowY: "auto",
      padding: "14px 12px",
      display: "flex",
      flexDirection: "column",
      gap: 9,
      scrollbarWidth: "thin",
      scrollbarColor: "#3c4a42 transparent"
    }
  }, messages.map((msg, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      maxWidth: "88%",
      padding: "9px 12px",
      borderRadius: msg.role === "bot" ? "4px 12px 12px 12px" : "12px 12px 4px 12px",
      background: msg.role === "bot" ? "#201f22" : "#4edea3",
      border: msg.role === "bot" ? "1px solid #3c4a42" : "none",
      color: msg.role === "bot" ? "#bbcabf" : "#003824",
      fontSize: 13,
      lineHeight: 1.55,
      alignSelf: msg.role === "bot" ? "flex-start" : "flex-end",
      fontWeight: msg.role === "user" ? 500 : 400,
      animation: "fadeUp 0.2s ease both"
    }
  }, msg.text))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 5,
      padding: "0 12px 10px"
    }
  }, SUGGESTIONS.map(s => /*#__PURE__*/React.createElement("button", {
    key: s,
    onClick: () => sendMessage(s),
    style: {
      padding: "4px 11px",
      background: "rgba(78,222,163,0.1)",
      border: "1px solid rgba(78,222,163,0.2)",
      borderRadius: 9999,
      fontSize: 11,
      fontWeight: 500,
      color: "#4edea3",
      cursor: "pointer",
      fontFamily: "inherit",
      transition: "background 0.15s"
    },
    onMouseEnter: e => e.currentTarget.style.background = "rgba(78,222,163,0.18)",
    onMouseLeave: e => e.currentTarget.style.background = "rgba(78,222,163,0.1)"
  }, s))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 12px",
      borderTop: "1px solid rgba(255,255,255,0.05)",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: input,
    onChange: e => setInput(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") sendMessage();
    },
    placeholder: "Escribe un mensaje...",
    style: {
      flex: 1,
      background: "#201f22",
      border: "1px solid rgba(255,255,255,0.05)",
      borderRadius: 9999,
      padding: "8px 13px",
      fontSize: 13,
      color: "#e5e1e4",
      fontFamily: "inherit",
      outline: "none",
      transition: "border-color 0.15s"
    },
    onFocus: e => e.currentTarget.style.borderColor = "rgba(78,222,163,0.4)",
    onBlur: e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => sendMessage(),
    style: {
      width: 32,
      height: 32,
      borderRadius: "50%",
      background: "#4edea3",
      border: "none",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#003824",
      flexShrink: 0,
      transition: "background 0.15s"
    },
    onMouseEnter: e => e.currentTarget.style.background = "#10b981",
    onMouseLeave: e => e.currentTarget.style.background = "#4edea3"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "22",
    y1: "2",
    x2: "11",
    y2: "13"
  }), /*#__PURE__*/React.createElement("polygon", {
    points: "22 2 15 22 11 13 2 9 22 2"
  }))))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpen(v => !v),
    style: {
      position: "fixed",
      bottom: 32,
      right: 32,
      width: 60,
      height: 60,
      borderRadius: "50%",
      background: "#4edea3",
      border: "none",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 4px 24px rgba(78,222,163,0.4), 0 2px 8px rgba(0,0,0,0.4)",
      zIndex: 1000,
      transition: "transform 0.2s ease, box-shadow 0.2s ease"
    },
    onMouseEnter: e => {
      e.currentTarget.style.transform = "scale(1.1)";
      e.currentTarget.style.boxShadow = "0 6px 32px rgba(78,222,163,0.5), 0 2px 8px rgba(0,0,0,0.4)";
    },
    onMouseLeave: e => {
      e.currentTarget.style.transform = "scale(1)";
      e.currentTarget.style.boxShadow = "0 4px 24px rgba(78,222,163,0.4), 0 2px 8px rgba(0,0,0,0.4)";
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 24,
      height: 24
    }
  }, /*#__PURE__*/React.createElement("svg", {
    style: {
      position: "absolute",
      inset: 0,
      transition: "opacity 0.15s, transform 0.15s",
      opacity: open ? 0 : 1,
      transform: open ? "rotate(90deg) scale(0.7)" : "none"
    },
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    fill: "#003824"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
  })), /*#__PURE__*/React.createElement("svg", {
    style: {
      position: "absolute",
      inset: 0,
      transition: "opacity 0.15s, transform 0.15s",
      opacity: open ? 1 : 0,
      transform: open ? "none" : "rotate(-90deg) scale(0.7)"
    },
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#003824",
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "6",
    x2: "6",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "6",
    x2: "18",
    y2: "18"
  }))), !open && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 10,
      height: 10,
      background: "#ffb4ab",
      borderRadius: "50%",
      border: "2px solid #131315"
    }
  })), /*#__PURE__*/React.createElement("style", null, `
        @keyframes fadeUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes skeletonPulse { 0%,100% { opacity:1; } 50% { opacity:0.45; } }
      `));
}
Object.assign(window, {
  ChatWidget
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/tutoring-platform/ChatWidget.jsx", error: String((e && e.message) || e) }); }

// ui_kits/tutoring-platform/Navbar.jsx
try { (() => {
// Navbar.jsx — GustavoAI Design System
// Matches: src/components/Navbar.tsx

function Navbar({
  signedIn = false,
  hasActivePack = false,
  credits = 3,
  packSize = 10,
  onOpenBooking
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const NAV_LINKS = [{
    label: "Cursos",
    href: "#"
  }, {
    label: "Mentoría",
    href: "#sessions",
    accent: true
  }, {
    label: "Blog",
    href: "#"
  }];
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      position: "fixed",
      top: 0,
      width: "100%",
      zIndex: 50,
      background: "rgba(19,19,21,0.85)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      boxShadow: "0 1px 0 rgba(255,255,255,0.05)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1280,
      margin: "0 auto",
      padding: "0 32px",
      height: 64,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 40
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      fontFamily: "var(--font-headline,'Manrope'),sans-serif",
      fontSize: "1.1rem",
      fontWeight: 900,
      letterSpacing: "-0.04em",
      color: "#e5e1e4",
      textDecoration: "none"
    }
  }, "GUSTAVOAI.DEV"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 28
    }
  }, NAV_LINKS.map(({
    label,
    href,
    accent
  }) => /*#__PURE__*/React.createElement("a", {
    key: label,
    href: href,
    style: {
      fontFamily: "var(--font-headline,'Manrope'),sans-serif",
      fontWeight: 600,
      fontSize: "0.875rem",
      color: accent ? "#4edea3" : "rgba(229,225,228,0.6)",
      textDecoration: "none",
      transition: "color 0.15s"
    },
    onMouseEnter: e => {
      if (!accent) e.currentTarget.style.color = "#e5e1e4";
    },
    onMouseLeave: e => {
      if (!accent) e.currentTarget.style.color = "rgba(229,225,228,0.6)";
    }
  }, label)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, signedIn ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    },
    onMouseEnter: () => setDropdownOpen(true),
    onMouseLeave: () => setDropdownOpen(false)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      paddingLeft: 14,
      borderLeft: "1px solid rgba(60,74,66,0.4)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "#bbcabf",
      lineHeight: 1,
      marginBottom: 2
    }
  }, "\xC1rea Personal"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: "#e5e1e4"
    }
  }, "Gustavo")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: "50%",
      background: "rgba(78,222,163,0.12)",
      border: "1px solid rgba(78,222,163,0.2)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 700,
      fontSize: 13,
      color: "#4edea3"
    }
  }, "G"), hasActivePack && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: -1,
      right: -1,
      width: 9,
      height: 9,
      borderRadius: "50%",
      background: "#4edea3",
      border: "2px solid #131315"
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined",
    style: {
      fontSize: 18,
      color: "#bbcabf"
    }
  }, "expand_more")), dropdownOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      right: 0,
      top: "100%",
      paddingTop: 10,
      zIndex: 300,
      minWidth: 190
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#2a2a2c",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      padding: 8,
      boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
    }
  }, hasActivePack && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    onClick: onOpenBooking,
    style: {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      padding: "10px 12px",
      borderRadius: 8,
      background: "rgba(78,222,163,0.06)",
      border: "none",
      cursor: "pointer",
      textAlign: "left",
      fontFamily: "inherit",
      marginBottom: 4
    },
    onMouseEnter: e => e.currentTarget.style.background = "rgba(78,222,163,0.12)",
    onMouseLeave: e => e.currentTarget.style.background = "rgba(78,222,163,0.06)"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "#4edea3"
    }
  }, "Pack ", packSize, "h activo"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: "#bbcabf",
      marginTop: 2
    }
  }, credits, " clases disponibles")), /*#__PURE__*/React.createElement("hr", {
    style: {
      borderColor: "rgba(60,74,66,0.3)",
      margin: "4px 0"
    }
  })), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 12px",
      borderRadius: 8,
      fontSize: 13,
      color: "#bbcabf",
      textDecoration: "none",
      transition: "background 0.15s"
    },
    onMouseEnter: e => {
      e.currentTarget.style.background = "#353437";
      e.currentTarget.style.color = "#e5e1e4";
    },
    onMouseLeave: e => {
      e.currentTarget.style.background = "transparent";
      e.currentTarget.style.color = "#bbcabf";
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined",
    style: {
      fontSize: 17
    }
  }, "dashboard"), "\xC1rea personal"), /*#__PURE__*/React.createElement("hr", {
    style: {
      borderColor: "rgba(60,74,66,0.3)",
      margin: "4px 0"
    }
  }), /*#__PURE__*/React.createElement("button", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      width: "100%",
      padding: "8px 12px",
      borderRadius: 8,
      fontSize: 13,
      color: "#ffb4ab",
      background: "none",
      border: "none",
      cursor: "pointer",
      fontFamily: "inherit",
      textAlign: "left",
      transition: "background 0.15s"
    },
    onMouseEnter: e => e.currentTarget.style.background = "rgba(255,180,171,0.08)",
    onMouseLeave: e => e.currentTarget.style.background = "transparent"
  }, /*#__PURE__*/React.createElement("span", {
    className: "material-symbols-outlined",
    style: {
      fontSize: 17
    }
  }, "logout"), "Cerrar sesi\xF3n")))) : /*#__PURE__*/React.createElement("button", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "9px 18px",
      borderRadius: 8,
      background: "transparent",
      border: "1px solid rgba(60,74,66,0.5)",
      color: "#e5e1e4",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: "inherit",
      transition: "background 0.2s"
    },
    onMouseEnter: e => e.currentTarget.style.background = "#353437",
    onMouseLeave: e => e.currentTarget.style.background = "transparent"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z",
    fill: "#4285F4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z",
    fill: "#34A853"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z",
    fill: "#FBBC05"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z",
    fill: "#EA4335"
  })), "Iniciar sesi\xF3n"))));
}
Object.assign(window, {
  Navbar
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/tutoring-platform/Navbar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/tutoring-platform/PackCard.jsx
try { (() => {
// PackCard.jsx — GustavoAI Design System
// Matches: src/features/booking/PackCard.tsx

function PackCard({
  size = 10,
  recommended = false,
  hasCredits = false,
  credits = 0,
  loading = false,
  onBuy,
  onSchedule
}) {
  const [hovered, setHovered] = React.useState(false);
  const PACK_CONFIG = {
    5: {
      label: "Pack Esencial",
      price: "€75",
      originalPrice: "€80",
      savingsPill: "Ahorras €5 · 6%",
      hourlyRate: "€15",
      hours: 5
    },
    10: {
      label: "Pack Intensivo",
      price: "€140",
      originalPrice: "€160",
      savingsPill: "Ahorras €20 · 12%",
      hourlyRate: "€14",
      hours: 10
    }
  };
  const cfg = PACK_CONFIG[size];
  const isPrimary = recommended || hasCredits;
  const benefits = [`${cfg.hours} sesiones de 1 hora`, "Reserva flexible — tú decides cuándo", "Vigencia de 180 días"];
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    style: {
      position: "relative",
      width: "100%",
      padding: 26,
      background: hasCredits ? "rgba(78,222,163,0.07)" : recommended ? "rgba(78,222,163,0.05)" : "#201f22",
      border: `1px solid ${hovered ? isPrimary ? "rgba(78,222,163,0.55)" : "rgba(78,222,163,0.2)" : isPrimary ? "rgba(78,222,163,0.35)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 16,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      transition: "border-color 0.2s"
    }
  }, (hasCredits || recommended) && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 0,
      right: 0,
      padding: "5px 12px",
      background: "#4edea3",
      color: "#003824",
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      fontFamily: "'Manrope',sans-serif",
      borderBottomLeftRadius: 10
    }
  }, hasCredits ? "Pack activo" : "Recomendado"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Manrope',sans-serif",
      fontSize: 17,
      fontWeight: 700,
      color: "#e5e1e4",
      letterSpacing: "-0.01em",
      marginBottom: 14,
      paddingRight: isPrimary ? 80 : 0
    }
  }, cfg.label), loading ? /*#__PURE__*/React.createElement("div", {
    style: {
      height: 16,
      width: 140,
      borderRadius: 4,
      background: "#2a2a2c",
      marginBottom: 18,
      animation: "skeletonPulse 1.4s ease-in-out infinite"
    }
  }) : hasCredits ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 10px",
      borderRadius: 9999,
      background: "rgba(78,222,163,0.1)",
      border: "1px solid rgba(78,222,163,0.25)",
      fontSize: 12,
      fontWeight: 600,
      color: "#4edea3"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: "#4edea3",
      flexShrink: 0
    }
  }), credits, " clase", credits !== 1 ? "s" : "", " disponible", credits !== 1 ? "s" : "")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "'Manrope',sans-serif",
      fontSize: "1.75rem",
      fontWeight: 800,
      color: "#4edea3",
      letterSpacing: "-0.02em",
      lineHeight: 1
    }
  }, cfg.price), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: "#86948a",
      textDecoration: "line-through"
    }
  }, cfg.originalPrice), /*#__PURE__*/React.createElement("span", {
    style: {
      padding: "3px 7px",
      background: "rgba(78,222,163,0.1)",
      border: "1px solid rgba(78,222,163,0.2)",
      borderRadius: 9999,
      fontSize: 10,
      fontWeight: 600,
      color: "#4edea3"
    }
  }, cfg.savingsPill)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#86948a",
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#4edea3",
      fontWeight: 600
    }
  }, cfg.hourlyRate, " / hora"), " \xB7 vs \u20AC16 en sesi\xF3n suelta")), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: "none",
      padding: 0,
      margin: "0 0 20px",
      display: "flex",
      flexDirection: "column",
      gap: 9,
      flex: 1
    }
  }, benefits.map(b => /*#__PURE__*/React.createElement("li", {
    key: b,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9,
      fontSize: 13,
      color: "#bbcabf"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 17,
      height: 17,
      borderRadius: "50%",
      background: "rgba(78,222,163,0.12)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "9",
    height: "9",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#4edea3",
    strokeWidth: "3",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  }))), b))), /*#__PURE__*/React.createElement("button", {
    onClick: hasCredits ? onSchedule : onBuy,
    style: {
      display: "block",
      width: "100%",
      padding: "11px",
      borderRadius: 8,
      border: isPrimary ? "none" : "1px solid rgba(78,222,163,0.25)",
      background: isPrimary ? "linear-gradient(135deg,#4edea3,#10b981)" : "rgba(78,222,163,0.06)",
      color: isPrimary ? "#003824" : "#bbcabf",
      fontFamily: "'Manrope',sans-serif",
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      transition: "filter 0.15s, background 0.15s"
    },
    onMouseEnter: e => {
      if (isPrimary) e.currentTarget.style.filter = "brightness(1.08)";else {
        e.currentTarget.style.background = "rgba(78,222,163,0.12)";
        e.currentTarget.style.color = "#4edea3";
      }
    },
    onMouseLeave: e => {
      e.currentTarget.style.filter = "brightness(1)";
      if (!isPrimary) {
        e.currentTarget.style.background = "rgba(78,222,163,0.06)";
        e.currentTarget.style.color = "#bbcabf";
      }
    }
  }, hasCredits ? "Reservar clase" : `Comprar pack · ${cfg.price}`));
}
Object.assign(window, {
  PackCard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/tutoring-platform/PackCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/tutoring-platform/SessionCard.jsx
try { (() => {
// SessionCard.jsx — GustavoAI Design System
// Matches: src/features/booking/SessionCard.tsx

function SessionCard({
  badge,
  name,
  duration,
  price,
  isFree = false,
  featured = false,
  onClick
}) {
  const [hovered, setHovered] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    style: {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      padding: "28px 22px",
      background: hovered ? featured ? "rgba(78,222,163,0.12)" : "#201f22" : featured ? "rgba(78,222,163,0.07)" : "#1c1b1d",
      border: featured ? `1px solid ${hovered ? "rgba(78,222,163,0.55)" : "rgba(78,222,163,0.3)"}` : `1px solid ${hovered ? "rgba(78,222,163,0.25)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 14,
      cursor: "pointer",
      textAlign: "left",
      transition: "border-color 0.2s, background 0.2s, transform 0.2s, box-shadow 0.2s",
      fontFamily: "inherit",
      transform: hovered ? featured ? "scale(1.05)" : "translateY(-2px)" : featured ? "scale(1.03)" : "scale(1)",
      boxShadow: featured ? hovered ? "0 20px 56px rgba(78,222,163,0.2)" : "0 16px 48px rgba(78,222,163,0.12)" : hovered ? "0 8px 24px rgba(0,0,0,0.3)" : "none"
    }
  }, badge ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      padding: "3px 9px",
      borderRadius: 9999,
      marginBottom: 18,
      background: featured ? "rgba(78,222,163,0.15)" : "rgba(255,255,255,0.06)",
      color: featured ? "#4edea3" : "#bbcabf",
      border: featured ? "1px solid rgba(78,222,163,0.25)" : "1px solid rgba(255,255,255,0.1)",
      alignSelf: "flex-start"
    }
  }, badge) : /*#__PURE__*/React.createElement("div", {
    style: {
      height: 28,
      marginBottom: 8
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Manrope',sans-serif",
      fontSize: "1.05rem",
      fontWeight: 700,
      color: "#e5e1e4",
      marginBottom: 8,
      letterSpacing: "-0.01em",
      lineHeight: 1.3
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "0.78rem",
      color: "#86948a",
      lineHeight: 1.5,
      flex: 1,
      marginBottom: 22
    }
  }, duration), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Manrope',sans-serif",
      fontSize: isFree ? "1rem" : "1.75rem",
      fontWeight: 800,
      color: "#4edea3",
      letterSpacing: isFree ? 0 : "-0.03em",
      lineHeight: 1
    }
  }, price), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: "50%",
      background: featured ? "rgba(78,222,163,0.15)" : "rgba(255,255,255,0.05)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#4edea3",
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "5",
    y1: "12",
    x2: "19",
    y2: "12"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "12 5 19 12 12 19"
  })))));
}
Object.assign(window, {
  SessionCard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/tutoring-platform/SessionCard.jsx", error: String((e && e.message) || e) }); }

__ds_ns.BookingsPage = __ds_scope.BookingsPage;

__ds_ns.FailedBookingsPage = __ds_scope.FailedBookingsPage;

__ds_ns.AdminLayout = __ds_scope.AdminLayout;

__ds_ns.AdminDashboard = __ds_scope.AdminDashboard;

__ds_ns.PaymentsPage = __ds_scope.PaymentsPage;

__ds_ns.StudentDetailPage = __ds_scope.StudentDetailPage;

__ds_ns.StudentsPage = __ds_scope.StudentsPage;

__ds_ns.AdjustCreditsForm = __ds_scope.AdjustCreditsForm;

__ds_ns.AdminNav = __ds_scope.AdminNav;

__ds_ns.RetryButton = __ds_scope.RetryButton;

__ds_ns.StatCard = __ds_scope.StatCard;

})();
