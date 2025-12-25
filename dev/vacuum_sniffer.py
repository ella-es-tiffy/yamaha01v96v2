import mido
import time
import sys

print("🌪️ VACUUM CLEANER SNIFFER - SUCKING EVERYTHING")
print("=============================================")

inputs = mido.get_input_names()
open_ports = []

def make_callback(port_name):
    def callback(msg):
        # Allow EVERYTHING. Spam away.
        print(f"[{port_name}] {msg}", flush=True)
    return callback

# Open EVERY port found on the system
for name in inputs:
    try:
        # Don't filter by name. Just open it.
        port = mido.open_input(name, callback=make_callback(name))
        open_ports.append(port)
        print(f"✅ Opened: {name}")
    except Exception as e:
        print(f"❌ Failed to open {name}: {e}")

if not open_ports:
    print("❌ No ports found on system!")
    sys.exit(1)

print(f"\n🎧 Listening on {len(open_ports)} ports... (Press CTRL+C to stop)")

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("\nStopped.")
