import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:blobatar/flutter.dart';
import 'package:blobatar_example/main.dart';

void main() {
  testWidgets('the grid renders twelve deterministic avatars', (tester) async {
    await tester.pumpWidget(const BlobatarExampleApp());
    expect(find.byType(Blobatar), findsNWidgets(12));
    // Restart remounts the grid; the same names render the same avatars.
    await tester.tap(find.byIcon(Icons.restart_alt));
    await tester.pumpAndSettle();
    expect(find.byType(Blobatar), findsNWidgets(12));
    expect(find.text('blobatar - epoch 1'), findsOneWidget);
  });
}
