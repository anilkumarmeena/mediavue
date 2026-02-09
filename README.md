# MediaVue Chrome Extension

MediaVue is a professional media extraction tool for Chrome that identifies video, audio, and streaming manifests (HLS/DASH) on any webpage. It combines DOM analysis with real-time network monitoring to provide a comprehensive view of all media assets.

## 🚀 Features

- **🔍 Intelligent Extraction**: Finds media in `<video>`, `<audio>`, `<source>`, and `<track>` tags using advanced DOM scanning and heuristics.
- **🌐 Network Monitoring**: Captures high-quality streaming manifests (`.m3u8`, `.mpd`) and direct media files in real-time as they load.
- **📋 Smart Deduplication**: Intelligently merges results from different sources and removes redundant entries to keep your list clean.
- **⚡ Quick Actions**: One-click copy to clipboard or open in a new tab for any discovered asset.
- **💎 Premium Design**: Modern dark-themed interface with glassmorphism, smooth animations, and a high-resolution squircle icon for maximum visibility.

## 🛠 Installation

1. Download or clone this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Toggle the **Developer mode** switch in the top right corner.
4. Click the **Load unpacked** button.
5. Select the `mediavue` directory (the folder containing `manifest.json`).

## 📖 How to Use

1. Navigate to any website containing video or audio.
2. **Tip**: For streaming sites, start playing the video to trigger network-based detection.
3. Click the **MediaVue** icon in your browser toolbar.
4. Click **Scan Page** to aggregate all detected media.
5. Copy or open the results as needed.

## 🏗 Project Structure

- `manifest.json`: Extension configuration (Manifest V3).
- `background.js`: Service worker for network capture and coordination.
- `content.js`: Injected script for DOM-based media extraction.
- `popup/`: User interface files (HTML, CSS, JS).
- `utils/`: Shared logic for media detection and URL handling.
- `icons/`: Extension branding assets.

## 🔒 Privacy & Performance

- **Local Only**: All extraction and processing happen locally on your machine. No data is sent to external servers.
- **Efficient**: Uses dynamic script injection to ensure zero overhead on pages you aren't activey scanning.
- **Stateless**: Clears tab-specific caches automatically when tabs are closed.

---
Built with ❤️ by MediaVue Team
