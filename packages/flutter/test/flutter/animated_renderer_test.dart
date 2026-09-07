import 'dart:typed_data' show ByteData;
import 'dart:ui' as ui;

import 'package:flutter_test/flutter_test.dart';

import 'package:blobatar/blobatar.dart' as core;
import 'package:blobatar/flutter.dart';
import 'package:blobatar/src/flutter/path.dart' show colorFromHex;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('selected elapsed frames rasterize deterministically and move',
      () async {
    final AnimatedBlobatarRenderer renderer = AnimatedBlobatarRenderer(
      name: 'alain',
      options: const core.BlobatarOptions(
        background: core.Backdrop.squircle,
      ),
    );
    final ByteData first = await _raster(
      renderer,
      _frame(renderer, 0, 1),
    );
    final ByteData repeated = await _raster(
      renderer,
      _frame(renderer, 0, 1),
    );
    final ByteData later = await _raster(
      renderer,
      _frame(renderer, 1234, 1),
    );
    expect(_equal(first, repeated), isTrue);
    expect(_equal(first, later), isFalse);
  });

  test('the backdrop remains outside every motion transform', () async {
    final AnimatedBlobatarRenderer renderer = AnimatedBlobatarRenderer(
      name: 'alain',
      options: const core.BlobatarOptions(
        background: core.Backdrop.square,
      ),
    );
    final ByteData first = await _raster(
      renderer,
      _frame(renderer, 0, 1),
    );
    final ByteData later = await _raster(
      renderer,
      _frame(renderer, 1234, 1),
    );
    expect(_pixel(first, 2, 2), _pixel(later, 2, 2));
    expect(_equal(first, later), isFalse, reason: 'the figure still moves');
  });

  test('secondary-eye wrap changes the composed eye raster', () async {
    final AnimatedBlobatarRenderer renderer =
        AnimatedBlobatarRenderer(name: 'alain');
    final AnimatedBlobatarFrame reference = _frame(renderer, 1234, 1);
    expect(reference.motion.wrap.side, isNot(0));
    final core.MotionFrame withoutWrap = core.MotionFrame(
      shake: reference.motion.shake,
      breathe: reference.motion.breathe,
      bob: reference.motion.bob,
      saccade: reference.motion.saccade,
      thinkingPhase: reference.motion.thinkingPhase,
      blink: reference.motion.blink,
      wrap: const core.MotionWrap(
        magnitudeX: 0,
        side: 0,
        scaleY: 0,
        rotation: 0,
      ),
    );
    final AnimatedBlobatarFrame flat = AnimatedBlobatarFrame(
      motion: withoutWrap,
      pose: reference.pose,
      headColor: reference.headColor,
      eyeColor: reference.eyeColor,
      amplitude: reference.amplitude,
    );
    expect(
      _equal(await _raster(renderer, reference), await _raster(renderer, flat)),
      isFalse,
    );
  });

  test('thinking keeps its held seesaw loop', () async {
    final AnimatedBlobatarRenderer renderer =
        AnimatedBlobatarRenderer(name: 'thinking');
    final ByteData first = await _raster(
      renderer,
      _frame(renderer, 0, 0, expression: core.thinking),
    );
    final ByteData opposite = await _raster(
      renderer,
      _frame(renderer, 450, 0, expression: core.thinking),
    );
    expect(_equal(first, opposite), isFalse);
  });
}

AnimatedBlobatarFrame _frame(
  AnimatedBlobatarRenderer renderer,
  double time,
  double amplitude, {
  core.Expression expression = core.idle,
}) {
  final core.Palette palette = renderer.paletteFor(expression);
  return AnimatedBlobatarFrame(
    motion: core.motionAt(
      renderer.motionSeeds,
      time,
      amplitude,
      shake: expression.pose.shake,
    ),
    pose: expression.pose,
    headColor: colorFromHex(palette[core.colorHead]!),
    eyeColor: colorFromHex(palette[core.colorEye]!),
    amplitude: amplitude,
  );
}

Future<ByteData> _raster(
  AnimatedBlobatarRenderer renderer,
  AnimatedBlobatarFrame frame,
) async {
  final ui.PictureRecorder recorder = ui.PictureRecorder();
  final ui.Canvas canvas = ui.Canvas(recorder);
  renderer.paint(canvas, const ui.Size(100, 100), frame);
  final ui.Image image = await recorder.endRecording().toImage(100, 100);
  return (await image.toByteData(format: ui.ImageByteFormat.rawRgba))!;
}

bool _equal(ByteData a, ByteData b) {
  if (a.lengthInBytes != b.lengthInBytes) return false;
  for (var index = 0; index < a.lengthInBytes; index++) {
    if (a.getUint8(index) != b.getUint8(index)) return false;
  }
  return true;
}

int _pixel(ByteData data, int x, int y) {
  final int offset = (y * 100 + x) * 4;
  return Object.hash(
    data.getUint8(offset),
    data.getUint8(offset + 1),
    data.getUint8(offset + 2),
    data.getUint8(offset + 3),
  );
}
