# Serviço Linux/systemd

Exemplo de unidade systemd:

```ini
[Unit]
Description=Tunnara Console Server
After=network.target

[Service]
ExecStart=/opt/tunnara-console/app-server --mode=headless-api
Restart=always
User=templateapp
Environment=APP_ENV=production

[Install]
WantedBy=multi-user.target
```
