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
The width of a mini's grid footprint on the table, fixed by its size category or given directly for a custom size. It determines the figure's scale. The margin adds paper outside this width.
_Avoid_: Size, width

**Size category**:
A named creature size — tiny, small, medium, large, huge, gargantuan — each mapping to a base width. `custom` sets a base width directly.

**Fold line**:
The dotted line at a mini's vertical centre, where front and back meet when folded.

**Tab**:
The strip at each end of an unfolded mini. Folding brings the two tabs together under the base, doubling their thickness.

**Cut**:
The path a user's scissors follow. Faint outlines mark the tab boundaries; the figure is cut freehand, leaving a rim with the tabs still attached. The rim retains any artwork background colour.

### The sheet

**Sheet**:
One page of the generated PDF, A4 or Letter, holding minis packed into rows.
_Avoid_: Page

**Gap**:
The space between neighbouring minis on a sheet. Wide enough that cutting one mini's margin never reaches its neighbour.

**Entry**:
One row of the user's input: artwork, a size category, and a number of copies. Expands into that many minis when packed.
_Avoid_: Row, item
