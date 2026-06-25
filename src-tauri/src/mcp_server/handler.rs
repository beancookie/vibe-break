use pmcp::{Error, RequestHandlerExtra};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use super::event::parse_event;

pub(super) async fn handle(
    args: Value,
    _extra: RequestHandlerExtra,
    app_handle: AppHandle,
) -> Result<Value, Error> {
    let tool_name = args["tool_name"].as_str().unwrap_or("");
    let tool_input = args.get("tool_input");
    let ts = args["ts"].as_f64().unwrap_or(0.0) as u64;

    eprintln!(
        "[vibe-break:mcp] INFO  report_event: tool_name={tool_name} ts={ts}"
    );

    let parsed = parse_event(tool_name, tool_input);

    eprintln!(
        "[vibe-break:mcp] DEBUG  → mapped: type={} meta={}",
        parsed.event_type, parsed.meta,
    );

    let payload = json!({
        "type": parsed.event_type,
        "meta": parsed.meta,
        "ts": ts,
    });

    let result = app_handle.emit("mcp:event", payload);

    match result {
        Ok(_) => eprintln!("[vibe-break:mcp] DEBUG  → emitted \"mcp:event\" OK"),
        Err(e) => eprintln!("[vibe-break:mcp] WARN  → emit failed: {e}"),
    }

    Ok(json!({"ok": true}))
}
