/* =========================================
   PROMOAI - JAVASCRIPT
   ========================================= */

/* =========================================
   PENYIMPANAN DATA
   ========================================= */

const HISTORY_KEY = "promoHistory";
const MANUAL_KEY = "promoManualPlans";

let historyData = [];
let manualPlans = [];
let lastCaption = "";
let lastAIPlanner = [];
let editingPlanId = null;

function loadStorage(key, fallback) {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    return data ?? fallback;
  } catch (error) {
    return fallback;
  }
}

historyData = loadStorage(HISTORY_KEY, []);
manualPlans = loadStorage(MANUAL_KEY, []);

if (!Array.isArray(historyData)) historyData = [];
if (!Array.isArray(manualPlans)) manualPlans = [];

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(historyData));
}

function saveManualPlans() {
  localStorage.setItem(MANUAL_KEY, JSON.stringify(manualPlans));
}

/* =========================================
   ELEMENT HELPER
   ========================================= */

function getValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

function setValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value || "";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, function (char) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char];
  });
}

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* =========================================
   TOAST NOTIFICATION
   ========================================= */

let toastTimeout;

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

/* =========================================
   NAVIGASI HALAMAN
   ========================================= */

function showPage(pageId, clickedButton = null) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  const selectedPage = document.getElementById(pageId);

  if (!selectedPage) return;

  selectedPage.classList.add("active");

  document.querySelectorAll(".nav-link").forEach(button => {
    button.classList.remove("active");
  });

  const activeButton =
    clickedButton ||
    document.querySelector(`.nav-link[data-page="${pageId}"]`);

  if (activeButton) {
    activeButton.classList.add("active");
  }

  document.getElementById("sidebar")?.classList.remove("sidebar-open");

  if (pageId === "dashboard") {
    renderDashboardActivity();
  }

  if (pageId === "history") {
    renderHistory();
  }

  if (pageId === "planner") {
    renderManualPlans();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function toggleSidebar() {
  document.getElementById("sidebar")?.classList.toggle("sidebar-open");
}

/* =========================================
   SINKRONISASI INFORMASI PRODUK
   ========================================= */

const productFieldGroups = [
  ["ideasName", "plannerName", "promoName"],
  ["ideasDescription", "plannerDescription", "promoDescription"],
  ["ideasTarget", "plannerTarget", "promoTarget"]
];

productFieldGroups.forEach(group => {
  group.forEach(id => {
    const element = document.getElementById(id);

    if (!element) return;

    element.addEventListener("input", () => {
      const value = element.value;

      group.forEach(otherId => {
        if (otherId === id) return;

        const otherElement = document.getElementById(otherId);

        if (otherElement) {
          otherElement.value = value;
        }
      });
    });
  });
});

/* =========================================
   API HELPER
   ========================================= */

async function sendToAPI(endpoint, data) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  let result;

  try {
    result = await response.json();
  } catch (error) {
    throw new Error("Server mengirim respons yang tidak valid.");
  }

  if (!response.ok || result.error) {
    throw new Error(result.error || "Terjadi kesalahan pada server.");
  }

  return result;
}

function setLoading(buttonId, loading, loadingText, normalText) {
  const button = document.getElementById(buttonId);

  if (!button) return;

  button.disabled = loading;
  button.textContent = loading ? loadingText : normalText;
}

/* =========================================
   FORMAT DAN PENYIMPANAN RIWAYAT
   ========================================= */

function addHistory(type, title, content) {
  const item = {
    id: createId(),
    type,
    title,
    content: String(content || ""),
    date: new Date().toISOString()
  };

  historyData.unshift(item);

  // Batasi jumlah riwayat agar penyimpanan browser tidak terlalu besar.
  historyData = historyData.slice(0, 100);

  saveHistory();
  renderDashboardActivity();
  renderHistory();
}

function formatDate(dateValue) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderDashboardActivity() {
  const container = document.getElementById("dashboardActivity");

  if (!container) return;

  if (historyData.length === 0) {
    container.innerHTML = `
      <div class="empty-state compact">
        <span>◷</span>
        <p>Belum ada aktivitas. Mulai gunakan fitur PromoAI!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = historyData.slice(0, 4).map(item => `
    <div class="activity-item">
      <div class="activity-icon">✦</div>

      <div class="activity-info">
        <strong>${escapeHTML(item.title)}</strong>
        <small>${escapeHTML(item.type)}</small>
      </div>

      <span class="activity-date">${escapeHTML(formatDate(item.date))}</span>
    </div>
  `).join("");
}

function renderHistory() {
  const container = document.getElementById("historyList");
  const count = document.getElementById("historyCount");

  if (!container) return;

  if (count) {
    count.textContent = `${historyData.length} hasil tersimpan`;
  }

  if (historyData.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span>◷</span>
        <p>Belum ada riwayat hasil AI.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = historyData.map(item => `
    <article class="history-card">
      <div class="history-card-top">
        <span class="history-type">${escapeHTML(item.type)}</span>
        <time>${escapeHTML(formatDate(item.date))}</time>
      </div>

      <h3>${escapeHTML(item.title)}</h3>

      <p class="history-preview">${escapeHTML(
        String(item.content || "").slice(0, 260)
      )}${String(item.content || "").length > 260 ? "..." : ""}</p>

      <div class="history-card-actions">
        <button class="small-action" onclick="copyHistory('${item.id}')">
          Salin
        </button>

        <button class="small-action delete" onclick="deleteHistory('${item.id}')">
          Hapus
        </button>
      </div>
    </article>
  `).join("");
}

function copyHistory(id) {
  const item = historyData.find(data => data.id === id);

  if (!item) return;

  copyText(item.content);
}

function deleteHistory(id) {
  historyData = historyData.filter(item => item.id !== id);

  saveHistory();
  renderHistory();
  renderDashboardActivity();

  showToast("Riwayat berhasil dihapus.");
}

function clearHistory() {
  if (historyData.length === 0) {
    showToast("Riwayat masih kosong.");
    return;
  }

  const confirmation = confirm("Yakin ingin menghapus semua riwayat AI?");

  if (!confirmation) return;

  historyData = [];

  saveHistory();
  renderHistory();
  renderDashboardActivity();

  showToast("Semua riwayat berhasil dihapus.");
}

/* =========================================
   COPY TEXT
   ========================================= */

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(String(text));
    showToast("Berhasil disalin!");
  } catch (error) {
    const temporaryInput = document.createElement("textarea");

    temporaryInput.value = String(text);
    document.body.appendChild(temporaryInput);

    temporaryInput.select();
    document.execCommand("copy");

    temporaryInput.remove();

    showToast("Berhasil disalin!");
  }
}

/* =========================================
   GENERATOR CAPTION PROMOSI
   ========================================= */

async function generateCaption() {
  const nama = getValue("promoName");
  const deskripsi = getValue("promoDescription");
  const harga = getValue("promoPrice");
  const target = getValue("promoTarget");
  const gaya = getValue("promoStyle");

  if (!nama || !deskripsi || !target) {
    showToast("Lengkapi nama, deskripsi, dan target audiens.");
    return;
  }

  const buttonText = "✦ Buat Caption Promosi";

  setLoading(
    "generateCaptionBtn",
    true,
    "Sedang membuat caption...",
    buttonText
  );

  try {
    const result = await sendToAPI("/api/generate-caption", {
      nama,
      deskripsi,
      harga,
      target,
      gaya
    });

    const caption = result.caption || result.result || result.output;

    if (!caption) {
      throw new Error("Hasil caption tidak ditemukan dari server.");
    }

    lastCaption = String(caption);

    document.getElementById("captionResult").textContent = lastCaption;
    document.getElementById("captionResultSection").hidden = false;

    addHistory(
      "Generator Promosi",
      `Caption ${nama}`,
      lastCaption
    );

    showToast("Caption berhasil dibuat!");

    document.getElementById("captionResultSection").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  } catch (error) {
    showToast(error.message || "Gagal membuat caption.");
  } finally {
    setLoading(
      "generateCaptionBtn",
      false,
      "Sedang membuat caption...",
      buttonText
    );
  }
}

function copyCaption() {
  if (!lastCaption) {
    showToast("Belum ada caption untuk disalin.");
    return;
  }

  copyText(lastCaption);
}

/* =========================================
   GENERATOR IDE KONTEN
   ========================================= */

async function generateIdeas() {
  const nama = getValue("ideasName");
  const deskripsi = getValue("ideasDescription");
  const target = getValue("ideasTarget");
  const platform = getValue("ideasPlatform");
  const jenis = getValue("ideasType");

  if (!nama || !deskripsi || !target) {
    showToast("Lengkapi informasi produk terlebih dahulu.");
    return;
  }

  const buttonText = "✦ Buat Ide Konten";

  setLoading(
    "generateIdeasBtn",
    true,
    "Sedang mencari ide...",
    buttonText
  );

  try {
    const result = await sendToAPI("/api/generate-ideas", {
      nama,
      deskripsi,
      target,
      platform,
      jenis,
      jenis_konten: jenis
    });

    const ideas =
      result.ideas ||
      result.ide ||
      result.result ||
      result.output ||
      result.content;

    if (!ideas) {
      throw new Error("Hasil ide konten tidak ditemukan dari server.");
    }

    const output = Array.isArray(ideas)
      ? ideas.map((item, index) => {
          if (typeof item === "string") {
            return `${index + 1}. ${item}`;
          }

          return `${index + 1}. ${item.judul || item.title || "Ide Konten"}\n${item.deskripsi || item.description || item.keterangan || ""}`;
        }).join("\n\n")
      : String(ideas);

    document.getElementById("ideasResult").textContent = output;
    document.getElementById("ideasResultSection").hidden = false;

    addHistory(
      "Ide Konten",
      `Ide konten ${nama}`,
      output
    );

    showToast("Ide konten berhasil dibuat!");

    document.getElementById("ideasResultSection").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  } catch (error) {
    showToast(error.message || "Gagal membuat ide konten.");
  } finally {
    setLoading(
      "generateIdeasBtn",
      false,
      "Sedang mencari ide...",
      buttonText
    );
  }
}

/* =========================================
   PLANNER TAB
   ========================================= */

function switchPlannerTab(tabId, clickedButton) {
  document.querySelectorAll(".planner-tab").forEach(tab => {
    tab.classList.remove("active");
  });

  document.querySelectorAll(".tab-button").forEach(button => {
    button.classList.remove("active");
  });

  document.getElementById(tabId)?.classList.add("active");

  if (clickedButton) {
    clickedButton.classList.add("active");
  }

  if (tabId === "manualPlanner") {
    renderManualPlans();
  }
}

/* =========================================
   AI CONTENT PLANNER
   ========================================= */

async function generatePlanner() {
  const nama = getValue("plannerName");
  const deskripsi = getValue("plannerDescription");
  const target = getValue("plannerTarget");
  const durasi = getValue("plannerDuration");
  const platform = getValue("plannerPlatform");

  if (!nama || !deskripsi || !target) {
    showToast("Lengkapi informasi produk terlebih dahulu.");
    return;
  }

  const buttonText = "✦ Buat Content Planner";

  setLoading(
    "generatePlannerBtn",
    true,
    "Sedang menyusun jadwal...",
    buttonText
  );

  try {
    const result = await sendToAPI("/api/generate-plan", {
      nama,
      deskripsi,
      target,
      durasi,
      platform,
      jumlah_hari: durasi
    });

    const plan =
      result.plan ||
      result.planner ||
      result.result ||
      result.output ||
      result.content;

    if (!plan) {
      throw new Error("Hasil planner tidak ditemukan dari server.");
    }

    lastAIPlanner = Array.isArray(plan) ? plan : [];

    const outputElement = document.getElementById("plannerResult");

    if (Array.isArray(plan)) {
      outputElement.innerHTML = plan.map((item, index) => {
        const day = item.hari || item.day || `Konten ${index + 1}`;
        const title = item.judul || item.title || item.ide || "Ide Konten";
        const detail = item.deskripsi || item.description || item.keterangan || "";
        const platformName = item.platform || platform;

        return `
          <article class="planner-result-item">
            <span class="plan-tag">${escapeHTML(day)}</span>
            <strong>${escapeHTML(title)}</strong>
            <p>${escapeHTML(detail)}</p>
            <p>Platform: ${escapeHTML(platformName)}</p>
          </article>
        `;
      }).join("");
    } else {
      outputElement.innerHTML = `
        <div class="result-card result-content">${escapeHTML(plan)}</div>
      `;
    }

    document.getElementById("plannerResultSection").hidden = false;

    addHistory(
      "AI Planner",
      `Planner ${nama}`,
      Array.isArray(plan)
        ? JSON.stringify(plan, null, 2)
        : String(plan)
    );

    showToast("Content planner berhasil dibuat!");

    document.getElementById("plannerResultSection").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  } catch (error) {
    showToast(error.message || "Gagal membuat content planner.");
  } finally {
    setLoading(
      "generatePlannerBtn",
      false,
      "Sedang menyusun jadwal...",
      buttonText
    );
  }
}

/* =========================================
   SIMPAN HASIL AI PLANNER KE MANUAL PLANNER
   ========================================= */

function saveAIPlanner() {
  if (!lastAIPlanner.length) {
    showToast("Hasil planner belum tersedia dalam format jadwal.");
    return;
  }

  let added = 0;

  lastAIPlanner.forEach((item, index) => {
    const title =
      item.judul ||
      item.title ||
      item.ide ||
      `Ide Konten ${index + 1}`;

    const description =
      item.deskripsi ||
      item.description ||
      item.keterangan ||
      "";

    const dayText = String(item.hari || item.day || "");
    const dayNumber = Number(dayText.match(/\d+/)?.[0] || index + 1);

    const date = new Date();
    date.setDate(date.getDate() + Math.max(0, dayNumber - 1));

    manualPlans.unshift({
      id: createId(),
      date: date.toISOString().slice(0, 10),
      platform: item.platform || getValue("plannerPlatform") || "Instagram",
      title,
      type: "Promosi",
      notes: description,
      status: "Belum",
      createdAt: new Date().toISOString()
    });

    added++;
  });

  saveManualPlans();
  renderManualPlans();

  showToast(`${added} jadwal berhasil disimpan.`);

  switchPlannerTab(
    "manualPlanner",
    document.querySelectorAll(".tab-button")[1]
  );
}

/* =========================================
   MANUAL PLANNER - TAMBAH DAN EDIT
   ========================================= */

function saveManualPlan() {
  const date = getValue("manualDate");
  const platform = getValue("manualPlatform");
  const title = getValue("manualTitle");
  const type = getValue("manualType");
  const notes = getValue("manualNotes");

  if (!date || !title) {
    showToast("Tanggal dan judul konten wajib diisi.");
    return;
  }

  if (editingPlanId) {
    const index = manualPlans.findIndex(item => item.id === editingPlanId);

    if (index !== -1) {
      manualPlans[index] = {
        ...manualPlans[index],
        date,
        platform,
        title,
        type,
        notes
      };
    }

    showToast("Jadwal berhasil diperbarui.");
  } else {
    manualPlans.unshift({
      id: createId(),
      date,
      platform,
      title,
      type,
      notes,
      status: "Belum",
      createdAt: new Date().toISOString()
    });

    showToast("Jadwal berhasil ditambahkan.");
  }

  saveManualPlans();
  renderManualPlans();
  resetManualForm();
}

function editManualPlan(id) {
  const item = manualPlans.find(plan => plan.id === id);

  if (!item) return;

  editingPlanId = id;

  setValue("manualDate", item.date);
  setValue("manualPlatform", item.platform);
  setValue("manualTitle", item.title);
  setValue("manualType", item.type);
  setValue("manualNotes", item.notes);

  document.getElementById("manualFormTitle").textContent = "Edit Jadwal Konten";
  document.getElementById("saveManualBtn").textContent = "Simpan Perubahan";
  document.getElementById("cancelEditBtn").hidden = false;

  document.getElementById("manualPlanner").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function cancelManualEdit() {
  resetManualForm();
}

function resetManualForm() {
  editingPlanId = null;

  setValue("manualDate", "");
  setValue("manualPlatform", "Instagram");
  setValue("manualTitle", "");
  setValue("manualType", "Promosi");
  setValue("manualNotes", "");

  document.getElementById("manualFormTitle").textContent = "Tambah Jadwal Konten";
  document.getElementById("saveManualBtn").textContent = "+ Tambah Jadwal";
  document.getElementById("cancelEditBtn").hidden = true;
}

/* =========================================
   MANUAL PLANNER - STATUS
   ========================================= */

function toggleManualStatus(id) {
  const item = manualPlans.find(plan => plan.id === id);

  if (!item) return;

  item.status = item.status === "Selesai" ? "Belum" : "Selesai";

  saveManualPlans();
  renderManualPlans();

  showToast(
    item.status === "Selesai"
      ? "Jadwal ditandai selesai."
      : "Jadwal dikembalikan ke belum selesai."
  );
}

/* =========================================
   MANUAL PLANNER - HAPUS
   ========================================= */

function deleteManualPlan(id) {
  const confirmation = confirm("Hapus jadwal konten ini?");

  if (!confirmation) return;

  manualPlans = manualPlans.filter(item => item.id !== id);

  saveManualPlans();
  renderManualPlans();

  showToast("Jadwal berhasil dihapus.");
}

/* =========================================
   MANUAL PLANNER - TAMPILKAN DATA
   ========================================= */

function renderManualPlans() {
  const container = document.getElementById("manualPlanList");
  const count = document.getElementById("manualPlanCount");
  const filter = getValue("manualFilter") || "Semua";

  if (!container) return;

  let filteredPlans = [...manualPlans];

  if (filter !== "Semua") {
    filteredPlans = filteredPlans.filter(item => item.status === filter);
  }

  filteredPlans.sort((a, b) => {
    return new Date(a.date) - new Date(b.date);
  });

  if (count) {
    count.textContent = `${manualPlans.length} jadwal tersimpan`;
  }

  if (filteredPlans.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span>▦</span>
        <p>
          ${manualPlans.length === 0
            ? "Belum ada jadwal konten. Tambahkan jadwal pertamamu."
            : "Tidak ada jadwal dengan status tersebut."}
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredPlans.map(item => `
    <article class="manual-plan-card">
      <div class="manual-plan-top">
        <div class="manual-plan-meta">
          <span>${escapeHTML(formatPlanDate(item.date))}</span>
          <span>${escapeHTML(item.platform)}</span>
          <span>${escapeHTML(item.type)}</span>
        </div>

        <span class="status-badge ${item.status === "Selesai" ? "done" : ""}">
          ${item.status === "Selesai" ? "Selesai" : "Belum"}
        </span>
      </div>

      <h3>${escapeHTML(item.title)}</h3>

      ${item.notes
        ? `<p>${escapeHTML(item.notes)}</p>`
        : `<p>Tidak ada catatan tambahan.</p>`}

      <div class="manual-plan-actions">
        <button class="small-action" onclick="toggleManualStatus('${item.id}')">
          ${item.status === "Selesai" ? "Batalkan Selesai" : "Tandai Selesai"}
        </button>

        <button class="small-action" onclick="editManualPlan('${item.id}')">
          Edit
        </button>

        <button class="small-action delete" onclick="deleteManualPlan('${item.id}')">
          Hapus
        </button>
      </div>
    </article>
  `).join("");
}

function formatPlanDate(dateValue) {
  if (!dateValue) return "-";

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) return dateValue;

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

/* =========================================
   INISIALISASI
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {
  renderDashboardActivity();
  renderHistory();
  renderManualPlans();
});