use serde_json::{json, Value};

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ActionCommand {
    #[serde(rename = "type")]
    pub action_type: String,
    pub name: Option<String>,
    pub url: Option<String>,
    pub weight: Option<f32>,
    pub bone: Option<String>,
    pub x: Option<f32>,
    pub y: Option<f32>,
    pub z: Option<f32>,
}

pub struct ParsedEvent {
    pub event_type: &'static str,
    pub meta: Value,
    pub actions: Vec<ActionCommand>,
}

pub fn parse_event(tool_name: &str, tool_input: Option<&Value>) -> ParsedEvent {
    let event_type = match tool_name {
        "Write" => "trigger:write",
        "Exec" => "trigger:exec",
        "Read" => "trigger:read",
        "Stop" => "thinking:end",
        _ => "thinking",
    };

    let actions = tool_input
        .and_then(|input| input.get("actions"))
        .and_then(|v| serde_json::from_value::<Vec<ActionCommand>>(v.clone()).ok())
        .unwrap_or_default();

    ParsedEvent { event_type, meta: json!({"tool_name": tool_name}), actions }
}

