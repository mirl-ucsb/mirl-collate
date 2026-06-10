# MIRL Collate

**Put two pictures next to each other and look closely.**

MIRL Collate is a free, friendly tool for comparing images. You load two of them
(or up to four), and it lets you study them together: side by side with a single
shared zoom, or stacked one on top of the other so you can swipe, fade, blink,
and difference between them. You can drop numbered markers on details worth
discussing, and it will write you a clean citation for each picture.

It was built for people in the **arts, humanities, and cultural heritage**:
curators, archivists, art and architectural historians, conservators, artists,
librarians, and students. **You do not need to know how to code to use it.**

The tool opens with a small sample already loaded, two states of the same
building facade, so you can see how everything works before you add anything of
your own.

---

## What you might use it for

- Two **states of a print**, or an etching against its preparatory drawing.
- A painting and its **infrared or raking-light** photograph.
- A building **before and after** a renovation, or a historical photograph
  against a measured drawing.
- A manuscript page and a **later copy**, or two versions of the same
  composition attributed to different hands.
- A conservation **before and after**, to show exactly what changed.
- Any two pictures where the interesting thing is the **difference between
  them**.

---

## The three ways to look

**Side by side.** Two frames, each with its own picture. Turn on **Linked pan and
zoom** and they move together, so wherever you go in one image you are in the
same place in the other. This is the close-reading view.

**Grid of four.** The same idea, for up to four images at once. Useful for a
series, a set of states, or four details of one object.

**Overlay.** The two pictures are laid exactly on top of each other, and you read
the difference in one of four ways:

- **Curtain.** A divider you drag across the frame. To its left, one image; to
  its right, the other. Slide it back and forth over a detail.
- **Onion skin.** Fade smoothly from one image to the other.
- **Blink.** Flip automatically between the two. Anything that moved or changed
  seems to flicker, which is the oldest trick in the book for spotting
  differences.
- **Difference.** Show only what is *not* the same. Identical areas go black; the
  changes light up.

---

## Loading your own images

There are three ways to bring a picture in, on each image card or by dropping a
file straight onto a frame:

1. **A file from your computer.** Drag it onto a frame, or use **Choose file**.
2. **A web address.** Paste a link to a JPEG, PNG, or TIFF.
3. **A IIIF image or manifest.** Paste the address of a **IIIF** image (an
   `info.json`) or a **IIIF manifest** from a museum or library, and Collate will
   load it as a deep-zoom image, tile by tile. Many collections (the Getty, the
   Bibliothèque nationale, Yale, and hundreds of others) publish their images
   this way. A large IIIF image fills in over a few seconds, with a spinner while
   it loads. The source has to allow cross-origin access (CORS), which almost all
   IIIF servers do; if one does not, Collate tells you so rather than failing
   silently. For some collections (the Yale Center for British Art, for one) you
   can paste the object's ordinary catalogue-page address and Collate will find
   its IIIF manifest for you.

Fill in an image's details once (title, maker, date, repository, accession
number, rights, source) and they flow straight into the citation.

---

## Marking details

Turn on **Annotate** and click any image to drop a numbered marker. Markers stay
pinned to the picture as you zoom and pan, so a point you make at full frame is
still in the right place when you are nose-to-the-canvas. Give each one a short
label and a note. You can export the whole set as a spreadsheet (CSV) or as data
(JSON), with both the on-screen position and the underlying pixel position of
every marker.

---

## Citations

Open the **Cite** panel, choose an image and a style, and Collate builds the
reference for you in **Chicago**, **MLA**, **APA**, or **BibTeX**, from the
details on the image's card. Copy it with one click.

---

## Saving your work

From the **Export** menu you can:

- **Save the comparison as a PNG**, markers and all, ready to drop into a slide,
  a handout, or an article.
- **Save the project** as a small `.json` file and open it again later. Web and
  IIIF images come back on their own; for images loaded from your own computer,
  the details and markers are kept and you re-open the files.
- **Export the markers** on their own, as CSV or JSON.

---

## Running it

MIRL Collate is a plain web page with no build step and nothing to install.

- The simplest way: **double-click `index.html`** to open it in your browser.
- If your browser is cautious about local files, or you want to share it on the
  web, serve the folder instead. From the Collate folder:

  ```bash
  python3 -m http.server 8000
  ```

  then visit `http://localhost:8000`. It also runs as-is on **GitHub Pages**.

To regenerate the sample images, run `python3 samples/make-samples.py` (needs
[Pillow](https://python-pillow.org)).

---

## Technical reference

- **Deep zoom and IIIF** are handled by [OpenSeadragon](https://openseadragon.github.io)
  (vendored in `vendor/`, no network needed). Local files and plain image URLs
  open as single-image tile sources; IIIF `info.json` and Presentation manifests
  (v2 and v3) are resolved to their image service.
- **Linked pan and zoom** mirrors each viewer's centre and zoom to the others in
  normalized viewport coordinates, with a small tolerance to avoid feedback.
- **Overlay** uses one viewer with two tiled images: onion skin sets the top
  image's opacity, difference sets its canvas composite operation, and the
  curtain clips the top image to the screen column under the divider, recomputed
  each frame.
- **Markers** are stored in viewport coordinates and drawn as OpenSeadragon
  overlays, so they track the image under zoom.
- **No data leaves your machine.** Everything runs in the browser. Remote images
  can be exported to PNG only if their server allows cross-origin reading (CORS).

### Layout

```
mirl-collate/
├── index.html          # the page
├── css/style.css
├── js/
│   ├── viewers.js      # state, OpenSeadragon panes, loading, linked pan/zoom
│   ├── overlay.js      # curtain / onion / blink / difference
│   ├── annotations.js  # numbered markers
│   ├── citation.js     # Chicago / MLA / APA / BibTeX
│   ├── exporters.js    # PNG, project, marker export
│   └── app.js          # interface wiring
├── vendor/openseadragon.min.js
└── samples/            # the two demonstration facades + their generator
```

---

Built at the [Material / Image Research Lab](https://mirl.arthistory.ucsb.edu),
Department of History of Art & Architecture, UC Santa Barbara.
Released under the MIT License. OpenSeadragon is BSD-licensed.
