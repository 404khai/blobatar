/**
 * What `packages/harness` cannot tell you.
 *
 * The harness renders `@blobatar/react-native` through a stub, because
 * `react-native`'s entry is Flow-typed source Bun cannot parse. That proves the
 * adapter chooses the right props and draws the same figure React draws — and
 * it proves nothing at all about whether `react-native-svg` puts pixels on a
 * screen when handed them. ADR-0009 records that this repo has shipped an
 * adapter rendering an empty string twice, each time with a clean typecheck and
 * a green suite, so the gap is not hypothetical.
 *
 * This app is the answer to it, and it is deliberately run by hand. There is no
 * `check` script worth writing here: an emulator in CI would test the emulator.
 *
 * ```sh
 * cd apps/example-native
 * bun start          # then press i, a, or scan the QR code with Expo Go
 * ```
 *
 * Two pins here exist for reasons that are not obvious from this file. The app
 * declares `typescript` at 5.x, because Expo's CLI reads the project tsconfig
 * through the TypeScript API and crashes on the 7 the rest of the workspace is
 * on. And `packages/react-native` pins its type-only `react-native` devDependency
 * to the exact version this app uses, because a floating range there resolves
 * higher, hoists over this one, and hands Metro mismatched internals.
 *
 * What to look for, in the order the screens are laid out:
 *
 * 1. **The grid** — ten silhouettes, one per band, each with the shape trait
 *    pinned. If a shape is missing or draws as a blank square, the mark for it
 *    is not reaching an element.
 * 2. **Backdrops** — the plate must sit *behind* the figure and must not lean
 *    or scale with it.
 * 3. **Poses** — `happy` shifts the body upward. If the posed row sits at the
 *    same height as the idle one, the `transform` is being dropped; if it sits
 *    at a different height than the same pose on the web, it is being applied
 *    twice.
 * 4. **The tinted pose** — `mad` recolours the head and leaves the eyes alone.
 */

import type { ReactNode } from "react";
import { StatusBar } from "expo-status-bar";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Blobatar } from "@blobatar/react-native";
import { happy, mad } from "blobatar/expression";

const SHAPES: [string, number][] = [
  ["round", 0.11],
  ["organic", 0.35],
  ["boxy", 0.54],
  ["capsule", 0.65],
  ["nub", 0.745],
  ["cloud", 0.825],
  ["droplet", 0.888],
  ["hexagon", 0.933],
  ["sun", 0.965],
  ["triangle", 0.99],
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{title}</Text>
      <View style={styles.row}>{children}</View>
    </View>
  );
}

export default function App() {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <StatusBar style="auto" />

      <Section title="Every silhouette in gen2">
        {SHAPES.map(([name, v]) => (
          <View key={name} style={styles.cell}>
            <Blobatar name="alain" size={64} traits={{ shape: v }} />
            <Text style={styles.caption}>{name}</Text>
          </View>
        ))}
      </Section>

      <Section title="Backdrops — the plate sits behind, and does not move with the figure">
        {(["square", "circle", "squircle"] as const).map(bg => (
          <View key={bg} style={styles.cell}>
            <Blobatar name="alain" size={64} background={bg} />
            <Text style={styles.caption}>{bg}</Text>
          </View>
        ))}
        <View style={styles.cell}>
          <Blobatar name="alain" size={64} background={false} />
          <Text style={styles.caption}>none</Text>
        </View>
      </Section>

      <Section title="Poses — happy lifts the body, mad tints the head only">
        <View style={styles.cell}>
          <Blobatar name="alain" size={64} background="squircle" />
          <Text style={styles.caption}>idle</Text>
        </View>
        <View style={styles.cell}>
          <Blobatar name="alain" size={64} background="squircle" expression={happy} />
          <Text style={styles.caption}>happy</Text>
        </View>
        <View style={styles.cell}>
          <Blobatar name="alain" size={64} background="squircle" expression={mad} />
          <Text style={styles.caption}>mad</Text>
        </View>
      </Section>

      <Section title="A crowd — every name a different creature">
        {Array.from({ length: 24 }, (_, i) => (
          <Blobatar key={i} name={`user-${i}`} size={44} title={`user-${i}`} />
        ))}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 64, gap: 28 },
  section: { gap: 10 },
  heading: { fontSize: 13, fontWeight: "600", opacity: 0.6 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-start" },
  cell: { alignItems: "center", gap: 4 },
  caption: { fontSize: 11, opacity: 0.5 },
});
