const IOS_HAPTIC_INPUT_ID = 'telepath-ios-haptic-switch';

let iosSwitchInput: HTMLInputElement | null = null;
let iosSwitchLabel: HTMLLabelElement | null = null;

const isBrowser = (): boolean => {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
};

const supportsVibration = (): boolean => {
  return (
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  );
};

const isLikelyIOSDevice = (): boolean => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent ?? '';
  const iOSPattern = /iPad|iPhone|iPod/i;
  const isTouchMac =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  return iOSPattern.test(userAgent) || isTouchMac;
};

const ensureIOSSwitchElements = (): void => {
  if (!isBrowser() || iosSwitchInput || iosSwitchLabel) {
    return;
  }

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = IOS_HAPTIC_INPUT_ID;
  input.setAttribute('switch', '');
  input.setAttribute('aria-hidden', 'true');
  input.tabIndex = -1;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';
  input.style.width = '1px';
  input.style.height = '1px';
  input.style.left = '-9999px';
  input.style.top = '-9999px';

  const label = document.createElement('label');
  label.htmlFor = IOS_HAPTIC_INPUT_ID;
  label.style.position = 'fixed';
  label.style.opacity = '0';
  label.style.pointerEvents = 'none';
  label.style.width = '1px';
  label.style.height = '1px';
  label.style.left = '-9999px';
  label.style.top = '-9999px';

  document.body.append(input, label);
  iosSwitchInput = input;
  iosSwitchLabel = label;
};

const triggerIOSSwitchPulse = (): boolean => {
  if (!isBrowser() || !isLikelyIOSDevice()) {
    return false;
  }

  ensureIOSSwitchElements();

  if (!iosSwitchInput || !iosSwitchLabel) {
    return false;
  }

  iosSwitchInput.checked = !iosSwitchInput.checked;
  iosSwitchLabel.click();
  return true;
};

export const triggerHapticPulse = (durationMs = 8): boolean => {
  if (supportsVibration()) {
    navigator.vibrate(durationMs);
    return true;
  }

  return triggerIOSSwitchPulse();
};
