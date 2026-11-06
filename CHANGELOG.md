# Changelog

All notable changes to MIRL Collate are recorded here. Versions follow
[semantic versioning](https://semver.org); project files from any earlier
version open cleanly in any later one.

## 1.1.0 (2026-11-06)

Collate takes the lab's own identity, and gathers the fixes and additions made
since the first release. Project files from 1.0.0 open as before.

- **The MIRL identity.** Familjen Grotesk for names and headings and Epilogue
  for everything you read and operate, the same faces as the Material /
  Image Research Lab's site, on the lab's paper white. Collate's key is the
  violet of the MIRL Risograph mark, paired with teal in the bloom beside its
  name, and used for the current view, the plate numbers, and the markers.
  Both typefaces are vendored in `fonts/` under the SIL Open Font License,
  with their licence texts; Spectral is retired.
- **One bar, plain words.** The mark, the three ways of looking, and Export
  sit on one line, with the controls for the current view on a second.
  Labels are in sentence case, the overlay modes are a single segmented
  control, and every text colour meets WCAG AA (4.5 to 1 or better).
- **Markers** are white with a violet ring, their numbers now centred, on
  screen and in the saved PNG.
- **Difference you can see.** An Amplify control brightens a near-black
  difference so small changes become legible, matched in the PNG export.
- **Distances between markers**, in image pixels, for consecutive markers on
  the same image.
- **Linked pan by image fraction**, so differently sized images track the same
  relative point.
- **Citations.** BibTeX keys are unique, and the access date is kept with the
  project rather than restamped on every open.
- **Exports.** The sparse grid places each image in its own slot, a remote
  image that forbids copying gives a clear message instead of a blank PNG,
  and the blink timer is cleared when you leave Overlay.
- **Keyboard and assistive technology.** A visible focus ring, and toggles and
  views that announce their state.
- **Phones.** The plates stack, and the panel sits beneath them.

## 1.0.0 (2026-06-10)

First public release, archived on Zenodo
([10.5281/zenodo.20651087](https://doi.org/10.5281/zenodo.20651087)).
