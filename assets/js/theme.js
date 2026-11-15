// Тема и заставка решаются до отрисовки страницы: при выбранной светлой теме тёмная не мелькает при загрузке.
// Отдельным файлом, потому что политика CSP сайта запрещает встроенные скрипты.
(function () {
  if (document.currentScript && document.currentScript.hasAttribute('data-storefront') && location.protocol !== 'file:' && !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) document.documentElement.classList.add('is-booting');
  var theme = 'dark';
  try { var saved = localStorage.getItem('astta-theme'); if (['dark', 'light', 'bimbo'].includes(saved)) theme = saved; } catch (e) { /* без хранилища — тёмная */ }
  document.documentElement.setAttribute('data-ui', theme);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'bimbo' ? '#fff8fc' : theme === 'light' ? '#f3f5ee' : '#070b09');
  // Заставка — один раз за сессию: при переходах и повторных открытиях вкладки сразу показываем сайт.
  try { if (sessionStorage.getItem('astta-splash')) document.documentElement.classList.add('no-splash'); } catch (e) { /* покажем */ }
}());
