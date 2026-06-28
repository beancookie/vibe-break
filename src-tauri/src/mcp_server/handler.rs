use pmcp::{Error, RequestHandlerExtra};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use super::event::{parse_event, parse_event_type};

pub(super) async fn handle_report(
    tool_name: &str,
    args: Value,
    _extra: RequestHandlerExtra,
    app_handle: AppHandle,
) -> Result<Value, Error> {
    let message = match args.get("message").and_then(|v| v.as_str()) {
        Some(m) => m.to_string(),
        None => {
            let err = format!("message is required for {tool_name}");
            eprintln!("[vibe-break:mcp] ERROR  {err}");
            return Err(Error::Validation(err));
        }
    };

    let tool_input = args.get("tool_input");
    let ts = args["ts"].as_f64().unwrap_or(0.0) as u64;

    eprintln!(
        "[vibe-break:mcp] INFO  {tool_name}: message=\"{}\" ts={ts}",
        message,
    );

    let actions = parse_event(tool_input);

    eprintln!(
        "[vibe-break:mcp] DEBUG  → actions={}",
        actions.len(),
    );

    let event_type = parse_event_type(tool_name);

    let payload = json!({
        "type": event_type,
        "meta": json!({"tool_name": tool_name}),
        "ts": ts,
        "actions": actions,
        "message": message,
    });

    let result = app_handle.emit("mcp:event", payload);

    match result {
        Ok(_) => eprintln!("[vibe-break:mcp] DEBUG  → emitted \"mcp:event\" OK"),
        Err(e) => eprintln!("[vibe-break:mcp] WARN  → emit failed: {e}"),
    }

    Ok(json!({"ok": true}))
}

fn pick_tool_message(tool_name: &str, args: &Value) -> String {
    match tool_name {
        "select_model" => {
            let name = args.get("url").and_then(|v| v.as_str()).unwrap_or("model");
            format!("切换到 {name}")
        }
        "play_animation" => {
            let name = args.get("url").and_then(|v| v.as_str()).unwrap_or("animation");
            format!("播放 {name}")
        }
        "set_scale" => {
            let scale = args.get("scale").and_then(|v| v.as_f64()).unwrap_or(1.0);
            format!("缩放调整到 {scale:.1}x")
        }
        "set_always_on_top" => {
            let on = args.get("on_top").and_then(|v| v.as_bool()).unwrap_or(false);
            if on { "窗口置顶已开启".to_string() } else { "窗口置顶已关闭".to_string() }
        }
        _ => String::new()
    }
}

pub(super) async fn handle_tool_call(
    tool_name: &str,
    args: Value,
    app_handle: AppHandle,
) -> Result<Value, Error> {
    eprintln!("[vibe-break:mcp] INFO  tool_call: {tool_name} args={args}");

    let event_type = match tool_name {
        "select_model" => "tool:select_model",
        "play_animation" => "tool:play_animation",
        "set_scale" => "tool:set_scale",
        "set_always_on_top" => "tool:set_always_on_top",
        _ => "tool:call",
    };

    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    let message = pick_tool_message(tool_name, &args);
    let message = if message.is_empty() { None } else { Some(message) };

    let payload = json!({
        "type": event_type,
        "meta": {
            "tool_name": tool_name,
            "args": args,
        },
        "ts": ts,
        "actions": [],
        "message": message,
    });

    let _ = app_handle.emit("mcp:event", payload);

    let response = match tool_name {
        "list_vrm_models" | "list_vrma_animations" | "get_status" => {
            json!({"ok": true, "tool": tool_name, "result": "Data emitted to frontend via mcp:event"})
        }
        "select_model" => {
            let url = args.get("url").and_then(|v| v.as_str()).unwrap_or("");
            json!({"ok": true, "tool": tool_name, "url": url, "message": format!("Switching to model: {url}")})
        }
        "play_animation" => {
            let url = args.get("url").and_then(|v| v.as_str()).unwrap_or("");
            json!({"ok": true, "tool": tool_name, "url": url, "message": format!("Playing animation: {url}")})
        }
        "set_scale" => {
            let scale = args.get("scale").and_then(|v| v.as_f64()).unwrap_or(1.0);
            json!({"ok": true, "tool": tool_name, "scale": scale, "message": format!("Scale set to {scale}")})
        }
        "set_always_on_top" => {
            let on_top = args.get("on_top").and_then(|v| v.as_bool()).unwrap_or(false);
            json!({"ok": true, "tool": tool_name, "on_top": on_top, "message": format!("Always on top: {on_top}")})
        }
        _ => {
            json!({"ok": true, "tool": tool_name})
        }
    };

    Ok(response)
}