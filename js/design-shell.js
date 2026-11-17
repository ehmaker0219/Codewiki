(() => {
  const title = document.querySelector('.sap-command-bar strong');
  const status = document.querySelector('.sap-statusbar span');
  const update = () => {
    const label = document.querySelector('.article-main-title')?.textContent || document.querySelector('#articleContainer h1')?.textContent || '코드위키';
    title.textContent = 'ABAP Workbench: Display ' + label;
    status.textContent = '✓ ' + label;
    document.querySelector('.main-content')?.scrollTo({top:0});
  };
  new MutationObserver(update).observe(document.getElementById('articleContainer'), {childList:true});
  document.getElementById('sapPrintBtn').addEventListener('click', () => window.print());
  update();
})();
