#ifndef TUNNARA_H
#define TUNNARA_H

#include <stdint.h>

#if defined(_WIN32)
  #if defined(TUNNARA_BUILD_SHARED)
    #define TUNNARA_API __declspec(dllexport)
  #elif defined(TUNNARA_USE_SHARED)
    #define TUNNARA_API __declspec(dllimport)
  #else
    #define TUNNARA_API
  #endif
#else
  #define TUNNARA_API __attribute__((visibility("default")))
#endif

#ifdef __cplusplus
extern "C" {
#endif

typedef struct tunnara_client tunnara_client_t;

typedef enum tunnara_result {
  TUNNARA_OK = 0,
  TUNNARA_ERROR_INVALID_ARGUMENT = 1,
  TUNNARA_ERROR_NETWORK = 2,
  TUNNARA_ERROR_HTTP = 3,
  TUNNARA_ERROR_MEMORY = 4,
  TUNNARA_ERROR_PROTOCOL = 5
} tunnara_result_t;

TUNNARA_API const char* tunnara_version(void);
TUNNARA_API tunnara_client_t* tunnara_client_create(const char* host, uint16_t port, const char* local_api_token);
TUNNARA_API void tunnara_client_destroy(tunnara_client_t* client);
TUNNARA_API const char* tunnara_last_error(const tunnara_client_t* client);
TUNNARA_API void tunnara_string_free(char* value);

TUNNARA_API tunnara_result_t tunnara_status(tunnara_client_t* client, char** out_json);
TUNNARA_API tunnara_result_t tunnara_tunnel_list(tunnara_client_t* client, char** out_json);
TUNNARA_API tunnara_result_t tunnara_tunnel_create_http(tunnara_client_t* client, uint16_t local_port, const char* hostname, int auto_dns, char** out_json);
TUNNARA_API tunnara_result_t tunnara_tunnel_create_tcp(tunnara_client_t* client, uint16_t local_port, uint16_t public_port, char** out_json);
TUNNARA_API tunnara_result_t tunnara_tunnel_create_udp(tunnara_client_t* client, uint16_t local_port, uint16_t public_port, char** out_json);
TUNNARA_API tunnara_result_t tunnara_tunnel_delete(tunnara_client_t* client, const char* tunnel_id);
TUNNARA_API tunnara_result_t tunnara_network_list(tunnara_client_t* client, char** out_json);
TUNNARA_API tunnara_result_t tunnara_network_join(tunnara_client_t* client, const char* network_id, int activate, char** out_json);
TUNNARA_API tunnara_result_t tunnara_network_leave(tunnara_client_t* client, const char* network_id, char** out_json);

#ifdef __cplusplus
}
#endif

#endif
