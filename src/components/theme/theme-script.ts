/**
 * Runs inline in <head> before first paint (no flash of the wrong theme).
 * Preference ("system" | "light" | "dark") lives in localStorage; the resolved theme is
 * written to <html data-theme> and the browser/PWA status-bar color is kept in sync.
 */
export const THEME_SCRIPT = `(function(){
var d=document.documentElement,m=window.matchMedia('(prefers-color-scheme: dark)');
function get(){try{var v=localStorage.getItem('appdrop-theme');return v==='light'||v==='dark'?v:'system'}catch(e){return 'system'}}
function apply(p){var dark=p==='dark'||(p==='system'&&m.matches);d.dataset.theme=dark?'dark':'light';d.dataset.themePref=p;d.style.colorScheme=dark?'dark':'light';
var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',dark?'#000000':'#ffffff');}
window.__appdropSetTheme=function(p){try{p==='system'?localStorage.removeItem('appdrop-theme'):localStorage.setItem('appdrop-theme',p)}catch(e){}apply(p);window.dispatchEvent(new Event('appdrop-theme'))};
apply(get());
var h=function(){if(get()==='system'){apply('system');window.dispatchEvent(new Event('appdrop-theme'))}};
m.addEventListener?m.addEventListener('change',h):m.addListener(h);
window.addEventListener('storage',function(e){if(e.key==='appdrop-theme'){apply(get());window.dispatchEvent(new Event('appdrop-theme'))}});
})();`;
