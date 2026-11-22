# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/shinichibi/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/shinichibi/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A dependency-free CSV reader for Node 22 that returns csv-reader 1.0.0's exact answers — the same columns, rows and broken-row errors ({code, line, row}, stray CRs, quote junk, unterminated quotes, short and long rows) — several times faster. Where the reference builds each field a character at a time, this reader scans for the next character that can change the reading and slices whole fields straight out of the text; only a field that really is broken is assembled from pieces. On the kit's practice set (6 cases, 10.2M characters) its answers are byte-identical to the reference's and run() takes about a third of the reference's CPU time.

## Run it

```sh
MAKEFUN_INPUT_DIR=<dir holding cases.json> MAKEFUN_OUTPUT_DIR=<dir for answers.json> node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=w1q3nb4x&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
