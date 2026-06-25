"""Test the Vibe Break MCP HTTP server with pytest.

Sends raw JSON-RPC 2.0 requests over HTTP POST to pmcp StreamableHttpServer
in stateless mode (no session tracking).

Usage:
    python -m pytest scripts/test_mcp_server.py -v
    python scripts/test_mcp_server.py
"""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

MCP_URL = "http://127.0.0.1:39876/"
MCP_TIMEOUT = httpx.Timeout(5.0)

INIT_PARAMS: dict[str, Any] = {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {"name": "pytest", "version": "1.0.0"},
}


def _get_result(data: dict[str, Any]) -> dict[str, Any]:
    """Extract the actual result from an MCP protocol response."""
    if "result" in data and "content" in data["result"]:
        for item in data["result"]["content"]:
            if item.get("type") == "text" and item.get("text"):
                return json.loads(item["text"])
    return data.get("result", {})


def _mcp(method: str, params: dict[str, Any] | None = None) -> httpx.Response:
    """Send a single JSON-RPC 2.0 request over a fresh HTTP connection."""
    body = json.dumps(
        {
            "jsonrpc": "2.0",
            "method": method,
            "id": 1,
            **({"params": params} if params else {}),
        }
    )
    with httpx.Client(timeout=MCP_TIMEOUT) as client:
        return client.post(
            MCP_URL,
            content=body,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )


def _initialize() -> None:
    """Perform MCP initialize handshake before non-init requests."""
    _mcp("initialize", INIT_PARAMS)


# =========================================================================
# Initialize
# =========================================================================


class TestInitialize:
    def test_server_info(self):
        data = _mcp("initialize", INIT_PARAMS).json()
        info = data["result"]["serverInfo"]
        assert info["name"] == "vibe-break"
        assert info["version"] == "0.1.0"

    def test_protocol_version(self):
        data = _mcp("initialize", INIT_PARAMS).json()
        assert data["result"]["protocolVersion"] == "2024-11-05"

    def test_tools_capability(self):
        data = _mcp("initialize", INIT_PARAMS).json()
        assert "tools" in data["result"]["capabilities"]


# =========================================================================
# Tools / List
# =========================================================================


class TestToolsList:
    def test_returns_tools(self):
        _initialize()
        data = _mcp("tools/list").json()
        assert len(data["result"]["tools"]) > 0

    def test_contains_report_event(self):
        _initialize()
        data = _mcp("tools/list").json()
        names = [t["name"] for t in data["result"]["tools"]]
        assert "report_event" in names

    def test_report_event_input_schema(self):
        _initialize()
        data = _mcp("tools/list").json()
        tool = next(t for t in data["result"]["tools"] if t["name"] == "report_event")
        schema = tool["inputSchema"]
        assert schema["type"] == "object"
        required = schema.get("required", [])
        assert "tool_name" in required
        assert "tool_name" in schema.get("properties", {})
        assert "tool_input" in schema.get("properties", {})

    def test_list_twice_returns_same_tools(self):
        _initialize()
        data1 = _mcp("tools/list").json()
        data2 = _mcp("tools/list").json()
        assert data1["result"]["tools"] == data2["result"]["tools"]


# =========================================================================
# Tools / Call
# =========================================================================


class TestToolCall:
    @pytest.mark.parametrize(
        "tool_name",
        [
            pytest.param("Write", id="write"),
            pytest.param("Edit", id="edit"),
            pytest.param("Bash", id="bash"),
            pytest.param("Stop", id="stop"),
            pytest.param("Read", id="read"),
            pytest.param("UnknownTool", id="unknown"),
        ],
    )
    def test_returns_ok(self, tool_name):
        _initialize()
        params = {"name": "report_event", "arguments": {"tool_name": tool_name, "ts": 1000}}
        result = _get_result(_mcp("tools/call", params).json())
        assert result["ok"] is True

    def test_with_tool_input(self):
        _initialize()
        params = {
            "name": "report_event",
            "arguments": {"tool_name": "Write", "tool_input": {"file_path": "src/test.ts"}, "ts": 2000},
        }
        result = _get_result(_mcp("tools/call", params).json())
        assert result["ok"] is True

    def test_with_bash_input(self):
        _initialize()
        params = {
            "name": "report_event",
            "arguments": {"tool_name": "Bash", "tool_input": {"command": "pnpm test"}, "ts": 3000},
        }
        result = _get_result(_mcp("tools/call", params).json())
        assert result["ok"] is True

    def test_timestamp_zero(self):
        _initialize()
        data = _mcp("tools/call", {"name": "report_event", "arguments": {"tool_name": "Stop", "ts": 0}}).json()
        result = _get_result(data)
        assert result["ok"] is True

    def test_timestamp_omitted(self):
        _initialize()
        data = _mcp("tools/call", {"name": "report_event", "arguments": {"tool_name": "Read"}}).json()
        result = _get_result(data)
        assert result["ok"] is True

    def test_tool_name_omitted(self):
        _initialize()
        data = _mcp("tools/call", {"name": "report_event", "arguments": {}}).json()
        result = _get_result(data)
        assert result["ok"] is True


# =========================================================================
# Errors
# =========================================================================


class TestErrors:
    def test_unknown_method(self):
        data = _mcp("unknown_method").json()
        assert data["error"]["code"] == -32700
        assert "unknown_method" in data["error"]["message"]

    @pytest.mark.parametrize(
        "payload",
        [
            pytest.param("not valid json", id="malformed"),
            pytest.param("", id="empty"),
        ],
    )
    def test_invalid_payload(self, payload):
        with httpx.Client(timeout=MCP_TIMEOUT) as client:
            resp = client.post(
                MCP_URL,
                content=payload,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
            )
        assert "error" in resp.json()

    def test_unknown_tool(self):
        _initialize()
        data = _mcp("tools/call", {"name": "nonexistent_tool", "arguments": {}}).json()
        assert "error" in data


# =========================================================================
# Direct run
# =========================================================================

if __name__ == "__main__":
    import sys

    sys.exit(pytest.main([__file__, "-v"]))
