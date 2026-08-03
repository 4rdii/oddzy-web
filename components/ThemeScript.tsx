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
 *
 * `defaultTheme` sets the brand's resting state when there is no stored choice
 * and no Telegram hint. Oddzy is light-first; PolyBaaz is dark-first, so it
 * passes "night" rather than falling through to prefers-color-scheme.
 */
export function ThemeScript({
  defaultTheme,
}: {
  defaultTheme?: "day" | "night";
}) {
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
      return;
    }
    ${defaultTheme ? `document.documentElement.setAttribute('data-theme', ${JSON.stringify(defaultTheme)});` : ""}
  } catch (e) {}
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
