import rtmidi
import time
import binascii

print("👹 WILD SNIFFER - DIRECT RTMIDI ACCESS")
print("======================================")

midi_in = rtmidi.MidiIn()
ports = midi_in.get_ports()
port_index = -1

for i, port in enumerate(ports):
    if "01V96" in port or "Port1" in port:
        port_index = i
        print(f"🔥 Target found: {port} (Index {i})")
        break

if port_index == -1:
    print("❌ No 01V96 found")
    exit(1)

# Aggressive open
try:
    midi_in.open_port(port_index)
    print("✅ Port OPENED! Listening aggressively...")
except Exception as e:
    print(f"❌ Failed to open: {e}")
    print("   Trying virtual port hijack...")
    try:
        midi_in.open_virtual_port("01V96 Imposter")
        print("   ✅ Created IMPOSTER port. Connect SM to '01V96 Imposter'!")
    except:
        exit(1)

# midi_in.ignore_types(...) - relying on defaults

try:
    while True:
        msg = midi_in.get_message()
        if msg:
            data, delta = msg
            hex_data = binascii.hexlify(bytearray(data)).decode().upper()
            
            # Filter REMOVED - Showing EVERYTHING
            # if hex_data == "F8" or hex_data == "FE":
            #    continue
                
            print(f"RAW: {' '.join([hex_data[i:i+2] for i in range(0, len(hex_data), 2)])}")
            
        time.sleep(0.0001) # Ultra fast poll
except KeyboardInterrupt:
    print("\nStopped.")
    del midi_in
