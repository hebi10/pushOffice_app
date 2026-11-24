/** Use the usable window, not a device model or fixed portrait screen size. */
export function adaptiveLayout(width: number, fontScale: number) {
  const w = Number.isFinite(width) ? Math.max(0,width) : 0;
  const scale = Number.isFinite(fontScale) ? Math.max(1,fontScale) : 1;
  const twoPane = w >= 800 && w / scale >= 760;
  return {
    twoPane,
    narrow: w / scale < 360,
    showIntroArtwork: w / scale >= 360,
    contentMaxWidth: twoPane ? 1120 : 720,
    tabHeight: Math.ceil(60 + 16 * (scale - 1)),
    stackDialogActions: w / scale < 330,
  };
}
