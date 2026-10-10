# WHO reference fixtures

These synthetic test fixtures were generated in a separate R process from the official [WorldHealthOrganization/anthro](https://github.com/WorldHealthOrganization/anthro/tree/b776d8a12b1c97369c748b561159fd2ec4f4db58) source, pinned to commit `b776d8a12b1c97369c748b561159fd2ec4f4db58`. Its DESCRIPTION reports version `1.1.0.9000` and licence `GPL-3`. The official source and tables remain outside the production bundle. GPL-3 attribution/licence is included in [WHO-LICENSE](WHO-LICENSE). Distribution of an integrated production reference engine still requires a project licensing decision.

Generate with R and the pinned source checkout:

```sh
R --vanilla --slave -f scripts/generate-who-fixtures.R --args /path/to/anthro reference-fixtures
```

The generation run used R 4.2.2. `who-lms-oracle.csv` contains 304 cases across WAZ, LAZ, WLZ and HCZ, both reference sexes, ordinary and tail values, day 730/731, and exact/intermediate length indices. Coefficients are indexed by chronological days for age indicators and decimal centimetres for WLZ. The expected scores come from the pinned R indicator functions, centiles use R `pnorm`, and flags apply the documented reference thresholds to rounded scores, separately from the TypeScript implementation. `who-normalization-oracle.csv` contains 10 reference-process cases covering positions, the under-nine-month boundary, day 730/731, zero/missing input and oedema.

Checksums (SHA-256):

| Input/output                   | SHA-256                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| Pinned source tarball          | `7a4e0bf3e934c93f9e61ffe6bc6690e67e5d35396a01330438060789507a3279` |
| Official `R/sysdata.rda`       | `e021d51a1e95237e141d7c85382887997d62c8ccd092a791c8fad003d7a5e7c7` |
| `who-lms-oracle.csv`           | `3122465b082b44c39e8f1fcb4e98ff1fc25b1bd16c7e4b039edbce312f88c482` |
| `who-normalization-oracle.csv` | `d13c2e99938d35fdeb2f6fef19825340a212c73f51cc2bb2c50058cb549a132a` |

The tests verify supplied-LMS scores within 0.01, centiles within 0.001, and strict flags exactly. Application scope suppression is tested against the normalization cases. This is **not** full equivalence of a production WHO lookup/normalization pipeline: production reference tables are not bundled, indicators are not published, and medical interpretation is withheld. Complete lookup, normalization, missing/error availability and flag-boundary equivalence must be implemented and independently verified before growth comparisons are enabled.
