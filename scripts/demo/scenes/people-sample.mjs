// The sample scene: HR opens the Employees list, searches, opens a person's file. About 25 seconds.
export default {
  id: 'people-sample',
  role: 'hr@demo.wendo.test',
  viewport: 'desktop',
  /** Off camera: opens every screen once so the recording never waits on a first-time compile. */
  async warmup(page, go) {
    await go('/app/workforce/employees');
    await page.getByText('Susan Wafula').first().click();
    await page.waitForLoadState('networkidle');
  },
  async run(s) {
    const { page } = s;
    await s.goto('/app/workforce/employees');
    await page.getByRole('heading', { name: 'Employees' }).waitFor(); // past the start-up splash
    await s.pause(500);
    s.markStart();
    s.caption('Everyone in one place');
    await s.pause(3500);
    await s.moveTo(page.getByText('Needs finishing').first());
    await s.pause(1500);
    s.caption('Find anyone by typing a few letters');
    const search = page.getByPlaceholder(/find a person/i);
    await s.type(search, 'Susan');
    await s.settle();
    await s.pause(3000);
    s.caption('Open a person to see their file');
    await s.click(page.getByText('Susan Wafula').first());
    await s.settle();
    await s.pause(3500);
    s.caption('Job, pay and documents on one page');
    await s.scroll(350);
    await s.pause(2500);
    await s.scroll(350);
    await s.pause(3500);
  },
};
