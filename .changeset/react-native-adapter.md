---
"@blobatar/react-native": minor
"blobatar": minor
---

React Native and Expo adapter.

`@blobatar/react-native` renders through `react-native-svg`, from a new
`_marks` export on `blobatar/internal`: the figure as drawing primitives
rather than as markup, because React Native has no `innerHTML` and its
`<Image>` does not decode SVG, so neither of the existing rendering modes ports.

Additive throughout: a new package, a new `internal` export, nothing renamed or
removed. `size` is required on this adapter and there is no `animate`, because
the motion layer is CSS, which the platform does not have. `expression` works in
full.
