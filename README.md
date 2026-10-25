# Axiom

A little play. A sharper mind.

[Play Axiom](https://trying-ai.github.io/axiom-play/) · [All 18 games](https://trying-ai.github.io/axiom-play/#/games) · [Play with a friend](https://trying-ai.github.io/axiom-play/#/multiplayer)

Eighteen logic, memory and number games, each with three difficulty levels, instructions and hints. Solo games work without an account, and solo progress stays in your browser.

## Multiplayer beta

Race a friend in **Mini Sudoku, Queens, Tango, Nonogram, or Lights Out**:

1. Sign in to your Axiom account and choose **Play with a friend**.
2. Create a room, choose a game and difficulty, and share the invitation link.
3. Your friend signs in with their own account and joins. Both players select Ready.
4. Solve your own board. Your opponent sees your connection and entry progress, not your board.
5. Submit your completed board. Firebase security rules validate the saved board and accept one winning result.

Acknowledged multiplayer moves are saved in Firebase Realtime Database and restored on reconnect. Leaving a page preserves the room; explicitly ending the room closes it for both players. Each room expires after one hour.

These are casual races. The prepared puzzle collection can repeat, and external solvers cannot be prevented. Progress percentages are estimates, not correctness scores. Finish order follows accepted server writes and is affected by network delay. There are no ranked ratings or prizes.

The beta allows one active room and up to 100 room participations per account. It uses Firebase's no-cost Spark plan, which currently supports 100 simultaneous database connections; availability is subject to its storage and download quotas. See [Firebase pricing](https://firebase.google.com/pricing).

## Separation

This repository contains only the frontend served by GitHub Pages. Firebase provides Authentication and multiplayer data storage with security rules. It does not host the game website. Backend rules, validation tooling and tests are maintained in a separate private repository. No Rust server, Render service or deployed Cloud Functions are used for this beta.
