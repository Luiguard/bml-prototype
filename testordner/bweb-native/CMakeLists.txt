cmake_minimum_required(VERSION 3.10)
project(bweb_native)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)

find_package(SDL2 REQUIRED)
find_package(SDL2_ttf REQUIRED)
find_package(SDL2_image REQUIRED)
find_package(OpenSSL REQUIRED)

include_directories(${SDL2_INCLUDE_DIRS} ${SDL2_TTF_INCLUDE_DIRS} ${SDL2_IMAGE_INCLUDE_DIRS} src)

add_executable(bweb_native
    src/main.cpp
    src/BwebParser.cpp
    src/Renderer.cpp
)

target_link_libraries(bweb_native ${SDL2_LIBRARIES} SDL2_ttf SDL2_image SDL2_gfx OpenSSL::SSL OpenSSL::Crypto)
