import type { PurchasingService } from '../services/purchasing-service';

/**
 * Open an uploaded photo or PDF in a new tab. The tab is opened first, while the click still counts as a person's action (a
 * browser blocks a window opened after an await), then pointed at the short-lived link. A refusal closes the tab and throws, so
 * the caller can show the server's message.
 */
export async function openFile(service: Pick<PurchasingService, 'getFileUrl'>, fileId: string): Promise<void> {
  const tab = window.open('', '_blank');
  try {
    const { url } = await service.getFileUrl(fileId);
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      window.location.assign(url);
    }
  } catch (error) {
    tab?.close();
    throw error;
  }
}
