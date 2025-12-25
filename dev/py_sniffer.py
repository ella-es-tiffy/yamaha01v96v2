import mido
import time
import sys

print("🐍 PYTHON MIDI SNIFFER (SIMPLE & ROBUST)")
print("========================================")

# List inputs
try:
    inputs = mido.get_input_names()
except Exception as e:
    print(f"❌ Error getting inputs: {e}")
    sys.exit(1)

target_port = None
for name in inputs:
    if "01V96" in name or "Port1" in name:
        target_port = name
        break

if not target_port:
    print("❌ No 01V96 found!")
    sys.exit(1)

print(f"✓ Found mixer: {target_port}")
print("🎧 Listening... (Press CTRL+C to stop)")

# Open input in POLLING mode (no callback) - sometimes more stable for sniffing
try:
    with mido.open_input(target_port) as port:
        print("✅ Port opened successfully.")
        while True:
            # Poll for new messages
            for msg in port.iter_pending():
                if msg.type == 'sysex':
                    hex_data = ' '.join([f'{b:02X}' for b in msg.data])
                    print(f"SYSEX: F0 {hex_data} F7", flush=True)
                    
                    # Highlight Bulk Request (0E)
                    if len(msg.data) > 4 and msg.data[4] == 0x0E:
                         print(f"  ⚡ BULK REQUEST: {msg.data[4]:02X} {msg.data[5]:02X}", flush=True)
                else:
                    # Log EVERYTHING else
                    print(msg, flush=True)
            
            time.sleep(0.001) # Tiny sleep to prevent CPU burn

except KeyboardInterrupt:
    print("\nStopped.")
except IOError as e:
    print(f"\n❌ Port Input Error: {e}")
    print("This usually means the port was grabbed by another app.")
except Exception as e:
    print(f"\n❌ Error: {e}")
