const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1240, height: 1400 }, deviceScaleFactor: 1 });
  await p.goto('file:///tmp/claude-1000/-home-edwinfred-projects-V3-RMS/b6442954-d4bd-40fd-91d5-fd2417cda29e/scratchpad/diag/client.html');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: '/tmp/claude-1000/-home-edwinfred-projects-V3-RMS/b6442954-d4bd-40fd-91d5-fd2417cda29e/scratchpad/diag/top.png' });
  await p.evaluate(() => window.scrollTo(0, 2400));
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/tmp/claude-1000/-home-edwinfred-projects-V3-RMS/b6442954-d4bd-40fd-91d5-fd2417cda29e/scratchpad/diag/mid.png' });
  await b.close();
})();
