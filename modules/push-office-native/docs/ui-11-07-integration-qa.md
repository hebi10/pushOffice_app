# UI-11-07 — Native regression trigger

This QA-only marker intentionally changes no Kotlin or production code.

Baseline: d4d0e8d324a96f4cd8ad0c904ef187fb2571056e
Combined changes: PR #50 settings and schedule detail; PR #51 AI models; PR #52 widget/Quick Settings native tests.

Triggered job: `Push Office Mono Office native instrumentation` on Android API 29.

Required for release, not satisfied by this marker alone: Android API 35/36 UI and native runtime checks, physical Samsung One UI widget/Quick Settings/permissions, real AI model inference, signed AAB and Google Play track readback.
