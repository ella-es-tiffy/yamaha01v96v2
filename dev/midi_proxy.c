#include <CoreFoundation/CoreFoundation.h>
#include <CoreMIDI/CoreMIDI.h>
#include <stdio.h>

MIDIPortRef outputToMixer = 0;
MIDIEndpointRef realMixerDest = 0;
MIDIEndpointRef virtualSrc = 0;

void ProxyInputCallback(const MIDIPacketList *list, void *procRef, void *srcRef) {
    const MIDIPacket *packet = &list->packet[0];
    
    for (int i = 0; i < list->numPackets; ++i) {
        printf("SM→MIXER: ");
        for (int j = 0; j < packet->length; ++j) {
            printf("%02X ", packet->data[j]);
        }
        printf("\n");
        fflush(stdout);
        
        // Forward to real mixer using output port
        if (outputToMixer && realMixerDest) {
            OSStatus result = MIDISend(outputToMixer, realMixerDest, list);
            if (result != noErr) {
                printf("   ❌ Failed to forward to mixer: %d\n", result);
            }
        }
        
        packet = MIDIPacketNext(packet);
    }
}

void MixerInputCallback(const MIDIPacketList *list, void *procRef, void *srcRef) {
    const MIDIPacket *packet = &list->packet[0];
    
    for (int i = 0; i < list->numPackets; ++i) {
        printf("MIXER→SM: ");
        for (int j = 0; j < packet->length; ++j) {
            printf("%02X ", packet->data[j]);
        }
        printf("\n");
        fflush(stdout);
        
        // Forward to SM via virtual source
        if (virtualSrc) {
            OSStatus result = MIDIReceived(virtualSrc, list);
            if (result != noErr) {
                printf("   ❌ Failed to forward to SM: %d\n", result);
            }
        }
        
        packet = MIDIPacketNext(packet);
    }
}

int main() {
    printf("🔨 NATIVE C MIDI PROXY (MAN-IN-THE-MIDDLE)\n");
    printf("==========================================\n");
    
    MIDIClientRef client;
    MIDIClientCreate(CFSTR("ProxyClient"), NULL, NULL, &client);
    
    // Create virtual destination for SM to send to
    MIDIEndpointRef virtualDest;
    MIDIDestinationCreate(client, CFSTR("01V96 Proxy IN"), ProxyInputCallback, NULL, &virtualDest);
    printf("✅ Created virtual destination: '01V96 Proxy IN'\n");
    printf("   Connect Studio Manager OUTPUT to this port!\n\n");
    
    // Create virtual source for SM to receive from
    MIDISourceCreate(client, CFSTR("01V96 Proxy OUT"), &virtualSrc);
    printf("✅ Created virtual source: '01V96 Proxy OUT'\n");
    printf("   Connect Studio Manager INPUT to this port!\n\n");
    
    // Create output port to send to real mixer
    MIDIOutputPortCreate(client, CFSTR("ProxyOut"), &outputToMixer);
    
    // Find real mixer destination
    ItemCount destCount = MIDIGetNumberOfDestinations();
    for (ItemCount i = 0; i < destCount; ++i) {
        MIDIEndpointRef dest = MIDIGetDestination(i);
        CFStringRef nameRef;
        MIDIObjectGetStringProperty(dest, kMIDIPropertyName, &nameRef);
        
        char name[128];
        CFStringGetCString(nameRef, name, sizeof(name), kCFStringEncodingUTF8);
        CFRelease(nameRef);
        
        if (strstr(name, "Port1") != NULL && strstr(name, "Proxy") == NULL) {
            realMixerDest = dest;
            printf("✅ Found real mixer destination: %s\n", name);
            break;
        }
    }
    
    if (!realMixerDest) {
        printf("❌ Could not find real Port1 destination!\n");
        return 1;
    }
    
    // Listen to real mixer source
    ItemCount srcCount = MIDIGetNumberOfSources();
    for (ItemCount i = 0; i < srcCount; ++i) {
        MIDIEndpointRef src = MIDIGetSource(i);
        CFStringRef nameRef;
        MIDIObjectGetStringProperty(src, kMIDIPropertyName, &nameRef);
        
        char name[128];
        CFStringGetCString(nameRef, name, sizeof(name), kCFStringEncodingUTF8);
        CFRelease(nameRef);
        
        if (strstr(name, "Port1") != NULL && strstr(name, "Proxy") == NULL) {
            printf("✅ Listening to real mixer source: %s\n", name);
            
            MIDIPortRef inputPort;
            MIDIInputPortCreate(client, CFSTR("ProxyListenPort"), MixerInputCallback, NULL, &inputPort);
            MIDIPortConnectSource(inputPort, src, NULL);
            break;
        }
    }
    
    printf("\n🎧 Proxy running...\n");
    printf("   SM → Proxy IN → MIXER\n");
    printf("   MIXER → Proxy OUT → SM\n");
    printf("   (All traffic logged)\n\n");
    
    CFRunLoopRun();
    return 0;
}
