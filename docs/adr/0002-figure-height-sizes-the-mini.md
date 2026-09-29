# Figure height sizes the mini, not base width

_Supersedes [ADR-0001](./0001-base-width-sizes-the-figure.md)._

A size category now fixes how tall a figure prints. Width follows from the artwork.

ADR-0001 had base width drive the scale, which scaled minis by the trait creatures of one category do not share. Three Medium minis from Printable Heroes measure roughly 2.4, 2.0 and 1.0 in height over width: a vine, a warrior whose axe reaches out sideways, an elemental spreading flame. Fitting each to one base width prints the elemental short and the vine tall, when on the table all three are Medium and a player expects them to stand eye to eye. Height is what creatures of a category share; width is a property of build, pose and props.

## What a size category is

The SRD is explicit that a creature's space is "the area in feet that it effectively controls in combat, not an expression of its physical dimensions" — a typical Medium creature is not 5 feet wide. Space is an abstraction about reach and crowding, and the rules give no creature height at all, per category or otherwise. Neither number in our table can be derived from them.

So base width is a convention, and its remaining jobs are narrow: keep a tab wide enough to stand, and signal relative size. It is deliberately not sized to cover a map square. Artwork overhangs it the way wings and horns overhang a plastic mini's base.

## The table

Two columns of tuned numbers rather than a width times a coefficient, because both are judgement calls and a product hides that.

| Size | Base width | Figure height |
| --- | --- | --- |
| Tiny | 20 mm | 24 mm |
| Small | 25 mm | 25 mm |
| Medium | 25 mm | 30 mm |
| Large | 37 mm | 44 mm |
| Huge | 50 mm | 60 mm |
| Gargantuan | 75 mm | 90 mm |

Small and Medium control the same space in the rules and differ only in real height, which is why they share a base width and not a height.

## Consequences

`MAX_HEIGHT_RATIO` existed because width led: without it a tall image scaled to a fixed width grew unbounded, and a Small mini could out-top a Large one. Height now comes from the category, so that cap has no work. The mirror problem appears on the other axis, and a width cap of about twice the base width replaces it. On hitting the cap the whole figure scales down, giving up a little height; artwork is never cropped.

A figure may be wider than its base, so a mini reserves the greater of figure width and base width, plus its margins. That could not happen before.

Both models ship behind a switch until they can be compared on real artwork, and the loser is removed. Two permanent sizing models would cost more than either.

Measuring height from the artwork's bounding box means a raised weapon eats into the figure's height, printing that mini shorter. Accepted for now, and revisited if real artwork makes it common.
