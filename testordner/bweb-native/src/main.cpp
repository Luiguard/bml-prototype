#include <SDL2/SDL.h>
#include <SDL2/SDL_ttf.h>
#include <SDL2/SDL_image.h>
#include <iostream>
#include "BwebParser.h"
#include "Renderer.h"

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cerr << "Usage: " << argv[0] << " <file.bweb>\n";
        return 1;
    }

    const char* filePath = argv[1];
    BwebDocument doc;
    if (!BwebParser::parse(filePath, doc)) {
        std::cerr << "Failed to parse BWEB file.\n";
        return 1;
    }

    if (SDL_Init(SDL_INIT_VIDEO) < 0) {
        std::cerr << "SDL_Init Error: " << SDL_GetError() << "\n";
        return 1;
    }

    if (TTF_Init() == -1) {
        std::cerr << "TTF_Init Error: " << TTF_GetError() << "\n";
        SDL_Quit();
        return 1;
    }

    int imgFlags = IMG_INIT_PNG | IMG_INIT_JPG | IMG_INIT_WEBP;
    if (!(IMG_Init(imgFlags) & imgFlags)) {
        std::cerr << "IMG_Init Error: " << IMG_GetError() << "\n";
        TTF_Quit();
        SDL_Quit();
        return 1;
    }

    SDL_Window* window = SDL_CreateWindow(
        "BWEB Native Engine", 
        SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED, 
        1024, 768, 
        SDL_WINDOW_SHOWN | SDL_WINDOW_RESIZABLE
    );

    if (!window) {
        std::cerr << "SDL_CreateWindow Error: " << SDL_GetError() << "\n";
        IMG_Quit();
        TTF_Quit();
        SDL_Quit();
        return 1;
    }

    SDL_Renderer* sdlRenderer = SDL_CreateRenderer(window, -1, SDL_RENDERER_ACCELERATED | SDL_RENDERER_PRESENTVSYNC);
    if (!sdlRenderer) {
        std::cerr << "SDL_CreateRenderer Error: " << SDL_GetError() << "\n";
        SDL_DestroyWindow(window);
        IMG_Quit();
        TTF_Quit();
        SDL_Quit();
        return 1;
    }

    Renderer renderer(sdlRenderer, doc);
    renderer.init();

    bool running = true;
    SDL_Event e;
    while (running) {
        while (SDL_PollEvent(&e) != 0) {
            if (e.type == SDL_QUIT) {
                running = false;
            } else if (e.type == SDL_MOUSEMOTION) {
                renderer.handleMouseMove(e.motion.x, e.motion.y);
            } else if (e.type == SDL_MOUSEBUTTONDOWN && e.button.button == SDL_BUTTON_LEFT) {
                renderer.handleMouseClick(e.button.x, e.button.y);
            } else if (e.type == SDL_MOUSEBUTTONUP && e.button.button == SDL_BUTTON_LEFT) {
                renderer.handleMouseUp(e.button.x, e.button.y);
            } else if (e.type == SDL_MOUSEWHEEL) {
                int mouseX, mouseY;
                SDL_GetMouseState(&mouseX, &mouseY);
                renderer.handleMouseWheel(e.wheel.y, mouseX, mouseY);
            }
        }

        if (renderer.needsRender) {
            renderer.draw();
            SDL_RenderPresent(sdlRenderer);
            renderer.needsRender = false;
        } else {
            SDL_Delay(16); // Sleep ~1 frame to avoid 100% CPU when idle
        }
    }

    renderer.cleanup();
    SDL_DestroyRenderer(sdlRenderer);
    SDL_DestroyWindow(window);
    IMG_Quit();
    TTF_Quit();
    SDL_Quit();

    return 0;
}
