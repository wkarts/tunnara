{{- define "tunnara.name" -}}{{ default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}{{- end }}
{{- define "tunnara.fullname" -}}{{ default (printf "%s-%s" .Release.Name (include "tunnara.name" .)) .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}{{- end }}
{{- define "tunnara.labels" -}}
app.kubernetes.io/name: {{ include "tunnara.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}
{{- define "tunnara.secretName" -}}{{ default (printf "%s-secrets" (include "tunnara.fullname" .)) .Values.server.existingSecret }}{{- end }}
