#pragma once
#include <SDL2/SDL.h>
#include <SDL2/SDL_ttf.h>
#include <functional>
#include <map>
#include "BwebParser.h"

class Renderer {
public:
    Renderer(SDL_Renderer* sdlRenderer, const BwebDocument& doc);
    ~Renderer();

    void init();
    void draw();
    void cleanup();

    void handleMouseMove(int x, int y);
    void handleMouseClick(int x, int y);
    void handleMouseUp(int x, int y);
    void handleMouseWheel(int deltaY, int mouseX, int mouseY);
    bool needsRender = true;

    std::function<void(uint16_t, const std::string&)> onEvent;

private:
    uint16_t getHitNode(int x, int y);
    void buildRenderOrder();

    SDL_Renderer* renderer;
    const BwebDocument& doc;
    TTF_Font* font;
    std::map<uint16_t, SDL_Texture*> textures;
    
    uint16_t hoveredNodeId = 0xFFFF;
    uint16_t clickedNodeId = 0xFFFF;
    std::vector<int> renderOrder;
    
    // Y-Offset from scrolling per node
    std::map<uint16_t, int> scrollOffsets;
    
    // Font cache by size
    std::map<int, TTF_Font*> fontCache;
    TTF_Font* getFont(int size);
};
