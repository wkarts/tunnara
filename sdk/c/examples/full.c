#include "tunnara.h"
#include <stdio.h>
#include <stdlib.h>

static int print_result(const char *name, tunnara_result_t result, char *json) {
  if (result != TUNNARA_OK) {
    fprintf(stderr, "%s falhou (%d)\n", name, result);
    tunnara_string_free(json);
    return 1;
  }
  printf("%s: %s\n", name, json ? json : "{}");
  tunnara_string_free(json);
  return 0;
}

int main(void) {
  const char *token = getenv("TUNNARA_LOCAL_API_TOKEN");
  if (!token || !*token) {
    fprintf(stderr, "Defina TUNNARA_LOCAL_API_TOKEN.\n");
    return 2;
  }
  tunnara_client_t *client = tunnara_client_create("127.0.0.1", 7390, token);
  if (!client) return 3;
  char *json = NULL;
  int rc = print_result("status", tunnara_status(client, &json), json);
  json = NULL;
  rc |= print_result("tunnels", tunnara_tunnel_list(client, &json), json);
  tunnara_client_destroy(client);
  return rc;
}
