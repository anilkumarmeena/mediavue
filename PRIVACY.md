# Privacy Policy for MediaVue

**Last Updated: February 2026**

## Overview

MediaVue is a Chrome browser extension that identifies and extracts media URLs (video, audio, and streaming manifests) from webpages. We are committed to protecting your privacy and being transparent about our practices.

## Data Collection

**MediaVue does NOT collect, store, or transmit any personal data.**

### What We Don't Collect

- ❌ Personal information
- ❌ Browsing history (except for temporary detection on active pages)
- ❌ Page content (except for identifying media elements)
- ❌ Media URLs you discover
- ❌ Analytics or usage data
- ❌ Cookies or tracking identifiers

### What We Store Locally

MediaVue is primarily stateless. Any discovered media lists are held in your browser's temporary memory and are cleared when you close the extension or reload the tab. 

## Permissions Explained

MediaVue requires certain permissions to function safely and effectively. Here's why:

| Permission | Purpose |
|------------|---------|
| `activeTab` | Required to safely interact with the page you are currently viewing. |
| `scripting` | Needed to execute the detection script that finds `<video>` and `<audio>` tags. |
| `tabs` | Used to identify the active tab and ensure results match your current view. |
| `webRequest` | Required to detect streaming manifests (HLS/DASH) as they load in the background. |
| `sidePanel` | Used to provide a persistent interface for viewing discovered media without blocking the page. |
| `<all_urls>` | Allows the extension to provide its core functionality on any website you choose to use it on. |

## Third-Party Services

MediaVue does **not** use any third-party services, APIs, or analytics.

## Data Security

- All media detection happens locally in your browser.
- All filtering and deduplication logic runs on your device.
- No network requests are made to transmit data to external servers.

## Children's Privacy

MediaVue does not knowingly collect any information from children under 13.

## Changes to This Policy

If we make changes to this privacy policy, we will update the "Last Updated" date above.

## Contact

If you have questions about this privacy policy, please open an issue on our GitHub repository.

## Open Source

MediaVue is open source. You can review the complete source code to verify our privacy practices:
https://github.com/anilkumarmeena/mediavue

---

**Summary**: MediaVue runs entirely in your browser, processes all media detection locally, and never transmits any data externally.
