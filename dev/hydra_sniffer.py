import mido
import time
import sys

print("🐉 HYDRA SNIFFER - LISTENING ON ALL PORTS")
print("=========================================")

inputs = mido.get_input_names()
open_ports = []
callbacks = []

def make_callback(port_name):
    def callback(msg):
        # NO FILTER. SPAM ME.
        # if msg.type == 'clock' or msg.type == 'active_sensing':
        #    return
            
        if msg.type == 'sysex':
            hex_data = ' '.join([f'{b:02X}' for b in msg.data])
            print(f"[{port_name}] SYSEX: F0 {hex_data} F7")
            
            # Check for Bulk Request (0E)
            if len(msg.data) > 4 and msg.data[4] == 0x0E:
                    print(f"⚡ BULK REQUEST on {port_name}!")
        else:
            print(f"[{port_name}] {msg}")
    return callback

# Open EVERY port that matches Yamaha or 01V96
for name in inputs:
    if "01V96" in name or "Yamaha" in name or "Port" in name:
        try:
            port = mido.open_input(name, callback=make_callback(name))
            open_ports.append(port)
            print(f"✅ Opened: {name}")
        except Exception as e:
            print(f"❌ Failed to open {name}: {e}")

if not open_ports:
    print("❌ No ports opened!")
    sys.exit(1)

print(f"\n🎧 Listening on {len(open_ports)} ports... (Press CTRL+C to stop)")

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("\nStopped.")
    for p in open_ports:
        p.close()
