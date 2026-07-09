#include "BwebParser.h"
#include <fstream>
#include <iostream>
#include <cstring>
#include <arpa/inet.h>

#include <openssl/sha.h>
#include "verify_ecdsa.h"

static uint16_t readU16BE(const uint8_t* ptr) {
    return (ptr[0] << 8) | ptr[1];
}

static uint32_t readU32BE(const uint8_t* ptr) {
    return (ptr[0] << 24) | (ptr[1] << 16) | (ptr[2] << 8) | ptr[3];
}

static float readFloatBE(const uint8_t* ptr) {
    uint32_t val = readU32BE(ptr);
    float f;
    std::memcpy(&f, &val, sizeof(float));
    return f;
}

bool BwebParser::parse(const std::string& filePath, BwebDocument& doc) {
    std::ifstream file(filePath, std::ios::binary | std::ios::ate);
    if (!file.is_open()) return false;
    
    std::streamsize size = file.tellg();
    file.seekg(0, std::ios::beg);
    std::vector<uint8_t> buffer(size);
    if (!file.read(reinterpret_cast<char*>(buffer.data()), size)) return false;

    if (size < 4) return false;
    
    size_t payloadOffset = 0;
    
    if (buffer[0] == 'B' && buffer[1] == 'P' && buffer[2] == 'G' && buffer[3] == '1') {
        std::cout << "[BWEB Engine] BPG Container detected. Initiating Handshake Verification...\n";
        
        uint32_t payloadLen = readU32BE(buffer.data() + 8);
        const uint8_t* expectedHash = buffer.data() + 16;
        
        uint16_t idLen = readU16BE(buffer.data() + 48);
        uint16_t tokenLen = readU16BE(buffer.data() + 50 + idLen);
        
        std::cout << "[BWEB Engine] Handshake Identity loaded (" << idLen << " bytes).\n";
        std::cout << "[BWEB Engine] Handshake Token loaded (" << tokenLen << " bytes).\n";
        
        payloadOffset = 52 + idLen + tokenLen;
        
        if (payloadOffset + payloadLen > size) {
            std::cerr << "Invalid BPG payload length.\n";
            return false;
        }
        
        // Calculate Integrity Check
        SHA256_CTX ctx;
        SHA256_Init(&ctx);
        SHA256_Update(&ctx, buffer.data() + payloadOffset, payloadLen);
        uint8_t actualHash[32];
        SHA256_Final(actualHash, &ctx);
        
        bool integrityPassed = true;
        for (int i = 0; i < 32; ++i) {
            if (actualHash[i] != expectedHash[i]) integrityPassed = false;
        }
        
        if (!integrityPassed) {
            std::cerr << "[BWEB Engine] Handshake Verification FAILED! Integrity Check mismatch. Tampering detected.\n";
            return false;
        }
        
        const uint8_t* pubKey = buffer.data() + 50;
        const uint8_t* token = buffer.data() + 52 + idLen;
        
        if (!verifyECDSASignature(pubKey, idLen, actualHash, 32, token, tokenLen)) {
            std::cerr << "[BWEB Engine] Handshake Verification FAILED! ECDSA Signature INVALID.\n";
            return false;
        }
        
        std::cout << "[BWEB Engine] Handshake Verification SUCCESS. Integrity Check & ECDSA passed. Rendering...\n";
    }

    const uint8_t* bwebData = buffer.data() + payloadOffset;
    size_t bwebSize = size - payloadOffset;

    if (bwebSize < 6) return false;
    if (bwebData[0] != 'B' || bwebData[1] != 'W' || bwebData[2] != 'E' || bwebData[3] != 'B') return false;
    
    uint8_t sectionCount = bwebData[5];
    
    size_t offset = 6;
    struct Section { uint8_t id; uint32_t offset; uint32_t length; };
    std::vector<Section> sections;
    
    for (int i = 0; i < sectionCount; ++i) {
        if (offset + 9 > bwebSize) return false;
        Section sec;
        sec.id = bwebData[offset];
        sec.offset = readU32BE(&bwebData[offset + 1]);
        sec.length = readU32BE(&bwebData[offset + 5]);
        sections.push_back(sec);
        offset += 9;
    }

    uint16_t nodeCount = 0;

    for (const auto& sec : sections) {
        if (sec.offset + sec.length > bwebSize) continue;
        const uint8_t* secData = bwebData + sec.offset;
        
        if (sec.id == 0) { // BDT
            nodeCount = readU16BE(secData);
            size_t p = 2;
            for (int i = 0; i < nodeCount; ++i) {
                BdtNode node;
                node.id = readU16BE(secData + p); p += 2;
                node.parentId = readU16BE(secData + p); p += 2;
                node.firstChildId = readU16BE(secData + p); p += 2;
                node.nextSiblingId = readU16BE(secData + p); p += 2;
                node.nodeType = secData[p++];
                node.flags = secData[p++];
                doc.bdt.push_back(node);
            }
        } else if (sec.id == 1) { // BML
            uint16_t nc = readU16BE(secData);
            size_t p = 2;
            struct BmlRaw { uint8_t tagId; uint32_t nsOffset; uint16_t attrCount; };
            std::vector<BmlRaw> rawBml;
            for (int i = 0; i < nc; ++i) {
                BmlRaw r;
                r.tagId = secData[p++];
                r.nsOffset = readU32BE(secData + p); p += 4;
                r.attrCount = readU16BE(secData + p); p += 2;
                rawBml.push_back(r);
            }
            struct AttrRaw { uint32_t keyOff; uint8_t type; uint32_t valOff; };
            std::vector<std::vector<AttrRaw>> nodeAttrs(nc);
            for (int i = 0; i < nc; ++i) {
                for (int a = 0; a < rawBml[i].attrCount; ++a) {
                    AttrRaw attr;
                    attr.keyOff = readU32BE(secData + p); p += 4;
                    attr.type = secData[p++];
                    attr.valOff = readU32BE(secData + p); p += 4;
                    nodeAttrs[i].push_back(attr);
                }
            }
            uint32_t poolSize = readU32BE(secData + p); p += 4;
            const uint8_t* poolData = secData + p;
            
            auto readStr = [&](uint32_t off) -> std::string {
                if (off >= poolSize) return "";
                uint16_t len = readU16BE(poolData + off);
                return std::string(reinterpret_cast<const char*>(poolData + off + 2), len);
            };

            for (int i = 0; i < nc; ++i) {
                BmlNode node;
                node.tagId = rawBml[i].tagId;
                for (const auto& a : nodeAttrs[i]) {
                    BmlAttribute attr;
                    attr.type = a.type;
                    attr.key = readStr(a.keyOff);
                    if (a.type == 3) {
                        attr.value = readStr(a.valOff);
                    } else if (a.type == 0) {
                        attr.value = a.valOff ? "true" : "false";
                    } else if (a.type == 1) {
                        attr.value = std::to_string((int32_t)a.valOff);
                    } else if (a.type == 2) {
                        uint32_t beVal = readU32BE(reinterpret_cast<const uint8_t*>(&a.valOff)); // valOff readU32BE already converted it to host.
                        float f;
                        std::memcpy(&f, &a.valOff, 4); // Actually, valOff is just the uint32 container. But wait, readU32BE returns host order.
                        // If it's float, we should parse it from the 4 bytes in BigEndian.
                        uint8_t fbuf[4];
                        fbuf[0] = (a.valOff >> 24) & 0xFF;
                        fbuf[1] = (a.valOff >> 16) & 0xFF;
                        fbuf[2] = (a.valOff >> 8) & 0xFF;
                        fbuf[3] = a.valOff & 0xFF;
                        attr.value = std::to_string(readFloatBE(fbuf));
                    }
                    node.attributes.push_back(attr);
                    if (attr.key == "text") node.text = attr.value;
                }
                doc.bml.push_back(node);
            }
        } else if (sec.id == 2) { // BLB
            uint16_t nc = readU16BE(secData);
            size_t p = 2;
            for (int i = 0; i < nc; ++i) {
                BlbNode node;
                node.x = readFloatBE(secData + p); p += 4;
                node.y = readFloatBE(secData + p); p += 4;
                node.w = readFloatBE(secData + p); p += 4;
                node.h = readFloatBE(secData + p); p += 4;
                node.pTop = readFloatBE(secData + p); p += 4;
                node.pRight = readFloatBE(secData + p); p += 4;
                node.pBottom = readFloatBE(secData + p); p += 4;
                node.pLeft = readFloatBE(secData + p); p += 4;
                node.bwTop = secData[p++];
                node.bwRight = secData[p++];
                node.bwBottom = secData[p++];
                node.bwLeft = secData[p++];
                node.borderStyle = secData[p++];
                node.bgR = secData[p++]; node.bgG = secData[p++]; node.bgB = secData[p++]; node.bgA = secData[p++];
                node.fgR = secData[p++]; node.fgG = secData[p++]; node.fgB = secData[p++]; node.fgA = secData[p++];
                node.radius = readU16BE(secData + p); p += 2;
                node.zIndex = (int16_t)readU16BE(secData + p); p += 2;
                node.flags = secData[p++];
                doc.blb.push_back(node);
            }
        } else if (sec.id == 4) { // BIB
            uint16_t ic = readU16BE(secData);
            size_t p = 2;
            struct ImgRaw { uint16_t id; uint32_t offset; uint32_t length; uint8_t chunkIdx; uint8_t compr; uint8_t streamHint; };
            std::vector<ImgRaw> rawImg;
            for (int i = 0; i < ic; ++i) {
                ImgRaw r;
                r.id = readU16BE(secData + p); p += 2;
                r.offset = readU32BE(secData + p); p += 4;
                r.length = readU32BE(secData + p); p += 4;
                r.chunkIdx = secData[p++];
                r.compr = secData[p++];
                r.streamHint = secData[p++];
                rawImg.push_back(r);
            }
            const uint8_t* poolData = secData + p;
            for (const auto& r : rawImg) {
                BibImage img;
                img.id = r.id;
                img.chunkIndex = r.chunkIdx;
                img.compression = r.compr;
                img.streamingHint = r.streamHint;
                img.data.assign(poolData + r.offset, poolData + r.offset + r.length);
                doc.bib[r.id] = img;
            }
        } else if (sec.id == 6) { // BMS
            uint16_t mc = readU16BE(secData);
            size_t p = 2;
            for (int i = 0; i < mc; ++i) {
                uint16_t nodeId = readU16BE(secData + p); p += 2;
                uint8_t entryCount = secData[p++];
                BmsMeta meta;
                for (int e = 0; e < entryCount; ++e) {
                    BmsEntry entry;
                    entry.typeId = secData[p++];
                    uint16_t vLen = readU16BE(secData + p); p += 2;
                    entry.value.assign(secData + p, secData + p + vLen);
                    p += vLen;
                    meta.entries.push_back(entry);
                }
                doc.bms[nodeId] = meta;
            }
        } else if (sec.id == 7) { // BFF
            uint16_t fc = readU16BE(secData);
            size_t p = 2;
            struct FontRaw { uint16_t id; uint32_t offset; uint32_t length; uint8_t chunkIdx; uint8_t compr; uint8_t streamHint; };
            std::vector<FontRaw> rawFont;
            for (int i = 0; i < fc; ++i) {
                FontRaw r;
                r.id = readU16BE(secData + p); p += 2;
                r.offset = readU32BE(secData + p); p += 4;
                r.length = readU32BE(secData + p); p += 4;
                r.chunkIdx = secData[p++];
                r.compr = secData[p++];
                r.streamHint = secData[p++];
                rawFont.push_back(r);
            }
            const uint8_t* poolData = secData + p;
            for (const auto& r : rawFont) {
                BffFont font;
                font.id = r.id;
                font.chunkIndex = r.chunkIdx;
                font.compression = r.compr;
                font.streamingHint = r.streamHint;
                font.data.assign(poolData + r.offset, poolData + r.offset + r.length);
                doc.bff[r.id] = font;
            }
        }
    }

    return true;
}
