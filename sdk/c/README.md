# Tunnara SDK C ABI

SDK C estável para controlar o daemon local do Tunnara Agent. A ABI não expõe estruturas Rust/Node e funciona por uma API HTTP autenticada vinculada exclusivamente a `127.0.0.1`.

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
```

A aplicação recebe o token local em `~/.tunnara/config.json` ou por provisionamento seguro do instalador. Nunca publique esse token.
