# ContextFlow QNX Hello World
# Build with QNX SDP 8.0
#
# Usage:
#   make              - Build for x86_64 (default)
#   make TARGET=aarch64  - Build for aarch64
#   make broken       - Build the intentionally broken version
#   make clean        - Remove build artifacts
#   make run-qemu     - Run in QEMU (requires QEMU setup)

TARGET ?= x86_64
CC = qcc
CFLAGS = -V gcc_nto$(TARGET) -Wall -Wextra -g
LDFLAGS = -lpthread

SRCDIR = src
BUILDDIR = build/$(TARGET)

# Main program
MAIN_SRC = $(SRCDIR)/main.c
MAIN_BIN = $(BUILDDIR)/contextflow-hello

# Broken version for demo
BROKEN_SRC = $(SRCDIR)/broken_main.c
BROKEN_BIN = $(BUILDDIR)/contextflow-broken

.PHONY: all clean broken run-qemu

all: $(MAIN_BIN)

$(BUILDDIR):
	mkdir -p $(BUILDDIR)

$(MAIN_BIN): $(MAIN_SRC) | $(BUILDDIR)
	$(CC) $(CFLAGS) -o $@ $< $(LDFLAGS)
	@echo ""
	@echo "[OK] Build successful: $@"
	@echo "  Target: QNX $(TARGET)"
	@echo "  Compiler: $(CC)"

broken: | $(BUILDDIR)
	-$(CC) $(CFLAGS) -o $(BROKEN_BIN) $(BROKEN_SRC) $(LDFLAGS) 2>&1 | tee $(BUILDDIR)/build-errors.log
	@echo ""
	@echo "Expected build failure captured in $(BUILDDIR)/build-errors.log"
	@echo "Run 'contextflow-qnx analyze $(BUILDDIR)/build-errors.log' to see diagnostics"

clean:
	rm -rf build/

run-qemu:
	@echo "QEMU execution requires a QNX IFS image."
	@echo "Build the IFS image using 'mkifs qnx-hello.build build/qnx-hello.ifs' on an SDP 8.0 host."
