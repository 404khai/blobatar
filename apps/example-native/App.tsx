/**
 * What `packages/harness` cannot tell you.
 *
 * The harness renders `@blobatar/react-native` through a stub, because
 * `react-native`'s entry is Flow-typed source Bun cannot parse. That proves the
 * adapter chooses the right props and draws the same figure React draws, and
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
 * Three things here exist for reasons that are not obvious from this file, and
 * each was found by the app failing rather than by reasoning:
 *
 * - `metro.config.js` deduplicates React. Without it the adapter loads a second
 *   copy from its own `node_modules` and every hook reads a null dispatcher.
 *   Its header has the whole account.
 * - `typescript` is declared at 5.x, because Expo's CLI reads the project
 *   tsconfig through the TypeScript API and crashes on the 7 the rest of the
 *   workspace is on.
 * - `packages/react-native` pins its type-only `react-native` devDependency to
 *   the version this app uses, because a floating range there resolves higher
 *   and hands Metro mismatched React Native internals.
 *
 * None of the three is a consumer's problem. All three exist because this app
 * lives inside the workspace that builds the adapter.
 *
 * What to look for, in the order the screens are laid out:
 *
 * 1. **The grid.** Ten silhouettes, one per band, each with the shape trait
 *    pinned. If a shape is missing or draws as a blank square, the mark for it
 *    is not reaching an element.
 * 2. **Backdrops.** The plate must sit *behind* the figure and must not lean
 *    or scale with it.
 * 3. **Poses.** `happy` shifts the body upward. If the posed row sits at the
 *    same height as the idle one, the `transform` is being dropped; if it sits
 *    at a different height than the same pose on the web, it is being applied
 *    twice.
 * 4. **The tinted pose.** `mad` recolours the head and leaves the eyes alone.
 * 5. **The morph.** Tap through the poses. Every channel has to move together
 *    over the same 300ms. If the eyes travel and the body snaps, or the tint
 *    arrives instantly while the eyes ease, a channel is being applied outside
 *    the interpolation. Tap two poses in quick succession: the second morph
 *    must start from where the face is, not from the pose the first set out
 *    from. And returning to idle is deliberately slower than adopting a pose,
 *    which is the one difference to watch for rather than to correct.
 */

import { useState, type ReactNode } from "react";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Blobatar, MorphingBlobatar } from "@blobatar/react-native";
import {
  happy,
  mad,
  sad,
  sleepy,
  surprised,
  thinking,
  wink,
  type Expression,
} from "blobatar/expression";

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

/**
 * The morph, which is the one thing on this screen a still screenshot cannot
 * check. Deliberately large: at 64pt the eye channels are a couple of points of
 * travel and a dropped one is invisible.
 */
const MORPHS: [string, Expression | undefined][] = [
  ["idle", undefined],
  ["happy", happy],
  ["sad", sad],
  ["mad", mad],
  ["surprised", surprised],
  ["wink", wink],
  ["sleepy", sleepy],
  ["thinking", thinking],
];

function Morph() {
  const [i, setI] = useState(0);
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>
        The morph: tap a pose, and tap two in a row to interrupt one
      </Text>
      <View style={styles.morph}>
        <MorphingBlobatar
          name="alain00"
          size={160}
          background="squircle"
          expression={MORPHS[i]![1]}
          title={`alain00, ${MORPHS[i]![0]}`}
        />
      </View>
      <View style={styles.row}>
        {MORPHS.map(([name], n) => (
          <Pressable
            key={name}
            onPress={() => setI(n)}
            style={[styles.chip, n === i && styles.chipOn]}
          >
            <Text style={styles.chipText}>{name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

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
            <Blobatar name="alain00" size={64} traits={{ shape: v }} />
            <Text style={styles.caption}>{name}</Text>
          </View>
        ))}
      </Section>

      <Section title="Backdrops: the plate sits behind, and does not move with the figure">
        {(["square", "circle", "squircle"] as const).map(bg => (
          <View key={bg} style={styles.cell}>
            <Blobatar name="alain00" size={64} background={bg} />
            <Text style={styles.caption}>{bg}</Text>
          </View>
        ))}
        <View style={styles.cell}>
          <Blobatar name="alain00" size={64} background={false} />
          <Text style={styles.caption}>none</Text>
        </View>
      </Section>

      <Section title="Poses: happy lifts the body, mad tints the head only">
        <View style={styles.cell}>
          <Blobatar name="alain00" size={64} background="squircle" />
          <Text style={styles.caption}>idle</Text>
        </View>
        <View style={styles.cell}>
          <Blobatar name="alain00" size={64} background="squircle" expression={happy} />
          <Text style={styles.caption}>happy</Text>
        </View>
        <View style={styles.cell}>
          <Blobatar name="alain00" size={64} background="squircle" expression={mad} />
          <Text style={styles.caption}>mad</Text>
        </View>
      </Section>

      <Morph />

      <Section title="A crowd: every name a different creature">
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
  morph: { alignItems: "center", paddingVertical: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  chipOn: { backgroundColor: "rgba(0,0,0,0.18)" },
  chipText: { fontSize: 12 },
});
