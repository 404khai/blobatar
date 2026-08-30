import 'package:flutter/material.dart';

import 'package:blobatar/blobatar.dart' as core;
import 'package:blobatar/flutter.dart';

/// The deterministic grid demo.
///
/// Every avatar comes from the same frozen gen-2 contract as the JavaScript
/// library: the name is normalized (NFC + trim + lowercase), hashed once, and
/// every trait reads independently from that state. Restarting the grid
/// remounts every widget from scratch and the picture is identical, which is
/// exactly what "deterministic" means here.
void main() => runApp(const BlobatarExampleApp());

const List<String> _names = [
  'alain',
  '  ALAIN@Example.COM  ',
  'café', // decomposed form below hashes the same
  'cafe\u0301',
  '日本語',
  '🦊🐻',
  'أحمد',
  'user-42',
  'Team Rocket 7',
  '00000000-0000-4000-8000-000000000000',
  'blobatar',
  'manga reader',
  'claude',
  'codex',
];

class BlobatarExampleApp extends StatelessWidget {
  const BlobatarExampleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'blobatar',
      theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
      home: const GridPage(),
    );
  }
}

class GridPage extends StatefulWidget {
  const GridPage({super.key});

  @override
  State<GridPage> createState() => _GridPageState();
}

class _GridPageState extends State<GridPage> {
  int _epoch = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('blobatar - epoch $_epoch'),
        actions: [
          IconButton(
            tooltip: 'Remount every widget; the avatars do not change',
            icon: const Icon(Icons.restart_alt),
            onPressed: () => setState(() => _epoch++),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Center(
          child: Column(
            children: [
              const SizedBox(height: 12),
              const Text(
                'Same name, same avatar - across restarts, devices, and time.',
                style: TextStyle(fontSize: 13, color: Colors.black54),
              ),
              const SizedBox(height: 12),
              // The ValueKey remounts the whole grid on restart; each cell
              // re-resolves its name from the core, so nothing is cached.
              KeyedSubtree(
                key: ValueKey<int>(_epoch),
                child: Wrap(
                  spacing: 16,
                  runSpacing: 16,
                  alignment: WrapAlignment.center,
                  children: [
                    for (final (int index, String name) in _names.indexed)
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            padding: const EdgeInsets.all(6),
                            child: Blobatar(
                              name: name,
                              size: 72,
                              options: core.BlobatarOptions(
                                background: core.Backdrop.squircle,
                                expression: core.expressions[index],
                              ),
                            ),
                          ),
                          const SizedBox(height: 4),
                          SizedBox(
                            width: 132,
                            child: Text(
                              '${core.expressions[index].name}: $name',
                              textAlign: TextAlign.center,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 11,
                                color: Colors.black54,
                              ),
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
