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

    eprintln!(
        "[vibe-break:mcp] DEBUG  → raw tool_input: {:?}",
        tool_input,
    );

    let parsed = parse_event(tool_name, tool_input);

    eprintln!(
        "[vibe-break:mcp] DEBUG  → mapped: type={} actions={}",
        parsed.event_type, parsed.actions.len(),
    );

    for (i, a) in parsed.actions.iter().enumerate() {
        eprintln!(
            "[vibe-break:mcp] DEBUG  → action[{}]: type={} name={:?} url={:?}",
            i, a.action_type, a.name, a.url,
        );
    }

    let actions: Vec<Value> = parsed
        .actions
        .iter()
        .map(|a| {
            json!({
                "type": a.action_type,
                "name": a.name,
                "url": a.url,
                "weight": a.weight,
                "bone": a.bone,
                "x": a.x,
                "y": a.y,
                "z": a.z,
            })
        })
        .collect();

    eprintln!(
        "[vibe-break:mcp] DEBUG  → final actions payload: {:?}",
        actions,
    );

    let payload = json!({
        "type": parsed.event_type,
        "meta": parsed.meta,
        "ts": ts,
        "actions": actions,
        "message": parsed.message,
    });

    let result = app_handle.emit("mcp:event", payload);

    match result {
        Ok(_) => eprintln!("[vibe-break:mcp] DEBUG  → emitted \"mcp:event\" OK"),
        Err(e) => eprintln!("[vibe-break:mcp] WARN  → emit failed: {e}"),
    }

    Ok(json!({"ok": true}))
}
