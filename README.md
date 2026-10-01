# Huawei Health Analytics

Local-first personal health analytics for Android, built with React Native, TypeScript, Expo, and an Expo development build.

Android application ID: `com.omar.huaweihealthanalytics`.

Milestone 0 uses a mock provider. Huawei Health access is intentionally deferred to the connection spike in Milestone 1.

## Development

```powershell
npm.cmd install
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run prebuild:android
npm.cmd run android
```

Connect a physical Android phone with USB debugging enabled before `npm.cmd run android`. Expo Go is not used for native Huawei integration.

On this Windows machine, set the SDK path in each new terminal if it is not already configured:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path += ";$env:ANDROID_HOME\platform-tools"
adb devices -l
```
