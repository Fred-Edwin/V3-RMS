/**
 * "Is this your phone?" (design pass 4, Chapter 14 step 3) is not built yet. The unlock asks this hook whether a phone is a confirmed
 * one; until the feature registers its answer the hook says `null` (unknown), and an unknown phone is neither alerted on nor trusted:
 * the audit entry records `confirmed: false` and nobody is paged (spec section 15: "every phone counts as unconfirmed only for the audit
 * flag, the System Admin push is held back"). The screens never say how phones are recognised.
 *
 * `true` = confirmed, `false` = known and not confirmed (opens after the code, raises the alert and a loud push, PD4), `null` = unknown.
 */
export type DeviceConfirmationSource = (userId: string, deviceId: string) => Promise<boolean | null>;

let source: DeviceConfirmationSource = async () => null;

export const setDeviceConfirmationSource = (next: DeviceConfirmationSource): void => {
  source = next;
};

export const isDeviceConfirmed = (userId: string, deviceId: string): Promise<boolean | null> => source(userId, deviceId);
