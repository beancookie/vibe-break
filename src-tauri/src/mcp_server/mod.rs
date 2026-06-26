mod event;
mod handler;

use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::Mutex;

use pmcp::server::streamable_http_server::{StreamableHttpServer, StreamableHttpServerConfig};
use pmcp::SimpleTool;
use pmcp::Server;

use handler::handle;

const MCP_PORT: u16 = 39876;

pub fn start(app_handle: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let tool = SimpleTool::new("report_event", move |args, extra| {
            Box::pin(handle(args, extra, app_handle.clone()))
        })
        .with_description(
            "Report an AI coding event from Claude Code to Vibe Break for visualization. \
             Call this after every tool use (Write, Edit, Bash, Read, etc.) \
             and when Claude stops thinking.",
        )
        .with_schema(serde_json::json!({
            "type": "object",
            "properties": {
                "tool_name": {
                    "type": "string",
                    "description": "Name of the Claude Code tool (Write, Edit, Bash, Read, Glob, Grep, Search, Stop, etc.)"
                },
                "tool_input": {
                    "type": "object",
                    "description": "Input arguments passed to the tool. Optionally include a \"_actions\" array to control the VRM avatar: [{\"type\":\"play_anim\",\"name\":\"Clapping\"}, {\"type\":\"expression\",\"name\":\"happy\",\"weight\":0.8}, {\"type\":\"bone_pose\",\"bone\":\"head\",\"x\":0.3,\"y\":0,\"z\":0}]"
                },
                "ts": {
                    "type": "number",
                    "description": "Unix timestamp (milliseconds) of the event"
                }
            },
            "required": ["tool_name"]
        }));

        let server = Server::builder()
            .name("vibe-break")
            .version("0.1.0")
            .capabilities(pmcp::ServerCapabilities::default())
            .tool("report_event", tool)
            .build();

        let server = match server {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[vibe-break] MCP server build failed: {e}");
                return;
            }
        };

        let addr: SocketAddr = match format!("127.0.0.1:{MCP_PORT}").parse() {
            Ok(a) => a,
            Err(e) => {
                eprintln!("[vibe-break] MCP server invalid address: {e}");
                return;
            }
        };

        eprintln!("[vibe-break:mcp] INFO  listening on http://{addr}");

        let config = StreamableHttpServerConfig::stateless();
        let http_server = StreamableHttpServer::with_config(
            addr,
            Arc::new(Mutex::new(server)),
            config,
        );

        if let Err(e) = http_server.start().await {
            eprintln!("[vibe-break] MCP server error: {e}");
        }
    });
}
