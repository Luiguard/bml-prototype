#pragma once
#include <stdint.h>
#include <stddef.h>
#include <string>

struct SHA256_CTX {
    uint8_t data[64];
    uint32_t datalen;
    uint64_t bitlen;
    uint32_t state[8];
};

void sha256_init(SHA256_CTX *ctx);
void sha256_update(SHA256_CTX *ctx, const uint8_t data[], size_t len);
void sha256_final(SHA256_CTX *ctx, uint8_t hash[]);

std::string sha256_hex(const uint8_t data[], size_t len);
