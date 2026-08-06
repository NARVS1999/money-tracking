# Amounts stored as integer cents

All money values are stored as integer cents (₱24.50 = `2450`); floating-point values never appear in the schema or computation.

Storing amounts as floats risks rounding errors (0.1 + 0.2), especially across summation in exports and summaries. Alternatives were float peso values (rejected: precision errors), strings (rejected: painful math and comparison), or integer cents (chosen: exact, trivially formatted, standard practice for currency). Conversion happens only in one utility (`money.js`).

**Status:** accepted

**Consequences:** every display and input must round-trip through `toPeso`/`parsePeso`; decimal input validation (max 2 places) lives in the amount input.
