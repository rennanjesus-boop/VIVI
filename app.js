// =====================================
// VIVI — Sistema principal
// =====================================

const SUPABASE_URL = "https://uxmoywbhcmxdegrewxvo.supabase.co/rest/v1/";
const SUPABASE_KEY = "sb_publishable_xL_ubEqHd4co-gPLoWbb1A_Olr-PczP";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let currentUser = null;

// Elementos da página
const auth = document.getElementById("auth");
const profile = document.getElementById("profile");
const message = document.getElementById("message");
const memories = document.getElementById("memories");

function showMessage(text) {
  message.textContent = text;
}

// =====================================
// CADASTRO
// =====================================

document.getElementById("signupBtn").addEventListener("click", async () => {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!name || !email || !password) {
    return showMessage("Preencha todos os campos.");
  }

  if (password.length < 6) {
    return showMessage("A senha precisa ter pelo menos 6 caracteres.");
  }

  showMessage("Criando sua conta...");

  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name
      }
    }
  });

  if (error) {
    return showMessage(error.message);
  }

  if (!data.session) {
    showMessage("Conta criada! Confira seu e-mail para confirmar o cadastro.");
  } else {
    showMessage("Conta criada com sucesso!");
  }
});

// =====================================
// LOGIN
// =====================================

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  showMessage("Entrando...");

  const { error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return showMessage("Não foi possível entrar: " + error.message);
  }

  showMessage("Bem-vindo ao VIVI!");
});

// =====================================
// SESSÃO E PERFIL
// =====================================

async function openProfile(user) {
  currentUser = user;

  auth.hidden = true;
  profile.hidden = false;

  const name = user.user_metadata?.full_name || user.email;

  document.getElementById("welcome").textContent =
    "Olá, " + name + "! Suas lembranças estão aqui.";

  await loadMemories();
}

async function closeProfile() {
  currentUser = null;
  profile.hidden = true;
  auth.hidden = false;
  memories.innerHTML = "";
}

db.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    openProfile(session.user);
  } else {
    closeProfile();
  }
});

// =====================================
// SAIR DA CONTA
// =====================================

document.getElementById("logoutBtn").addEventListener("click", async () => {
  const { error } = await db.auth.signOut();

  if (error) {
    showMessage(error.message);
  }
});

// =====================================
// CRIAR MEMÓRIA
// =====================================

document.getElementById("saveMemoryBtn").addEventListener("click", async () => {
  if (!currentUser) {
    return showMessage("Entre na sua conta primeiro.");
  }

  const title = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const memoryDate = document.getElementById("memoryDate").value;
  const file = document.getElementById("memoryFile").files[0];

  if (!title) {
    return showMessage("Digite um título para sua memória.");
  }

  showMessage("Salvando sua lembrança...");

  let filePath = null;
  let fileType = null;

  if (file) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    filePath = currentUser.id + "/" + crypto.randomUUID() + "-" + safeName;
    fileType = file.type.startsWith("video/") ? "video" : "image";

    const { error: uploadError } = await db.storage
      .from("memories")
      .upload(filePath, file);

    if (uploadError) {
      return showMessage("Erro ao enviar arquivo: " + uploadError.message);
    }
  }

  const { error } = await db.from("memories").insert({
    user_id: currentUser.id,
    title,
    description,
    memory_date: memoryDate || null,
    file_path: filePath,
    file_type: fileType
  });

  if (error) {
    if (filePath) {
      await db.storage.from("memories").remove([filePath]);
    }

    return showMessage("Erro ao salvar memória: " + error.message);
  }

  document.getElementById("title").value = "";
  document.getElementById("description").value = "";
  document.getElementById("memoryDate").value = "";
  document.getElementById("memoryFile").value = "";

  showMessage("Sua memória foi guardada!");
  await loadMemories();
});

// =====================================
// CARREGAR MEMÓRIAS
// =====================================

async function loadMemories() {
  if (!currentUser) return;

  memories.innerHTML = "Carregando lembranças...";

  const { data, error } = await db
    .from("memories")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    memories.textContent = "Erro ao carregar: " + error.message;
    return;
  }

  memories.innerHTML = "";

  if (!data.length) {
    memories.textContent = "Você ainda não guardou nenhuma memória.";
    return;
  }

  for (const item of data) {
    const card = document.createElement("article");
    card.className = "memory-card";

    const heading = document.createElement("h3");
    heading.textContent = item.title;
    card.appendChild(heading);

    const description = document.createElement("p");
    description.textContent = item.description || "";
    card.appendChild(description);

    if (item.memory_date) {
      const date = document.createElement("p");
      date.textContent = new Date(item.memory_date + "T12:00:00")
        .toLocaleDateString("pt-BR");
      card.appendChild(date);
    }

    if (item.file_path) {
      const { data: fileData, error: fileError } = await db.storage
        .from("memories")
        .createSignedUrl(item.file_path, 3600);

      if (!fileError && fileData?.signedUrl) {
        const media = document.createElement(
          item.file_type === "video" ? "video" : "img"
        );

        media.src = fileData.signedUrl;

        if (item.file_type === "video") {
          media.controls = true;
        } else {
          media.alt = item.title;
        }

        card.appendChild(media);
      }
    }

    memories.appendChild(card);
  }
}

console.log("VIVI iniciado!");
