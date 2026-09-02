import { Alert, Linking } from 'react-native';

import { CONTACT_EMAIL } from '@/constants/config';

/**
 * Opens the device mail composer with a message to Gustavo pre-filled. This is
 * the escape hatch for when an in-app action (cancel / reschedule) keeps failing
 * — the API is the primary path, this is only for when it's broken. If no app can
 * handle the `mailto:` intent, the address is surfaced in an alert so the user
 * can still reach out.
 *
 * `noMailAppBody` must contain the literal token `{email}`; it's substituted with
 * the address at call time.
 */
export function openGustavoEmail(params: {
  subject: string;
  body: string;
  noMailAppTitle: string;
  noMailAppBody: string;
}): void {
  const url =
    `mailto:${CONTACT_EMAIL}` +
    `?subject=${encodeURIComponent(params.subject)}` +
    `&body=${encodeURIComponent(params.body)}`;
  Linking.openURL(url).catch(() => {
    Alert.alert(params.noMailAppTitle, params.noMailAppBody.replace('{email}', CONTACT_EMAIL));
  });
}
