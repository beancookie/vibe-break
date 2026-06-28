use serde_json::Value;

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
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

pub fn parse_event_type(tool_name: &str) -> &'static str {
    match tool_name {
        "report_write" => "trigger:write",
        "report_read" => "trigger:read",
        "report_bash" => "trigger:exec",
        "report_search" => "trigger:search",
        "report_done" => "thinking:end",
        "report_error" => "system:error",
        _ => "thinking",
    }
}

pub fn parse_event(tool_input: Option<&Value>) -> Vec<ActionCommand> {
    tool_input
        .and_then(|input| input.get("actions"))
        .and_then(|v| serde_json::from_value::<Vec<ActionCommand>>(v.clone()).ok())
        .unwrap_or_default()
}
