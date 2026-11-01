// VIVI — Conexão com Supabase

const SUPABASE_URL = "https://uxmoywbhcmxdegrewxvo.supabase.co/rest/v1/";
const SUPABASE_KEY = "sb_publishable_xL_ubEqHd4co-gPLoWbb1A_Olr-PczP";

const script = document.createElement("script");
script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

script.onload = () => {
  window.viviDB = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  console.log("VIVI conectado ao Supabase!");

  document.dispatchEvent(
    new Event("viviConectado")
  );
};

script.onerror = () => {
  console.error("Não foi possível carregar o Supabase.");
};

document.head.appendChild(script);
