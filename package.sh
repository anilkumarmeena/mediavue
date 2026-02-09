#!/bin/bash

# MediaVue Extension Packager
# Automates the creation of a clean production .zip file for the Chrome Web Store.

VERSION=$(grep '"version"' manifest.json | cut -d '"' -f 4)
ZIP_NAME="mediavue_v${VERSION}.zip"

echo "📦 Packaging MediaVue v${VERSION}..."

# Remove old zip if exists
rm -f "$ZIP_NAME"

# Create the zip file
# -r: recursive
# -q: quiet
# -x: exclude specific patterns
zip -rq "$ZIP_NAME" . \
    -x "*.DS_Store" \
    -x "*/.DS_Store" \
    -x ".git/*" \
    -x ".gitignore" \
    -x "store_assets/*" \
    -x "PUBLISHING_GUIDE.md" \
    -x "package.sh" \
    -x "README.md" \
    -x "icons/icon_source.svg" \
    -x "mediavue_*.zip"

if [ $? -eq 0 ]; then
    echo "✅ Successfully created $ZIP_NAME"
    echo "📄 Contents included: manifest.json, background.js, content.js, icons/, popup/, sidepanel/, utils/"
else
    echo "❌ Failed to create zip file."
    exit 1
fi
