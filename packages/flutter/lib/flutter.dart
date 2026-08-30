/// The Flutter widget layer of the blobatar SDK.
///
/// ```dart
/// import 'package:blobatar/flutter.dart';
///
/// Blobatar(name: 'alain@example.com', size: 48)
/// ```
///
/// The widget paints the deterministic generation-2 layout through
/// `dart:ui` primitives — the same math the parity fixture pins against the
/// TypeScript core. For the pure, Flutter-independent engine (hash, traits,
/// palette, layout), import `package:blobatar/blobatar.dart` instead.
library;

export 'package:blobatar/blobatar.dart'
    show Backdrop, BackdropGeometry, BlobatarOptions, Palette;

export 'src/flutter/painter.dart' show BlobatarPainter;
export 'src/flutter/renderer.dart' show BlobatarRenderer;
export 'src/flutter/widget.dart' show Blobatar;
