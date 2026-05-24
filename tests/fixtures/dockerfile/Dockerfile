# EXPECTED FINDINGS:
# - line 13: dockerfile-image-tag-latest — security — FROM uses :latest tag
# - line 16: dockerfile-arg-secret — security — ARG carries a secret token
# - line 19: dockerfile-env-secret — security — ENV bakes a secret into the image
# - line 22: dockerfile-add-url — security — ADD <url> without checksum
# - line 25: dockerfile-curl-no-verify — security — curl --insecure disables TLS
# - line 28: dockerfile-apt-get-no-clean — security — apt-get install without cleanup
# - line 31: dockerfile-pip-no-version-pin — security — pip install without == pin
# - line 34: dockerfile-shell-form-cmd — quality — CMD in shell form
# - line 1: dockerfile-user-root — security — no USER instruction (file-level)
# - line 1: dockerfile-no-healthcheck — security — no HEALTHCHECK (file-level)

FROM nginx:latest

# OWASP A07: build-time secret leaks via docker history
ARG GITHUB_TOKEN=ghp_examplebuildtoken1234

# OWASP A07: runtime secret embedded into image layer
ENV API_KEY=live-prod-secret-9999

# OWASP A06: remote artifact with no integrity check
ADD https://example.com/installer.bin /tmp/installer.bin

# OWASP A02: TLS verification disabled
RUN curl --insecure https://example.com/data -o /tmp/data

# bloated layer + stale cache that hides security updates
RUN apt-get update && apt-get install -y curl

# OWASP A06: floating dep version
RUN pip install requests

# signals never forwarded to the application
CMD nginx -g "daemon off;"
