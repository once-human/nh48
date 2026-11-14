# Puneri (nh48)

## How to work here

- Commit and push straight to `main`. No side branches, no pull requests.
- Build with `node tools/build.mjs` (`NH_LOCAL=1` to use local libraries). Don't run the game or take screenshots unless asked.
- Commit messages are one plain-English paragraph a player could read, saying what changed for them.

## Every commit says what kind of change it is

The game's version is worked out from the history by `tools/version.mjs`; nobody sets it by hand. End every commit
message with one line (before any Co-Authored-By lines), judged by what the change is for the player, not by its size:

    Change: generation - <why>      a new way to play: a new mode, the game rebuilt, a new city or the map remade
    Change: release - <why>         something new in the game: a story chapter or part, a mechanic, a system,
                                    a vehicle, a power, a district, a screen
    Change: fix - <why>             everything else: fixes, tuning, polish, map and asset updates, tooling

One feature built over several commits is one release: mark the commit that makes it playable `release`, the rest `fix`.
When unsure between two, pick the lower.
