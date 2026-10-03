# Huawei Health Analytics

Local-first personal health analytics for Android, built with React Native, TypeScript, Expo, and an Expo development build.

Android application ID: `com.omar.huaweihealthanalytics`.

The app provides daily summaries, personal Recovery, metric history, Trends, Insights, and persisted theme/language preferences. See the [User Guide](docs/USER_GUIDE.md) for features and usage.

Huawei integration currently supports authorized step retrieval only; broader Health Service Kit access remains pending approval/integration. Mock/development readings are synthetic, not live Huawei measurements.

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
