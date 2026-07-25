/**
 * Applies the stored theme before first paint.
 *
 * Without this the page paints in the media-query default and then snaps to the
 * stored choice on hydration — a visible flash on every navigation. Runs
 * synchronously in <head>, reads localStorage, and stamps data-theme on <html>.
 *
 * Inside Telegram we take the client's colorScheme as the initial value so the
 * mini app matches the surrounding chat, unless the user has picked a theme
 * here explicitly.
 */
export function ThemeScript() {
  const js = `
(function(){
  try {
    var stored = localStorage.getItem('oz-theme');
    if (stored === 'day' || stored === 'night') {
      document.documentElement.setAttribute('data-theme', stored);
      return;
    }
    var tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.colorScheme) {
      document.documentElement.setAttribute('data-theme', tg.colorScheme === 'dark' ? 'night' : 'day');
    }
  } catch (e) {}
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
