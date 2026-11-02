// Тема ставится до отрисовки страницы: при выбранной светлой теме тёмная не мелькает при загрузке.
// Отдельным файлом, потому что политика CSP сайта запрещает встроенные скрипты.
(function () {
  var theme = 'dark';
  try { if (localStorage.getItem('astta-theme') === 'light') theme = 'light'; } catch (e) { /* без хранилища — тёмная */ }
  document.documentElement.setAttribute('data-ui', theme);
}());
