# Paper Mini Generator

Turns uploaded artwork into print-ready PDFs of foldable paper miniatures for tabletop play. Everything runs in the browser.

## Language

### The artwork

**Artwork**:
The image a user uploads for one entry. Stays untouched so any derived image can be recomputed.
_Avoid_: Picture, asset, source

**Figure**:
The pixels of the artwork that depict the creature, as opposed to its background.
_Avoid_: Subject, character, sprite

**Background**:
The pixels of the artwork that are not the figure. Either transparent (an alpha channel) or a flat colour, and the two are detected differently.

**Trim**:
Cropping artwork to the figure's bounding box, discarding background margins. The image stays rectangular.
_Avoid_: Crop, cut

**Knockout**:
Replacing background pixels with transparency, leaving the figure as a silhouette. Distinct from a trim, which only removes margins.
_Avoid_: Background removal, masking

**Normalization**:
Trimming artwork to its figure so the original framing does not affect the printed scale. The figure margin is a separate setting.

**Margin** (figure margin):
The paper added around each face outside its base width, measured in millimetres and identical for every mini on a sheet. It applies whether normalization is on or off.
_Avoid_: Padding, whitespace, bleed

### The printed mini

**Mini**:
One printed, foldable miniature: a figure over its base, front and back, with the tabs and fold that make it stand.
_Avoid_: Miniature, model, token

**Base width**:
The width of a mini's tab, derived from the size category its height slot carries, or given directly for a custom size. A convention rather than a measurement: it keeps the tab wide enough to stand and signals relative size, and it is not sized to cover a map square. Artwork may be wider and overhang it.
_Avoid_: Size, width, footprint

**Height slot**:
What the user picks, and the only input to a mini's scale: a graded real height — nine of them, from 0.6 m to 10 m+ — carrying its figure height in millimetres and the size category it belongs to. The interface states the creature's height and leaves the millimetres to a tooltip, because the millimetres are the consequence rather than the choice. `custom` bypasses the grading and names both numbers directly.
_Avoid_: Size, size category

**Size category**:
A named creature size — tiny, small, medium, large, huge, gargantuan. No longer an input: a height slot carries one, and the category's single remaining job is to fix the base width. Six categories over nine slots, because a category spans an octave of real height: Medium carries three slots and Large two, while the other four carry one each.

**Figure height**:
How tall a figure prints, fixed by its height slot. It is what scales a mini; the figure's width then follows the artwork's proportions, capped so a spread-out figure cannot run away.

**Fold line**:
The dotted line at a mini's vertical centre, where front and back meet when folded.

**Tab**:
The strip at each end of an unfolded mini. Folding brings the two tabs together under the base, doubling their thickness. Normally 8 mm, but under a figure too short to carry that it shrinks with the figure, down to a floor where the fold still has something to grip.

**Cut**:
The path a user's scissors follow. Faint outlines mark the tab boundaries; the figure is cut freehand, leaving a rim with the tabs still attached. The rim retains any artwork background colour.

### The sheet

**Sheet**:
One page of the generated PDF, A4 or Letter, holding minis packed into rows.
_Avoid_: Page

**Gap**:
The space between neighbouring minis on a sheet. Wide enough that cutting one mini's margin never reaches its neighbour.

**Entry**:
One row of the user's input: artwork, a height slot, and a number of copies. Expands into that many minis when packed.
_Avoid_: Row, item
