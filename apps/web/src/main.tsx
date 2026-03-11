import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";

/* --- Design tokens & base --- */
import "./styles/variables.css";
import "./styles/base.css";

/* --- Components --- */
import "./styles/components/navbar.css";
import "./styles/components/card.css";
import "./styles/components/table.css";
import "./styles/components/forms.css";
import "./styles/components/modal.css";
import "./styles/components/avatar.css";

/* --- Pages --- */
import "./styles/pages/home.css";
import "./styles/pages/wheel.css";
import "./styles/pages/leaderboard.css";
import "./styles/pages/person.css";
import "./styles/pages/grotta.css";
import "./styles/pages/stats.css";
import "./styles/pages/session.css";
import "./styles/pages/chuglist.css";
import "./styles/pages/violations.css";
import "./styles/pages/rules.css";
import "./styles/pages/join.css";
import "./styles/pages/admin.css";

/* --- Utilities (last for override priority) --- */
import "./styles/utilities.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);