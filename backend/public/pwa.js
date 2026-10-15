// O worker guarda somente a página pública de indisponibilidade e seu ícone.
// Painel e APIs sempre consultam o servidor, inclusive depois de atualizações.
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
}
