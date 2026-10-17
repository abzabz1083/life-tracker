---
name: Frankfurter currency coverage
description: Currency API version and supported-pair caveats.
---

The legacy Frankfurter `.app` host redirects to v1, which does not include every currency pair. The current v2 service includes pairs such as USD/AED that v1 rejects.

**Why:** During initial setup, the old endpoint returned a redirect and then a not-found response for USD→AED, while v2 returned a valid rate.

**How to apply:** When changing supported base currencies or the exchange-rate provider, verify every offered pair (especially AED) and show conversion failures rather than saving an unconverted amount.
