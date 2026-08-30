import 'dart:typed_data' show ByteData;
import 'dart:ui' as ui;

import 'package:flutter_test/flutter_test.dart';

import 'package:blobatar/blobatar.dart' as core;
import 'package:blobatar/flutter.dart';
import 'package:blobatar/src/flutter/path.dart' show toUiPath;
import 'package:blobatar/src/shape.dart' show BlobPath;

import '../dart/helpers.dart' show optionsFromJson, vectors;

/// Rasterizes one renderer paint at [size] to raw RGBA bytes.
///
/// Raw pixels (not PNG) keep the comparison free of any codec behavior: the
/// only transformation between the two paints is the renderer itself.
Future<ByteData> _raster(BlobatarRenderer r, ui.Size size) async {
  final ui.PictureRecorder recorder = ui.PictureRecorder();
  final ui.Canvas canvas = ui.Canvas(recorder);
  r.paint(canvas, size);
  final ui.Picture picture = recorder.endRecording();
  final ui.Image image =
      await picture.toImage(size.width.round(), size.height.round());
  final ByteData? data =
      await image.toByteData(format: ui.ImageByteFormat.rawRgba);
  return data!;
}

bool _equal(ByteData a, ByteData b) {
  if (a.lengthInBytes != b.lengthInBytes) return false;
  for (var i = 0; i < a.lengthInBytes; i++) {
    if (a.getUint8(i) != b.getUint8(i)) return false;
  }
  return true;
}

ui.Color _pixelAt(ByteData rgba, int width, int x, int y) {
  final int offset = (y * width + x) * 4;
  return ui.Color.fromARGB(
    rgba.getUint8(offset + 3),
    rgba.getUint8(offset),
    rgba.getUint8(offset + 1),
    rgba.getUint8(offset + 2),
  );
}

void _assertInFrame(ui.Rect b, String seed) {
  expect(b.left, greaterThanOrEqualTo(-0.01), reason: 'left $seed');
  expect(b.right, lessThanOrEqualTo(100.01), reason: 'right $seed');
  expect(b.top, greaterThanOrEqualTo(-0.01), reason: 'top $seed');
  expect(b.bottom, lessThanOrEqualTo(100.01), reason: 'bottom $seed');
}

/// Paint fixtures for representative seeds across the reference fixture.
///
/// The vector's path strings equal the core's `toPathData()` exactly (the
/// Phase 1 parity gate); these tests re-anchor that geometry at the canvas
/// layer — every drawn path keeps the 100-by-100 frame — and verify the
/// rasterized result is deterministic and seed-dependent. Raster bounds allow
/// the documented antialiasing margin (paths are exact; pixels may soften at
/// edges by sub-pixel amounts).
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final cases =
      (vectors['cases'] as List<dynamic>).cast<Map<String, dynamic>>();
  group('BlobatarRenderer', () {
    test('paints deterministically and differs across seeds', () async {
      final ByteData a1 = await _raster(
          BlobatarRenderer(name: 'alain'), const ui.Size(120, 120));
      final ByteData a2 = await _raster(
          BlobatarRenderer(name: 'alain'), const ui.Size(120, 120));
      final ByteData b =
          await _raster(BlobatarRenderer(name: 'bob'), const ui.Size(120, 120));
      expect(_equal(a1, a2), isTrue,
          reason: 'same seed must rasterize identically');
      expect(_equal(a1, b), isFalse, reason: 'different seeds must differ');
    });

    test('a fresh renderer after "restart" paints the same bytes', () async {
      final ByteData first = await _raster(
          BlobatarRenderer(name: 'user-42'), const ui.Size(96, 96));
      final ByteData second = await _raster(
          BlobatarRenderer(name: 'user-42'), const ui.Size(96, 96));
      expect(_equal(first, second), isTrue);
    });

    test('every fixture case keeps its drawn paths inside the frame', () {
      for (final Map<String, dynamic> m in cases) {
        final String seed = m['seed'] as String;
        final core.BlobatarLayout l = core.layoutFor(
            seed, optionsFromJson(m['options'] as Map<String, dynamic>));
        // The path that reaches the canvas is exactly the fixture's path.
        expect(l.bodyPath().toPathData(), m['bodyPath'], reason: 'seed=$seed');
        _assertInFrame(toUiPath(l.bodyPath()).getBounds(), seed);
        for (final BlobPath e in l.eyePaths()) {
          _assertInFrame(toUiPath(e).getBounds(), seed);
        }
      }
    });

    test('backdrop: none keeps the corners transparent', () async {
      final ByteData bytes = await _raster(
        BlobatarRenderer(
          name: 'alain',
          options: const core.BlobatarOptions(background: core.Backdrop.none),
        ),
        const ui.Size(100, 100),
      );
      final ui.Color corner = _pixelAt(bytes, 100, 2, 2);
      expect(corner.a, 0, reason: 'corner must be transparent when off');
    });

    test('backdrop: square, circle and squircle fill their plates', () async {
      for (final core.Backdrop bg in [
        core.Backdrop.square,
        core.Backdrop.circle,
        core.Backdrop.squircle,
      ]) {
        final ByteData bytes = await _raster(
          BlobatarRenderer(
              name: 'alain', options: core.BlobatarOptions(background: bg)),
          const ui.Size(100, 100),
        );
        final ui.Color centre = _pixelAt(bytes, 100, 50, 50);
        expect(centre.a, greaterThan(0), reason: '$bg centre painted');
        if (bg == core.Backdrop.square) {
          final ui.Color corner = _pixelAt(bytes, 100, 2, 2);
          expect(corner.a, greaterThan(0), reason: '$bg corner painted');
        }
      }
    });

    test('the body pixel is exactly the fixture palette head color', () async {
      final ByteData bytes = await _raster(
          BlobatarRenderer(name: 'alain'), const ui.Size(100, 100));
      final core.BlobatarLayout layout = core.layoutFor('alain');
      // Find a sample point inside the drawn body but inside no eye, scanning
      // down from the body's centre - interior pixels are never antialiased,
      // so the sampled pixel must equal the head hex exactly.
      final ui.Path body = toUiPath(layout.bodyPath());
      final List<ui.Path> eyes = [
        for (final p in layout.eyePaths()) toUiPath(p),
      ];
      ui.Offset? probe;
      for (var dy = 0; dy < 45 && probe == null; dy++) {
        for (final double sign in [1.0, -1.0]) {
          final ui.Offset candidate =
              ui.Offset(layout.body.cx, layout.body.cy + sign * dy);
          if (body.contains(candidate) &&
              !eyes.any((p) => p.contains(candidate))) {
            probe = candidate;
            break;
          }
        }
      }
      expect(probe, isNotNull, reason: 'no interior body pixel found');
      final (_, core.Palette palette) = core.partsFor('alain');
      final ui.Color px =
          _pixelAt(bytes, 100, probe!.dx.round(), probe.dy.round());
      expect(
        px.toARGB32() & 0xFFFFFF,
        int.parse(palette['head']!.substring(1), radix: 16),
        reason: 'body pixel ($probe) must equal the resolved head hex',
      );
    });
  });
}
