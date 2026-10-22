import { apiClient } from '@/lib/apiClient';
import { deviceId } from '@/lib/device-id';

/**
 * The two calls behind the device step (the server's device list, `GET`-less: `seen` records this browser and says whether to ask;
 * `answer` is "Trust this device" or "Use just this once"). They run before the session is set, so each takes the new access token.
 * Own file, not the security feature's barrel: the sign-in page must not load the whole signed-in app.
 */
const BASE = '/workforce/security/phones/me/current';

export type DeviceAnswer = 'REMEMBER' | 'ONCE';

export interface DeviceSeen {
  /** true = this device is new to the person and the device step must ask. */
  phoneQuestion: boolean;
  phone: { label: string; placeLabel: string | null };
}

/** A random key for one press, so a double tap is one answer. */
const newKey = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export const deviceApi = {
  seen: (accessToken: string): Promise<DeviceSeen> => apiClient.post(`${BASE}/seen`, { deviceId: deviceId() }, accessToken),
  answer: (answer: DeviceAnswer, accessToken: string): Promise<unknown> => apiClient.post(`${BASE}/answer`, { deviceId: deviceId(), answer, idempotencyKey: newKey() }, accessToken),
};
