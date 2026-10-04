# Root Cause Analysis Tracker

| Date | Issue | Severity | How discovered | Verification / recurrence prevention |
| --- | --- | --- | --- | --- |
| 2026-09-20 | [#126: iOS development build from paths with spaces](https://github.com/pkarlsso/FieldDay/issues/126) | Medium | Device Hub manual test exposed Xcode build failure and launch crash. | Build now succeeds from the normal repository path; the Expo config plugin and `patch-package` patch preserve quoted paths after every install. |
