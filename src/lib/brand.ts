/**
 * Store copy shown in link previews, share text and the PWA manifest.
 * Written in the third person so it reads correctly no matter who shares the link
 * (the owner or a friend). Override the name with NEXT_PUBLIC_OWNER_NAME.
 */
export const OWNER_NAME = process.env.NEXT_PUBLIC_OWNER_NAME || "Manoj Anasuri";
export const STORE_TAGLINE = `Apps by ${OWNER_NAME}`;
export const STORE_DESCRIPTION = `Android and web apps by ${OWNER_NAME}. Install them straight to your phone.`;
export const STORE_SHARE_TEXT = `AppDrop: apps by ${OWNER_NAME}. Install them straight to your phone.`;
