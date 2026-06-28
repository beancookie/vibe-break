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

ALL_REPORT_TOOLS = [
    "report_write",
    "report_read",
    "report_bash",
    "report_search",
    "report_done",
    "report_error",
]

ALL_STANDARD_TOOLS = [
    "list_vrm_models",
    "list_vrma_animations",
    "select_model",
    "play_animation",
    "set_scale",
    "set_always_on_top",
    "get_status",
]


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
    def test_returns_all_tools(self):
        _initialize()
        data = _mcp("tools/list").json()
        names = [t["name"] for t in data["result"]["tools"]]
        for tool in ALL_REPORT_TOOLS + ALL_STANDARD_TOOLS:
            assert tool in names, f"Missing tool: {tool}"

    def test_each_report_tool_requires_message(self):
        _initialize()
        data = _mcp("tools/list").json()
        for tool in ALL_REPORT_TOOLS:
            t = next(x for x in data["result"]["tools"] if x["name"] == tool)
            schema = t["inputSchema"]
            required = schema.get("required", [])
            assert "message" in required, f"{tool} missing message in required"

    def test_report_tool_schema(self):
        _initialize()
        data = _mcp("tools/list").json()
        for tool in ALL_REPORT_TOOLS:
            t = next(x for x in data["result"]["tools"] if x["name"] == tool)
            schema = t["inputSchema"]
            assert schema["type"] == "object"
            props = schema.get("properties", {})
            assert "message" in props
            assert props["message"]["type"] == "string"

    def test_list_twice_returns_same_tools(self):
        _initialize()
        data1 = _mcp("tools/list").json()
        data2 = _mcp("tools/list").json()
        assert data1["result"]["tools"] == data2["result"]["tools"]


# =========================================================================
# Tools / Call - report tools
# =========================================================================


class TestReportTools:
    @pytest.mark.parametrize("tool_name", ALL_REPORT_TOOLS)
    def test_with_message_returns_ok(self, tool_name):
        _initialize()
        params = {
            "name": tool_name,
            "arguments": {
                "message": f"Test message for {tool_name}",
                "ts": 1000,
            },
        }
        data = _mcp("tools/call", params).json()
        result = _get_result(data)
        assert result["ok"] is True

    @pytest.mark.parametrize("tool_name", ALL_REPORT_TOOLS)
    def test_without_message_returns_error(self, tool_name):
        _initialize()
        params = {
            "name": tool_name,
            "arguments": {"ts": 1000},
        }
        data = _mcp("tools/call", params).json()
        assert "error" in data, f"{tool_name} should error without message"

    def test_with_tool_input_actions(self):
        _initialize()
        params = {
            "name": "report_write",
            "arguments": {
                "message": "Test with actions",
                "tool_input": {
                    "actions": [
                        {"type": "play_anim", "name": "Clapping"}
                    ]
                },
                "ts": 1000,
            },
        }
        result = _get_result(_mcp("tools/call", params).json())
        assert result["ok"] is True


# =========================================================================
# Tools / Call - standard tools
# =========================================================================


class TestStandardTools:
    def test_list_vrm_models(self):
        _initialize()
        data = _mcp("tools/call", {"name": "list_vrm_models", "arguments": {}}).json()
        result = _get_result(data)
        assert "models" in result

    def test_list_vrma_animations(self):
        _initialize()
        data = _mcp("tools/call", {"name": "list_vrma_animations", "arguments": {}}).json()
        result = _get_result(data)
        assert "animations" in result

    def test_get_status(self):
        _initialize()
        data = _mcp("tools/call", {"name": "get_status", "arguments": {}}).json()
        result = _get_result(data)
        assert "models" in result
        assert "animations" in result

    def test_select_model(self):
        _initialize()
        params = {"name": "select_model", "arguments": {"url": "assets/Furina.vrm"}}
        data = _mcp("tools/call", params).json()
        result = _get_result(data)
        assert result["ok"] is True

    def test_play_animation(self):
        _initialize()
        params = {"name": "play_animation", "arguments": {"url": "assets/vrma/Clapping.vrma"}}
        data = _mcp("tools/call", params).json()
        result = _get_result(data)
        assert result["ok"] is True

    def test_set_scale(self):
        _initialize()
        params = {"name": "set_scale", "arguments": {"scale": 2.0}}
        data = _mcp("tools/call", params).json()
        result = _get_result(data)
        assert result["ok"] is True

    def test_set_always_on_top(self):
        _initialize()
        params = {"name": "set_always_on_top", "arguments": {"on_top": True}}
        data = _mcp("tools/call", params).json()
        result = _get_result(data)
        assert result["ok"] is True

    def test_unknown_tool(self):
        _initialize()
        data = _mcp("tools/call", {"name": "nonexistent_tool", "arguments": {}}).json()
        assert "error" in data


# =========================================================================
# Errors
# =========================================================================


class TestErrors:
    def test_unknown_method(self):
        data = _mcp("unknown_method").json()
        assert "error" in data

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


# =========================================================================
# Direct run
# =========================================================================

if __name__ == "__main__":
    import sys

    sys.exit(pytest.main([__file__, "-v"]))
