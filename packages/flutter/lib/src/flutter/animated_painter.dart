/// Custom painter for animated blobatar frames.
library;

import 'dart:ui' as ui;

import 'package:flutter/foundation.dart' show Listenable;
import 'package:flutter/rendering.dart' show CustomPainter;

import 'animated_renderer.dart';

typedef AnimatedBlobatarFrameBuilder = AnimatedBlobatarFrame Function();

class AnimatedBlobatarPainter extends CustomPainter {
  final AnimatedBlobatarRenderer renderer;
  final AnimatedBlobatarFrameBuilder frameBuilder;

  AnimatedBlobatarPainter({
    required this.renderer,
    required this.frameBuilder,
    required Listenable repaint,
  }) : super(repaint: repaint);

  AnimatedBlobatarFrame get currentFrame => frameBuilder();

  @override
  void paint(ui.Canvas canvas, ui.Size size) =>
      renderer.paint(canvas, size, currentFrame);

  @override
  bool shouldRepaint(covariant AnimatedBlobatarPainter oldDelegate) =>
      oldDelegate.renderer != renderer;
}
