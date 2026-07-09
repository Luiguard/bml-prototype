#pragma once
#include <cstdint>
#include <vector>
#include <openssl/evp.h>
#include <openssl/x509.h>
#include <openssl/ecdsa.h>

inline bool verifyECDSASignature(const uint8_t* pubKey, size_t pubKeyLen, 
                                 const uint8_t* hash, size_t hashLen, 
                                 const uint8_t* sig, size_t sigLen) {
    const unsigned char* p = pubKey;
    EVP_PKEY* pkey = d2i_PUBKEY(NULL, &p, pubKeyLen);
    if (!pkey) return false;

    EVP_MD_CTX* ctx = EVP_MD_CTX_new();
    if (!ctx) {
        EVP_PKEY_free(pkey);
        return false;
    }

    if (EVP_DigestVerifyInit(ctx, NULL, EVP_sha256(), NULL, pkey) <= 0) {
        EVP_MD_CTX_free(ctx);
        EVP_PKEY_free(pkey);
        return false;
    }

    // We pass the raw payload to EVP_DigestVerifyUpdate usually, but we already have the hash.
    // Actually, EVP_DigestVerify takes the original message, not the hash.
    // If we only have the hash, we can use ECDSA_do_verify directly or use EVP_PKEY_verify.
    
    EVP_PKEY_CTX *pctx = EVP_PKEY_CTX_new(pkey, NULL);
    if (!pctx) return false;
    
    if (EVP_PKEY_verify_init(pctx) <= 0) return false;
    if (EVP_PKEY_CTX_set_signature_md(pctx, EVP_sha256()) <= 0) return false;
    
    int result = EVP_PKEY_verify(pctx, sig, sigLen, hash, hashLen);
    
    EVP_PKEY_CTX_free(pctx);
    EVP_MD_CTX_free(ctx);
    EVP_PKEY_free(pkey);
    
    return result == 1;
}
