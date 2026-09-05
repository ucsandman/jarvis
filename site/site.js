const tabs = [...document.querySelectorAll('[role="tab"]')];
const panels = [...document.querySelectorAll('[role="tabpanel"]')];
function selectStep(step) {
  tabs.forEach(tab => {
    const selected = tab.dataset.step === step;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  panels.forEach(panel => { panel.hidden = panel.dataset.panel !== step; });
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectStep(tab.dataset.step));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus(); selectStep(tabs[next].dataset.step);
  });
});
if (location.hostname.endsWith('.vercel.app')) {
  const analytics = document.createElement('script');
  analytics.src = '/_vercel/insights/script.js'; analytics.defer = true;
  document.head.append(analytics);
}
