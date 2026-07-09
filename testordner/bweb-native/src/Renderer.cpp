#include "Renderer.h"
#include <SDL2/SDL_image.h>
#include <iostream>
#include <algorithm>
#include <numeric>
#include <SDL2/SDL2_gfxPrimitives.h>

Renderer::Renderer(SDL_Renderer* sdlRenderer, const BwebDocument& d) 
    : renderer(sdlRenderer), doc(d), font(nullptr) {
}

Renderer::~Renderer() {
    cleanup();
}

void Renderer::buildRenderOrder() {
    renderOrder.resize(doc.blb.size());
    std::iota(renderOrder.begin(), renderOrder.end(), 0);
    std::stable_sort(renderOrder.begin(), renderOrder.end(), [&](int a, int b) {
        return doc.blb[a].zIndex < doc.blb[b].zIndex;
    });
}

TTF_Font* Renderer::getFont(int size) {
    if (size <= 0) size = 16;
    if (fontCache.count(size)) return fontCache[size];

    TTF_Font* f = nullptr;
    if (!doc.bff.empty()) {
        const auto& fontData = doc.bff.at(0).data;
        SDL_RWops* rw = SDL_RWFromConstMem(fontData.data(), fontData.size());
        f = TTF_OpenFontRW(rw, 1, size);
    } else {
        f = TTF_OpenFont("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size);
    }
    
    if (f) fontCache[size] = f;
    return f;
}

void Renderer::init() {
    // Load default font size just to test
    font = getFont(16);

    // Load images
    for (auto const& [id, imgData] : doc.bib) {
        SDL_RWops* rw = SDL_RWFromConstMem(imgData.data.data(), imgData.data.size());
        SDL_Surface* surface = IMG_Load_RW(rw, 1);
        if (surface) {
            textures[id] = SDL_CreateTextureFromSurface(renderer, surface);
            SDL_FreeSurface(surface);
        } else {
            std::cerr << "Failed to load image " << id << ": " << IMG_GetError() << "\n";
        }
    }
    
    buildRenderOrder();
}

uint16_t Renderer::getHitNode(int x, int y) {
    for (int i = renderOrder.size() - 1; i >= 0; --i) {
        int idx = renderOrder[i];
        const auto& blb = doc.blb[idx];
        
        int currentScrollY = 0;
        uint16_t currParent = doc.bdt[idx].parentId;
        while (currParent != 0xFFFF) {
            if (scrollOffsets.count(currParent)) currentScrollY += scrollOffsets[currParent];
            currParent = doc.bdt[currParent].parentId;
        }
        int checkY = y + currentScrollY;
        
        if (x >= blb.x && x <= blb.x + blb.w && checkY >= blb.y && checkY <= blb.y + blb.h) {
            if (doc.bms.count(idx)) {
                for (const auto& entry : doc.bms.at(idx).entries) {
                    if (entry.typeId == 3 && entry.value.size() >= 2) {
                        uint16_t mask = (entry.value[0] << 8) | entry.value[1];
                        if (mask & 0x05) return idx; // hover or click
                    }
                }
            }
        }
    }
    return 0xFFFF;
}

void Renderer::handleMouseMove(int x, int y) {
    uint16_t hit = getHitNode(x, y);
    if (hit != hoveredNodeId) {
        hoveredNodeId = hit;
        needsRender = true;
        if (hit != 0xFFFF) std::cout << "Hovered Node: " << hit << "\n";
    }
}

void Renderer::handleMouseClick(int x, int y) {
    uint16_t hit = getHitNode(x, y);
    if (hit != clickedNodeId) {
        clickedNodeId = hit;
        needsRender = true;
        if (hit != 0xFFFF) {
            std::cout << "Clicked Node: " << hit << "\n";
            if (onEvent) onEvent(hit, "click");
        }
    }
}

void Renderer::handleMouseUp(int x, int y) {
    if (clickedNodeId != 0xFFFF) {
        clickedNodeId = 0xFFFF;
        needsRender = true;
    }
}

void Renderer::handleMouseWheel(int deltaY, int x, int y) {
    for (int i = renderOrder.size() - 1; i >= 0; --i) {
        int idx = renderOrder[i];
        const auto& blb = doc.blb[idx];
        
        int currentScrollY = 0;
        uint16_t currParent = doc.bdt[idx].parentId;
        while (currParent != 0xFFFF) {
            if (scrollOffsets.count(currParent)) currentScrollY += scrollOffsets[currParent];
            currParent = doc.bdt[currParent].parentId;
        }
        int checkY = y + currentScrollY;
        
        if (x >= blb.x && x <= blb.x + blb.w && checkY >= blb.y && checkY <= blb.y + blb.h) {
            if (blb.flags & 0x08) { // Overflow Scroll
                scrollOffsets[idx] -= (deltaY * 30);
                if (scrollOffsets[idx] < 0) scrollOffsets[idx] = 0;
                needsRender = true;
                return;
            }
        }
    }
}

void Renderer::draw() {
    SDL_SetRenderDrawColor(renderer, 255, 255, 255, 255);
    SDL_RenderClear(renderer);

    for (size_t k = 0; k < renderOrder.size(); ++k) {
        int i = renderOrder[k];
        const auto& blb = doc.blb[i];
        
        int currentScrollY = 0;
        uint16_t currParent = doc.bdt[i].parentId;
        while (currParent != 0xFFFF) {
            if (scrollOffsets.count(currParent)) currentScrollY += scrollOffsets[currParent];
            currParent = doc.bdt[currParent].parentId;
        }
        
        int drawY = blb.y - currentScrollY;

        // Handle clipping if overflow hidden or scroll
        if ((blb.flags & 0x04) || (blb.flags & 0x08)) {
            SDL_Rect clipRect = { (int)blb.x, drawY, (int)blb.w, (int)blb.h };
            SDL_RenderSetClipRect(renderer, &clipRect);
        }

        // Background
        uint8_t a = blb.bgA;
        uint8_t r_c = blb.bgR;
        uint8_t g_c = blb.bgG;
        uint8_t b_c = blb.bgB;
        
        if (i == hoveredNodeId) {
            a = 255;
            r_c = std::max(0, r_c - 30);
            g_c = std::max(0, g_c - 30);
            b_c = std::max(0, b_c - 30);
        }
        if (i == clickedNodeId) {
            r_c = std::min(255, r_c + 50);
        }

        if (a > 0) {
            if (blb.radius > 0) {
                roundedBoxRGBA(renderer, blb.x, drawY, blb.x + blb.w - 1, drawY + blb.h - 1, blb.radius, r_c, g_c, b_c, a);
            } else {
                SDL_SetRenderDrawColor(renderer, r_c, g_c, b_c, a);
                SDL_Rect r = { (int)blb.x, drawY, (int)blb.w, (int)blb.h };
                SDL_RenderFillRect(renderer, &r);
            }
        }
        
        // Borders
        if (blb.borderStyle != 0) {
            if (blb.radius > 0 && (blb.bwTop > 0 || blb.bwLeft > 0)) {
                roundedRectangleRGBA(renderer, blb.x, drawY, blb.x + blb.w - 1, drawY + blb.h - 1, blb.radius, blb.fgR, blb.fgG, blb.fgB, blb.fgA);
            } else {
                SDL_SetRenderDrawColor(renderer, blb.fgR, blb.fgG, blb.fgB, blb.fgA);
                if (blb.bwTop > 0) { SDL_Rect rb = {(int)blb.x, drawY, (int)blb.w, blb.bwTop}; SDL_RenderFillRect(renderer, &rb); }
                if (blb.bwBottom > 0) { SDL_Rect rb = {(int)blb.x, (int)(drawY + blb.h - blb.bwBottom), (int)blb.w, blb.bwBottom}; SDL_RenderFillRect(renderer, &rb); }
                if (blb.bwLeft > 0) { SDL_Rect rb = {(int)blb.x, drawY, blb.bwLeft, (int)blb.h}; SDL_RenderFillRect(renderer, &rb); }
                if (blb.bwRight > 0) { SDL_Rect rb = {(int)(blb.x + blb.w - blb.bwRight), drawY, blb.bwRight, (int)blb.h}; SDL_RenderFillRect(renderer, &rb); }
            }
        }

        // Draw Image? Check BML
        if (i < doc.bml.size() && doc.bml[i].tagId == 6) {
            const std::string& text = doc.bml[i].text;
            if (text.find("bib://") == 0) {
                int imgId = std::stoi(text.substr(6));
                if (textures.count(imgId)) {
                    SDL_Rect r = { (int)blb.x, drawY, (int)blb.w, (int)blb.h };
                    SDL_RenderCopy(renderer, textures[imgId], nullptr, &r);
                }
            }
        }

        // Draw Text
        if (doc.bdt[i].nodeType == 1 && i < doc.bml.size()) {
            const std::string& text = doc.bml[i].text;
            if (!text.empty() && text.find("bib://") != 0) {
                int fontSize = 16;
                std::string textAlign = "left";
                for (const auto& attr : doc.bml[i].attributes) {
                    if (attr.key == "fontSize") fontSize = std::stoi(attr.value);
                    if (attr.key == "textAlign") textAlign = attr.value;
                }
                
                TTF_Font* currFont = getFont(fontSize);
                if (currFont) {
                    SDL_Color color = { blb.fgR, blb.fgG, blb.fgB, blb.fgA };
                    SDL_Surface* surface = TTF_RenderUTF8_Blended_Wrapped(currFont, text.c_str(), color, blb.w > 0 ? blb.w : 0);
                    if (surface) {
                        SDL_Texture* tex = SDL_CreateTextureFromSurface(renderer, surface);
                        int textX = blb.x;
                        if (textAlign == "center") textX = blb.x + (blb.w / 2) - (surface->w / 2);
                        if (textAlign == "right") textX = blb.x + blb.w - surface->w;
                        
                        SDL_Rect dst = { textX, drawY, surface->w, surface->h };
                        SDL_RenderCopy(renderer, tex, nullptr, &dst);
                        SDL_DestroyTexture(tex);
                        SDL_FreeSurface(surface);
                    }
                }
            }
        }
        
        // Highlight border for focused/hovered
        if (i == hoveredNodeId) {
            SDL_SetRenderDrawColor(renderer, 52, 152, 219, 255);
            SDL_Rect r = { (int)blb.x - 2, drawY - 2, (int)blb.w + 4, (int)blb.h + 4 };
            SDL_RenderDrawRect(renderer, &r);
        }
        
        if ((blb.flags & 0x04) || (blb.flags & 0x08)) {
            SDL_RenderSetClipRect(renderer, nullptr); // disable clip
        }
    }
}

void Renderer::cleanup() {
    for (auto& pair : textures) {
        SDL_DestroyTexture(pair.second);
    }
    textures.clear();

    for (auto& pair : fontCache) {
        if (pair.second) TTF_CloseFont(pair.second);
    }
    fontCache.clear();
    font = nullptr;
}
