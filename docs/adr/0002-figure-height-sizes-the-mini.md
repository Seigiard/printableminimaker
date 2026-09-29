# Figure height sizes the mini, not base width

_Supersedes [ADR-0001](./0001-base-width-sizes-the-figure.md)._

The user picks how tall a figure prints. Width follows from the artwork, and the size category
follows from the height.

ADR-0001 had base width drive the scale, which scaled minis by the trait creatures of one category do not share. Three Medium minis from Printable Heroes measure roughly 2.4, 2.0 and 1.0 in height over width: a vine, a warrior whose axe reaches out sideways, an elemental spreading flame. Fitting each to one base width prints the elemental short and the vine tall, when on the table all three are Medium and a player expects them to stand eye to eye. Height is what creatures of a category share; width is a property of build, pose and props.

## What a size category is

The SRD is explicit that a creature's space is "the area in feet that it effectively controls in combat, not an expression of its physical dimensions" — a typical Medium creature is not 5 feet wide. Space is an abstraction about reach and crowding, and the rules give no creature height at all, per category or otherwise. Neither number in our table can be derived from them.

So base width is a convention, and its remaining jobs are narrow: keep a tab wide enough to stand, and signal relative size. It is deliberately not sized to cover a map square. Artwork overhangs it the way wings and horns overhang a plastic mini's base.

## Height is the input, and the category comes along with it

The first version of this decision kept the size category as the user's input and hung a height off
it. That inherits the category's resolution, and the category is an octave wide: the rules' size
bands double, Medium running 4 to 8 feet. A single height per band is wrong by up to a factor of
two, and Medium is where it hurts, because Medium holds most of what anybody prints. On a test sheet
a dwarf at 4'3" and a bugbear at 7' printed at identical height; on the table one comes up to the
other's chest.

So the choice is split. The user picks a **height slot**. The size category stops being an input and
becomes a label the slot carries, along with the base width it implies — and because the base is
derived from the category rather than stored per slot, two slots sharing a category cannot disagree
about it.

Nine slots rather than six, because two of the six bands need splitting and four do not: Medium
carries three slots and Large two, while Tiny, Small, Huge and Gargantuan keep one each. This is not
a derivation from the rules; both columns are still judgement calls, as below. What changed is only
the key: nine slots chosen by height instead of six chosen by the combat grid.

| Slot | Real height | Typical | Category | Base | Figure |
| --- | --- | --- | --- | --- | --- |
| Tiny | ~2' | familiar, imp, hawk | Tiny | 20 mm | 11 mm |
| Small | ~3'2" | halfling, gnome, goblin, kobold | Small | 25 mm | 17 mm |
| Medium, short | 4'3" | dwarf | Medium | 25 mm | 23 mm |
| Medium | 5'8" | human, elf, orc | Medium | 25 mm | 30 mm |
| Medium, tall | ~7' | bugbear, goliath | Medium | 25 mm | 37 mm |
| Large | ~9' | ogre, troll, owlbear | Large | 37 mm | 48 mm |
| Large, tall | ~13' | hill giant, young dragon | Large | 37 mm | 69 mm |
| Huge | ~20' | giant, adult dragon | Huge | 50 mm | 95 mm |
| Gargantuan | 32'+ | ancient dragon, kraken | Gargantuan | 75 mm | 111 mm |

Anchored on a human at 5'8" printing 30 mm, which is what the six-row table's Medium printed, so a
Medium row standing at its full height is untouched. Artwork wide enough to hit the width cap is not:
the cap moved with the table, and the Consequences section below says how far. That works out to
5.3 mm per foot, held linear from Tiny up to the tall Large slot. Halfling and gnome
share a slot deliberately: 3'0" against 3'4" is 12%, invisible once cut out of paper. The dwarf gets
his own, because 4'3" against 5'8" is 34% and reads instantly.

Small and Medium control the same space in the rules and differ only in real height, which is why
they share a base width and not a height. Base widths are unchanged from the six-row table; only the
key into them moved.

## Where the scale bends, and why

**The top two rows are cut by the page, with headroom.** An unfolded mini costs
`2h + 4×margin + 2×tab`, so at the default 2 mm margin the tallest figure A4 can hold is about
126 mm and Letter about 117 mm. A 40-ft ancient dragon at true scale wants 212 mm and a 448 mm
sheet. So the top of the table comes from the paper rather than from the creature.

Cutting those rows *to* the ceiling is the trap, and the first version of this table fell into it at
117 mm. The figure margin is a setting, not a constant: a user raises it to cut more comfortably, and
because an unfolded mini carries four margins, every millimetre added costs four of height. A
Gargantuan tuned to sit 1 mm inside Letter therefore left the sheet at a 2.25 mm margin — where the
six-row table's 90 mm row had survived roughly 15 mm. Losing the largest mini to a cutting preference
is worse than printing it short.

Gargantuan is therefore cut to 111 mm rather than the 170 mm the linear scale asks for, which leaves
it printable through a 5 mm margin on Letter, the smaller of the two pages, and through 9 mm on A4.

Huge is cut to 95 mm for a different reason, and the distinction matters to anyone re-deriving the
table: its own linear 106 mm is not a page problem at all — it survives a 7.75 mm margin on Letter
and 12 mm on A4. What rules it out is Gargantuan. At 106 against a paper-bound 111 the top two rows
print 5% apart, which on cut paper is no difference at all, and a Huge that reads the same as a
Gargantuan is worse than one printed short. 95 buys back a 17% step. So the price is resolution at
the top: above Large the table signals rank rather than height. Below Large nothing moved.

Whether either row stands at all is a separate question and still open: a figure twice the height of
its 50 mm base, on 0.3 mm photo paper, may not. If it does not, the limit is structural rather than
typographic and wants a printed sheet, not an argument.

**The bottom end is floored by the tab, and the tab yields.** `TAB_HEIGHT_MM` is 8 mm, and a Tiny at
11 mm would be only 1.4× its own tab — the "strip of paper with a dot on top" that #20's story 10 was
written against, and the reason the six-row table inflated Tiny to 24 mm. The two ways out were to
lift Tiny and Small above true scale again, or to make the tab proportional at the small end. Lifting
them re-compresses exactly the halfling-versus-dwarf gap this grading exists to open, so the tab
gives way instead: it is capped at 40% of the figure standing on it and floored at 4 mm, below which
the fold has nothing to grip. Any figure printing 20 mm or taller keeps the full 8 mm, which at
nominal height is every slot from the short Medium up. At their own heights Tiny and Small stand
2.5× their tabs. This wants confirming against a printed sheet rather than in the abstract.

Both of those are statements about a figure's *printed* height, because that is what the tab is
measured from rather than the slot's nominal one — a figure scaled down by the width cap gets the tab
it actually stands on. So wide artwork moves a slot down the rule: a Medium on 4:1 prints 11.25 mm
and takes a 4.5 mm tab, not the 8 mm its slot would suggest. And below about 10 mm of printed figure
the 4 mm floor takes over from the proportion entirely, so a heavily capped Tiny can end up no taller
than its own tab. The floor wins there on purpose: the grip the fold needs is a fixed physical
quantity and does not scale away. The number badge is told how much
paper sits below the image — margin plus tab — and shrinks to stay inside it, because a Tiny at zero
margin would otherwise hang its badge off the mini.

**Custom keeps naming both numbers.** It could derive a base width from its height the way the slots
do, but then nothing would set a base width directly, and that is the one job custom exists for.

## Consequences

`MAX_HEIGHT_RATIO` existed because width led: without it a tall image scaled to a fixed width grew unbounded, and a Small mini could out-top a Large one. Height now comes from the height slot, so that cap had no work left and is gone. The mirror problem appears on the other axis, and a width cap replaced it. On hitting the cap the whole figure scales down, giving up a little height; artwork is never cropped.

That cap is measured against the height the slot prints at — `MAX_WIDTH_TO_SLOT_HEIGHT`, 1.5 — and not against its base width, which is what it was when the category fixed the height. A base-width cap carries no slot term, because every slot of a category shares one base, so a capped figure's height collapsed to the same millimetres for every slot of its category: on artwork twice as wide as it is tall, the dwarf and the bugbear printed identically again, which is the defect this grading exists to remove. Against the slot's height the scale-down is proportional and the slots stay ordered at every aspect ratio.

It bounds width, not the printed width-to-height ratio, and is not meant to bound that: the artwork's own proportions survive the scale-down, which is what keeps the figure uncropped. A 4:1 Medium prints 45 × 11.25 mm and is still 4:1.

1.5 is a judgement about how far a figure may spread, not a number the paper forces — A4 would hold about 1.67 at the tallest slot. It is chosen to sit close to the 1.67 the old base-width cap happened to give a Medium, so the common case barely moves.

A capped figure still gives up more height than the six-row table's cap did, because the figures grew and the bases did not: a Medium on 3:1 artwork prints 15 mm rather than its slot's 30 mm, and its cap engages from 1.5:1 where the old one waited until 1.67:1. The loss is proportional, so the slot ordering a user picked by is still what they get — but a slot's quoted height is what an uncapped figure prints, not a promise.

A figure may be wider than its base, so a mini reserves the greater of figure width and base width, plus its margins. That could not happen before.

Both models shipped behind a switch until they could be compared on real artwork. On a sheet of party and monster art the width model printed the halfling as the tallest humanoid on the page — taller than the dwarf, level with the lich — because the art fills its canvas, width was pinned to the base, and height followed the aspect ratio, so the framing of whoever drew the piece decided the scale. The height model won and #19 removed the switch, `SIZE_WIDTH_MM` and the losing branch.

#24 regraded the table: the six-row version gave a dwarf and a bugbear, both Medium, the same
printed height, which was a limit of the table rather than of height-driven sizing. Height is now
the input and the category is derived, as above.

Measuring height from the artwork's bounding box means a raised weapon eats into the figure's height, printing that mini shorter. Accepted for now, and revisited if real artwork makes it common.
