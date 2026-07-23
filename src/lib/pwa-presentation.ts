export type PwaPresentationFacts = {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  standalone: boolean;
};

export function browserPwaPresentationFacts(): PwaPresentationFacts {
  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean;
  };

  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone:
      window.matchMedia("(display-mode: standalone)").matches ||
      navigatorWithStandalone.standalone === true,
  };
}

export function shouldShowIosBrowserGuidance({
  userAgent,
  platform,
  maxTouchPoints,
  standalone,
}: PwaPresentationFacts): boolean {
  const iosDevice = /iPad|iPhone|iPod/.test(userAgent);
  const ipadWithDesktopUserAgent =
    platform === "MacIntel" && maxTouchPoints > 1;

  return (iosDevice || ipadWithDesktopUserAgent) && !standalone;
}

