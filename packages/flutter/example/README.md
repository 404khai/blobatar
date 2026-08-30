# Blobatar Flutter example

This app displays a deterministic grid from the local `blobatar` package,
including all fourteen static expressions.

From the repository root:

```sh
cd packages/flutter/example
flutter pub get
flutter run -d chrome
```

List available devices when Chrome is not the desired target:

```sh
flutter devices
flutter run -d <device-id>
```

Run the example checks with:

```sh
flutter analyze
flutter test
```
