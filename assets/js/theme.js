// Тема и заставка решаются до отрисовки страницы: при выбранной светлой теме тёмная не мелькает при загрузке.
// Отдельным файлом, потому что политика CSP сайта запрещает встроенные скрипты.
(function () {
  var theme = 'dark';
  try { if (localStorage.getItem('astta-theme') === 'light') theme = 'light'; } catch (e) { /* без хранилища — тёмная */ }
  document.documentElement.setAttribute('data-ui', theme);
  // Заставка — один раз за сессию: при переходах и повторных открытиях вкладки сразу показываем сайт.
  try { if (sessionStorage.getItem('astta-splash')) document.documentElement.classList.add('no-splash'); } catch (e) { /* покажем */ }
}());
