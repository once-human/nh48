# Puneri (nh48)

## Building

`node tools/build.mjs` builds the game into `dist/` (`NH_LOCAL=1` uses the libraries in `node_modules`).

## Every commit says what kind of change it is

The game's version (GENERATION.RELEASE.FIX) is worked out from the history by `tools/version.mjs`; nobody sets it by
hand. You are the judge: you know what you just changed, so you say what it amounts to. End every commit message with
one `Change:` line (before any Co-Authored-By lines).

There is no list of cases to match. Ask what a player who knows the game would say after this change, whatever it
touched (code, map, art, sound, story, rules, controls, anything):

    Change: generation - <why>   "This is a different game now", or "there's a whole new way to play it."
                                 What the game is, or what you can do with it, has changed at the root.
    Change: release - <why>      "There's something new." They can do, see, hear, reach or own something they
                                 couldn't before, and would tell a friend about it.
    Change: fix - <why>          "It's better." Nothing new exists; what was there works, looks, sounds or runs
                                 better. Also anything a player never sees (tooling, refactors, build).

For scale only, never as a checklist: a new mode, a new city, the game redrawn from scratch or multiplayer would be a
generation; a story chapter, a mechanic, a vehicle, a district, a festival would be a release.

- Judge the change, not its size. Ten lines can be a release; ten thousand can be a fix.
- One thing built over several commits is counted once: mark the commit that makes it playable, the rest are `fix`.
- When honestly torn between two, pick the lower. Generations should be rare enough to mean something.
