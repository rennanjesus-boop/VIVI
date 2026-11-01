
// VIVI — Sua vida, lembrada.

console.log("VIVI iniciado!");

document.addEventListener("DOMContentLoaded", () => {
  console.log("Página carregada com sucesso.");

  const botao = document.querySelector(".signup-actions button");

  if (botao) {
    botao.addEventListener("click", () => {
      alert("Em breve você poderá criar sua conta no VIVI!");
    });
  }
});
