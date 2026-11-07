#!/usr/bin/env bash
#
# ContextFlow QNX 8.0 QEMU Target Runner
# Boots the QNX Initial File System (IFS) image inside QEMU x86_64
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IFS_IMAGE="$PROJECT_DIR/build/x86_64/contextflow-qnx.ifs"

echo "=================================================="
echo "  ContextFlow QNX 8.0 Virtual Target Runner"
echo "=================================================="

# Check for QEMU executable
if ! command -v qemu-system-x86_64 &> /dev/null; then
    echo "[WARN] qemu-system-x86_64 is not installed on this host."
    echo "       Install QEMU to execute the target simulation."
    echo "       Ubuntu: sudo apt-get install qemu-system-x86"
    echo "       macOS:  brew install qemu"
    echo ""
    echo "[DRY-RUN] Command that would execute with QNX IFS image:"
    echo "  qemu-system-x86_64 -m 512M -kernel \"$IFS_IMAGE\" -nographic -serial mon:stdio"
    exit 0
fi

# Check if the IFS image exists
if [ ! -f "$IFS_IMAGE" ]; then
    echo "[INFO] Target IFS image not found at: $IFS_IMAGE"
    echo "       Building with mkifs requires QNX SDP 8.0 on an x86_64 Linux host:"
    echo "         mkifs qnx-hello.build build/x86_64/contextflow-qnx.ifs"
    echo ""
    echo "[DRY-RUN] Simulating virtual target boot..."
    echo "  qemu-system-x86_64 -m 512M -kernel \"$IFS_IMAGE\" -nographic"
    exit 0
fi

echo "[INFO] Launching QEMU target emulator..."
exec qemu-system-x86_64 \
    -m 512M \
    -kernel "$IFS_IMAGE" \
    -nographic \
    -serial mon:stdio

