const $ = (id) => document.getElementById(id);

function showSection(id) {
  document.querySelectorAll(".section").forEach(section => {
    section.classList.remove("active");
  });

  const target = $(id);
  if (target) target.classList.add("active");

  document.querySelectorAll(".nav").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.section === id);
  });

  if (id === "history") loadHistory();
}

document.querySelectorAll(".nav").forEach(btn => {
  btn.addEventListener("click", () => showSection(btn.dataset.section));
});

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const text = await response.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Server returned invalid JSON: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

async function checkHealth() {
  try {
    const data = await api("/api/health");
    $("status").textContent = data.geminiConfigured ? "● API Online" : "● API Key Missing";
    $("status").className = `status ${data.geminiConfigured ? "online" : "offline"}`;
  } catch (error) {
    $("status").textContent = "● Backend Offline";
    $("status").className = "status offline";
  }
}

function addMessage(role, text, extra = "") {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  wrapper.innerHTML = `
    <div class="avatar">${role === "ai" ? "🤖" : "👤"}</div>
    <div>
      <b>${role === "ai" ? "AI Tutor" : "You"}</b>
      <p>${escapeHtml(text)}</p>
      ${extra}
    </div>
  `;

  $("chat").appendChild(wrapper);
  $("chat").scrollTop = $("chat").scrollHeight;
}

$("chatForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = $("chatInput").value.trim();
  if (!message) return;

  const topic = $("topic").value;

  addMessage("user", message);
  $("chatInput").value = "";

  const loading = document.createElement("div");
  loading.className = "message ai loading";
  loading.innerHTML = `<div class="avatar">🤖</div><div><b>AI Tutor</b><p>Thinking...</p></div>`;
  $("chat").appendChild(loading);

  const history = [...$("chat").querySelectorAll(".message")]
    .filter(item => !item.classList.contains("loading"))
    .slice(-8)
    .map(item => ({
      role: item.classList.contains("user") ? "user" : "assistant",
      text: item.querySelector("p")?.innerText || ""
    }));

  try {
    const data = await api("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message, topic, history })
    });

    loading.remove();

    let extra = "";

    if (data.correction) {
      extra += `
        <div class="feedback">
          <b>Correction:</b> ${escapeHtml(data.correction)}
          ${data.betterSentence ? `<br><b>Better:</b> ${escapeHtml(data.betterSentence)}` : ""}
          ${data.tip ? `<br><b>Tip:</b> ${escapeHtml(data.tip)}` : ""}
        </div>
      `;
    }

    addMessage("ai", data.reply, extra);

  } catch (error) {
    loading.remove();
    addMessage("ai", `⚠️ ${error.message}`);
  }
});

$("correctBtn").addEventListener("click", async () => {
  const text = $("grammarInput").value.trim();

  if (!text) {
    alert("Enter a sentence first.");
    return;
  }

  $("correctBtn").disabled = true;
  $("correctBtn").textContent = "Checking...";

  try {
    const data = await api("/api/correct", {
      method: "POST",
      body: JSON.stringify({ text })
    });

    $("correctionResult").classList.remove("hidden");

    $("correctionResult").innerHTML = `
      <div class="score">${data.score ?? 0}/100</div>
      <h3>Corrected sentence</h3>
      <p>${escapeHtml(data.corrected)}</p>
      <h3>Explanation</h3>
      <p>${escapeHtml(data.explanation)}</p>
      <h3>Natural alternatives</h3>
      <ul>
        ${(data.alternatives || []).map(x => `<li>${escapeHtml(x)}</li>`).join("")}
      </ul>
    `;
  } catch (error) {
    $("correctionResult").classList.remove("hidden");
    $("correctionResult").innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  } finally {
    $("correctBtn").disabled = false;
    $("correctBtn").textContent = "Correct Sentence";
  }
});

$("evaluateBtn").addEventListener("click", async () => {
  const answer = $("evalInput").value.trim();
  const topic = $("evalTopic").value.trim();

  if (!answer) {
    alert("Write an answer first.");
    return;
  }

  $("evaluateBtn").disabled = true;
  $("evaluateBtn").textContent = "Evaluating...";

  try {
    const data = await api("/api/evaluate", {
      method: "POST",
      body: JSON.stringify({ answer, topic })
    });

    $("evaluationResult").classList.remove("hidden");

    $("evaluationResult").innerHTML = `
      <div class="score">${data.overallScore}/100</div>
      <div class="score-grid">
        <div><b>Grammar</b><strong>${data.grammarScore}</strong></div>
        <div><b>Vocabulary</b><strong>${data.vocabularyScore}</strong></div>
        <div><b>Clarity</b><strong>${data.clarityScore}</strong></div>
      </div>

      <h3>Strengths</h3>
      <ul>${(data.strengths || []).map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>

      <h3>Mistakes</h3>
      <ul>${(data.mistakes || []).map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>

      <h3>Suggestions</h3>
      <ul>${(data.suggestions || []).map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>

      <h3>Improved Answer</h3>
      <p>${escapeHtml(data.improvedAnswer || "")}</p>
    `;
  } catch (error) {
    $("evaluationResult").classList.remove("hidden");
    $("evaluationResult").innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  } finally {
    $("evaluateBtn").disabled = false;
    $("evaluateBtn").textContent = "Evaluate My English";
  }
});

async function loadHistory() {
  const list = $("historyList");
  list.innerHTML = "<p>Loading...</p>";

  try {
    const data = await api("/api/history");

    if (!data.length) {
      list.innerHTML = "<p>No saved history yet. Configure MongoDB to save history.</p>";
      return;
    }

    list.innerHTML = data.map(item => {
      const date = new Date(item.createdAt).toLocaleString();

      return `
        <div class="history-item">
          <span class="history-type">${escapeHtml(item.type)}</span>
          <small>${date}</small>
          <p>${escapeHtml(item.message || item.text || item.answer || item.topic || "")}</p>
        </div>
      `;
    }).join("");

  } catch (error) {
    list.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

$("refreshHistory").addEventListener("click", loadHistory);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

checkHealth();
