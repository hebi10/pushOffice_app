# Native widget and quick entry design

The current widget distributes spare height between schedule rows. Replace that spacing with a compact, readable content stack and keep text/voice actions reachable when resized or using large text. Keep existing schedule links, local storage, refresh scheduling and voice safeguards.

1. Update the two RemoteViews layouts and widget size metadata. Adapt displayed rows to available height, refresh on host size changes, and measure real views at normal and large font sizes.
2. Use a consistent Push Office identity for the Quick Settings tile and its add-tile prompt. Add the supported text/voice subtitle. Preserve Android-owned tile styling, unlock handling and the API 34 launch path.
3. Replace the chooser's default stacked buttons with two clear input actions and a compact close action. Keep the editor and confirmation flows intact; opening the voice screen must not start recording.
4. Run the existing app/native checks and new UI regression checks. Build and install the actual APK in an Android emulator, inspect both widgets and the tile/chooser, and capture the resulting screens.
5. Record the tested source and artifacts. The previous signed AAB predates these changes; do not claim it includes the new UI or upload it before the pending upload-key activation.

Implementation scopes: `modules/push-office-native/android/src/main`, its `src/androidTest` UI checks, and this verification record. No dependency changes or unrelated app screens.
