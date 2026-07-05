#ifndef TUNNARA_H
#define TUNNARA_H

#include <stdbool.h>

#if defined(_WIN32) || defined(__CYGWIN__)
  #if defined(TUNNARA_SDK_BUILD)
    #define TUNNARA_API __declspec(dllexport)
  #else
    #define TUNNARA_API __declspec(dllimport)
  #endif
#else
  #define TUNNARA_API __attribute__((visibility("default")))
#endif

#ifdef __cplusplus
extern "C" {
#endif

TUNNARA_API char *tunnara_version(void);
TUNNARA_API void tunnara_string_free(char *value);
TUNNARA_API bool tunnara_validate_token(const char *token);

#ifdef __cplusplus
}
#endif

#endif
