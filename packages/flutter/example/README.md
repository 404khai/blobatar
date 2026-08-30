# Blobatar Flutter example

This app provides a live editor for the local `blobatar` package. Enter any
seed, choose a generation-2 silhouette and static expression from the visual
bottom sheet, then tune the hue and backdrop. A fixed 3-by-4 gallery demonstrates
seeded output. The Claude and Codex cards mirror blobatar.dev's example-only
seed easter eggs, so their appearance controls stay locked.

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
