#include <CoreFoundation/CoreFoundation.h>
#include <CoreMIDI/CoreMIDI.h>
#include <stdio.h>
#include <unistd.h>

void MIDIInputCallback(const MIDIPacketList *list, void *procRef, void *srcRef) {
    const MIDIPacket *packet = &list->packet[0];
    for (int i = 0; i < list->numPackets; ++i) {
        // Filter active sensing (FE) and clock (F8) to reduce spam? 
        // No, user wants EVERYTHING.
        
        printf("MIDI: ");
        for (int j = 0; j < packet->length; ++j) {
            printf("%02X ", packet->data[j]);
        }
        printf("\n");
        
        // Highlight Bulk Request
        if (packet->length > 4) {
             if (packet->data[0] == 0xF0 && packet->data[4] == 0x0E) {
                 printf("⚡⚡⚡ BULK REQUEST DETECTED ABOVE! ⚡⚡⚡\n");
             }
        }
        
        packet = MIDIPacketNext(packet);
    }
    fflush(stdout);
}

int main(int argc, const char * argv[]) {
    printf("🔨 NATIVE C COREMIDI SNIFFER\n");
    printf("============================\n");
    
    MIDIClientRef client;
    MIDIClientCreate(CFSTR("NativeSnifferClient"), NULL, NULL, &client);
    
    MIDIPortRef inputPort;
    MIDIInputPortCreate(client, CFSTR("SnifferInput"), MIDIInputCallback, NULL, &inputPort);
    
    ItemCount sourceCount = MIDIGetNumberOfSources();
    printf("Found %lu MIDI sources:\n", sourceCount);
    
    int connectedCount = 0;
    
    for (ItemCount i = 0; i < sourceCount; ++i) {
        MIDIEndpointRef src = MIDIGetSource(i);
        CFStringRef nameRef;
        MIDIObjectGetStringProperty(src, kMIDIPropertyName, &nameRef);
        
        char name[64];
        CFStringGetCString(nameRef, name, sizeof(name), kCFStringEncodingUTF8);
        CFRelease(nameRef);
        
        // Connect to Yamaha 01V96
        if (strstr(name, "01V96") != NULL || strstr(name, "Port1") != NULL) {
             printf("Connecting to: %s\n", name);
             OSStatus result = MIDIPortConnectSource(inputPort, src, NULL);
             if (result == noErr) {
                 printf("✅ Connected!\n");
                 connectedCount++;
             } else {
                 printf("❌ Failed to connect: %d (Port exclusive?)\n", result);
             }
        }
    }
    
    if (connectedCount == 0) {
        printf("❌ No sources connected. Exiting.\n");
        return 1;
    }
    
    printf("🎧 listening... (CTRL+C to stop)\n");
    
    CFRunLoopRun(); // Main CoreMIDI loop
    return 0;
}
