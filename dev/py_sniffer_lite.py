import mido
import time
import sys

print("🐍 PYTHON MIDI SNIFFER LITE")
print("===========================")
print("Ignoring Clock, Sense, and Meters...")

inputs = mido.get_input_names()
target_port = None

for name in inputs:
    if "01V96" in name or "Port1" in name:
        target_port = name
        break

if not target_port:
    print("❌ No 01V96 found!")
    sys.exit(1)

print(f"✓ Found: {target_port}")

try:
    with mido.open_input(target_port) as port:
        for msg in port:
            # Ignore Realtime & Clock
            if msg.type in ['clock', 'active_sensing', 'start', 'stop', 'continue']:
                continue
            
            if msg.type == 'sysex':
                # Ignore Meter Data (huge spam)
                # Meter usually starts with F0 43 10 3E ...
                if len(msg.data) > 6 and msg.data[4] == 0x21: # Example meter byte, adjust if known
                     # Keep it but maybe short log
                     pass

                hex_data = ' '.join([f'{b:02X}' for b in msg.data])
                
                # Highlight Bulk Requests (0E or 0F) and EQ Data (51)
                if len(msg.data) > 8:
                    if msg.data[4] == 0x0E:
                        print(f"\n⚡ BULK REQ: F0 {hex_data} F7")
                    elif msg.data[15] == 0x51: # EQ Library
                        print(f"\n🎯 EQ DATA: F0 {hex_data} F7")
                    else:
                        # Print other sysex only if not meters
                        # Check if it looks like meter spam (often length > 50 orspecific signature)
                        if len(msg.data) < 200: # Log unknown but manageable sysex
                             print(f"SYSEX: F0 {hex_data} F7")
            else:
                # Log Control Changes / Program Changes
                print(msg)

except KeyboardInterrupt:
    print("\nStopped.")
