#include "tunnara.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#if defined(_WIN32)
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")
typedef SOCKET tunnara_socket_t;
#define TUNNARA_INVALID_SOCKET INVALID_SOCKET
#define tunnara_close closesocket
#else
#include <arpa/inet.h>
#include <netdb.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>
typedef int tunnara_socket_t;
#define TUNNARA_INVALID_SOCKET (-1)
#define tunnara_close close
#endif

#define TUNNARA_VERSION "2.0.0-rc.1"
#define TUNNARA_MAX_RESPONSE (32u * 1024u * 1024u)

struct tunnara_client {
  char host[256];
  uint16_t port;
  char token[512];
  char last_error[1024];
};

static void set_error(tunnara_client_t* client, const char* message) {
  if (!client) return;
  snprintf(client->last_error, sizeof(client->last_error), "%s", message ? message : "Erro desconhecido");
}

static char* json_escape(const char* input) {
  const char* value = input ? input : "";
  size_t len = strlen(value), capacity = len * 2 + 1, used = 0;
  char* out = (char*)malloc(capacity);
  if (!out) return NULL;
  for (size_t i = 0; i < len; ++i) {
    unsigned char c = (unsigned char)value[i];
    const char* replacement = NULL;
    char unicode[7];
    switch (c) {
      case '\\': replacement = "\\\\"; break;
      case '"': replacement = "\\\""; break;
      case '\n': replacement = "\\n"; break;
      case '\r': replacement = "\\r"; break;
      case '\t': replacement = "\\t"; break;
      default:
        if (c < 32) { snprintf(unicode, sizeof(unicode), "\\u%04x", c); replacement = unicode; }
        break;
    }
    size_t add = replacement ? strlen(replacement) : 1;
    if (used + add + 1 > capacity) {
      capacity = (used + add + 1) * 2;
      char* grown = (char*)realloc(out, capacity);
      if (!grown) { free(out); return NULL; }
      out = grown;
    }
    if (replacement) { memcpy(out + used, replacement, add); used += add; }
    else out[used++] = (char)c;
  }
  out[used] = '\0';
  return out;
}

static tunnara_socket_t connect_socket(tunnara_client_t* client) {
  char port[16];
  struct addrinfo hints, *result = NULL, *cursor;
  snprintf(port, sizeof(port), "%u", (unsigned)client->port);
  memset(&hints, 0, sizeof(hints));
  hints.ai_family = AF_UNSPEC;
  hints.ai_socktype = SOCK_STREAM;
  if (getaddrinfo(client->host, port, &hints, &result) != 0) { set_error(client, "Falha ao resolver o host da API local."); return TUNNARA_INVALID_SOCKET; }
  tunnara_socket_t socket_fd = TUNNARA_INVALID_SOCKET;
  for (cursor = result; cursor; cursor = cursor->ai_next) {
    socket_fd = (tunnara_socket_t)socket(cursor->ai_family, cursor->ai_socktype, cursor->ai_protocol);
    if (socket_fd == TUNNARA_INVALID_SOCKET) continue;
    if (connect(socket_fd, cursor->ai_addr, (int)cursor->ai_addrlen) == 0) break;
    tunnara_close(socket_fd); socket_fd = TUNNARA_INVALID_SOCKET;
  }
  freeaddrinfo(result);
  if (socket_fd == TUNNARA_INVALID_SOCKET) set_error(client, "Não foi possível conectar à API local do Tunnara Agent.");
  return socket_fd;
}

static tunnara_result_t request(tunnara_client_t* client, const char* method, const char* path, const char* body, char** out_json) {
  if (!client || !method || !path) return TUNNARA_ERROR_INVALID_ARGUMENT;
  if (out_json) *out_json = NULL;
  tunnara_socket_t socket_fd = connect_socket(client);
  if (socket_fd == TUNNARA_INVALID_SOCKET) return TUNNARA_ERROR_NETWORK;
  size_t body_len = body ? strlen(body) : 0;
  size_t request_capacity = body_len + strlen(path) + strlen(client->token) + 1024;
  char* request_data = (char*)malloc(request_capacity);
  if (!request_data) { tunnara_close(socket_fd); return TUNNARA_ERROR_MEMORY; }
  int request_len = snprintf(request_data, request_capacity,
    "%s %s HTTP/1.1\r\nHost: %s:%u\r\nAuthorization: Bearer %s\r\nAccept: application/json\r\nConnection: close\r\n%sContent-Length: %zu\r\n\r\n%s",
    method, path, client->host, (unsigned)client->port, client->token,
    body ? "Content-Type: application/json\r\n" : "", body_len, body ? body : "");
  if (request_len <= 0 || (size_t)request_len >= request_capacity) { free(request_data); tunnara_close(socket_fd); set_error(client, "Falha ao montar requisição HTTP."); return TUNNARA_ERROR_PROTOCOL; }
  size_t sent = 0;
  while (sent < (size_t)request_len) {
#if defined(_WIN32)
    int n = send(socket_fd, request_data + sent, (int)((size_t)request_len - sent), 0);
#else
    ssize_t n = send(socket_fd, request_data + sent, (size_t)request_len - sent, 0);
#endif
    if (n <= 0) { free(request_data); tunnara_close(socket_fd); set_error(client, "Falha ao enviar requisição HTTP."); return TUNNARA_ERROR_NETWORK; }
    sent += (size_t)n;
  }
  free(request_data);
  size_t capacity = 8192, used = 0;
  char* response = (char*)malloc(capacity + 1);
  if (!response) { tunnara_close(socket_fd); return TUNNARA_ERROR_MEMORY; }
  for (;;) {
    if (used == capacity) {
      if (capacity >= TUNNARA_MAX_RESPONSE) { free(response); tunnara_close(socket_fd); set_error(client, "Resposta da API local excedeu o limite."); return TUNNARA_ERROR_PROTOCOL; }
      capacity *= 2;
      char* grown = (char*)realloc(response, capacity + 1);
      if (!grown) { free(response); tunnara_close(socket_fd); return TUNNARA_ERROR_MEMORY; }
      response = grown;
    }
#if defined(_WIN32)
    int n = recv(socket_fd, response + used, (int)(capacity - used), 0);
#else
    ssize_t n = recv(socket_fd, response + used, capacity - used, 0);
#endif
    if (n == 0) break;
    if (n < 0) { free(response); tunnara_close(socket_fd); set_error(client, "Falha ao receber resposta HTTP."); return TUNNARA_ERROR_NETWORK; }
    used += (size_t)n;
  }
  tunnara_close(socket_fd); response[used] = '\0';
  int status = 0; sscanf(response, "HTTP/%*s %d", &status);
  char* separator = strstr(response, "\r\n\r\n");
  if (!separator) { free(response); set_error(client, "Resposta HTTP inválida."); return TUNNARA_ERROR_PROTOCOL; }
  separator += 4;
  char* payload = (char*)malloc(strlen(separator) + 1);
  if (!payload) { free(response); return TUNNARA_ERROR_MEMORY; }
  strcpy(payload, separator); free(response);
  if (status < 200 || status >= 300) {
    set_error(client, payload[0] ? payload : "A API local recusou a requisição.");
    if (out_json) *out_json = payload; else free(payload);
    return TUNNARA_ERROR_HTTP;
  }
  if (out_json) *out_json = payload; else free(payload);
  client->last_error[0] = '\0';
  return TUNNARA_OK;
}

static tunnara_result_t create_tunnel(
  tunnara_client_t* client,
  const char* protocol,
  uint16_t local_port,
  uint16_t public_port,
  const char* hostname,
  int auto_dns,
  char** out_json
) {
  if (!client || !protocol || local_port == 0) return TUNNARA_ERROR_INVALID_ARGUMENT;
  char* escaped = hostname && hostname[0] ? json_escape(hostname) : NULL;
  if (hostname && hostname[0] && !escaped) return TUNNARA_ERROR_MEMORY;

  char body[2048];
  int written = snprintf(
    body,
    sizeof(body),
    "{\"protocol\":\"%s\",\"targetHost\":\"127.0.0.1\",\"targetPort\":%u",
    protocol,
    (unsigned)local_port
  );
  if (written < 0 || (size_t)written >= sizeof(body)) { free(escaped); return TUNNARA_ERROR_PROTOCOL; }

  size_t used = (size_t)written;
  if (public_port) {
    written = snprintf(body + used, sizeof(body) - used, ",\"publicPort\":%u", (unsigned)public_port);
    if (written < 0 || (size_t)written >= sizeof(body) - used) { free(escaped); return TUNNARA_ERROR_PROTOCOL; }
    used += (size_t)written;
  }
  if (escaped) {
    written = snprintf(body + used, sizeof(body) - used, ",\"hostname\":\"%s\"", escaped);
    if (written < 0 || (size_t)written >= sizeof(body) - used) { free(escaped); return TUNNARA_ERROR_PROTOCOL; }
    used += (size_t)written;
  }
  written = snprintf(body + used, sizeof(body) - used, ",\"autoDns\":%s}", auto_dns ? "true" : "false");
  free(escaped);
  if (written < 0 || (size_t)written >= sizeof(body) - used) return TUNNARA_ERROR_PROTOCOL;
  return request(client, "POST", "/v1/tunnels", body, out_json);
}

const char* tunnara_version(void) { return TUNNARA_VERSION; }

tunnara_client_t* tunnara_client_create(const char* host, uint16_t port, const char* local_api_token) {
#if defined(_WIN32)
  static int winsock_ready = 0;
  if (!winsock_ready) { WSADATA data; if (WSAStartup(MAKEWORD(2,2), &data) != 0) return NULL; winsock_ready = 1; }
#endif
  if (!host || !local_api_token || port == 0) return NULL;
  tunnara_client_t* client = (tunnara_client_t*)calloc(1, sizeof(tunnara_client_t));
  if (!client) return NULL;
  snprintf(client->host, sizeof(client->host), "%s", host);
  snprintf(client->token, sizeof(client->token), "%s", local_api_token);
  client->port = port;
  return client;
}
void tunnara_client_destroy(tunnara_client_t* client) { if (client) { memset(client, 0, sizeof(*client)); free(client); } }
const char* tunnara_last_error(const tunnara_client_t* client) { return client ? client->last_error : "Cliente inválido"; }
void tunnara_string_free(char* value) { free(value); }
tunnara_result_t tunnara_status(tunnara_client_t* client, char** out_json) { return request(client, "GET", "/v1/status", NULL, out_json); }
tunnara_result_t tunnara_tunnel_list(tunnara_client_t* client, char** out_json) { return request(client, "GET", "/v1/tunnels", NULL, out_json); }
tunnara_result_t tunnara_tunnel_create_http(tunnara_client_t* client, uint16_t local_port, const char* hostname, int auto_dns, char** out_json) { return create_tunnel(client, "http", local_port, 0, hostname, auto_dns, out_json); }
tunnara_result_t tunnara_tunnel_create_tcp(tunnara_client_t* client, uint16_t local_port, uint16_t public_port, char** out_json) { return create_tunnel(client, "tcp", local_port, public_port, NULL, 0, out_json); }
tunnara_result_t tunnara_tunnel_create_udp(tunnara_client_t* client, uint16_t local_port, uint16_t public_port, char** out_json) { return create_tunnel(client, "udp", local_port, public_port, NULL, 0, out_json); }
tunnara_result_t tunnara_tunnel_delete(tunnara_client_t* client, const char* tunnel_id) { char path[256]; if (!tunnel_id) return TUNNARA_ERROR_INVALID_ARGUMENT; snprintf(path, sizeof(path), "/v1/tunnels/%s", tunnel_id); return request(client, "DELETE", path, NULL, NULL); }
tunnara_result_t tunnara_network_list(tunnara_client_t* client, char** out_json) { return request(client, "GET", "/v1/networks", NULL, out_json); }
tunnara_result_t tunnara_network_join(tunnara_client_t* client, const char* network_id, int activate, char** out_json) { char path[256], body[64]; if (!network_id) return TUNNARA_ERROR_INVALID_ARGUMENT; snprintf(path, sizeof(path), "/v1/networks/%s/join", network_id); snprintf(body, sizeof(body), "{\"activate\":%s}", activate ? "true" : "false"); return request(client, "POST", path, body, out_json); }
tunnara_result_t tunnara_network_leave(tunnara_client_t* client, const char* network_id, char** out_json) { char path[256]; if (!network_id) return TUNNARA_ERROR_INVALID_ARGUMENT; snprintf(path, sizeof(path), "/v1/networks/%s/leave", network_id); return request(client, "POST", path, "{}", out_json); }
