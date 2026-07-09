#pragma once
#include <vector>
#include <string>
#include <cstdint>
#include <map>

struct BdtNode {
    uint16_t id;
    uint16_t parentId;
    uint16_t firstChildId;
    uint16_t nextSiblingId;
    uint8_t nodeType;
    uint8_t flags;
};

struct BmlAttribute {
    uint8_t type;
    std::string key;
    std::string value;
};

struct BmlNode {
    uint8_t tagId;
    std::string text;
    std::vector<BmlAttribute> attributes;
};

struct BlbNode {
    float x, y, w, h;
    float pTop, pRight, pBottom, pLeft;
    uint8_t bwTop, bwRight, bwBottom, bwLeft;
    uint8_t borderStyle;
    uint8_t bgR, bgG, bgB, bgA;
    uint8_t fgR, fgG, fgB, fgA; // Spec says FG Color RGBA
    uint16_t radius;
    int16_t zIndex;
    uint8_t flags;
};

struct BibImage {
    uint16_t id;
    uint8_t chunkIndex;
    uint8_t compression;
    uint8_t streamingHint;
    std::vector<uint8_t> data;
};

struct BffFont {
    uint16_t id;
    uint8_t chunkIndex;
    uint8_t compression;
    uint8_t streamingHint;
    std::vector<uint8_t> data;
};

struct BmsEntry {
    uint8_t typeId;
    std::vector<uint8_t> value;
};

struct BmsMeta {
    std::vector<BmsEntry> entries;
};

struct BwebDocument {
    std::vector<BdtNode> bdt;
    std::vector<BmlNode> bml;
    std::vector<BlbNode> blb;
    std::map<uint16_t, BibImage> bib;
    std::map<uint16_t, BmsMeta> bms;
    std::map<uint16_t, BffFont> bff;
};

class BwebParser {
public:
    static bool parse(const std::string& filePath, BwebDocument& doc);
};
