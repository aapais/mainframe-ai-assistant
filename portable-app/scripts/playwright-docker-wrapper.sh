#!/bin/bash
# Wrapper script para executar MCP Playwright via Docker oficial

exec sudo docker run -i --rm \
    --add-host=host.docker.internal:host-gateway \
    -v "$(pwd)":/workspace \
    -w /workspace \
    mcp/playwright "$@"