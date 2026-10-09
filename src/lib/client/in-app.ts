"use client";

import { useSyncExternalStore } from "react";

/**
 * Instagram, Facebook and similar apps open links in their own web view.
 * Those can't hand off to a UPI app, and Google refuses to sign anyone in
 * from them. Android can be sent to Chrome; iOS has no such link, so it gets
 * instructions.
 */
const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Snapchat|Line\/|; wv\)/i;

export type InApp = "android" | "ios" | "";

function inAppBrowser(): InApp {
  const ua = navigator.userAgent;
  if (!IN_APP.test(ua)) return "";
  return /Android/i.test(ua) ? "android" : "ios";
}

/** Reopens this page in Chrome on Android. */
export function chromeIntent(): string {
  const { host, pathname, search } = window.location;
  return `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;end`;
}

const noSubscribe = () => () => {};

/** "" on the server and in ordinary browsers. */
export function useInAppBrowser(): InApp {
  return useSyncExternalStore(noSubscribe, inAppBrowser, () => "" as const);
}
