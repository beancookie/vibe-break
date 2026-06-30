mod event;
mod handler;

use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::Mutex;

use pmcp::server::streamable_http_server::{StreamableHttpServer, StreamableHttpServerConfig};
use pmcp::SimpleTool;
use pmcp::Server;

use handler::handle_report;
use handler::handle_tool_call;
use tauri::Manager;

use serde_json::json;

const MCP_PORT: u16 = 39876;

const MESSAGE_DESC: &str = "A short natural-language message from the AI companion's perspective describing what just happened. This will be displayed as a speech bubble on the VRM pet avatar. Be creative, playful and friendly; use Chinese or English as context fits. Make each message unique.";

fn scan_vrm_assets(app_handle: &tauri::AppHandle) -> Vec<serde_json::Value> {
    let mut out = Vec::new();
    let candidates = resource_dirs(app_handle);
    for base in &candidates {
        let assets_dir = base.join("assets");
        if !assets_dir.exists() {
            continue;
        }
        crate::collect_dir(&assets_dir, "vrm", "assets/", &mut out);
        let vrma_dir = assets_dir.join("vrma");
        if vrma_dir.exists() {
            crate::collect_dir_recursive(&vrma_dir, "vrma", "assets/vrma/", &mut out, true);
        }
        if !out.is_empty() {
            break;
        }
        out.clear();
    }
    out.into_iter().map(|a| json!({"name": a.name, "url": a.url})).collect()
}

fn resource_dirs(app_handle: &tauri::AppHandle) -> Vec<std::path::PathBuf> {
    let mut bases = Vec::new();
    if let Ok(p) = app_handle.path().resource_dir() {
        bases.push(p);
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            bases.push(dir.join("resources"));
        }
    }
    bases
}

macro_rules! define_report_tool {
    ($name:expr, $desc:expr, $ah:expr) => {{
        let ah = $ah.clone();
        let name = $name;
        SimpleTool::new(name, move |args, extra| {
            let ah = ah.clone();
            Box::pin(handle_report(name, args, extra, ah))
        })
        .with_description($desc)
        .with_schema(json!({
            "type": "object",
            "properties": {
                "message": {
                    "type": "string",
                    "description": MESSAGE_DESC
                },
                "tool_input": {
                    "type": "object",
                    "description": "Optional. Include an \"actions\" array to trigger VRM avatar animations: [{\"type\":\"play_anim\",\"name\":\"Clapping\"}, {\"type\":\"expression\",\"name\":\"happy\",\"weight\":0.8}, {\"type\":\"bone_pose\",\"bone\":\"head\",\"x\":0.3,\"y\":0,\"z\":0}]."
                },
                "ts": {
                    "type": "number",
                    "description": "Unix timestamp (milliseconds) of the event"
                }
            },
            "required": ["message"]
        }))
    }};
}

pub fn start(app_handle: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let ah = app_handle.clone();

        let rt_write = define_report_tool!(
            "report_write",
            "Call after writing or editing a file. Provide a message describing what was changed.",
            ah
        );
        let ah = app_handle.clone();
        let rt_read = define_report_tool!(
            "report_read",
            "Call after reading a file. Provide a message describing what was found or reviewed.",
            ah
        );
        let ah = app_handle.clone();
        let rt_bash = define_report_tool!(
            "report_bash",
            "Call after running a terminal command. Provide a message describing the command and its outcome.",
            ah
        );
        let ah = app_handle.clone();
        let rt_search = define_report_tool!(
            "report_search",
            "Call after searching the codebase (Grep, Glob, Search). Provide a message describing the search.",
            ah
        );
        let ah = app_handle.clone();
        let rt_done = define_report_tool!(
            "report_done",
            "Call when Claude stops thinking and is ready to proceed. Provide a message summarizing the result.",
            ah
        );
        let ah = app_handle.clone();
        let rt_error = define_report_tool!(
            "report_error",
            "Call when an error occurs. Provide a message describing the error.",
            ah
        );

        let ah2 = app_handle.clone();
        let list_models_tool = SimpleTool::new("list_vrm_models", move |_args, _extra| {
            let ah = ah2.clone();
            Box::pin(async move {
                let all = scan_vrm_assets(&ah);
                let models: Vec<_> = all.into_iter().filter(|a| a["url"].as_str().map_or(false, |u| u.ends_with(".vrm"))).collect();
                Ok(json!({"models": models}))
            })
        })
        .with_description("List all available VRM models in the assets directory.");

        let ah3 = app_handle.clone();
        let list_anims_tool = SimpleTool::new("list_vrma_animations", move |_args, _extra| {
            let ah = ah3.clone();
            Box::pin(async move {
                let all = scan_vrm_assets(&ah);
                let anims: Vec<_> = all.into_iter().filter(|a| a["url"].as_str().map_or(false, |u| u.ends_with(".vrma"))).collect();
                Ok(json!({"animations": anims}))
            })
        })
        .with_description("List all available VRMA animations in the assets/vrma directory.");

        let ah4 = app_handle.clone();
        let select_model_tool = SimpleTool::new("select_model", move |args, _extra| {
            let ah = ah4.clone();
            Box::pin(handle_tool_call("select_model", args, ah))
        })
        .with_description("Switch to a specific VRM model by URL (e.g. \"assets/Furina.vrm\").")
        .with_schema(json!({
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "URL of the VRM model (e.g. \"assets/Furina.vrm\")"
                }
            },
            "required": ["url"]
        }));

        let ah5 = app_handle.clone();
        let play_anim_tool = SimpleTool::new("play_animation", move |args, _extra| {
            let ah = ah5.clone();
            Box::pin(handle_tool_call("play_animation", args, ah))
        })
        .with_description("Play a specific VRMA animation by URL (e.g. \"assets/vrma/Clapping.vrma\").")
        .with_schema(json!({
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "URL of the VRMA animation (e.g. \"assets/vrma/Clapping.vrma\")"
                }
            },
            "required": ["url"]
        }));

        let ah6 = app_handle.clone();
        let set_scale_tool = SimpleTool::new("set_scale", move |args, _extra| {
            let ah = ah6.clone();
            Box::pin(handle_tool_call("set_scale", args, ah))
        })
        .with_description("Adjust the VRM model scale. Range: 0.1 to 10.0.")
        .with_schema(json!({
            "type": "object",
            "properties": {
                "scale": {
                    "type": "number",
                    "description": "Scale factor (0.1 ~ 10.0)",
                    "minimum": 0.1,
                    "maximum": 10.0
                }
            },
            "required": ["scale"]
        }));

        let ah7 = app_handle.clone();
        let always_on_top_tool = SimpleTool::new("set_always_on_top", move |args, _extra| {
            let ah = ah7.clone();
            Box::pin(handle_tool_call("set_always_on_top", args, ah))
        })
        .with_description("Set whether the application window stays on top of other windows.")
        .with_schema(json!({
            "type": "object",
            "properties": {
                "on_top": {
                    "type": "boolean",
                    "description": "Whether to keep the window on top"
                }
            },
            "required": ["on_top"]
        }));

        let ah8 = app_handle.clone();
        let get_status_tool = SimpleTool::new("get_status", move |_args, _extra| {
            let ah = ah8.clone();
            Box::pin(async move {
                let all = scan_vrm_assets(&ah);
                let models: Vec<_> = all.iter().filter(|a| a["url"].as_str().map_or(false, |u| u.ends_with(".vrm"))).cloned().collect();
                let anims: Vec<_> = all.into_iter().filter(|a| a["url"].as_str().map_or(false, |u| u.ends_with(".vrma"))).collect();
                Ok(json!({"models": models, "animations": anims}))
            })
        })
        .with_description("Get current application status: available models and animations.");

        let server = Server::builder()
            .name("vibe-break")
            .version("0.1.0")
            .capabilities(pmcp::ServerCapabilities::default())
            .tool("report_write", rt_write)
            .tool("report_read", rt_read)
            .tool("report_bash", rt_bash)
            .tool("report_search", rt_search)
            .tool("report_done", rt_done)
            .tool("report_error", rt_error)
            .tool("list_vrm_models", list_models_tool)
            .tool("list_vrma_animations", list_anims_tool)
            .tool("select_model", select_model_tool)
            .tool("play_animation", play_anim_tool)
            .tool("set_scale", set_scale_tool)
            .tool("set_always_on_top", always_on_top_tool)
            .tool("get_status", get_status_tool)
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