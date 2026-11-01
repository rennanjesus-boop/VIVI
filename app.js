
const SUPABASE_URL = "https://uxmoywbhcmxdegrewxvo.supabase.co";
const SUPABASE_KEY = "COLE_SUA_CHAVE_PUBLICA_AQUI";
const BUCKET = "memories";
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);

let currentUser = null;
let memories = [];
let activeFilter = "all";
let activeCategory = "Todas";
let editingMemory = null;

$("year").textContent = new Date().getFullYear();
$("memoryDate").value = new Date().toISOString().slice(0, 10);

function message(id, text, error = false) {
  const element = $(id);
  element.textContent = text;
  element.style.color = error ? "#b34d43" : "#8c693a";
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatDate(value) {
  if (!value) return "Data não informada";
  const date = new Date(value + "T12:00:00");
  return date.toLocaleDateString("pt-BR");
}

function setAuthTab(tab) {
  const login = tab === "login";
  $("loginForm").classList.toggle("hidden", !login);
  $("signupForm").classList.toggle("hidden", login);
  $("showLogin").classList.toggle("active", login);
  $("showSignup").classList.toggle("active", !login);
  message("authMessage", "");
}

$("showLogin").addEventListener("click", () => setAuthTab("login"));
$("showSignup").addEventListener("click", () => setAuthTab("signup"));

function showAuth() {
  $("auth").classList.remove("hidden");
  $("app").classList.add("hidden");
}

function showApp() {
  $("auth").classList.add("hidden");
  $("app").classList.remove("hidden");
}

function updateProfile() {
  const name = currentUser.user_metadata?.full_name || "Minha conta";
  $("profileName").textContent = name;
  $("profileFullName")?.textContent;
  $("profileEmail").textContent = currentUser.email || "";
  $("avatarInitial").textContent = name.trim().charAt(0).toUpperCase() || "V";
  $("greeting").textContent = `Olá, ${name.split(" ")[0]}`;
}

async function enterApp(user) {
  currentUser = user;
  updateProfile();
  showApp();
  await loadMemories();
}

$("signupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  message("authMessage", "Criando sua conta...");

  const name = $("signupName").value.trim();
  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;

  if (!name) {
    message("authMessage", "Digite seu nome.", true);
    return;
  }

  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name }
    }
  });

  if (error) {
    message("authMessage", error.message, true);
    return;
  }

  if (data.session) {
    message("authMessage", "Conta criada! Entrando...");
    await enterApp(data.user);
  } else {
    message("authMessage", "Conta criada! Confira seu e-mail para confirmar o cadastro e depois entre.");
    setAuthTab("login");
  }
});

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  message("authMessage", "Entrando...");

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    message("authMessage", error.message, true);
    return;
  }

  await enterApp(data.user);
});

$("logoutButton").addEventListener("click", async () => {
  const { error } = await db.auth.signOut();
  if (error) {
    alert("Não foi possível sair: " + error.message);
    return;
  }
  currentUser = null;
  memories = [];
  showAuth();
});

$("editNameButton").addEventListener("click", async () => {
  if (!currentUser) return;

  const oldName = currentUser.user_metadata?.full_name || "";
  const newName = prompt("Digite seu nome:", oldName);

  if (newName === null) return;
  if (!newName.trim()) {
    alert("O nome não pode ficar vazio.");
    return;
  }

  const { data, error } = await db.auth.updateUser({
    data: { full_name: newName.trim() }
  });

  if (error) {
    alert("Erro ao atualizar perfil: " + error.message);
    return;
  }

  currentUser = data.user;
  updateProfile();
  alert("Perfil atualizado!");
});

async function loadMemories() {
  if (!currentUser) return;

  $("memoryList").innerHTML = "<p>Carregando suas memórias...</p>";

  const { data, error } = await db
    .from("memories")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("memory_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    $("memoryList").innerHTML = "";
    message("memoryMessage", "Erro ao carregar: " + error.message, true);
    return;
  }

  memories = data || [];
  updateStats();
  await renderMemories();
}

function updateStats() {
  $("memoryCount").textContent = memories.length;
  $("favoriteCount").textContent = memories.filter(item => item.is_favorite).length;
}

async function getMediaUrl(path) {
  if (!path) return null;

  const { data, error } = await db.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60);

  if (error) {
    console.error("Erro ao abrir arquivo:", error.message);
    return null;
  }

  return data.signedUrl;
}

async function renderMemories() {
  const list = $("memoryList");
  const search = $("searchInput").value.trim().toLowerCase();

  let filtered = memories.filter(item => {
    const matchesSearch =
      (item.title || "").toLowerCase().includes(search) ||
      (item.description || "").toLowerCase().includes(search);

    const matchesFavorite =
      activeFilter !== "favorite" || item.is_favorite;

    const matchesCategory =
      activeCategory === "Todas" || item.category === activeCategory;

    return matchesSearch && matchesFavorite && matchesCategory;
  });

  $("listHeading").textContent =
    activeFilter === "favorite" ? "Memórias favoritas" : "Todas as memórias";

  list.innerHTML = "";

  if (filtered.length === 0) {
    $("emptyMessage").classList.add("show");
    $("emptyMessage").querySelector("h3").textContent =
      memories.length === 0 ? "Sua história começa aqui." : "Nenhuma memória encontrada.";
    $("emptyMessage").querySelector("p").textContent =
      memories.length === 0
        ? "Adicione sua primeira memória para ela ficar guardada."
        : "Tente mudar a busca ou os filtros.";
    return;
  }

  $("emptyMessage").classList.remove("show");

  for (const item of filtered) {
    const mediaUrl = await getMediaUrl(item.file_path);
    const isVideo = item.file_type?.startsWith("video/");
    let media = '<div class="memory-placeholder">v.</div>';

    if (mediaUrl && isVideo) {
      media = `<video class="memory-media" src="${escapeHTML(mediaUrl)}" controls preload="metadata"></video>`;
    } else if (mediaUrl) {
      media = `<img class="memory-media" src="${escapeHTML(mediaUrl)}" alt="Imagem da memória" loading="lazy">`;
    }

    const card = document.createElement("article");
    card.className = "memory-card";
    card.innerHTML = `
      ${media}
      <div class="memory-content">
        <div class="memory-meta">
          <span class="memory-category">${escapeHTML(item.category || "Pessoal")}</span>
          <span>${formatDate(item.memory_date)}</span>
        </div>
        <h4>${escapeHTML(item.title)}</h4>
        <p class="memory-description">${escapeHTML(item.description || "Uma lembrança especial.")}</p>
        <div class="memory-actions">
          <button class="favorite ${item.is_favorite ? "active" : ""}" data-action="favorite" data-id="${item.id}">
            ${item.is_favorite ? "♥ Favorita" : "♡ Favoritar"}
          </button>
          <button data-action="edit" data-id="${item.id}">Editar</button>
          <button data-action="delete" data-id="${item.id}">Excluir</button>
        </div>
      </div>
    `;

    list.appendChild(card);
  }
}

$("searchInput").addEventListener("input", renderMemories);

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    activeFilter = button.dataset.filter;
    renderMemories();
  });
});

document.querySelectorAll(".category-filter").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".category-filter").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    activeCategory = button.dataset.category;
    renderMemories();
  });
});

$("memoryFile").addEventListener("change", () => {
  const file = $("memoryFile").files[0];
  $("fileLabel").textContent = file ? file.name : "Escolha um arquivo do seu dispositivo";
});

function resetMemoryForm() {
  editingMemory = null;
  $("memoryForm").reset();
  $("memoryDate").value = new Date().toISOString().slice(0, 10);
  $("formHeading").textContent = "Guardar uma memória";
  $("saveMemoryButton").textContent = "Guardar memória ↗";
  $("cancelEditButton").classList.add("hidden");
  $("fileLabel").textContent = "Escolha um arquivo do seu dispositivo";
  message("memoryMessage", "");
}

$("cancelEditButton").addEventListener("click", resetMemoryForm);

async function uploadMemoryFile(file) {
  if (!file) return { path: null, type: null };

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("O arquivo deve ter no máximo 50 MB.");
  }

  const allowed = file.type.startsWith("image/") ||
    ["video/mp4", "video/webm", "video/quicktime"].includes(file.type);

  if (!allowed) {
    throw new Error("Escolha uma imagem ou vídeo MP4, WebM ou MOV.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${currentUser.id}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });

  if (error) throw error;

  return { path, type: file.type };
}

$("memoryForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;

  const title = $("memoryTitle").value.trim();
  const description = $("memoryDescription").value.trim();
  const memoryDate = $("memoryDate").value || null;
  const category = $("memoryCategory").value;
  const file = $("memoryFile").files[0];

  if (!title) {
    message("memoryMessage", "Digite um título para a memória.", true);
    return;
  }

  $("saveMemoryButton").disabled = true;
  $("saveMemoryButton").textContent = "Salvando...";
  message("memoryMessage", "Salvando sua memória...");

  let uploadedPath = null;

  try {
    let filePath = editingMemory?.file_path || null;
    let fileType = editingMemory?.file_type || null;

    if (file) {
      const uploaded = await uploadMemoryFile(file);
      filePath = uploaded.path;
      fileType = uploaded.type;
      uploadedPath = uploaded.path;
    }

    const record = {
      user_id: currentUser.id,
      title,
      description,
      memory_date: memoryDate,
      category,
      file_path: filePath,
      file_type: fileType
    };

    let result;

    if (editingMemory) {
      result = await db
        .from("memories")
        .update(record)
        .eq("id", editingMemory.id)
        .eq("user_id", currentUser.id)
        .select()
        .single();
    } else {
      result = await db
        .from("memories")
        .insert(record)
        .select()
        .single();
    }

    if (result.error) throw result.error;

    if (editingMemory && file && editingMemory.file_path) {
      await db.storage.from(BUCKET).remove([editingMemory.file_path]);
    }

    resetMemoryForm();
    message("memoryMessage", "Memória salva com sucesso!");
    await loadMemories();

  } catch (error) {
    if (uploadedPath) {
      await db.storage.from(BUCKET).remove([uploadedPath]);
    }
    message("memoryMessage", error.message || "Não foi possível salvar.", true);
  } finally {
    $("saveMemoryButton").disabled = false;
    $("saveMemoryButton").textContent = editingMemory ? "Salvar alterações" : "Guardar memória ↗";
  }
});

$("memoryList").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;
  const item = memories.find(memory => memory.id === id);
  if (!item) return;

  if (action === "favorite") {
    const { error } = await db
      .from("memories")
      .update({ is_favorite: !item.is_favorite })
      .eq("id", id)
      .eq("user_id", currentUser.id);

    if (error) {
      alert("Não foi possível atualizar favorito: " + error.message);
      return;
    }
    await loadMemories();
  }

  if (action === "edit") {
    editingMemory = item;
    $("memoryTitle").value = item.title || "";
    $("memoryDescription").value = item.description || "";
    $("memoryDate").value = item.memory_date || "";
    $("memoryCategory").value = item.category || "Pessoal";
    $("fileLabel").textContent = item.file_path
      ? "Escolha outro arquivo para substituir o atual (opcional)"
      : "Escolha um arquivo do seu dispositivo";
    $("formHeading").textContent = "Editar memória";
    $("saveMemoryButton").textContent = "Salvar alterações";
    $("cancelEditButton").classList.remove("hidden");
    $("memoryForm").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (action === "delete") {
    const confirmed = confirm(`Tem certeza que deseja excluir "${item.title}"?`);
    if (!confirmed) return;

    const { error } = await db
      .from("memories")
      .delete()
      .eq("id", id)
      .eq("user_id", currentUser.id);

    if (error) {
      alert("Não foi possível excluir: " + error.message);
      return;
    }

    if (item.file_path) {
      const { error: storageError } = await db.storage
        .from(BUCKET)
        .remove([item.file_path]);

      if (storageError) {
        console.error("O registro foi excluído, mas o arquivo não:", storageError.message);
      }
    }

    await loadMemories();
  }
});

db.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    currentUser = session.user;
    showApp();
    updateProfile();
    setTimeout(() => loadMemories(), 0);
  } else if (event === "SIGNED_OUT") {
    currentUser = null;
    memories = [];
    showAuth();
  }
});

async function initialize() {
  const { data, error } = await db.auth.getSession();

  if (error) {
    console.error("Erro ao verificar sessão:", error.message);
    showAuth();
    return;
  }

  if (data.session?.user) {
    await enterApp(data.session.user);
  } else {
    showAuth();
  }
}

initialize();

